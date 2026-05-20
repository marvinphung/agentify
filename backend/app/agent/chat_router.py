import json
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.agent.chat_schemas import AgentChatRequest, AgentChatResponse, AgentRecommendedProduct
from app.config import get_settings
from app.database import get_db
from app.models import AgentAction, Conversation, Customer, Message, Order, ProductCache
from app.shared.text import normalize_text
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace

router = APIRouter(prefix="/api/agent", tags=["agent"])


INTENT_SYSTEM_PROMPT = """Bạn là nhân viên AI tiếng Việt cho Lumi Beauty, một spa/beauty có bán mỹ phẩm online.
Nhiệm vụ: trả lời khách tự nhiên, an toàn, ngắn gọn nhưng hữu ích.

Bạn phải trả JSON thuần:
{
  "intent": "product_consultation|order_status|place_order|post_purchase_complaint|appointment_booking|general",
  "reply": "câu trả lời tiếng Việt gửi khách",
  "product_keywords": ["từ khóa sản phẩm cần gợi ý"],
  "quick_replies": ["các lựa chọn ngắn cho khách bấm"],
  "actions": ["những việc Agentify đã làm"]
}

Quy tắc:
- Luôn xưng hô bằng đúng tên khách nếu có customer_name, giữ nguyên họ tên đã nhập, không tự rút gọn tên. Ví dụ customer_name là "Hoàng Linh" thì viết "Dạ chị Hoàng Linh...", không viết "Dạ chị Linh...".
- reply là tin nhắn chat thuần văn bản, không dùng markdown, không dùng **in đậm**, không dùng bullet markdown phức tạp.
- Các phản hồi chăm sóc khách hàng nên kết thúc lịch sự bằng một câu cảm ơn ngắn khi phù hợp, ví dụ "Em cảm ơn chị."
- Nếu khách hỏi trạng thái đơn mà thiếu mã đơn, có thể dùng số điện thoại nếu có; nếu không có, hỏi xin SĐT/mã đơn.
- Luôn đọc conversation_history để hiểu ngữ cảnh trước đó. Nếu tin nhắn hiện tại là câu ngắn như "ok", "đặt mua ngay", "da mụn", "lấy loại đó", phải suy luận theo sản phẩm/nhu cầu vừa được nhắc trong hội thoại, không hỏi lại từ đầu.
- Nếu active_product_focus có giá trị, phải giữ đúng nhóm sản phẩm đó khi tư vấn tiếp. Ví dụ active_product_focus là "tẩy da chết" và khách nói "da nhạy cảm" thì tư vấn tẩy da chết phù hợp da nhạy cảm, không chuyển sang sữa rửa mặt/toner/kem dưỡng trừ khi khách yêu cầu đổi nhóm sản phẩm.
- Nếu khách hỏi đơn giao trễ, chưa nhận được hàng, đổi/trả hàng hoặc hoàn tiền và có order_history, phải mở đầu bằng: "Sau khi tra lịch sử mua hàng, em thấy chị [tên] mới có đơn #[id] ..." rồi nói trạng thái/sản phẩm trong đơn và hỏi thêm thông tin cần thiết.
- Nếu khách hỏi tư vấn sản phẩm, hãy hỏi thêm loại da/ngân sách nếu thiếu và vẫn gợi ý nhóm sản phẩm phù hợp.
- Nếu khách nói đang treatment, dùng retinol, AHA/BHA, peel, da đỏ rát, bong tróc hoặc rất nhạy cảm: tư vấn thận trọng, không khẳng định an toàn tuyệt đối. Nên khuyên thử vùng nhỏ, dùng tần suất thấp, tránh dùng cùng ngày với retinol/AHA/BHA/peel; nếu da đang đỏ rát/bong tróc thì tạm ngưng hoạt chất mạnh và mời chuyên viên kiểm tra.
- Nếu khách phản hồi kích ứng, phải trấn an, khuyên tạm ngưng sản phẩm, hỏi thông tin đơn hàng/SĐT/họ tên để tra hồ sơ, và mời kiểm tra miễn phí. Không chẩn đoán bệnh.
- Nếu khách muốn đặt hàng nhưng thiếu địa chỉ/SĐT, hỏi lại thông tin còn thiếu.
"""


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(payload: AgentChatRequest, db: Session = Depends(get_db)) -> AgentChatResponse:
    ensure_default_workspace(db)
    customer = _find_or_create_customer(db, payload)
    conversation = _find_or_create_conversation(db, payload.conversation_id, customer.id)
    db.add(Message(conversation_id=conversation.id, sender="customer", content=payload.message))
    db.flush()

    products = _load_products(db)
    order_history = _load_order_history(db, payload.customer_phone)
    conversation_history = _load_conversation_history(db, conversation.id)
    active_product_focus = _resolve_active_product_focus(payload.message, conversation_history)
    llm_response = await _call_llm(payload, products, order_history, conversation_history, active_product_focus)
    if llm_response is None:
        llm_response = _fallback_response(payload.message, payload.customer_name, payload.customer_phone, order_history)
    if _is_order_support_message(payload.message) and order_history:
        llm_response = _order_history_response(payload.customer_name, order_history)

    intent = llm_response.get("intent") or "general"
    reply = llm_response.get("reply") or "Dạ em đã nhận tin nhắn của chị. Chị cho em thêm thông tin để em hỗ trợ chính xác hơn nhé."
    actions = llm_response.get("actions") or ["LLM đã phân loại tin nhắn và tạo phản hồi"]
    db.add(Message(conversation_id=conversation.id, sender="ai", content=reply))
    for action in actions:
        db.add(AgentAction(conversation_id=conversation.id, action_type="llm_chat", status="success", summary=action, raw_json={"intent": intent}))
    conversation.status = _status_from_intent(intent)
    db.commit()
    db.refresh(conversation)

    recommended = [] if intent in {"order_status", "appointment_booking"} else _recommend_products(products, llm_response.get("product_keywords") or [], payload.message, active_product_focus)
    return AgentChatResponse(
        conversation_id=conversation.id,
        intent=intent,
        reply=reply,
        recommended_products=recommended,
        quick_replies=llm_response.get("quick_replies") or [],
        actions=actions,
    )


