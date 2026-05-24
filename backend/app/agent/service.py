from __future__ import annotations

from copy import deepcopy
import json

import httpx
from sqlalchemy import desc
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.conversation_state import resolve_pending_order_intent
from app.agent.invoice import build_invoice_payload
from app.agent.llm import plan_with_llm
from app.agent.schemas import AgentPlan, AgentUiEvent, InvoicePayload, ToolResult
from app.agent.tools import check_stock, create_draft_order, search_product_recommendations, search_products
from app.config import get_settings
from app.models import AgentAction, Conversation, Message, Order, ProductCache
from app.shared.workspace import DEFAULT_WORKSPACE_ID
from app.shared.text import normalize_text


CONFIRM_WORDS = ("dung", "dung roi", "ok", "oki", "okay", "xac nhan", "chot", "chot don", "dong y", "duoc")
REJECT_WORDS = ("sai", "khong dung", "chua dung", "doi lai", "sua", "nham")
ORDER_SUPPORT_WORDS = ("hoan tien", "doi hang", "tra hang", "huy don", "don tre", "giao cham", "chua nhan", "kiem tra don", "trang thai don")
APPOINTMENT_WORDS = ("soi da", "dat lich", "lich tu van", "tu van mun", "hen", "clinic")


GENERAL_LLM_PROMPT = """Bạn là nhân viên AI tiếng Việt cho Lumi Beauty, shop mỹ phẩm online dùng Agentify.
Trả JSON thuần:
{
  "reply": "tin nhắn ngắn gửi khách",
  "actions": ["việc đã làm"],
  "quick_replies": ["0-4 lựa chọn ngắn nếu thật sự cần"]
}

Quy tắc:
- Nếu khách chưa chốt mua, không hỏi tên/SĐT/địa chỉ.
- Nếu khách chỉ tư vấn sản phẩm, hãy dùng context sản phẩm để gợi ý tự nhiên.
- Nếu khách muốn đặt hàng nhưng thiếu thông tin, hỏi từng nhóm thông tin cần thiết.
- Không tạo hóa đơn, không nói đã tạo đơn nếu context chưa có order/invoice.
- Với hoàn tiền/đổi trả/hủy đơn, hỏi mã đơn hoặc SĐT nếu chưa có; nếu có lịch sử đơn thì nhắc đơn gần nhất.
- Trả lời đúng ngữ cảnh hội thoại, không lặp lại kịch bản cứng.
"""


