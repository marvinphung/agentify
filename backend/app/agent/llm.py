from pydantic import ValidationError

from app.agent.llm_client import LLMClientError, generate_llm_json, llm_available
from app.agent.parser import parse_message
from app.agent.schemas import AgentPlan
from app.agent.tools import list_agent_tools
from app.config import get_settings


SYSTEM_PROMPT = """Bạn là planner cho Agentify, một nhân viên AI bán hàng tiếng Việt.
Chỉ trả JSON thuần, không markdown.
Không tự bịa tool. Tool hợp lệ nằm trong tool_catalog. Các tool quan trọng gồm:
- list_products: lấy danh sách hàng hóa KiotViet/cache.
- search_products: tìm sản phẩm theo tên/nhu cầu.
- recommend_products: gợi ý nhiều sản phẩm theo loại da/ngân sách.
- check_stock: kiểm tra tồn kho.
- lookup_order: tra cứu đơn theo SĐT/mã đơn.
- create_draft_order: chỉ dùng sau khi đủ thông tin và khách xác nhận.
- create_invoice: xuất hóa đơn từ đơn đã tạo.
- book_appointment: đặt lịch sau khi khách xác nhận.
- create_support_ticket: tạo ticket khiếu nại.
- ask_clarification: hỏi thêm thông tin.
Intent hợp lệ: product_consultation, buy_product, ask_stock, unknown.
Nhiệm vụ: trích xuất intent, slots và tool_plan từ tin nhắn khách.
Slots cần trích xuất kỹ: product_query, quantity, customer_name, customer_phone, shipping_address, payment_method.
payment_method chỉ nhận "cod" nếu khách muốn thanh toán khi nhận hàng/trả sau, hoặc "prepaid" nếu khách muốn chuyển khoản/QR/thanh toán trước.
Nếu khách chỉ hỏi "tư vấn", "gợi ý", "nên dùng", "phù hợp" hoặc hỏi loại sản phẩm như kem chống nắng/serum/sữa rửa mặt mà chưa nói mua/đặt/lấy/lên đơn, intent phải là product_consultation và không được dùng create_draft_order.
Chỉ dùng buy_product/create_draft_order khi khách có ý định đặt/mua/chốt lấy rõ ràng.
Nếu khách viết "Chị là/Tên chị/Người nhận là ..." thì đó là customer_name, không phải địa chỉ.
Nếu khách viết "giao tới/địa chỉ ..." thì shipping_address chỉ là phần địa chỉ, dừng trước số điện thoại, tên người nhận, khung giờ nhận hàng hoặc hình thức thanh toán.
Nếu thiếu số điện thoại hoặc địa chỉ khi đặt hàng, vẫn tìm/check hàng nhưng dùng ask_clarification thay vì tạo đơn.
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