def _find_or_create_customer(db: Session, payload: AgentChatRequest) -> Customer:
    customer = None
    if payload.customer_phone:
        customer = db.scalar(
            select(Customer).where(
                Customer.workspace_id == DEFAULT_WORKSPACE_ID,
                Customer.phone == payload.customer_phone,
                Customer.channel == "user_chat",
            )
        )
    if customer:
        customer.name = payload.customer_name
        return customer
    customer = Customer(workspace_id=DEFAULT_WORKSPACE_ID, name=payload.customer_name, phone=payload.customer_phone, channel="user_chat")
    db.add(customer)
    db.flush()
    return customer


def _find_or_create_conversation(db: Session, conversation_id: int | None, customer_id: int) -> Conversation:
    if conversation_id:
        conversation = db.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.workspace_id == DEFAULT_WORKSPACE_ID,
            )
        )
        if conversation:
            conversation.customer_id = customer_id
            conversation.updated_at = datetime.now(UTC)
            return conversation
    conversation = Conversation(workspace_id=DEFAULT_WORKSPACE_ID, customer_id=customer_id, channel="user_chat", status="open")
    db.add(conversation)
    db.flush()
    return conversation


def _status_from_intent(intent: str) -> str:
    if intent == "post_purchase_complaint":
        return "needs_review"
    if intent == "appointment_booking":
        return "appointment_pending"
    if intent == "place_order":
        return "order_pending"
    return "open"


def _load_products(db: Session) -> list[ProductCache]:
    return list(db.scalars(select(ProductCache).where(ProductCache.workspace_id == DEFAULT_WORKSPACE_ID).order_by(ProductCache.name).limit(80)))


def _load_order_history(db: Session, phone: str | None) -> list[dict]:
    if not phone:
        return []
    orders = list(
        db.scalars(
            select(Order)
            .where(Order.workspace_id == DEFAULT_WORKSPACE_ID, Order.customer_phone == phone)
            .order_by(desc(Order.created_at))
            .limit(3)
        )
    )
    return [
        {
            "id": order.id,
            "status": order.status,
            "total": float(order.total),
            "customer_name": order.customer_name,
            "shipping_address": order.shipping_address,
            "items": order.items,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }
        for order in orders
    ]