async def process_customer_message(
    db: Session,
    *,
    conversation: Conversation,
    customer_id: int,
    customer_name: str,
    customer_phone: str | None,
    message: str,
) -> tuple[AgentPlan, str, list[ToolResult], Order | None, InvoicePayload | None, list[AgentUiEvent]]:
    plan = await plan_with_llm(message, customer_name=customer_name, customer_phone=customer_phone)
    if customer_phone and not plan.slots.customer_phone:
        plan.slots.customer_phone = customer_phone
    if customer_name and not plan.slots.customer_name:
        plan.slots.customer_name = customer_name
    plan = resolve_pending_order_intent(db, conversation.id, current=plan, current_message=message)

    actions: list[ToolResult] = [
        ToolResult(type="intent_detected", status="success", summary=f"Ý định: {plan.intent} ({plan.source}).", data=plan.model_dump())
    ]
    order: Order | None = None
    invoice: InvoicePayload | None = None
    ui_events: list[AgentUiEvent] = []

    pending_confirmation = _latest_pending_confirmation(db, conversation.id)
    if pending_confirmation:
        handled = _handle_pending_confirmation(
            db,
            pending_confirmation=pending_confirmation,
            conversation=conversation,
            customer_id=customer_id,
            message=message,
            actions=actions,
        )
        if handled:
            reply, order, invoice, ui_events = handled
            actions.append(ToolResult(type="reply", status="success", summary=reply))
            _persist_actions(db, conversation.id, actions)
            _persist_ai_message(db, conversation.id, reply)
            return plan, reply, actions, order, invoice, ui_events

    if plan.intent == "product_consultation":
        recommendation_result = search_product_recommendations(db, plan.slots.product_query)
        actions.append(recommendation_result)
        conversation.status = "open"
        reply = _consultation_reply(recommendation_result, plan.slots.product_query)
        actions.append(ToolResult(type="reply", status="success", summary=reply))
        _persist_actions(db, conversation.id, actions)
        _persist_ai_message(db, conversation.id, reply)
        return plan, reply, actions, None, None, ui_events

    if _is_order_support_message(message):
        conversation.status = "needs_review"
        reply = _order_support_reply(db, conversation.id, customer_name, customer_phone)
        actions.append(ToolResult(type="order_support", status="success", summary="Nhận diện kịch bản sau mua/hoàn tiền/đổi trả/hủy đơn."))
        actions.append(ToolResult(type="reply", status="success", summary=reply))
        _persist_actions(db, conversation.id, actions)
        _persist_ai_message(db, conversation.id, reply)
        return plan, reply, actions, None, None, [
            AgentUiEvent(type="handoff_review", status="info", title="Cần nhân viên theo dõi", detail="Khách đang hỏi sau mua hoặc yêu cầu hoàn tiền/đổi trả/hủy đơn.")
        ]

    if _is_appointment_message(message):
        conversation.status = "appointment_pending"
        reply = "Dạ Lumi Beauty có thể soi da và tư vấn routine cho mình. Chị cho em xin ngày/khung giờ chị tiện ghé, em sẽ kiểm tra lịch trống cho chị nhé."
        actions.append(ToolResult(type="appointment_intent", status="success", summary="Nhận diện nhu cầu đặt lịch/tư vấn da."))
        actions.append(ToolResult(type="reply", status="success", summary=reply))
        _persist_actions(db, conversation.id, actions)
        _persist_ai_message(db, conversation.id, reply)
        return plan, reply, actions, None, None, [
            AgentUiEvent(type="appointment_pending", status="info", title="Khách muốn đặt lịch", detail="Agentify đang xin khung giờ phù hợp.")
        ]

    if plan.intent == "unknown":
        llm_reply = await _reply_with_general_llm(db, conversation.id, message, customer_name, customer_phone)
        if llm_reply:
            conversation.status = "open"
            reply = llm_reply["reply"]
            actions.extend(ToolResult(type="llm_context_reply", status="success", summary=summary) for summary in llm_reply.get("actions", []))
            actions.append(ToolResult(type="reply", status="success", summary=reply, data={"quick_replies": llm_reply.get("quick_replies", [])}))
            _persist_actions(db, conversation.id, actions)
            _persist_ai_message(db, conversation.id, reply)
            return plan, reply, actions, None, None, ui_events

    if "ask_clarification" in plan.tool_plan and not _has_required_order_fields(plan):
        missing_fields = _missing_order_fields(plan)
        reply = plan.reply_if_missing or f"Dạ em cần thêm thông tin: {', '.join(missing_fields)} để lên đơn giúp chị."
        actions.append(ToolResult(type="reply", status="success", summary=reply))
        _persist_actions(db, conversation.id, actions)
        _persist_ai_message(db, conversation.id, reply)
        ui_events.append(
            AgentUiEvent(
                type="order_clarification",
                status="info",
                title="Cần bổ sung thông tin",
                detail="Khách hàng chưa cung cấp đủ sản phẩm/địa chỉ/SĐT."
            )
        )
        return plan, reply, actions, None, None, ui_events

    product_result = search_products(db, plan.slots.product_query)
    actions.append(product_result)
    stock_result = check_stock(product_result, plan.slots.quantity)
    actions.append(stock_result)

    if plan.intent == "buy_product" or "create_draft_order" in plan.tool_plan:
        if stock_result.status == "success" and _has_required_order_fields(plan):
            conversation.status = "order_pending"
            confirmation_action = _persist_pending_confirmation(db, conversation.id, plan)
            actions.append(
                ToolResult(
                    type="order_confirmation_pending",
                    status="pending",
                    summary=confirmation_action.summary,
                    data=confirmation_action.raw_json,
                )
            )
            ui_events.append(
                AgentUiEvent(
                    type="order_confirmation_pending",
                    status="info",
                    title="Chờ khách xác nhận thông tin đơn",
                    detail="Agentify đã đọc lại sản phẩm, tên, SĐT và địa chỉ trước khi tạo hóa đơn."
                )
            )
            reply = _confirmation_reply(product_result, plan)
        else:
            conversation.status = "open"
            reply = _missing_info_reply(plan, ToolResult(type="order_create", status="skipped", summary="Chưa tạo hóa đơn vì thiếu xác nhận hoặc thông tin đơn."))
    else:
        conversation.status = _status_from_intent(plan.intent)
        reply = _stock_reply(product_result, stock_result)

    actions.append(ToolResult(type="reply", status="success", summary=reply))
    _persist_actions(db, conversation.id, actions)
    _persist_ai_message(db, conversation.id, reply)
    return plan, reply, actions, order, invoice, ui_events


