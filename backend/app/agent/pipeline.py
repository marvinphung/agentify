from __future__ import annotations

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.agent.llm_client import LLMClientError, generate_llm_json, llm_available
from app.agent.schemas import AgentConversationContext, AgentReplyResult, AgentSuggestionResult, AgentToolDecision, ToolResult
from app.agent.tools import check_stock, list_agent_tools, search_product_recommendations, search_products
from app.config import get_settings
from app.shared.text import normalize_text


ALLOWED_DECISION_TOOLS = {
    "search_products",
    "recommend_products",
    "check_stock",
    "create_draft_order",
    "track_shipping_order",
}

SHORT_CONTEXTUAL_YES_REPLIES = {"co", "ok", "oki", "okay", "duoc", "dong y", "uh", "um"}

TOOL_DECISION_PROMPT = """Ban la nhan vien Lumi Beauty, beauty consultant tu van skincare/my pham qua Zalo, va la tool coordinator cho cac tool noi bo.
Chi tra JSON thuan, khong markdown, khong giai thich ngoai JSON.

Nhiem vu:
- Doc message moi, history, active_scenario va active_product_focus.
- Quyet dinh intent cua khach va co can goi tool noi bo hay khong.
- Neu message ngan nhu "co", "ok", "duoc", "loai do", phai giu ngu canh san pham dang focus.
- Khong goi recommend_products khi khach chi dong y nghe tu van ky hon ve san pham dang focus.
- Khong tao don neu khach chua chot mua ro rang hoac chua co du thong tin nhan hang.
- Chi chon selected_tool co trong tool_catalog va trong danh sach cho phep.

Danh sach selected_tool duoc phep:
search_products, recommend_products, check_stock, create_draft_order, track_shipping_order.

JSON schema:
{
  "intent": "product_consultation|product_consultation_detail|buy_product|ask_stock|order_status|support|unknown",
  "needs_tool": true|false,
  "selected_tool": "search_products|recommend_products|check_stock|create_draft_order|track_shipping_order"|null,
  "tool_args": {},
  "active_product_focus": string|null,
  "next_state": object|null,
  "handoff": true|false,
  "confidence": number,
  "reason": string|null
}
"""

BEAUTY_CONSULTANT_REPLY_PROMPT = """Ban la chuyen vien tu van my pham cua Lumi Beauty, shop beauty consultant for Zalo.
Chi tra JSON thuan, khong markdown, khong giai thich ngoai JSON.

Nhiem vu:
- Viet cau tra loi ngan gon, tu nhien, lich su va huu ich cho khach hang.
- Uu tien ngu canh active_product_focus va active_scenario neu co.
- Neu co tool_result, dung noi dung do de tra loi theo goc nhin tu van ban hang.
- Khong noi minh la AI, tool coordinator, he thong noi bo, hoac dang doc database.
- Tuyet doi khong nhac cac tu: tool, database, KiotViet, GHN, Agentify.
- Neu thieu thong tin de chot don, hoi tiep mot cau ro rang.
- Neu khach chi dang tu van san pham, khong hoi ten, so dien thoai, dia chi.
- Chi hoi ten, so dien thoai, dia chi khi khach da co y dinh mua/chot don ro rang.

JSON schema:
{
  "reply": "noi dung gui cho khach",
  "actions": ["nhan_dien_hanh_dong"],
  "state_update": object|null
}
"""

QUICK_REPLY_PROMPT = """Ban la chuyen vien tu van my pham cua Lumi Beauty, tao quick reply cho khach tren Zalo.
Chi tra JSON thuan, khong markdown, khong giai thich ngoai JSON.

Nhiem vu:
- De xuat toi da 4 cau tra loi ngan de khach bam tiep.
- Moi quick reply toi da 24 ky tu, tu nhien, dung ngu canh hoi thoai.
- Uu tien active_product_focus neu dang tu van mot san pham cu the.
- Khong nhac tu noi bo: tool, database, KiotViet, GHN, Agentify.
- Khong hoi thong tin ca nhan neu khach chua chot mua ro rang.

JSON schema:
{
  "quick_replies": ["toi da 4 lua chon"]
}
"""

INTERNAL_TERMS = ("tool", "database", "kiotviet", "ghn", "agentify")


