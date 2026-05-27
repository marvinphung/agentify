from pydantic import ValidationError

from app.agent.llm_client import LLMClientError, generate_llm_json, llm_available
from app.agent.parser import parse_message
from app.agent.schemas import AgentPlan
from app.agent.tools import list_agent_tools
from app.config import get_settings


SYSTEM_PROMPT = """Bạn là planner cho Agentify, một nhân viên AI bán hàng tiếng Việt cho Lumi Beauty.
Chỉ trả JSON thuần, không markdown, không giải thích ngoài JSON.

Schema phải khớp AgentPlan:
{
  "intent": "product_consultation|buy_product|ask_stock|unknown",
  "slots": {
    "product_query": string|null,
    "quantity": number,
    "customer_name": string|null,
    "customer_phone": string|null,
    "shipping_address": string|null,
    "payment_method": "cod|prepaid"|null
  },
  "tool_plan": string[],
  "reply_if_missing": string|null
}

Tool hợp lệ nằm trong tool_catalog. Không tự bịa tool.
Các tool quan trọng:
- list_products: lấy danh sách hàng hóa KiotViet/cache.
- search_products: tìm sản phẩm theo tên/nhu cầu.
- recommend_products: gợi ý nhiều sản phẩm theo loại da/ngân sách.
- check_stock: kiểm tra tồn kho.
- lookup_order: tra cứu đơn theo SĐT/mã đơn.
- create_draft_order: chỉ dùng khi đã đủ sản phẩm, số lượng, tên người nhận, SĐT, địa chỉ và khách đã xác nhận.
- create_invoice: xuất hóa đơn từ đơn đã tạo.
- book_appointment: đặt lịch sau khi khách xác nhận.
- create_support_ticket: tạo ticket khiếu nại.
- ask_clarification: hỏi thêm thông tin.

Quy tắc intent:
- Nếu khách hỏi "tư vấn", "gợi ý", "nên dùng", "phù hợp", "loại nào", "rẻ nhất", hoặc mô tả loại da/ngân sách mà chưa nói mua/đặt/lấy/chốt, intent là product_consultation.
- Nếu khách nói mua/đặt/lấy/chốt/đồng ý lấy rõ ràng, intent là buy_product.
- Nếu khách hỏi còn hàng/tồn kho, intent là ask_stock.
- Tin nhắn ngắn như "ok", "lấy loại đó", "da dầu", "rẻ nhất" phải giữ ngữ cảnh sản phẩm đang được nói tới nếu message hoặc fallback parser có product_query.
- Không chuyển product_consultation thành buy_product chỉ vì khách nói "tư vấn kỹ hơn" hoặc "phù hợp".

Quy tắc slot:
- Trích xuất product_query ngắn gọn, giữ tên sản phẩm hoặc nhóm sản phẩm chính.
- quantity mặc định là 1, không lấy số trong SPF50/30ml/10% làm quantity.
- Nếu khách viết "chị là", "tên chị", "người nhận là", đó là customer_name.
- Nếu khách viết "giao tới", "giao đến", "địa chỉ", shipping_address chỉ lấy phần địa chỉ; dừng trước SĐT, tên người nhận, giờ nhận hàng, hình thức thanh toán.
- payment_method là "cod" nếu khách trả khi nhận hàng/trả sau; là "prepaid" nếu khách chuyển khoản/QR/thanh toán trước.
- Nếu thiếu tên, SĐT hoặc địa chỉ khi đặt hàng, vẫn có thể dùng search_products/check_stock nhưng phải thêm ask_clarification và không dùng create_draft_order.
"""


async def plan_with_llm(message: str, *, customer_name: str | None, customer_phone: str | None) -> AgentPlan:
    settings = get_settings()
    fallback_plan = parse_message(message, customer_name=customer_name, customer_phone=customer_phone)
    if not llm_available(settings):
        return fallback_plan

    try:
        parsed = await generate_llm_json(
            SYSTEM_PROMPT,
            {
                "message": message,
                "customer_name": customer_name,
                "customer_phone": customer_phone,
                "tool_catalog": list_agent_tools(),
            },
            temperature=0,
            settings=settings,
        )
        plan = AgentPlan.model_validate(parsed)
        plan = _merge_missing_slots(plan, fallback_plan)
        if "create_draft_order" in plan.tool_plan:
            plan.intent = "buy_product"
        if fallback_plan.intent == "product_consultation" and plan.intent == "buy_product":
            plan.intent = "product_consultation"
            plan.tool_plan = [tool for tool in plan.tool_plan if tool != "create_draft_order"] or ["search_products"]
        plan.source = "llm"
        return plan
    except (LLMClientError, ValidationError):
        return fallback_plan


def _merge_missing_slots(plan: AgentPlan, fallback_plan: AgentPlan) -> AgentPlan:
    for field in ("product_query", "customer_name", "customer_phone", "shipping_address", "payment_method"):
        if not getattr(plan.slots, field):
            setattr(plan.slots, field, getattr(fallback_plan.slots, field))
    if not plan.slots.quantity or plan.slots.quantity <= 0:
        plan.slots.quantity = fallback_plan.slots.quantity
    if not plan.tool_plan:
        plan.tool_plan = fallback_plan.tool_plan
    if plan.intent == "unknown" and fallback_plan.intent != "unknown":
        plan.intent = fallback_plan.intent
    if fallback_plan.intent == "product_consultation" and plan.intent == "buy_product":
        plan.intent = "product_consultation"
        plan.tool_plan = [tool for tool in plan.tool_plan if tool != "create_draft_order"] or ["search_products"]
    return plan