def _latest_pending_confirmation(db: Session, conversation_id: int) -> AgentAction | None:
    return db.scalar(
        select(AgentAction)
        .where(
            AgentAction.conversation_id == conversation_id,
            AgentAction.action_type == "order_confirmation_pending",
            AgentAction.status == "pending",
        )
        .order_by(AgentAction.created_at.desc(), AgentAction.id.desc())
    )


def _handle_pending_confirmation(
    db: Session,
    *,
    pending_confirmation: AgentAction,
    conversation: Conversation,
    customer_id: int,
    message: str,
    actions: list[ToolResult],
) -> tuple[str, Order | None, InvoicePayload | None, list[AgentUiEvent]] | None:
    normalized = normalize_text(message)
    if any(word in normalized for word in REJECT_WORDS):
        pending_confirmation.status = "cancelled"
        reply = "Dạ chị gửi lại giúp em thông tin cần sửa: sản phẩm, số lượng, tên người nhận, SĐT hoặc địa chỉ. Em sẽ kiểm tra lại trước khi tạo hóa đơn."
        actions.append(ToolResult(type="order_confirmation_cancelled", status="success", summary="Khách báo thông tin chưa đúng, chưa tạo hóa đơn."))
        return reply, None, None, [
            AgentUiEvent(type="order_confirmation_cancelled", status="info", title="Khách cần sửa thông tin", detail="Hóa đơn chưa được tạo.")
        ]
    if not any(word in normalized for word in CONFIRM_WORDS):
        return None

    plan = AgentPlan.model_validate(pending_confirmation.raw_json.get("plan") or {})
    product_result = search_products(db, plan.slots.product_query)
    stock_result = check_stock(product_result, plan.slots.quantity)
    actions.append(product_result)
    actions.append(stock_result)
    order_result, order = create_draft_order(
        db,
        conversation_id=conversation.id,
        customer_id=customer_id,
        plan=plan,
        product_result=product_result,
        stock_result=stock_result,
    )
    actions.append(order_result)
    if order_result.status != "success" or order is None:
        pending_confirmation.status = "failed"
        conversation.status = "open"
        return _missing_info_reply(plan, order_result), None, None, []

    pending_confirmation.status = "confirmed"
    conversation.status = "order_created"
    order = db.get(Order, order.id) or order
    invoice = build_invoice_payload(order)
    reply = _order_reply(product_result, plan.slots.quantity, order)
    return reply, order, invoice, [
        AgentUiEvent(
            type="invoice_ready",
            status="success",
            title="Hóa đơn điện tử đã được tạo",
            detail=f"Đơn #{order.id} tổng {int(order.total):,}đ đã được tạo sau khi khách xác nhận."
        )
    ]


def _persist_pending_confirmation(db: Session, conversation_id: int, plan: AgentPlan) -> AgentAction:
    for action in db.scalars(
        select(AgentAction).where(
            AgentAction.conversation_id == conversation_id,
            AgentAction.action_type == "order_confirmation_pending",
            AgentAction.status == "pending",
        )
    ):
        action.status = "superseded"
    pending = AgentAction(
        conversation_id=conversation_id,
        action_type="order_confirmation_pending",
        status="pending",
        summary="Đã kiểm tra đủ thông tin, chờ khách xác nhận trước khi tạo hóa đơn.",
        raw_json={"plan": deepcopy(plan.model_dump())},
    )
    db.add(pending)
    db.flush()
    return pending


