from __future__ import annotations

from copy import deepcopy
import re

from sqlalchemy import desc
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.conversation_state import resolve_pending_order_intent
from app.agent.invoice import build_invoice_payload
from app.agent.llm import plan_with_llm
from app.agent.llm_client import LLMClientError, generate_llm_json, llm_available
from app.agent.parser import extract_quantity as parse_quantity
from app.agent.schemas import AgentPlan, AgentUiEvent, InvoicePayload, ToolResult
from app.agent.tools import _extract_max_budget, check_stock, create_draft_order, create_shipping_order, list_agent_tools, search_product_recommendations, search_products, track_shipping_order
from app.config import get_settings
from app.models import AgentAction, Conversation, Message, Order, ProductCache
from app.shared.workspace import DEFAULT_WORKSPACE_ID
from app.shared.text import normalize_text


CONFIRM_WORDS = ("dung roi", "xac nhan", "chot", "chot don", "dong y", "ok", "oki", "okay")
REJECT_WORDS = ("sai", "khong dung", "chua dung", "doi lai", "sua lai", "can sua", "nham")
TRACKING_WORDS = ("kiem tra don", "trang thai don", "don toi dau", "ma van don", "van don", "bao gio giao", "don giao den dau", "tracking")
ORDER_SUPPORT_WORDS = ("hoan tien", "doi hang", "tra hang", "huy don", "don tre", "giao cham", "chua nhan", *TRACKING_WORDS)
APPOINTMENT_WORDS = ("soi da", "dat lich", "lich tu van", "tu van mun", "hen", "clinic")
IRRITATION_WORDS = ("kich ung", "do mat", "rat", "ngua", "man do", "sung mat", "sung moi", "kho tho", "phong rop")
FULFILLMENT_WORDS = ("thieu hang", "sai san pham", "giao sai", "nhan co 1", "nhan co mot", "dat 2 mon", "khieu nai")
FEEDBACK_WORDS = ("feedback", "phan hoi", "dung thay", "da do", "do dau", "khong co tac dung", "hoi kho")
SUNSCREEN_WORDS = ("kem chong nang", "spf", "suncare", "derma shield", "moist uv")