def _fallback_tool_decision(context: AgentConversationContext) -> AgentToolDecision:
    normalized_message = normalize_text(context.message)
    if context.active_product_focus and normalized_message in SHORT_CONTEXTUAL_YES_REPLIES:
        return AgentToolDecision(
            intent="product_consultation_detail",
            needs_tool=False,
            selected_tool=None,
            tool_args={},
            active_product_focus=context.active_product_focus,
            confidence=0.7,
            reason="Short contextual reply keeps active product focus.",
        )

    return AgentToolDecision(
        intent="unknown",
        needs_tool=False,
        selected_tool=None,
        tool_args={},
        active_product_focus=context.active_product_focus,
        confidence=0.0,
        reason="LLM unavailable or invalid.",
    )


def _fallback_reply(
    context: AgentConversationContext,
    decision: AgentToolDecision,
    tool_result: ToolResult | None,
) -> AgentReplyResult:
    active_product = decision.active_product_focus or context.active_product_focus
    actions: list[str] = []
    if decision.intent and decision.intent != "unknown":
        actions.append(decision.intent)

    if tool_result and tool_result.status == "success":
        actions.append(tool_result.summary)
        if active_product:
            reply = f"Về {active_product}, em đã có thêm thông tin để tư vấn tiếp cho chị."
        else:
            reply = "Dạ em đã lọc được vài lựa chọn phù hợp để tư vấn tiếp theo nhu cầu hiện tại của chị."
        return AgentReplyResult(reply=reply, actions=actions)

    if active_product:
        return AgentReplyResult(
            reply=(
                f"Về {active_product}, em sẽ tư vấn kỹ hơn theo nhu cầu hiện tại của chị. "
                "Dòng này đang là lựa chọn em ưu tiên trong ngữ cảnh mình vừa trao đổi."
            ),
            actions=actions,
        )

    return AgentReplyResult(
        reply="Dạ em sẽ tư vấn mỹ phẩm phù hợp theo nhu cầu của chị. Chị cho em thêm tình trạng da hoặc mong muốn hiện tại nhé?",
        actions=actions,
    )


def _reply_mentions_internal_terms(reply: str) -> bool:
    normalized_reply = normalize_text(reply)
    return any(term in normalized_reply for term in INTERNAL_TERMS)