def _is_order_support_message(message: str) -> bool:
    normalized = normalize_text(message)
    return any(word in normalized for word in ORDER_SUPPORT_WORDS)


def _is_appointment_message(message: str) -> bool:
    normalized = normalize_text(message)
    return any(word in normalized for word in APPOINTMENT_WORDS)


def _order_support_reply(db: Session, conversation_id: int, customer_name: str | None, customer_phone: str | None) -> str:
    order = _latest_order_for_customer(db, customer_phone)
    display_name = customer_name if customer_name and customer_name != "Khách Zalo" else "chị"
    if order:
        first_item = "sản phẩm"
        if order.items and isinstance(order.items[0], dict):
            first_item = order.items[0].get("name") or first_item
        return (
            f"Dạ {display_name}, em đã tra lịch sử mua hàng và thấy đơn gần nhất #{order.id} gồm {first_item}, "
            f"tổng {int(order.total):,}đ. Em đã ghi nhận yêu cầu của chị và chuyển nhân viên kiểm tra chính sách xử lý đơn này. "
            "Chị mô tả thêm giúp em lý do muốn hoàn tiền/đổi trả/hủy đơn nhé."
        )
    return (
        f"Dạ {display_name}, để kiểm tra yêu cầu hoàn tiền/đổi trả/hủy đơn, chị gửi giúp em mã đơn hoặc số điện thoại đã đặt hàng. "
        "Em sẽ tra đơn gần nhất rồi chuyển nhân viên xử lý đúng chính sách cho chị."
    )


def _latest_order_for_customer(db: Session, customer_phone: str | None) -> Order | None:
    if not customer_phone:
        return None
    return db.scalar(
        select(Order)
        .where(Order.workspace_id == DEFAULT_WORKSPACE_ID, Order.customer_phone == customer_phone)
        .order_by(desc(Order.created_at), desc(Order.id))
    )


async def _reply_with_general_llm(db: Session, conversation_id: int, message: str, customer_name: str | None, customer_phone: str | None) -> dict | None:
    settings = get_settings()
    if not settings.llm_api_key:
        return None
    products = list(
        db.scalars(
            select(ProductCache)
            .where(ProductCache.workspace_id == DEFAULT_WORKSPACE_ID)
            .order_by(ProductCache.name)
            .limit(60)
        )
    )
    history_rows = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(desc(Message.created_at), desc(Message.id))
            .limit(16)
        )
    )
    history_rows.reverse()
    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": GENERAL_LLM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "message": message,
                        "customer_name": customer_name,
                        "customer_phone": customer_phone,
                        "conversation_history": [
                            {"role": "assistant" if row.sender == "ai" else "user", "content": row.content}
                            for row in history_rows
                        ],
                        "available_products": [
                            {"name": product.name, "price": float(product.base_price), "stock": product.stock}
                            for product in products
                        ],
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.llm_http_referer,
        "X-OpenRouter-Title": settings.llm_app_title,
    }
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.post(f"{settings.llm_base_url.rstrip('/')}/chat/completions", headers=headers, json=payload)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"].get("content")
        parsed = json.loads(content) if content else None
        if not isinstance(parsed, dict) or not parsed.get("reply"):
            return None
        return {
            "reply": str(parsed.get("reply")),
            "actions": [str(item) for item in parsed.get("actions", [])[:4] if item],
            "quick_replies": [str(item) for item in parsed.get("quick_replies", [])[:4] if item],
        }
    except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None


def _stock_reply(product_result: ToolResult, stock_result: ToolResult) -> str:
    if product_result.status != "success":
        return f"Dạ em chưa tìm thấy sản phẩm phù hợp. {product_result.summary}"
    return f"Dạ {stock_result.summary}"