def _load_conversation_history(db: Session, conversation_id: int, limit: int = 16) -> list[dict]:
    rows = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(desc(Message.created_at), desc(Message.id))
            .limit(limit)
        )
    )
    rows.reverse()
    return [
        {
            "role": "assistant" if message.sender == "ai" else "user",
            "content": message.content,
        }
        for message in rows
    ]


PRODUCT_FOCUS_PATTERNS = (
    ("tẩy da chết", ("tay da chet", "peel", "enzyme")),
    ("kem chống nắng", ("kem chong nang", "spf", "chong nang")),
    ("serum", ("serum", "vitamin c", "retinol", "niacinamide")),
    ("sữa rửa mặt", ("sua rua mat", "rua mat")),
    ("mặt nạ", ("mat na", "mask")),
    ("kem dưỡng", ("kem duong", "duong am", "cap am", "phuc hoi")),
    ("toner", ("toner", "nuoc hoa hong")),
    ("dầu gội", ("dau goi",)),
)


def _detect_product_focus(text: str) -> str | None:
    normalized = normalize_text(text)
    for label, patterns in PRODUCT_FOCUS_PATTERNS:
        if any(pattern in normalized for pattern in patterns):
            return label
    return None


def _resolve_active_product_focus(message: str, conversation_history: list[dict]) -> str | None:
    explicit_focus = _detect_product_focus(message)
    if explicit_focus:
        return explicit_focus
    for item in reversed(conversation_history):
        focus = _detect_product_focus(str(item.get("content") or ""))
        if focus:
            return focus
    return None


def _product_matches_focus(product: ProductCache, focus: str | None) -> bool:
    if not focus:
        return True
    return normalize_text(focus) in normalize_text(product.name)


async def _call_llm(payload: AgentChatRequest, products: list[ProductCache], order_history: list[dict], conversation_history: list[dict], active_product_focus: str | None) -> dict | None:
    settings = get_settings()
    if not settings.llm_api_key:
        return None
    focused_products = [product for product in products if _product_matches_focus(product, active_product_focus)]
    context_products = focused_products or products
    product_context = [
        {"name": product.name, "price": float(product.base_price), "stock": product.stock}
        for product in context_products[:50]
    ]
    request_body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": INTENT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "customer_name": payload.customer_name,
                        "customer_phone": payload.customer_phone,
                        "message": payload.message,
                        "conversation_history": conversation_history,
                        "active_product_focus": active_product_focus,
                        "available_products": product_context,
                        "order_history": order_history,
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
            response = await client.post(f"{settings.llm_base_url.rstrip('/')}/chat/completions", headers=headers, json=request_body)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"].get("content")
        return json.loads(content) if content else None
    except (httpx.HTTPError, KeyError, TypeError, json.JSONDecodeError):
        return None


def _recommend_products(products: list[ProductCache], keywords: list[str], message: str, active_product_focus: str | None = None) -> list[AgentRecommendedProduct]:
    query = normalize_text(" ".join(keywords) + " " + message + " " + (active_product_focus or ""))
    candidate_products = [product for product in products if _product_matches_focus(product, active_product_focus)] or products
    scored: list[tuple[int, ProductCache]] = []
    for product in candidate_products:
        name = normalize_text(product.name)
        score = 0
        for token in query.split():
            if len(token) > 2 and token in name:
                score += 5
        if "mat na" in query and "mat na" in name:
            score += 30
        if "kem chong nang" in query and "kem chong nang" in name:
            score += 30
        if "serum" in query and "serum" in name:
            score += 30
        if "sua rua mat" in query and "sua rua mat" in name:
            score += 30
        if "duong" in query and ("duong" in name or "cap am" in name):
            score += 20
        if "tay da chet" in query and "tay da chet" in name:
            score += 30
        if active_product_focus and _product_matches_focus(product, active_product_focus):
            score += 20
        if score:
            scored.append((score, product))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        AgentRecommendedProduct(
            id=product.id,
            name=product.name,
            price=float(product.base_price),
            stock=product.stock,
            reason="Phù hợp với nhu cầu chị vừa mô tả và đang có sẵn trong KiotViet.",
        )
        for _, product in scored[:5]
    ]