def _clean_quick_replies(replies: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for reply in replies:
        if not isinstance(reply, str):
            continue
        item = reply.strip()
        if not item:
            continue
        if _reply_mentions_internal_terms(item):
            continue
        if len(item) > 24:
            item = item[:24].rstrip()
        normalized_item = normalize_text(item)
        if not normalized_item or normalized_item in seen:
            continue
        seen.add(normalized_item)
        cleaned.append(item)
        if len(cleaned) >= 4:
            break
    return cleaned


def _fallback_quick_replies(
    context: AgentConversationContext,
    decision: AgentToolDecision,
    tool_result: ToolResult | None,
    reply_result: AgentReplyResult,
) -> AgentSuggestionResult:
    active_product = decision.active_product_focus or context.active_product_focus
    if active_product:
        short_product = active_product
        if len(short_product) > 15:
            short_product = short_product[:15].rstrip()
        return AgentSuggestionResult(
            quick_replies=_clean_quick_replies(
                [
                    f"Tư vấn {short_product}",
                    "Giá bao nhiêu",
                    "Còn hàng không",
                    "Mua sản phẩm",
                ]
            )
        )

    if tool_result and tool_result.type == "product_recommendation" and tool_result.status == "success":
        return AgentSuggestionResult(
            quick_replies=_clean_quick_replies(["Da dầu", "Da khô", "Da nhạy cảm", "Dưới 350k"])
        )

    if decision.intent in {"buy_product", "ask_stock"}:
        return AgentSuggestionResult(
            quick_replies=_clean_quick_replies(["Còn hàng không", "Giá bao nhiêu", "Mua sản phẩm", "Gặp nhân viên"])
        )

    return AgentSuggestionResult(
        quick_replies=_clean_quick_replies(["Tư vấn thêm", "Giá bao nhiêu", "Gặp nhân viên"])
    )


def _sanitize_tool_decision(decision: AgentToolDecision) -> AgentToolDecision:
    if decision.selected_tool is None:
        if decision.needs_tool:
            return decision.model_copy(update={"needs_tool": False, "tool_args": {}})
        return decision.model_copy()

    if decision.selected_tool not in ALLOWED_DECISION_TOOLS:
        return decision.model_copy(update={"needs_tool": False, "selected_tool": None, "tool_args": {}})
    return decision.model_copy()


def execute_selected_tool(db: Session, decision: AgentToolDecision) -> ToolResult | None:
    if not decision.needs_tool:
        return None

    selected_tool = decision.selected_tool
    tool_args = decision.tool_args or {}
    query = tool_args.get("query") or tool_args.get("product_query") or tool_args.get("product_name")

    if selected_tool == "recommend_products":
        return search_product_recommendations(db, query)
    if selected_tool == "search_products":
        return search_products(db, query)
    if selected_tool == "check_stock":
        product_result = search_products(db, query)
        quantity = int(tool_args.get("quantity") or 1)
        return check_stock(product_result, quantity)

    return ToolResult(
        type="tool_execution",
        status="skipped",
        summary=f"Tool '{selected_tool}' khong hop le hoac chua duoc phep thuc thi trong pipeline nay.",
        data={"selected_tool": selected_tool},
    )


async def decide_next_tool(context: AgentConversationContext) -> AgentToolDecision:
    settings = get_settings()
    if not llm_available(settings):
        return _fallback_tool_decision(context)

    try:
        parsed = await generate_llm_json(
            TOOL_DECISION_PROMPT,
            {
                "conversation_id": context.conversation_id,
                "customer_name": context.customer_name,
                "customer_phone": context.customer_phone,
                "message": context.message,
                "history": context.history,
                "active_scenario": context.active_scenario,
                "active_product_focus": context.active_product_focus,
                "tool_catalog": list_agent_tools(),
            },
            temperature=0,
            settings=settings,
        )
        decision = AgentToolDecision.model_validate(parsed)
    except (LLMClientError, ValidationError, KeyError, TypeError, ValueError):
        return _fallback_tool_decision(context)

    return _sanitize_tool_decision(decision)


async def generate_customer_reply(
    context: AgentConversationContext,
    decision: AgentToolDecision,
    tool_result: ToolResult | None,
) -> AgentReplyResult:
    settings = get_settings()
    if not llm_available(settings):
        return _fallback_reply(context, decision, tool_result)

    try:
        parsed = await generate_llm_json(
            BEAUTY_CONSULTANT_REPLY_PROMPT,
            {
                "message": context.message,
                "customer_name": context.customer_name,
                "customer_phone": context.customer_phone,
                "history": context.history,
                "active_scenario": context.active_scenario,
                "active_product_focus": context.active_product_focus,
                "decision": decision.model_dump(),
                "tool_result": tool_result.model_dump() if tool_result else None,
            },
            temperature=0.4,
            settings=settings,
        )
        result = AgentReplyResult.model_validate(parsed)
    except (LLMClientError, ValidationError, KeyError, TypeError, ValueError):
        return _fallback_reply(context, decision, tool_result)

    if not result.reply.strip():
        return _fallback_reply(context, decision, tool_result)
    if _reply_mentions_internal_terms(result.reply):
        return _fallback_reply(context, decision, tool_result)
    return result


async def generate_quick_replies(
    context: AgentConversationContext,
    decision: AgentToolDecision,
    tool_result: ToolResult | None,
    reply_result: AgentReplyResult,
) -> AgentSuggestionResult:
    settings = get_settings()
    if not llm_available(settings):
        return _fallback_quick_replies(context, decision, tool_result, reply_result)

    try:
        parsed = await generate_llm_json(
            QUICK_REPLY_PROMPT,
            {
                "context": {
                    "conversation_id": context.conversation_id,
                    "customer_name": context.customer_name,
                    "customer_phone": context.customer_phone,
                    "message": context.message,
                    "history": context.history,
                    "active_scenario": context.active_scenario,
                    "active_product_focus": context.active_product_focus,
                },
                "decision": decision.model_dump(),
                "tool_result": tool_result.model_dump() if tool_result else None,
                "reply": reply_result.model_dump(),
            },
            temperature=0.3,
            settings=settings,
        )
        result = AgentSuggestionResult.model_validate(parsed)
    except (LLMClientError, ValidationError, KeyError, TypeError, ValueError):
        return _fallback_quick_replies(context, decision, tool_result, reply_result)

    cleaned = _clean_quick_replies(result.quick_replies)
    if not cleaned:
        return _fallback_quick_replies(context, decision, tool_result, reply_result)
    return AgentSuggestionResult(quick_replies=cleaned)
