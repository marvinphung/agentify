import json

import httpx
from pydantic import ValidationError

from app.agent.parser import parse_message
from app.agent.schemas import AgentPlan
from app.config import get_settings


SYSTEM_PROMPT = """Bạn là planner cho Agentify, một nhân viên AI bán hàng tiếng Việt.
Chỉ trả JSON thuần, không markdown.
Không tự bịa tool. Tool hợp lệ: search_products, check_stock, create_draft_order, ask_clarification.
Intent hợp lệ: buy_product, ask_stock, unknown.
Nhiệm vụ: trích xuất intent, slots và tool_plan từ tin nhắn khách.
Slots cần trích xuất kỹ: product_query, quantity, customer_name, customer_phone, shipping_address, payment_method.
payment_method chỉ nhận "cod" nếu khách muốn thanh toán khi nhận hàng/trả sau, hoặc "prepaid" nếu khách muốn chuyển khoản/QR/thanh toán trước.
Nếu khách viết "Chị là/Tên chị/Người nhận là ..." thì đó là customer_name, không phải địa chỉ.
Nếu khách viết "giao tới/địa chỉ ..." thì shipping_address chỉ là phần địa chỉ, dừng trước số điện thoại, tên người nhận hoặc hình thức thanh toán.
Nếu thiếu số điện thoại hoặc địa chỉ khi đặt hàng, vẫn tìm/check hàng nhưng dùng ask_clarification thay vì tạo đơn.
"""


async def plan_with_llm(message: str, *, customer_name: str | None, customer_phone: str | None) -> AgentPlan:
    settings = get_settings()
    fallback_plan = parse_message(message, customer_name=customer_name, customer_phone=customer_phone)
    if not settings.llm_api_key:
        return fallback_plan

    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {"message": message, "customer_name": customer_name, "customer_phone": customer_phone},
                    ensure_ascii=False,
                ),
            },
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.llm_http_referer,
        "X-OpenRouter-Title": settings.llm_app_title,
    }
    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"].get("content")
        if not content:
            raise ValueError("LLM returned empty content")
        plan = AgentPlan.model_validate_json(content)
        plan = _merge_missing_slots(plan, fallback_plan)
        if "create_draft_order" in plan.tool_plan:
            plan.intent = "buy_product"
        plan.source = "llm"
        return plan
    except (httpx.HTTPError, KeyError, TypeError, ValueError, ValidationError, json.JSONDecodeError):
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
    return plan