def _is_order_support_message(message: str) -> bool:
    text = normalize_text(message)
    return any(token in text for token in ("don", "chua nhan", "tre", "giao cham", "tra hang", "doi hang", "hoan tien", "huy don"))


def _order_history_response(customer_name: str | None, order_history: list[dict]) -> dict:
    latest_order = order_history[0]
    display_name = customer_name or latest_order.get("customer_name") or "chị"
    items = latest_order.get("items") or []
    first_item = items[0].get("name") if items and isinstance(items[0], dict) else "sản phẩm"
    status_label = "đang chờ shop xác nhận và chuẩn bị giao" if latest_order.get("status") == "draft" else latest_order.get("status")
    return {
        "intent": "order_status",
        "reply": f"Dạ chị {display_name}, sau khi tra lịch sử mua hàng, em thấy chị mới có đơn #{latest_order['id']} gồm {first_item}, tổng {int(latest_order.get('total') or 0):,}đ. Đơn hiện {status_label}. Chị đang cần kiểm tra giao trễ, đổi/trả hàng hay muốn gặp nhân viên hỗ trợ ạ? Em cảm ơn chị.",
        "product_keywords": [],
        "quick_replies": ["Đơn giao trễ", "Muốn trả hàng", "Muốn đổi sản phẩm", "Gặp nhân viên"],
        "actions": ["Tra lịch sử mua hàng theo số điện thoại", "Xác định đơn gần nhất"],
    }


def _fallback_response(message: str, customer_name: str | None, phone: str | None, order_history: list[dict]) -> dict:
    text = normalize_text(message)
    display_name = customer_name or "chị"
    is_order_question = any(token in text for token in ("don", "giao", "ship", "chua nhan", "tre", "tra hang", "doi hang", "hoan tien", "huy don"))
    if is_order_question:
        if order_history:
            return _order_history_response(customer_name, order_history)
        return {
            "intent": "order_status",
            "reply": f"Dạ chị {display_name}, em chưa thấy đơn gần đây theo {'số ' + phone if phone else 'thông tin chị cung cấp'}. Chị gửi giúp em mã đơn hoặc số điện thoại mua hàng để Lumi kiểm tra chính xác hơn ạ. Em cảm ơn chị.",
            "product_keywords": [],
            "quick_replies": ["Gửi mã đơn", "Gửi số điện thoại", "Gặp nhân viên"],
            "actions": ["Nhận diện câu hỏi sau mua", "Cần thêm thông tin đơn hàng"],
        }
    if "kich ung" in text or "rat" in text or "do da" in text:
        return {
            "intent": "post_purchase_complaint",
            "reply": f"Dạ chị {display_name}, em rất tiếc vì da chị đang khó chịu. Chị tạm ngưng sản phẩm, rửa mặt bằng nước mát và tránh treatment mạnh. Chị gửi giúp em mã đơn hoặc số điện thoại mua hàng để em mở hồ sơ và đặt lịch kiểm tra miễn phí cho chị nhé. Em cảm ơn chị.",
            "product_keywords": ["phục hồi", "xịt khoáng", "mặt nạ"],
            "quick_replies": ["Dùng số điện thoại này", "Đặt lịch kiểm tra miễn phí", "Gặp chuyên viên"],
            "actions": ["Nhận diện phản hồi kích ứng", "Kích hoạt quy trình chăm sóc sau mua"],
        }
    return {
        "intent": "product_consultation",
        "reply": f"Dạ chị {display_name}, em tư vấn được ạ. Chị cho em biết loại da của mình và ngân sách mong muốn nhé. Em cũng gửi vài sản phẩm phù hợp để chị tham khảo trước. Em cảm ơn chị.",
        "product_keywords": message.split(),
        "quick_replies": ["Da dầu", "Da mụn", "Da khô", "Da nhạy cảm"],
        "actions": ["Nhận diện nhu cầu tư vấn sản phẩm", "Tìm sản phẩm phù hợp"],
    }