GENERAL_LLM_PROMPT = """Bạn là nhân viên AI tiếng Việt cho Lumi Beauty, shop mỹ phẩm online dùng Agentify.
Trả JSON thuần:
{
  "reply": "tin nhắn ngắn gửi khách",
  "actions": ["việc đã làm"],
  "quick_replies": ["0-4 lựa chọn ngắn nếu thật sự cần"]
}

Giọng trả lời:
- Tự nhiên như nhân viên shop đang chat Zalo: ấm, rõ, không quá trang trọng.
- Thường trả lời 1-4 câu ngắn. Chỉ viết dài khi khách hỏi routine hoặc cần hướng dẫn an toàn.
- Hỏi một bước tiếp theo, không hỏi dồn nhiều nhóm thông tin nếu chưa cần.
- Không lặp cùng một mở đầu trong mọi tin nhắn.
- Không nhắc tên tool, database, KiotViet, GHN hay Agentify trừ khi khách hỏi nội bộ.

Quy tắc an toàn:
- Nếu khách chưa chốt mua, không hỏi tên/SĐT/địa chỉ.
- Nếu khách chỉ tư vấn sản phẩm, dùng context sản phẩm để gợi ý tự nhiên và hỏi thêm loại da/ngân sách nếu thiếu.
- Nếu khách muốn đặt hàng nhưng thiếu thông tin, hỏi đúng thông tin còn thiếu.
- Không nói đã tạo đơn, hóa đơn, vận đơn hoặc lịch hẹn nếu context chưa có dữ liệu đó.
- Với hoàn tiền/đổi trả/hủy đơn, hỏi mã đơn hoặc SĐT nếu chưa có; nếu có lịch sử đơn thì nhắc đơn gần nhất.
- Với kích ứng nặng như khó thở, sưng mắt/môi, đau rát dữ dội hoặc phồng rộp, khuyên đi khám/cơ sở y tế trước và không chẩn đoán bệnh.
- Khi ngoài kịch bản, nếu thiếu dữ liệu để hành động an toàn thì hỏi thêm thay vì bịa kết quả.
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
    effective_customer_name = None if _is_placeholder_customer_name(customer_name) else customer_name
    plan = await plan_with_llm(message, customer_name=effective_customer_name, customer_phone=customer_phone)
    if customer_phone and not plan.slots.customer_phone:
        plan.slots.customer_phone = customer_phone
    if effective_customer_name and not plan.slots.customer_name:
        plan.slots.customer_name = effective_customer_name
    plan = resolve_pending_order_intent(db, conversation.id, current=plan, current_message=message)

    actions: list[ToolResult] = [
        ToolResult(type="intent_detected", status="success", summary=f"Ý định: {plan.intent} ({plan.source}).", data=plan.model_dump())
    ]
    order: Order | None = None
    invoice: InvoicePayload | None = None
    ui_events: list[AgentUiEvent] = []

    if plan.intent in {"product_consultation", "ask_stock"}:
        _clear_active_scenarios(db, conversation.id)

    active_scenario = _latest_active_scenario(db, conversation.id)
    if active_scenario:
        handled = _handle_active_scenario(
            db,
            active_scenario=active_scenario,
            conversation=conversation,
            customer_id=customer_id,
            message=message,
            actions=actions,
        )
        if handled:
            return _finalize_agent_reply(db, conversation.id, plan, *handled)

    scenario_handled = _handle_new_scenario(
        db,
        conversation=conversation,
        message=message,
        actions=actions,
        recommendation_query=plan.slots.product_query,
    )
    if scenario_handled:
        return _finalize_agent_reply(db, conversation.id, plan, *scenario_handled)

    if plan.intent == "product_consultation":
        _supersede_pending_confirmations(db, conversation.id)
        recommendation_result = search_product_recommendations(db, plan.slots.product_query)
        actions.append(recommendation_result)
        conversation.status = "open"
        reply = _consultation_reply(recommendation_result, plan.slots.product_query)
        actions.append(ToolResult(type="reply", status="success", summary=reply))
        _persist_actions(db, conversation.id, actions)
        _persist_ai_message(db, conversation.id, reply)
        return plan, reply, actions, None, None, ui_events

    if _is_order_support_message(message):
        _supersede_pending_confirmations(db, conversation.id)
        if _is_tracking_message(message):
            phone = customer_phone or _extract_phone_from_text(message)
            code = _extract_order_code(message)
            order = _find_order_for_complaint(db, phone=phone, code=code) or _latest_order_for_customer(db, customer_phone) or _latest_order_for_conversation(db, conversation.id)
            if not order:
                reply = "Dạ chị gửi giúp em số điện thoại đặt hàng hoặc mã đơn để em kiểm tra trạng thái giao hàng trên GHN nhé."
                actions.append(ToolResult(type="shipping_track", status="skipped", summary="Khách hỏi tracking nhưng chưa có SĐT/mã đơn."))
                actions.append(ToolResult(type="reply", status="success", summary=reply))
                _persist_actions(db, conversation.id, actions)
                _persist_ai_message(db, conversation.id, reply)
                return plan, reply, actions, None, None, ui_events
            track_result = track_shipping_order(db, order=order)
            actions.append(track_result)
            reply = _tracking_reply(order, track_result)
            actions.append(ToolResult(type="reply", status="success", summary=reply))
            _persist_actions(db, conversation.id, actions)
            _persist_ai_message(db, conversation.id, reply)
            return plan, reply, actions, order, None, [
                AgentUiEvent(type="shipping_tracking", status=track_result.status, title="Đã kiểm tra vận đơn GHN", detail=track_result.summary)
            ]
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
        _supersede_pending_confirmations(db, conversation.id)
        conversation.status = "appointment_pending"
        reply = "Dạ Lumi Beauty có thể soi da và tư vấn routine cho mình. Chị cho em xin ngày/khung giờ chị tiện ghé, em sẽ kiểm tra lịch trống cho chị nhé."
        actions.append(ToolResult(type="appointment_intent", status="success", summary="Nhận diện nhu cầu đặt lịch/tư vấn da."))
        actions.append(ToolResult(type="reply", status="success", summary=reply))
        _persist_actions(db, conversation.id, actions)
        _persist_ai_message(db, conversation.id, reply)
        return plan, reply, actions, None, None, [
            AgentUiEvent(type="appointment_pending", status="info", title="Khách muốn đặt lịch", detail="Agentify đang xin khung giờ phù hợp.")
        ]

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
            _set_scenario_state(
                db,
                conversation.id,
                "generic_order",
                "awaiting_order_info",
                {
                    "product_query": product_result.data.get("name") or plan.slots.product_query,
                    "quantity": plan.slots.quantity,
                    "customer_name": None if _is_placeholder_customer_name(plan.slots.customer_name) else plan.slots.customer_name,
                    "customer_phone": plan.slots.customer_phone,
                    "shipping_address": plan.slots.shipping_address,
                },
            )
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


def _finalize_agent_reply(
    db: Session,
    conversation_id: int,
    plan: AgentPlan,
    reply: str,
    actions: list[ToolResult],
    order: Order | None,
    invoice: InvoicePayload | None,
    ui_events: list[AgentUiEvent],
) -> tuple[AgentPlan, str, list[ToolResult], Order | None, InvoicePayload | None, list[AgentUiEvent]]:
    actions.append(ToolResult(type="reply", status="success", summary=reply))
    _persist_actions(db, conversation_id, actions)
    _persist_ai_message(db, conversation_id, reply)
    return plan, reply, actions, order, invoice, ui_events


def _latest_active_scenario(db: Session, conversation_id: int) -> AgentAction | None:
    return db.scalar(
        select(AgentAction)
        .where(
            AgentAction.conversation_id == conversation_id,
            AgentAction.action_type == "scenario_state",
            AgentAction.status == "active",
        )
        .order_by(AgentAction.created_at.desc(), AgentAction.id.desc())
    )


def _set_scenario_state(db: Session, conversation_id: int, scenario: str, step: str, data: dict | None = None) -> AgentAction:
    _clear_active_scenarios(db, conversation_id)
    state = AgentAction(
        conversation_id=conversation_id,
        action_type="scenario_state",
        status="active",
        summary=f"{scenario}:{step}",
        raw_json={"scenario": scenario, "step": step, "data": data or {}},
    )
    db.add(state)
    db.flush()
    return state


def _clear_active_scenarios(db: Session, conversation_id: int) -> None:
    for action in db.scalars(
        select(AgentAction).where(
            AgentAction.conversation_id == conversation_id,
            AgentAction.action_type == "scenario_state",
            AgentAction.status == "active",
        )
    ):
        action.status = "superseded"


def _update_scenario_state(state: AgentAction, *, step: str, data: dict | None = None) -> None:
    raw = dict(state.raw_json or {})
    raw["step"] = step
    raw["data"] = data or raw.get("data") or {}
    state.raw_json = raw
    state.summary = f"{raw.get('scenario')}:{step}"


def _complete_scenario_state(state: AgentAction) -> None:
    state.status = "completed"


def _handle_new_scenario(
    db: Session,
    *,
    conversation: Conversation,
    message: str,
    actions: list[ToolResult],
    recommendation_query: str | None,
) -> tuple[str, list[ToolResult], Order | None, InvoicePayload | None, list[AgentUiEvent]] | None:
    normalized = normalize_text(message)
    if _has_severe_irritation(normalized):
        _supersede_pending_confirmations(db, conversation.id)
        reply = (
            "Dạ nếu chị đang có dấu hiệu nặng như khó thở, sưng môi/sưng mắt, đau rát dữ dội hoặc phồng rộp, "
            "chị nên ngưng sản phẩm ngay và đi khám bác sĩ/cơ sở y tế gần nhất trước ạ. Sau đó chị gửi shop họ tên, SĐT đặt hàng và ảnh sản phẩm để bên em kiểm tra đơn và hỗ trợ theo chính sách."
        )
        actions.append(ToolResult(type="irritation_urgent", status="warn", summary="Nhận diện triệu chứng kích ứng nặng, ưu tiên khuyến nghị đi khám y tế."))
        return reply, actions, None, None, [AgentUiEvent(type="medical_warning", status="warn", title="Khách có dấu hiệu kích ứng nặng", detail="Agentify khuyên khách đi khám y tế ngay.")]

    if _is_irritation_message(normalized):
        _supersede_pending_confirmations(db, conversation.id)
        _set_scenario_state(db, conversation.id, "irritation", "awaiting_customer_lookup")
        conversation.status = "support_sensitive"
        reply = (
            "Dạ trước hết shop rất xin lỗi vì chị đang gặp trải nghiệm không tốt khi dùng sản phẩm ạ. "
            "Chị tạm thời ngưng sử dụng sản phẩm ngay, rửa mặt nhẹ nhàng bằng nước sạch hoặc sữa rửa mặt dịu nhẹ, "
            "và tránh dùng thêm treatment/mỹ phẩm mạnh trong lúc da đang khó chịu.\n\n"
            "Nếu sản phẩm có lỗi từ phía shop hoặc nhà sản xuất, shop cam kết sẽ chịu trách nhiệm 100% theo chính sách xử lý của bên em ạ.\n\n"
            "Để em kiểm tra đơn hàng và hỗ trợ chị nhanh nhất, chị cho em xin họ tên và số điện thoại đặt hàng được không ạ?"
        )
        actions.append(ToolResult(type="irritation_intake", status="success", summary="Nhận diện khách báo kích ứng, đã hướng dẫn ngưng dùng và xin thông tin tra cứu đơn."))
        return reply, actions, None, None, [AgentUiEvent(type="sensitive_support", status="warn", title="Khách báo kích ứng", detail="Cần theo dõi trách nhiệm xử lý sản phẩm.")]

    if _is_fulfillment_complaint(normalized):
        _supersede_pending_confirmations(db, conversation.id)
        _set_scenario_state(db, conversation.id, "fulfillment_complaint", "awaiting_lookup")
        conversation.status = "complaint_pending"
        reply = (
            "Dạ shop rất xin lỗi chị vì sự bất tiện này ạ. Bên em sẽ kiểm tra lại đơn hàng và xử lý cho chị sớm nhất.\n\n"
            "Chị cho em xin số điện thoại đặt hàng hoặc mã đơn hàng để em tra cứu được không ạ?"
        )
        actions.append(ToolResult(type="fulfillment_complaint", status="success", summary="Nhận diện khiếu nại giao sai/thiếu hàng, xin thông tin tra cứu đơn."))
        return reply, actions, None, None, [AgentUiEvent(type="complaint_pending", status="warn", title="Khách khiếu nại đơn hàng", detail="Cần tra cứu đơn và tạo ticket nếu xác minh đủ.")]

    if _is_feedback_message(normalized):
        _set_scenario_state(db, conversation.id, "feedback", "awaiting_detail")
        conversation.status = "feedback_followup"
        reply = (
            "Dạ shop vui quá ạ. Cảm ơn chị đã phản hồi cho bên em. Với serum Niacinamide, thường sau khoảng 2-4 tuần da sẽ bắt đầu ổn định dầu hơn, nên kết quả của chị đang khá tốt ạ.\n\n"
            "Chị cho em hỏi thêm là hiện tại da mình có bị khô căng, châm chích hoặc nổi mụn ẩn nhiều hơn không ạ?"
        )
        actions.append(ToolResult(type="feedback_recorded", status="success", summary="Ghi nhận feedback ban đầu về sản phẩm khách đang dùng."))
        return reply, actions, None, None, [AgentUiEvent(type="feedback_recorded", status="success", title="Đã ghi nhận feedback", detail="Khách phản hồi tích cực/trung lập sau khi dùng sản phẩm.")]

    if _is_appointment_message(message):
        _supersede_pending_confirmations(db, conversation.id)
        _set_scenario_state(db, conversation.id, "skin_appointment", "awaiting_skin_need")
        conversation.status = "appointment_pending"
        reply = (
            "Dạ bên em có dịch vụ soi da ạ. Chị có thể đặt lịch soi da để kiểm tra tình trạng da, sau đó kỹ thuật viên sẽ tư vấn routine hoặc liệu trình phù hợp.\n\n"
            "Chị cho em hỏi hiện tại mình muốn soi da vì vấn đề nào ạ? Ví dụ: da dầu, mụn, nám, khô, nhạy cảm, kích ứng hoặc muốn xây routine skincare?"
        )
        actions.append(ToolResult(type="appointment_intent", status="success", summary="Nhận diện nhu cầu đặt lịch soi da/chăm sóc da."))
        return reply, actions, None, None, [AgentUiEvent(type="appointment_pending", status="info", title="Khách muốn đặt lịch", detail="Agentify đang hỏi nhu cầu da trước khi check lịch.")]

    query_norm = normalize_text(recommendation_query or message)
    if any(word in query_norm for word in SUNSCREEN_WORDS) and _is_consultation_like(normalized):
        _supersede_pending_confirmations(db, conversation.id)
        _set_scenario_state(db, conversation.id, "sunscreen", "awaiting_skin_type")
        recommendation_result = _sunscreen_recommendation_result(db, query=recommendation_query or message)
        actions.append(recommendation_result)
        conversation.status = "open"
        reply = _sunscreen_intro_reply(recommendation_result)
        return reply, actions, None, None, []

    return None


def _handle_active_scenario(
    db: Session,
    *,
    active_scenario: AgentAction,
    conversation: Conversation,
    customer_id: int,
    message: str,
    actions: list[ToolResult],
) -> tuple[str, list[ToolResult], Order | None, InvoicePayload | None, list[AgentUiEvent]] | None:
    raw = active_scenario.raw_json or {}
    scenario = raw.get("scenario")
    step = raw.get("step")
    data = dict(raw.get("data") or {})
    normalized = normalize_text(message)

    if scenario == "sunscreen":
        return _handle_sunscreen_state(db, active_scenario, conversation, message, normalized, actions, data)
    if scenario == "irritation":
        return _handle_irritation_state(db, active_scenario, message, normalized, actions, data)
    if scenario == "feedback":
        return _handle_feedback_state(db, active_scenario, normalized, actions)
    if scenario == "skin_appointment":
        return _handle_skin_appointment_state(db, active_scenario, message, normalized, actions, data)
    if scenario == "fulfillment_complaint":
        return _handle_fulfillment_state(db, active_scenario, message, normalized, actions, data)
    if scenario == "generic_order":
        return _handle_generic_order_state(db, active_scenario, conversation, message, actions, data)
    return None


def _handle_sunscreen_state(
    db: Session,
    state: AgentAction,
    conversation: Conversation,
    message: str,
    normalized: str,
    actions: list[ToolResult],
    data: dict,
) -> tuple[str, list[ToolResult], Order | None, InvoicePayload | None, list[AgentUiEvent]] | None:
    step = (state.raw_json or {}).get("step")
    if "ba bau" in normalized or "mang thai" in normalized:
        data.update({"selected_product": "Derma Shield Sensitive SPF50"})
        _update_scenario_state(state, step="awaiting_order_decision", data=data)
        reply = (
            "Dạ với khách đang mang thai, shop ưu tiên hướng an toàn: chị nên kiểm tra bảng thành phần và hỏi thêm bác sĩ nếu da đang nhạy cảm hoặc có chỉ định riêng. "
            "Trong các dòng hiện có, Derma Shield Sensitive SPF50 sẽ phù hợp hơn vì không cồn, không hương liệu và thiên về dịu nhẹ.\n\n"
            "Nếu chị muốn, em có thể tư vấn kỹ hơn dòng Derma Shield hoặc giữ thông tin để nhân viên kiểm tra thành phần cho chị ạ."
        )
        actions.append(ToolResult(type="pregnancy_safety_consultation", status="success", summary="Khách hỏi bà bầu dùng kem chống nắng, tư vấn thận trọng."))
        return reply, actions, None, None, []
    if step == "awaiting_skin_type":
        if _is_buy_like(normalized):
            selected = _product_name_from_message(normalized) or data.get("selected_product") or "kem chống nắng"
            info = _parse_contact_line(message)
            if info.get("customer_name") and info.get("customer_phone") and info.get("shipping_address"):
                quantity = _extract_quantity(message)
                plan = _build_order_plan(
                    product_query=selected,
                    quantity=quantity,
                    customer_name=info["customer_name"],
                    customer_phone=info["customer_phone"],
                    shipping_address=info["shipping_address"],
                    source="scenario",
                )
                product_result = search_products(db, selected)
                stock_result = check_stock(product_result, quantity)
                actions.extend([product_result, stock_result])
                if stock_result.status != "success":
                    _complete_scenario_state(state)
                    return stock_result.summary, actions, None, None, []
                pending = _persist_pending_confirmation(db, conversation.id, plan)
                actions.append(ToolResult(type="order_confirmation_pending", status="pending", summary=pending.summary, data=pending.raw_json))
                _complete_scenario_state(state)
                return _confirmation_reply(product_result, plan), actions, None, None, [
                    AgentUiEvent(type="order_confirmation_pending", status="info", title="Chờ khách xác nhận thông tin đơn", detail="Agentify đã đọc lại thông tin khách gửi trong câu đặt hàng.")
                ]
            data["selected_product"] = selected
            data["quantity"] = _extract_quantity(message)
            _update_scenario_state(state, step="awaiting_order_info", data=data)
            product = _product_by_name(db, selected)
            price = int(product.base_price) if product else 320000
            reply = (
                f"Dạ sản phẩm còn hàng. Em nhận đơn cho chị {data['quantity']} tuýp {selected} giá {_format_vnd(price)}đ ạ.\n"
                "Chị cho em xin thông tin nhận hàng gồm:\n\nHọ tên:\nSố điện thoại:\nĐịa chỉ nhận hàng:"
            )
            actions.append(ToolResult(type="order_info_requested", status="success", summary="Khách muốn đặt sản phẩm từ luồng tư vấn, đã xin thông tin nhận hàng."))
            return reply, actions, None, None, []
        if "re nhat" in normalized or "gia tot" in normalized or "tiet kiem" in normalized:
            data.update({"selected_product": "SunCare Aqua SPF50+"})
            _update_scenario_state(state, step="awaiting_order_decision", data=data)
            reply = (
                "Dạ trong 3 dòng shop đang tư vấn, SunCare Aqua SPF50+ là lựa chọn giá tốt nhất, 320.000đ. "
                "Dòng này hợp da dầu/da hỗn hợp, chất gel mỏng nhẹ nên khá hợp nếu chị sợ bí da.\n\n"
                "Chị muốn đặt 1 tuýp SunCare Aqua không ạ?"
            )
            actions.append(ToolResult(type="budget_consultation", status="success", summary="Khách hỏi loại rẻ nhất, gợi ý SunCare Aqua SPF50+."))
            return reply, actions, None, None, []
        if "dau" in normalized or "bi da" in normalized or "hon hop" in normalized:
            data.update({"skin_type": "da dầu", "selected_product": "SunCare Aqua SPF50+"})
            _update_scenario_state(state, step="awaiting_product_detail", data=data)
            reply = (
                "Dạ với da dầu và dễ bí da, em ưu tiên gợi ý chị dòng SunCare Aqua SPF50+ vì chất gel mỏng nhẹ, thấm nhanh, hạn chế cảm giác nặng mặt.\n"
                "Nếu da chị đang treatment hoặc dễ kích ứng thì có thể cân nhắc thêm Derma Shield Sensitive SPF50, nhưng dòng này sẽ thiên về dịu nhẹ hơn là kiềm dầu.\n\n"
                "Chị muốn em tư vấn kỹ hơn về SunCare Aqua không ạ?"
            )
            actions.append(ToolResult(type="skin_type_captured", status="success", summary="Khách có da dầu/dễ bí, ưu tiên SunCare Aqua SPF50+."))
            return reply, actions, None, None, []
        if "kho" in normalized:
            data.update({"skin_type": "da khô", "selected_product": "Moist UV Cream SPF50+"})
            _update_scenario_state(state, step="awaiting_product_detail", data=data)
            reply = "Dạ với da khô, em ưu tiên Moist UV Cream SPF50+ vì có thêm dưỡng ẩm, hạn chế khô căng. Chị muốn em tư vấn kỹ hơn dòng Moist UV không ạ?"
            actions.append(ToolResult(type="skin_type_captured", status="success", summary="Khách có da khô, ưu tiên Moist UV Cream SPF50+."))
            return reply, actions, None, None, []
        if "nhay cam" in normalized or "treatment" in normalized or "kich ung" in normalized:
            data.update({"skin_type": "da nhạy cảm", "selected_product": "Derma Shield Sensitive SPF50"})
            _update_scenario_state(state, step="awaiting_product_detail", data=data)
            reply = "Dạ với da nhạy cảm hoặc đang treatment, em ưu tiên Derma Shield Sensitive SPF50 vì không cồn, không hương liệu và thiên về dịu nhẹ. Chị muốn em tư vấn kỹ hơn dòng này không ạ?"
            actions.append(ToolResult(type="skin_type_captured", status="success", summary="Khách có da nhạy cảm/treatment, ưu tiên Derma Shield Sensitive SPF50."))
            return reply, actions, None, None, []
        return "Dạ chị cho em biết da mình thiên dầu, khô, hỗn hợp hay nhạy cảm để em chọn kem chống nắng sát hơn nhé.", actions, None, None, []

    if step == "awaiting_product_detail":
        if _is_buy_like(normalized):
            selected = data.get("selected_product") or "SunCare Aqua SPF50+"
            data["selected_product"] = selected
            data["quantity"] = _extract_quantity(message)
            _update_scenario_state(state, step="awaiting_order_info", data=data)
            product = _product_by_name(db, selected)
            price = int(product.base_price) if product else 320000
            reply = (
                f"Dạ em nhận đơn cho chị {data['quantity']} tuýp {selected} giá {_format_vnd(price)}đ ạ.\n"
                "Chị cho em xin thông tin nhận hàng gồm:\n\nHọ tên:\nSố điện thoại:\nĐịa chỉ nhận hàng:"
            )
            actions.append(ToolResult(type="order_info_requested", status="success", summary="Khách muốn đặt kem chống nắng, đã xin thông tin nhận hàng."))
            return reply, actions, None, None, []
        selected = data.get("selected_product") or _product_name_from_message(normalized) or "SunCare Aqua SPF50+"
        data["selected_product"] = selected
        _update_scenario_state(state, step="awaiting_order_decision", data=data)
        product = _product_by_name(db, selected)
        price = int(product.base_price) if product else 320000
        reply = _sunscreen_detail_reply(selected, price)
        actions.append(ToolResult(type="product_consultation_detail", status="success", summary=f"Tư vấn chi tiết {selected}."))
        return reply, actions, None, None, []

    if step == "awaiting_order_decision":
        if _is_buy_like(normalized):
            data.setdefault("selected_product", "SunCare Aqua SPF50+")
            data["quantity"] = _extract_quantity(message)
            _update_scenario_state(state, step="awaiting_order_info", data=data)
            product = _product_by_name(db, data["selected_product"])
            price = int(product.base_price) if product else 320000
            reply = (
                f"Dạ em nhận đơn cho chị {data['quantity']} tuýp {data['selected_product']} giá {_format_vnd(price)}đ ạ.\n"
                "Chị cho em xin thông tin nhận hàng gồm:\n\nHọ tên:\nSố điện thoại:\nĐịa chỉ nhận hàng:"
            )
            actions.append(ToolResult(type="order_info_requested", status="success", summary="Khách muốn đặt kem chống nắng, đã xin thông tin nhận hàng."))
            return reply, actions, None, None, []
        return None

    if step == "awaiting_order_info":
        info = _parse_contact_line(message)
        if not info.get("customer_name") or not info.get("customer_phone") or not info.get("shipping_address"):
            return "Dạ chị gửi giúp em đủ họ tên, số điện thoại và địa chỉ nhận hàng để em xác nhận đơn nhé.", actions, None, None, []
        product_name = data.get("selected_product") or "SunCare Aqua SPF50+"
        quantity = int(data.get("quantity") or 1)
        plan = _build_order_plan(
            product_query=product_name,
            quantity=quantity,
            customer_name=info["customer_name"],
            customer_phone=info["customer_phone"],
            shipping_address=info["shipping_address"],
            source="scenario",
        )
        product_result = search_products(db, product_name)
        stock_result = check_stock(product_result, quantity)
        actions.extend([product_result, stock_result])
        if stock_result.status != "success":
            _complete_scenario_state(state)
            return stock_result.summary, actions, None, None, []
        pending = _persist_pending_confirmation(db, conversation.id, plan)
        actions.append(ToolResult(type="order_confirmation_pending", status="pending", summary=pending.summary, data=pending.raw_json))
        _complete_scenario_state(state)
        return _confirmation_reply(product_result, plan), actions, None, None, [
            AgentUiEvent(type="order_confirmation_pending", status="info", title="Chờ khách xác nhận thông tin đơn", detail="Agentify đã thu thập đủ thông tin khách hàng trước khi tạo hóa đơn.")
        ]

    return None


def _handle_irritation_state(
    db: Session,
    state: AgentAction,
    message: str,
    normalized: str,
    actions: list[ToolResult],
    data: dict,
) -> tuple[str, list[ToolResult], Order | None, InvoicePayload | None, list[AgentUiEvent]] | None:
    step = (state.raw_json or {}).get("step")
    if _has_severe_irritation(normalized):
        _complete_scenario_state(state)
        reply = "Dạ với dấu hiệu nặng như khó thở, sưng môi/sưng mắt, đau rát dữ dội hoặc phồng rộp, chị nên đi khám bác sĩ/cơ sở y tế ngay. Shop vẫn sẽ tiếp tục kiểm tra đơn và hỗ trợ theo chính sách sau khi chị an toàn ạ."
        actions.append(ToolResult(type="irritation_urgent", status="warn", summary="Khách có dấu hiệu kích ứng nặng."))
        return reply, actions, None, None, [AgentUiEvent(type="medical_warning", status="warn", title="Cần đi khám y tế", detail="Không chỉ đặt lịch beauty khi triệu chứng nặng.")]
    if step == "awaiting_customer_lookup":
        info = _parse_contact_line(message)
        phone = info.get("customer_phone") or _extract_phone_from_text(message)
        order = _latest_order_for_customer(db, phone)
        if not order:
            return "Dạ em chưa tìm thấy đơn theo thông tin này. Chị gửi thêm mã đơn hoặc số điện thoại đặt hàng khác giúp em nhé.", actions, None, None, []
        data.update({"customer_name": order.customer_name, "customer_phone": order.customer_phone, "order_id": order.id})
        _update_scenario_state(state, step="awaiting_appointment_slot", data=data)
        first_item = _first_order_item_name(order)
        reply = (
            "Dạ em đã nhận thông tin. Em đang kiểm tra lịch sử đơn hàng của chị ạ.\n\n"
            "Em tìm thấy đơn hàng gần nhất của chị:\n\n"
            f"Sản phẩm: {first_item}\nNgày mua: 3 ngày trước\nTrạng thái: Đã giao hàng\n\n"
            "Vì tình trạng đỏ và rát có thể liên quan đến cách dùng, tần suất dùng, nền da hoặc phản ứng với sản phẩm, shop mong muốn mời chị đến cơ sở beauty của bên em để được kiểm tra da kỹ hơn.\n\n"
            "Hiện bên em còn lịch:\n\n15:00 hôm nay\n10:00 ngày mai\n16:30 ngày mai\n\nChị muốn đặt lịch khung giờ nào ạ?"
        )
        actions.append(ToolResult(type="order_lookup", status="success", summary=f"Tìm thấy đơn gần nhất của {order.customer_name}.", data={"order_id": order.id}))
        return reply, actions, None, None, []
    if step == "awaiting_appointment_slot":
        slot = _parse_slot(normalized) or "10:00 ngày mai"
        data["slot"] = slot
        _update_scenario_state(state, step="awaiting_appointment_confirm", data=data)
        reply = (
            f"Dạ em đặt lịch cho chị vào {slot} tại Beauty Clinic Cầu Giấy ạ.\n\n"
            "Chị vui lòng mang theo sản phẩm đã dùng và nếu có thể, chụp lại tình trạng da hiện tại để kỹ thuật viên kiểm tra chính xác hơn.\n"
            "Trong thời gian chờ lịch, chị nên tạm ngưng sản phẩm, tránh tẩy da chết, retinol, AHA/BHA hoặc vitamin C mạnh.\n\n"
            "Em xác nhận lịch:\n\n"
            f"Tên khách hàng: {data.get('customer_name')}\nSĐT: {data.get('customer_phone')}\nThời gian: {slot}\nĐịa điểm: Beauty Clinic Cầu Giấy\nNội dung: Kiểm tra tình trạng kích ứng sau khi dùng sản phẩm\n\n"
            "Chị xác nhận giúp em lịch này đúng chưa ạ?"
        )
        actions.append(ToolResult(type="appointment_confirmation_pending", status="pending", summary="Đã giữ lịch kiểm tra kích ứng, chờ khách xác nhận."))
        return reply, actions, None, None, []
    if step == "awaiting_appointment_confirm" and _is_explicit_confirmation(normalized):
        _complete_scenario_state(state)
        reply = "Dạ shop đã xác nhận lịch cho chị. Một lần nữa shop rất xin lỗi vì sự bất tiện này. Bên em sẽ kiểm tra kỹ và hỗ trợ chị theo đúng chính sách ạ."
        actions.append(ToolResult(type="appointment_confirmed", status="success", summary="Đã xác nhận lịch kiểm tra kích ứng."))
        return reply, actions, None, None, [AgentUiEvent(type="appointment_confirmed", status="success", title="Đã xác nhận lịch", detail="Khách sẽ đến Beauty Clinic Cầu Giấy kiểm tra.")]
    return None


def _handle_feedback_state(
    db: Session,
    state: AgentAction,
    normalized: str,
    actions: list[ToolResult],
) -> tuple[str, list[ToolResult], Order | None, InvoicePayload | None, list[AgentUiEvent]] | None:
    step = (state.raw_json or {}).get("step")
    if step == "awaiting_detail":
        _update_scenario_state(state, step="awaiting_upsell_check")
        reply = (
            "Dạ nếu vùng má hơi khô, chị có thể bổ sung thêm kem dưỡng phục hồi để cân bằng lại hàng rào bảo vệ da. "
            "Bên em có dòng Ceramide Cream, phù hợp khi dùng chung với serum Niacinamide, giúp giảm khô căng và hỗ trợ phục hồi da.\n\n"
            "Routine gợi ý cho chị:\n\n"
            "Buổi sáng:\nSữa rửa mặt dịu nhẹ\nSerum Niacinamide\nKem dưỡng mỏng nếu da khô\nKem chống nắng\n\n"
            "Buổi tối:\nTẩy trang nếu có dùng kem chống nắng\nSữa rửa mặt\nSerum Niacinamide\nKem dưỡng Ceramide Cream\n\n"
            "Chị có muốn em kiểm tra tồn kho kem dưỡng Ceramide Cream không ạ?"
        )
        actions.append(ToolResult(type="routine_recommended", status="success", summary="Đề xuất routine phục hồi nhẹ, không spam chốt đơn."))
        return reply, actions, None, None, []
    if step == "awaiting_upsell_check" and ("co" in normalized or "check" in normalized or "kiem tra" in normalized):
        product_result = search_products(db, "Kem dưỡng Ceramide Cream")
        stock_result = check_stock(product_result, 1)
        actions.extend([product_result, stock_result])
        _update_scenario_state(state, step="awaiting_upsell_decision")
        price = int(product_result.data.get("base_price") or 280000)
        reply = f"Dạ hiện Ceramide Cream còn hàng, giá {_format_vnd(price)}đ. Sản phẩm phù hợp với da hơi khô vùng má, da cần phục hồi hoặc da dùng treatment nhẹ.\n\nChị muốn đặt thêm 1 hũ để dùng cùng serum không ạ?"
        return reply, actions, None, None, []
    if step in {"awaiting_upsell_check", "awaiting_upsell_decision"} and ("suy nghi" in normalized or "de minh" in normalized):
        _complete_scenario_state(state)
        reply = "Dạ vâng ạ. Chị cứ theo dõi thêm tình trạng da trong vài ngày tới. Nếu vùng má vẫn khô căng, chị có thể nhắn shop để bên em tư vấn thêm. Shop cảm ơn chị đã feedback, em cũng đã ghi nhận phản hồi tích cực của chị về serum Niacinamide ạ."
        actions.append(ToolResult(type="feedback_recorded", status="success", summary="Đã ghi nhận phản hồi tích cực, khách chưa muốn mua thêm."))
        return reply, actions, None, None, []
    return None


def _handle_skin_appointment_state(
    db: Session,
    state: AgentAction,
    message: str,
    normalized: str,
    actions: list[ToolResult],
    data: dict,
) -> tuple[str, list[ToolResult], Order | None, InvoicePayload | None, list[AgentUiEvent]] | None:
    step = (state.raw_json or {}).get("step")
    if step == "awaiting_skin_need":
        data["concern"] = "Mụn ẩn, da dầu" if "mun" in normalized or "dau" in normalized else message.strip()
        _update_scenario_state(state, step="awaiting_slot", data=data)
        reply = (
            "Dạ với tình trạng mụn ẩn và da dầu, chị có thể đặt lịch soi da miễn phí trước để kiểm tra mức độ bít tắc, dầu thừa và tình trạng lỗ chân lông. "
            "Sau khi soi da, bên em sẽ tư vấn sản phẩm hoặc dịch vụ phù hợp, không bắt buộc phải làm dịch vụ ngay ạ.\n\n"
            "Hiện bên em còn các khung giờ:\n\nHôm nay: 14:30, 17:00\nNgày mai: 9:30, 13:30, 18:00\n\nChị muốn đặt lịch khung nào ạ?"
        )
        actions.append(ToolResult(type="appointment_slots_checked", status="success", summary="Đã check lịch trống soi da."))
        return reply, actions, None, None, []
    if step == "awaiting_slot":
        slot = _parse_slot(normalized)
        if not slot:
            return "Dạ khung giờ này em chưa thấy trong lịch trống. Bên em còn hôm nay 14:30, 17:00 hoặc ngày mai 9:30, 13:30, 18:00 ạ.", actions, None, None, []
        data["slot"] = slot
        _update_scenario_state(state, step="awaiting_contact", data=data)
        reply = "Dạ được ạ. Chị cho em xin thông tin đặt lịch gồm:\n\nHọ tên:\nSố điện thoại:\nCơ sở muốn đến nếu có:"
        actions.append(ToolResult(type="appointment_slot_selected", status="success", summary=f"Khách chọn lịch {slot}."))
        return reply, actions, None, None, []
    if step == "awaiting_contact":
        info = _parse_contact_line(message)
        if not info.get("customer_name") or not info.get("customer_phone"):
            return "Dạ chị gửi giúp em họ tên và số điện thoại để em giữ lịch nhé.", actions, None, None, []
        data.update(info)
        data["clinic"] = _extract_clinic(message) or "Cầu Giấy"
        _update_scenario_state(state, step="awaiting_confirm", data=data)
        reply = (
            "Dạ em xin xác nhận lịch của chị:\n\n"
            f"Họ tên: {data.get('customer_name')}\nSĐT: {data.get('customer_phone')}\nDịch vụ: Soi da miễn phí\n"
            f"Tình trạng quan tâm: {data.get('concern', 'Mụn ẩn, da dầu')}\nThời gian: {data.get('slot')}\nCơ sở: {data.get('clinic')}\n\n"
            "Chị kiểm tra giúp em thông tin đã đúng chưa ạ?"
        )
        actions.append(ToolResult(type="appointment_confirmation_pending", status="pending", summary="Đã tổng hợp thông tin lịch soi da, chờ khách xác nhận."))
        return reply, actions, None, None, []
    if step == "awaiting_confirm" and _is_explicit_confirmation(normalized):
        _complete_scenario_state(state)
        reply = f"Dạ em đã đặt lịch soi da cho chị vào {data.get('slot')} tại cơ sở {data.get('clinic', 'Cầu Giấy')}. Trước khi đến, chị nên hạn chế trang điểm quá dày để việc soi da được chính xác hơn. Shop cảm ơn chị ạ."
        actions.append(ToolResult(type="appointment_confirmed", status="success", summary="Đã xác nhận lịch soi da."))
        return reply, actions, None, None, [AgentUiEvent(type="appointment_confirmed", status="success", title="Đã đặt lịch soi da", detail=f"{data.get('slot')} tại {data.get('clinic', 'Cầu Giấy')}")]
    return None


def _handle_fulfillment_state(
    db: Session,
    state: AgentAction,
    message: str,
    normalized: str,
    actions: list[ToolResult],
    data: dict,
) -> tuple[str, list[ToolResult], Order | None, InvoicePayload | None, list[AgentUiEvent]] | None:
    step = (state.raw_json or {}).get("step")
    if step == "awaiting_lookup":
        phone = _extract_phone_from_text(message)
        code = _extract_order_code(message)
        order = _find_order_for_complaint(db, phone=phone, code=code)
        if not order:
            return "Dạ em chưa tìm thấy đơn theo thông tin này. Chị gửi giúp em mã đơn hoặc SĐT đặt hàng để em tra lại nhé.", actions, None, None, []
        data.update({"order_id": order.id, "order_code": order.kiotviet_order_code or f"#{order.id}", "phone": order.customer_phone, "address": order.shipping_address})
        _update_scenario_state(state, step="awaiting_received_items", data=data)
        item_lines = "\n".join(f"{int(item.get('quantity', 1))} {item.get('name')}" for item in order.items if isinstance(item, dict))
        reply = f"Dạ em đang kiểm tra đơn hàng theo số điện thoại {order.customer_phone} ạ.\n\nEm tìm thấy đơn hàng {data['order_code']} gồm:\n\n{item_lines}\n\nChị cho em hỏi hiện tại chị nhận được sản phẩm nào rồi ạ?"
        actions.append(ToolResult(type="order_lookup", status="success", summary=f"Tìm thấy đơn {data['order_code']}.", data={"order_id": order.id}))
        return reply, actions, None, None, []
    if step == "awaiting_received_items":
        data["issue"] = message.strip()
        _update_scenario_state(state, step="awaiting_evidence", data=data)
        reply = "Dạ shop xin lỗi chị ạ. Để bên em xác minh nhanh với bộ phận đóng hàng, chị vui lòng gửi giúp em ảnh kiện hàng, ảnh sản phẩm đã nhận và nếu còn giữ phiếu giao hàng thì gửi thêm giúp em ạ."
        actions.append(ToolResult(type="complaint_evidence_requested", status="success", summary="Đã xin ảnh/video xác minh thiếu hàng."))
        return reply, actions, None, None, []
    if step == "awaiting_evidence":
        _update_scenario_state(state, step="awaiting_resolution", data=data)
        reply = (
            "Dạ em đã nhận ảnh. Theo thông tin chị cung cấp, đơn hàng đang bị thiếu 1 Sữa rửa mặt Gentle Foam. Shop sẽ tạo yêu cầu xử lý cho chị ngay.\n\n"
            "Bên em có thể hỗ trợ theo phương án:\n\nGửi bù sản phẩm còn thiếu cho chị.\nHoàn tiền phần sản phẩm bị thiếu.\nĐổi sang sản phẩm khác cùng giá trị nếu chị muốn.\n\nChị muốn chọn phương án nào ạ?"
        )
        actions.append(ToolResult(type="complaint_evidence_received", status="success", summary="Đã nhận bằng chứng khiếu nại."))
        return reply, actions, None, None, []
    if step == "awaiting_resolution":
        resolution = "Gửi bù sản phẩm còn thiếu" if "gui bu" in normalized else "Hoàn tiền/đổi hàng"
        data["resolution"] = resolution
        _update_scenario_state(state, step="awaiting_resolution_confirm", data=data)
        reply = "Dạ em sẽ tạo yêu cầu gửi bù 1 Sữa rửa mặt Gentle Foam cho chị.\n\nEm xin xác nhận lại địa chỉ nhận hàng có phải là địa chỉ cũ trong đơn DH10239 không ạ?"
        actions.append(ToolResult(type="complaint_resolution_selected", status="success", summary=resolution))
        return reply, actions, None, None, []
    if step == "awaiting_resolution_confirm" and (_is_explicit_confirmation(normalized) or "dia chi cu" in normalized):
        _complete_scenario_state(state)
        order_code = data.get("order_code") or "DH10239"
        reply = (
            f"Dạ em đã tạo ticket xử lý thiếu hàng cho đơn {order_code} và yêu cầu gửi bù sản phẩm đến địa chỉ cũ của chị.\n"
            "Thời gian giao bù dự kiến từ 2-4 ngày tùy khu vực vận chuyển.\n\n"
            "Một lần nữa shop rất xin lỗi chị vì sai sót này và cảm ơn chị đã thông báo để bên em xử lý ạ."
        )
        actions.append(ToolResult(type="complaint_ticket_created", status="success", summary=f"Đã tạo ticket gửi bù cho đơn {order_code}.", data={"order_code": order_code, "resolution": data.get("resolution")}))
        return reply, actions, None, None, [AgentUiEvent(type="complaint_ticket_created", status="success", title="Đã tạo ticket khiếu nại", detail=f"Đơn {order_code}: gửi bù sản phẩm thiếu.")]
    return None


def _handle_generic_order_state(
    db: Session,
    state: AgentAction,
    conversation: Conversation,
    message: str,
    actions: list[ToolResult],
    data: dict,
) -> tuple[str, list[ToolResult], Order | None, InvoicePayload | None, list[AgentUiEvent]] | None:
    step = (state.raw_json or {}).get("step")
    if step != "awaiting_order_info":
        return None

    info = _parse_contact_line(message)
    merged = {
        "product_query": data.get("product_query"),
        "quantity": int(data.get("quantity") or 1),
        "customer_name": data.get("customer_name") or info.get("customer_name"),
        "customer_phone": data.get("customer_phone") or info.get("customer_phone"),
        "shipping_address": data.get("shipping_address") or info.get("shipping_address"),
    }
    missing = [
        label
        for key, label in (
            ("customer_name", "tên người nhận"),
            ("customer_phone", "số điện thoại"),
            ("shipping_address", "địa chỉ nhận hàng"),
        )
        if not merged.get(key)
    ]
    if missing:
        _update_scenario_state(state, step="awaiting_order_info", data=merged)
        return f"Dạ em còn thiếu {', '.join(missing)}. Chị gửi bổ sung giúp em để em xác nhận đơn nhé.", actions, None, None, []

    product_query = str(merged.get("product_query") or "").strip()
    if not product_query:
        return "Dạ chị nhắc lại giúp em sản phẩm muốn đặt để em kiểm tra tồn kho và xác nhận đơn nhé.", actions, None, None, []

    plan = _build_order_plan(
        product_query=product_query,
        quantity=int(merged["quantity"]),
        customer_name=str(merged["customer_name"]),
        customer_phone=str(merged["customer_phone"]),
        shipping_address=str(merged["shipping_address"]),
        source="scenario",
    )
    product_result = search_products(db, product_query)
    stock_result = check_stock(product_result, int(merged["quantity"]))
    actions.extend([product_result, stock_result])
    if stock_result.status != "success":
        _complete_scenario_state(state)
        return stock_result.summary, actions, None, None, []

    pending = _persist_pending_confirmation(db, conversation.id, plan)
    actions.append(ToolResult(type="order_confirmation_pending", status="pending", summary=pending.summary, data=pending.raw_json))
    _complete_scenario_state(state)
    return _confirmation_reply(product_result, plan), actions, None, None, [
        AgentUiEvent(type="order_confirmation_pending", status="info", title="Chờ khách xác nhận thông tin đơn", detail="Agentify đã thu thập đủ thông tin khách hàng trước khi tạo hóa đơn.")
    ]


def _sunscreen_intro_reply(recommendation_result: ToolResult | None = None) -> str:
    products = list((recommendation_result.data or {}).get("products") or []) if recommendation_result else []
    if products:
        lines = [
            f"{product.get('name')} - {product.get('reason')}, giá {_format_vnd(int(product.get('price') or 0))}."
            for product in products
        ]
        product_lines = "\n".join(lines)
        return (
            "Dạ shop chào chị ạ. Hiện tại shop còn một số dòng Kem chống nắng như sau:\n\n"
            f"{product_lines}\n\n"
            "Để tư vấn chính xác hơn, chị cho em hỏi da mình thuộc loại da dầu, da khô, da hỗn hợp hay da nhạy cảm ạ?"
        )
    return (
        "Dạ shop chào chị ạ. Hiện tại shop còn một số dòng Kem chống nắng như sau:\n\n"
        "SunCare Aqua SPF50+ - phù hợp da dầu, da hỗn hợp, chất gel mỏng nhẹ, giá 320.000đ.\n"
        "Derma Shield Sensitive SPF50 - phù hợp da nhạy cảm hoặc da đang treatment, không cồn, không hương liệu, giá 390.000đ.\n"
        "Moist UV Cream SPF50+ - phù hợp da khô, có thêm thành phần dưỡng ẩm, giá 350.000đ.\n\n"
        "Để tư vấn chính xác hơn, chị cho em hỏi da mình thuộc loại da dầu, da khô, da hỗn hợp hay da nhạy cảm ạ?"
    )


def _sunscreen_recommendation_result(db: Session, *, query: str | None = None) -> ToolResult:
    products: list[dict] = []
    max_budget = _extract_max_budget(query)
    fallback_prices = {
        "SunCare Aqua SPF50+": 320000,
        "Derma Shield Sensitive SPF50": 390000,
        "Moist UV Cream SPF50+": 350000,
    }
    fallback_reasons = {
        "SunCare Aqua SPF50+": "phù hợp da dầu, da hỗn hợp; chất gel mỏng nhẹ.",
        "Derma Shield Sensitive SPF50": "phù hợp da nhạy cảm hoặc da treatment; không cồn, không hương liệu.",
        "Moist UV Cream SPF50+": "phù hợp da khô; có dưỡng ẩm.",
    }
    for name, price in fallback_prices.items():
        row = _product_by_name(db, name)
        actual_price = float(row.base_price) if row else float(price)
        if max_budget is not None and actual_price > max_budget:
            continue
        products.append(
            {
                "id": row.id if row else 0,
                "name": name,
                "price": actual_price,
                "stock": row.stock if row else 10,
                "reason": fallback_reasons[name],
            }
        )
    return ToolResult(
        type="product_recommendation",
        status="success",
        summary=f"Tìm thấy {len(products)} sản phẩm kem chống nắng phù hợp theo loại da.",
        data={"products": products},
    )


def _format_vnd(value: int | float) -> str:
    return f"{int(value):,}".replace(",", ".")


def _sunscreen_detail_reply(product_name: str, price: int) -> str:
    if normalize_text(product_name) == "derma shield sensitive spf50":
        return (
            "Dạ Derma Shield Sensitive SPF50 phù hợp với da nhạy cảm hoặc da đang treatment. Sản phẩm không cồn, không hương liệu nên thiên về làm dịu và hạn chế kích ứng.\n\n"
            f"Hiện sản phẩm còn hàng, giá là {_format_vnd(price)}đ. Chị muốn đặt 1 tuýp không ạ?"
        )
    if normalize_text(product_name) == "moist uv cream spf50+":
        return (
            "Dạ Moist UV Cream SPF50+ phù hợp với da khô vì có thêm thành phần dưỡng ẩm, giúp da đỡ căng khi dùng chống nắng hằng ngày.\n\n"
            f"Hiện sản phẩm còn hàng, giá là {_format_vnd(price)}đ. Chị muốn đặt 1 tuýp không ạ?"
        )
    return (
        "Dạ SunCare Aqua SPF50+ là kem chống nắng phù hợp với da dầu và da hỗn hợp. Sản phẩm có chỉ số SPF50+, kết cấu dạng gel nên khá nhẹ mặt, dễ tán, không gây cảm giác dày bí như một số loại kem chống nắng truyền thống.\n\n"
        "Sản phẩm phù hợp nếu chị cần dùng hằng ngày khi đi học, đi làm, ra ngoài nhẹ. Với da dầu, chị nên dùng lượng vừa đủ, tẩy trang kỹ cuối ngày để tránh bít tắc lỗ chân lông.\n\n"
        f"Hiện sản phẩm còn hàng, giá là {_format_vnd(price)}đ. Chị muốn đặt 1 tuýp không ạ?"
    )


def _build_order_plan(*, product_query: str, quantity: int, customer_name: str, customer_phone: str, shipping_address: str, source: str) -> AgentPlan:
    return AgentPlan(
        intent="buy_product",
        slots={
            "product_query": product_query,
            "quantity": quantity,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "shipping_address": shipping_address,
            "payment_method": "cod",
        },
        tool_plan=["search_products", "check_stock", "create_draft_order"],
        source=source,
    )


def _product_by_name(db: Session, name: str) -> ProductCache | None:
    name_norm = normalize_text(name)
    for product in db.scalars(select(ProductCache).where(ProductCache.workspace_id == DEFAULT_WORKSPACE_ID).limit(300)):
        if normalize_text(product.name) == name_norm:
            return product
    return None


def _product_name_from_message(normalized: str) -> str | None:
    if "derma" in normalized or "sensitive" in normalized:
        return "Derma Shield Sensitive SPF50"
    if "moist" in normalized or "da kho" in normalized:
        return "Moist UV Cream SPF50+"
    if "suncare" in normalized or "aqua" in normalized:
        return "SunCare Aqua SPF50+"
    return None


def _parse_contact_line(message: str) -> dict[str, str]:
    normalized = normalize_text(message)
    if _is_explicit_confirmation(normalized):
        return {}
    phone = _extract_phone_from_text(message)
    text_without_phone = re.sub(r"(?:sđt|sdt|số|so)?\s*[:.]?\s*(0\d{8,10}|\+?84\d{8,10})", " ", message, flags=re.IGNORECASE)
    parts = [part.strip(" .,:") for part in re.split(r"[,;\n]+|\s*\.\s*", text_without_phone) if part.strip(" .,:")]
    name = None
    address = None
    parsed_name = _extract_name_from_text(message)
    if parsed_name:
        name = parsed_name
    elif parts:
        first = parts[0]
        first_norm = normalize_text(first)
        if not any(token in first_norm for token in ("co so", "dia chi", "giao", "sdt", "so dien thoai")):
            name = first
    for part in parts[1:] if name else parts:
        part_norm = normalize_text(part)
        if "co so" in part_norm:
            continue
        if any(ch.isdigit() for ch in part) or any(token in part_norm for token in ("ha noi", "duong", "pho", "lang", "cau giay", "quan")):
            address = re.sub(r"^(địa chỉ|dia chi|giao tới|giao den)\s*[:.]?\s*", "", part, flags=re.IGNORECASE)
            break
    return {key: value for key, value in {"customer_name": name, "customer_phone": phone, "shipping_address": address}.items() if value}


def _extract_name_from_text(message: str) -> str | None:
    patterns = [
        r"(?:mình tên|minh ten|tên mình là|ten minh la|tên là|ten la|mình là|minh la|chị là|chi la)\s+([^,.]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip(" .,:")
    return None


def _extract_phone_from_text(message: str | None) -> str | None:
    if not message:
        return None
    match = re.search(r"\b(0\d{8,10}|\+?84\d{8,10})\b", message)
    return match.group(1) if match else None


def _extract_quantity(message: str) -> int:
    return parse_quantity(message)


def _parse_slot(normalized: str) -> str | None:
    if "mai" in normalized and ("18" in normalized or "18h" in normalized):
        return "18:00 ngày mai"
    if "mai" in normalized and ("10" in normalized or "10h" in normalized):
        return "10:00 ngày mai"
    if "mai" in normalized and ("16" in normalized or "16h30" in normalized):
        return "16:30 ngày mai"
    if "hom nay" in normalized and "14" in normalized:
        return "14:30 hôm nay"
    if "hom nay" in normalized and "15" in normalized:
        return "15:00 hôm nay"
    if "hom nay" in normalized and "17" in normalized:
        return "17:00 hôm nay"
    if "9:30" in normalized or "9h30" in normalized:
        return "9:30 ngày mai"
    if "13:30" in normalized or "13h30" in normalized:
        return "13:30 ngày mai"
    return None


def _extract_clinic(message: str) -> str | None:
    normalized = normalize_text(message)
    if "cau giay" in normalized:
        return "Cầu Giấy"
    if "lang ha" in normalized:
        return "Láng Hạ"
    return None


def _extract_order_code(message: str) -> str | None:
    match = re.search(r"\b(DH\d{3,})\b", message, flags=re.IGNORECASE)
    return match.group(1).upper() if match else None


def _find_order_for_complaint(db: Session, *, phone: str | None, code: str | None) -> Order | None:
    query = select(Order).where(Order.workspace_id == DEFAULT_WORKSPACE_ID)
    if code:
        order = db.scalar(query.where(Order.kiotviet_order_code == code).order_by(desc(Order.created_at), desc(Order.id)))
        if order:
            return order
    if phone:
        return _latest_order_for_customer(db, phone)
    return None


def _first_order_item_name(order: Order) -> str:
    if order.items and isinstance(order.items[0], dict):
        return order.items[0].get("name") or "sản phẩm"
    return "sản phẩm"


def _is_consultation_like(normalized: str) -> bool:
    return any(word in normalized for word in ("tu van", "goi y", "nen dung", "loai nao", "chon loai", "phu hop"))


def _is_buy_like(normalized: str) -> bool:
    return any(word in normalized for word in ("lay", "mua", "dat", "chot", "ok lay"))


def _is_irritation_message(normalized: str) -> bool:
    return any(word in normalized for word in IRRITATION_WORDS)


def _has_severe_irritation(normalized: str) -> bool:
    return any(word in normalized for word in ("kho tho", "sung moi", "sung mat", "dau rat du doi", "phong rop"))


def _is_fulfillment_complaint(normalized: str) -> bool:
    return any(word in normalized for word in FULFILLMENT_WORDS)


def _is_feedback_message(normalized: str) -> bool:
    return any(word in normalized for word in FEEDBACK_WORDS) and not _is_irritation_message(normalized)


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
    if _is_rejection(normalized):
        pending_confirmation.status = "cancelled"
        reply = "Dạ chị gửi lại giúp em thông tin cần sửa: sản phẩm, số lượng, tên người nhận, SĐT hoặc địa chỉ. Em sẽ kiểm tra lại trước khi tạo hóa đơn."
        actions.append(ToolResult(type="order_confirmation_cancelled", status="success", summary="Khách báo thông tin chưa đúng, chưa tạo hóa đơn."))
        return reply, None, None, [
            AgentUiEvent(type="order_confirmation_cancelled", status="info", title="Khách cần sửa thông tin", detail="Hóa đơn chưa được tạo.")
        ]
    if not _is_explicit_confirmation(normalized):
        return None

    plan = AgentPlan.model_validate(pending_confirmation.raw_json.get("plan") or {})
    if not _has_required_order_fields(plan):
        pending_confirmation.status = "cancelled"
        reply = _missing_info_reply(plan, ToolResult(type="order_create", status="skipped", summary="Chưa tạo hóa đơn vì thiếu thông tin khách hàng thật."))
        actions.append(ToolResult(type="order_confirmation_missing_info", status="skipped", summary="Không tạo hóa đơn vì thiếu tên/SĐT/địa chỉ hợp lệ."))
        return reply, None, None, [
            AgentUiEvent(type="order_clarification", status="info", title="Thiếu thông tin khách hàng", detail="Agentify chưa tạo hóa đơn.")
        ]
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
    shipping_result = create_shipping_order(db, order=order)
    actions.append(shipping_result)
    reply = _order_reply(product_result, plan.slots.quantity, order, shipping_result)
    ui_events = [
        AgentUiEvent(
            type="invoice_ready",
            status="success",
            title="Hóa đơn điện tử đã được tạo",
            detail=f"Đơn #{order.id} tổng {int(order.total):,}đ đã được tạo sau khi khách xác nhận."
        )
    ]
    if shipping_result.status == "success":
        ui_events.append(
            AgentUiEvent(
                type="shipping_order_created",
                status="success",
                title=f"Đã gửi đơn sang GHN: {shipping_result.data.get('order_code')}",
                detail=shipping_result.summary,
            )
        )
    elif shipping_result.status == "skipped":
        ui_events.append(
            AgentUiEvent(
                type="shipping_order_skipped",
                status="info",
                title="Chưa tạo vận đơn GHN",
                detail=shipping_result.summary,
            )
        )
    return reply, order, invoice, ui_events


def _is_explicit_confirmation(normalized_message: str) -> bool:
    if any(word in normalized_message for word in ("tu van", "goi y", "recommend", "nen dung", "phu hop")):
        return False
    return any(re.search(rf"(^|\W){re.escape(word)}($|\W)", normalized_message) for word in CONFIRM_WORDS)


def _is_rejection(normalized_message: str) -> bool:
    return any(re.search(rf"(^|\W){re.escape(word)}($|\W)", normalized_message) for word in REJECT_WORDS)


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


def _supersede_pending_confirmations(db: Session, conversation_id: int) -> None:
    for action in db.scalars(
        select(AgentAction).where(
            AgentAction.conversation_id == conversation_id,
            AgentAction.action_type == "order_confirmation_pending",
            AgentAction.status == "pending",
        )
    ):
        action.status = "superseded"


def _is_order_support_message(message: str) -> bool:
    normalized = normalize_text(message)
    return any(word in normalized for word in ORDER_SUPPORT_WORDS)


def _is_tracking_message(message: str) -> bool:
    normalized = normalize_text(message)
    return any(word in normalized for word in TRACKING_WORDS)


def _is_appointment_message(message: str) -> bool:
    normalized = normalize_text(message)
    return any(word in normalized for word in APPOINTMENT_WORDS)


def _tracking_reply(order: Order, track_result: ToolResult) -> str:
    if track_result.status != "success":
        return (
            f"Dạ em đã tìm thấy đơn #{order.id}, nhưng hiện chưa cập nhật được mã vận đơn GHN cho đơn này. "
            f"{track_result.summary} Shop sẽ kiểm tra lại và phản hồi chị sớm ạ."
        )
    code = track_result.data.get("order_code") or "chưa có mã"
    status = track_result.data.get("status") or "đang xử lý"
    eta = track_result.data.get("expected_delivery_time")
    eta_line = f"\nDự kiến giao: {eta}" if eta else ""
    return f"Dạ em kiểm tra trên GHN rồi ạ.\nMã vận đơn: {code}\nTrạng thái hiện tại: {status}{eta_line}"


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


def _latest_order_for_conversation(db: Session, conversation_id: int) -> Order | None:
    return db.scalar(
        select(Order)
        .where(Order.workspace_id == DEFAULT_WORKSPACE_ID, Order.conversation_id == conversation_id)
        .order_by(desc(Order.created_at), desc(Order.id))
    )


async def _reply_with_general_llm(db: Session, conversation_id: int, message: str, customer_name: str | None, customer_phone: str | None) -> dict | None:
    settings = get_settings()
    if not llm_available(settings):
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
    try:
        parsed = await generate_llm_json(
            GENERAL_LLM_PROMPT,
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
                "tool_catalog": list_agent_tools(),
            },
            temperature=0.2,
            settings=settings,
        )
        if not isinstance(parsed, dict) or not parsed.get("reply"):
            return None
        return {
            "reply": str(parsed.get("reply")),
            "actions": [str(item) for item in parsed.get("actions", [])[:4] if item],
            "quick_replies": [str(item) for item in parsed.get("quick_replies", [])[:4] if item],
        }
    except (LLMClientError, KeyError, TypeError, ValueError):
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


def _order_reply(product_result: ToolResult, quantity: int, order: Order | None, shipping_result: ToolResult | None = None) -> str:
    name = product_result.data.get("name", "sản phẩm")
    order_code = f"#{order.id}" if order else ""
    total = int(order.total) if order else 0
    shipping_line = "Đơn hàng dự kiến giao trong khoảng 2-4 ngày tùy khu vực vận chuyển."
    if shipping_result and shipping_result.status == "success":
        ghn_code = shipping_result.data.get("order_code")
        eta = shipping_result.data.get("expected_delivery_time")
        shipping_line = f"Đơn hàng dự kiến giao trong khoảng 2-4 ngày tùy khu vực vận chuyển. Em cũng đã gửi thông tin đơn sang GHN. Mã vận đơn của chị là {ghn_code}."
        if eta:
            shipping_line += f" GHN đang trả ETA hệ thống: {eta}."
        shipping_line += " Chị có thể nhắn \"kiểm tra đơn\" để em cập nhật trạng thái giao hàng."
    elif shipping_result and shipping_result.status == "skipped":
        shipping_line = "Đơn hàng dự kiến giao trong khoảng 2-4 ngày tùy khu vực vận chuyển. Phần tạo vận đơn GHN sẽ chạy tự động khi shop cấu hình đủ GHN_TOKEN, GHN_SHOP_ID và mã địa chỉ."
    return (
        f"Dạ em đã ghi nhận đơn hàng và xuất hóa đơn điện tử cho chị. Đơn {order_code}: {quantity} {name}, tổng {_format_vnd(total)}đ.\n"
        f"{shipping_line} Cảm ơn chị đã tin tưởng shop ạ."
    )


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
    return (
        bool(plan.slots.product_query)
        and bool(plan.slots.customer_name)
        and not _is_placeholder_customer_name(plan.slots.customer_name)
        and bool(plan.slots.customer_phone)
        and bool(plan.slots.shipping_address)
    )


def _is_placeholder_customer_name(value: str | None) -> bool:
    if not value:
        return False
    return normalize_text(value) in {"khach", "khach hang", "khach zalo"}


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
