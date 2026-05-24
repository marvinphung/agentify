from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.conversation_state import resolve_pending_order_intent
from app.agent.invoice import build_invoice_payload
from app.agent.llm import plan_with_llm
from app.agent.schemas import AgentPlan, AgentUiEvent, InvoicePayload, ToolResult
from app.agent.tools import check_stock, create_draft_order, search_products
from app.models import AgentAction, Conversation, Message, Order


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
        order_result, order = create_draft_order(
            db,
            conversation_id=conversation.id,
            customer_id=customer_id,
            plan=plan,
            product_result=product_result,
            stock_result=stock_result,
        )
        actions.append(order_result)
        if order_result.status == "success" and order is not None:
            conversation.status = "order_created"
            order = db.get(Order, order.id) or order
            invoice = build_invoice_payload(order)
            ui_events.append(
                AgentUiEvent(
                    type="invoice_ready",
                    status="success",
                    title="Hóa đơn tạm tính sẵn sàng",
                    detail=f"Đơn #{order.id} tổng {int(order.total):,}đ đã được tạo."
                )
            )
            reply = _order_reply(product_result, plan.slots.quantity, order)
        else:
            conversation.status = "open"
            reply = _missing_info_reply(plan, order_result)
    else:
        conversation.status = _status_from_intent(plan.intent)
        reply = _stock_reply(product_result, stock_result)

    actions.append(ToolResult(type="reply", status="success", summary=reply))
    _persist_actions(db, conversation.id, actions)
    _persist_ai_message(db, conversation.id, reply)
    return plan, reply, actions, order, invoice, ui_events


def _stock_reply(product_result: ToolResult, stock_result: ToolResult) -> str:
    if product_result.status != "success":
        return f"Dạ em chưa tìm thấy sản phẩm phù hợp. {product_result.summary}"
    return f"Dạ {stock_result.summary}"


def _missing_info_reply(plan: AgentPlan, order_result: ToolResult) -> str:
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


def _status_from_intent(intent: str) -> str:
    if intent == "ask_stock":
        return "open"
    if intent == "order_status":
        return "order_pending"
    return "open"


def _has_required_order_fields(plan: AgentPlan) -> bool:
    return bool(plan.slots.product_query) and bool(plan.slots.customer_phone) and bool(plan.slots.shipping_address)


def _missing_order_fields(plan: AgentPlan) -> list[str]:
    fields: list[str] = []
    if not plan.slots.product_query:
        fields.append("sản phẩm")
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