def _consultation_reply(recommendation_result: ToolResult, query: str | None) -> str:
    products = recommendation_result.data.get("products") or []
    if recommendation_result.status != "success" or not products:
        return f"Dạ em chưa tìm thấy sản phẩm phù hợp với nhu cầu {query or 'này'}. Chị mô tả thêm loại da hoặc ngân sách để em tư vấn sát hơn nhé."
    lines = [
        "Dạ em đang tìm trong danh sách sản phẩm KiotViet của shop và thấy các lựa chọn phù hợp:",
    ]
    for index, product in enumerate(products[:4], start=1):
        price = int(product.get("price") or 0)
        stock = int(product.get("stock") or 0)
        lines.append(f"{index}. {product.get('name')} - {price:,}đ, còn {stock}.")
    lines.append("Chị cho em biết da dầu, da khô, da mụn hay da nhạy cảm để em chốt loại phù hợp nhất nhé.")
    return "\n".join(lines)


def _missing_info_reply(plan: AgentPlan, order_result: ToolResult) -> str:
    if not plan.slots.customer_name:
        return "Dạ sản phẩm còn hàng. Chị cho em xin tên người nhận để em lên thông tin đơn nhé."
    if not plan.slots.customer_phone:
        return "Dạ sản phẩm còn hàng. Chị cho em xin số điện thoại để em lên đơn nhé."
    if not plan.slots.shipping_address:
        return "Dạ sản phẩm còn hàng. Chị cho em xin địa chỉ giao hàng để em lên đơn nhé."
    return f"Dạ em chưa thể tạo đơn. {order_result.summary}"


def _order_reply(product_result: ToolResult, quantity: int, order: Order | None) -> str:
    name = product_result.data.get("name", "sản phẩm")
    order_code = f"#{order.id}" if order else ""
    total = int(order.total) if order else 0
    return f"Dạ em đã tạo đơn nháp {order_code} và gửi hóa đơn tạm tính trong khung chat: {quantity} {name}, tổng {total:,}đ. Em đang chuyển kết quả cho nhân viên theo dõi đơn."


def _confirmation_reply(product_result: ToolResult, plan: AgentPlan) -> str:
    name = product_result.data.get("name", plan.slots.product_query or "sản phẩm")
    quantity = max(plan.slots.quantity, 1)
    price = int(product_result.data.get("base_price") or 0)
    total = price * quantity
    return (
        "Dạ em kiểm tra sản phẩm còn hàng. Chị xác nhận giúp em thông tin trước khi em tạo hóa đơn điện tử nhé:\n"
        f"- Sản phẩm: {quantity} {name}\n"
        f"- Tổng tạm tính: {total:,}đ\n"
        f"- Người nhận: {plan.slots.customer_name}\n"
        f"- SĐT: {plan.slots.customer_phone}\n"
        f"- Địa chỉ: {plan.slots.shipping_address}\n"
        "Nếu đúng, chị nhắn \"đúng rồi\" hoặc \"xác nhận\". Nếu sai, chị gửi lại thông tin cần sửa giúp em."
    )


def _status_from_intent(intent: str) -> str:
    if intent == "ask_stock":
        return "open"
    if intent == "product_consultation":
        return "open"
    if intent == "order_status":
        return "order_pending"
    return "open"


def _has_required_order_fields(plan: AgentPlan) -> bool:
    return bool(plan.slots.product_query) and bool(plan.slots.customer_name) and bool(plan.slots.customer_phone) and bool(plan.slots.shipping_address)


def _missing_order_fields(plan: AgentPlan) -> list[str]:
    fields: list[str] = []
    if not plan.slots.product_query:
        fields.append("sản phẩm")
    if not plan.slots.customer_name:
        fields.append("tên người nhận")
    if not plan.slots.customer_phone:
        fields.append("số điện thoại")
    if not plan.slots.shipping_address:
        fields.append("địa chỉ giao hàng")
    if not fields:
        fields.append("thông tin bổ sung")
    return fields


def _persist_actions(db: Session, conversation_id: int, actions: list[ToolResult]) -> None:
    for action in actions:
        db.add(
            AgentAction(
                conversation_id=conversation_id,
                action_type=action.type,
                status=action.status,
                summary=action.summary,
                raw_json=action.data,
            )
        )


def _persist_ai_message(db: Session, conversation_id: int, reply: str) -> None:
    db.add(Message(conversation_id=conversation_id, sender="ai", content=reply))
