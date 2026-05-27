import re
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.schemas import AgentPlan, ToolResult
from app.config import get_settings
from app.integrations.ghn.service import create_ghn_shipment_for_order, latest_shipment_for_order, refresh_ghn_tracking
from app.models import Order, ProductCache, Shipment
from app.shared.text import normalize_text
from app.shared.workspace import DEFAULT_WORKSPACE_ID


AGENT_TOOL_CATALOG = [
    {
        "name": "list_products",
        "purpose": "Lấy danh sách hàng hóa đang có trong KiotViet/cache để tư vấn hoặc so sánh.",
        "inputs": ["query optional", "limit optional"],
        "returns": "products: id, name, price, stock, metadata",
    },
    {
        "name": "search_products",
        "purpose": "Tìm sản phẩm gần nhất theo tên/nhu cầu khách.",
        "inputs": ["product_query"],
        "returns": "product_id, kiotviet_product_id, name, base_price, stock",
    },
    {
        "name": "recommend_products",
        "purpose": "Gợi ý nhiều sản phẩm phù hợp theo nhu cầu/loại da/ngân sách.",
        "inputs": ["query", "skin_type optional", "budget optional"],
        "returns": "recommended products with reason",
    },
    {
        "name": "check_stock",
        "purpose": "Kiểm tra tồn kho trước khi hỏi chốt đơn hoặc tạo đơn.",
        "inputs": ["product_id or product_result", "quantity"],
        "returns": "stock status",
    },
    {
        "name": "lookup_order",
        "purpose": "Tra cứu đơn hàng theo SĐT/mã đơn để xử lý hoàn tiền, thiếu hàng, kích ứng, trạng thái giao.",
        "inputs": ["customer_phone optional", "order_code optional"],
        "returns": "latest matching order and items",
    },
    {
        "name": "create_draft_order",
        "purpose": "Tạo đơn nháp sau khi đã có sản phẩm, số lượng, tên khách, SĐT, địa chỉ và khách xác nhận.",
        "inputs": ["confirmed order slots"],
        "returns": "order_id, total",
    },
    {
        "name": "create_invoice",
        "purpose": "Xuất hóa đơn điện tử từ đơn đã tạo.",
        "inputs": ["order_id"],
        "returns": "invoice payload with line items and payment QR data",
    },
    {
        "name": "create_shipping_order",
        "purpose": "Tự động gửi thông tin đơn hàng sang GHN sandbox sau khi khách xác nhận và hóa đơn đã tạo.",
        "inputs": ["order_id"],
        "returns": "GHN order_code, fee, expected_delivery_time, shipment status",
    },
    {
        "name": "track_shipping_order",
        "purpose": "Tra cứu trạng thái giao hàng từ GHN bằng mã vận đơn hoặc đơn hàng trong hệ thống.",
        "inputs": ["order_id optional", "order_code optional"],
        "returns": "shipment status and expected delivery time",
    },
    {
        "name": "book_appointment",
        "purpose": "Đặt lịch soi da/chăm sóc da/kích ứng sau khi khách xác nhận thông tin.",
        "inputs": ["customer_name", "phone", "slot", "clinic", "reason"],
        "returns": "appointment confirmation",
    },
    {
        "name": "create_support_ticket",
        "purpose": "Tạo ticket khiếu nại thiếu hàng/sai hàng/kích ứng sau khi đủ thông tin xử lý.",
        "inputs": ["order_id", "issue", "resolution"],
        "returns": "ticket status",
    },
    {
        "name": "ask_clarification",
        "purpose": "Hỏi thêm khi thiếu dữ liệu hoặc rủi ro tạo hành động sai.",
        "inputs": ["missing fields"],
        "returns": "next question",
    },
]


def list_agent_tools() -> list[dict]:
    return AGENT_TOOL_CATALOG


def list_products(db: Session, query: str | None = None, *, limit: int = 20) -> ToolResult:
    products_query = select(ProductCache).where(ProductCache.workspace_id == DEFAULT_WORKSPACE_ID).limit(300)
    products = list(db.scalars(products_query))
    query_norm = normalize_text(query or "")
    if query_norm:
        products = [product for product in products if _product_score(product, query_norm) > 0]
    products.sort(key=lambda product: normalize_text(product.name))
    rows = [
        {
            "id": product.id,
            "kiotviet_product_id": product.kiotviet_product_id,
            "name": product.name,
            "price": float(product.base_price),
            "stock": product.stock,
            "metadata": product.raw_json or {},
        }
        for product in products[:limit]
    ]
    return ToolResult(type="product_list", status="success", summary=f"Lấy {len(rows)} sản phẩm từ KiotViet/cache.", data={"products": rows})


def search_products(db: Session, query: str | None) -> ToolResult:
    if not query:
        return ToolResult(type="product_search", status="failed", summary="Chưa có tên sản phẩm.")
    products = list(db.scalars(select(ProductCache).where(ProductCache.workspace_id == DEFAULT_WORKSPACE_ID).limit(200)))
    query_norm = normalize_text(query)
    scored: list[tuple[int, ProductCache]] = []
    for product in products:
        score = _product_score(product, query_norm)
        if score:
            scored.append((score, product))
    if not scored:
        return ToolResult(type="product_search", status="failed", summary=f"Không tìm thấy sản phẩm gần với '{query}'.")
    scored.sort(key=lambda item: item[0], reverse=True)
    product = scored[0][1]
    return ToolResult(
        type="product_search",
        status="success",
        summary=f"Tìm thấy {product.name}.",
        data={"product_id": product.id, "kiotviet_product_id": product.kiotviet_product_id, "name": product.name, "base_price": float(product.base_price), "stock": product.stock},
    )


def search_product_recommendations(db: Session, query: str | None, *, limit: int = 5) -> ToolResult:
    if not query:
        return ToolResult(type="product_recommendation", status="failed", summary="Chưa có nhóm sản phẩm để tư vấn.")
    products = list(db.scalars(select(ProductCache).where(ProductCache.workspace_id == DEFAULT_WORKSPACE_ID).limit(200)))
    query_norm = normalize_text(query)
    max_budget = _extract_max_budget(query)
    scored: list[tuple[int, ProductCache]] = []
    for product in products:
        if max_budget is not None and float(product.base_price or 0) > max_budget:
            continue
        score = _product_score(product, query_norm)
        metadata_norm = normalize_text(" ".join(str(value) for value in (product.raw_json or {}).values()))
        for token in query_norm.split():
            if len(token) > 2 and token in metadata_norm:
                score += 8
        if score:
            scored.append((score, product))
    scored.sort(key=lambda item: item[0], reverse=True)
    recommendations = [
        {
            "id": product.id,
            "name": product.name,
            "price": float(product.base_price),
            "stock": product.stock,
            "reason": _recommendation_reason(product),
        }
        for _, product in scored[:limit]
    ]
    if not recommendations:
        return ToolResult(type="product_recommendation", status="failed", summary=f"Không tìm thấy sản phẩm phù hợp với '{query}'.", data={"products": []})
    return ToolResult(
        type="product_recommendation",
        status="success",
        summary=f"Tìm thấy {len(recommendations)} sản phẩm phù hợp với '{query}'.",
        data={"products": recommendations},
    )


def _extract_max_budget(query: str | None) -> float | None:
    normalized = normalize_text(query or "")
    match = re.search(
        r"(?:duoi|toi da|khong qua|nho hon|<=|<)\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|trieu|m)?",
        normalized,
    )
    if not match:
        return None
    amount = float(match.group(1).replace(",", "."))
    unit = match.group(2) or ""
    if unit in {"k", "nghin", "ngan"}:
        amount *= 1000
    elif unit in {"trieu", "m"}:
        amount *= 1_000_000
    elif amount < 10_000:
        amount *= 1000
    return amount


def lookup_order(db: Session, *, customer_phone: str | None = None, order_code: str | None = None) -> ToolResult:
    query = select(Order).where(Order.workspace_id == DEFAULT_WORKSPACE_ID)
    if order_code:
        order = db.scalar(query.where(Order.kiotviet_order_code == order_code))
    elif customer_phone:
        order = db.scalar(query.where(Order.customer_phone == customer_phone).order_by(Order.created_at.desc(), Order.id.desc()))
    else:
        order = None
    if not order:
        return ToolResult(type="order_lookup", status="failed", summary="Không tìm thấy đơn hàng theo thông tin khách cung cấp.")
    return ToolResult(
        type="order_lookup",
        status="success",
        summary=f"Tìm thấy đơn {order.kiotviet_order_code or f'#{order.id}'}.",
        data={
            "order_id": order.id,
            "order_code": order.kiotviet_order_code,
            "status": order.status,
            "total": float(order.total),
            "customer_name": order.customer_name,
            "customer_phone": order.customer_phone,
            "shipping_address": order.shipping_address,
            "items": order.items,
        },
    )


def check_stock(product_result: ToolResult, quantity: int) -> ToolResult:
    if product_result.status != "success":
        return ToolResult(type="stock_check", status="skipped", summary="Bỏ qua kiểm tra tồn vì chưa tìm thấy sản phẩm.")
    stock = int(product_result.data.get("stock") or 0)
    name = product_result.data.get("name")
    if stock >= quantity:
        return ToolResult(type="stock_check", status="success", summary=f"{name} còn {stock}, đủ để tạo đơn {quantity} sản phẩm.", data={"stock": stock})
    return ToolResult(type="stock_check", status="failed", summary=f"{name} chỉ còn {stock}, không đủ số lượng {quantity}.", data={"stock": stock})


def create_draft_order(db: Session, *, conversation_id: int, customer_id: int, plan: AgentPlan, product_result: ToolResult, stock_result: ToolResult) -> tuple[ToolResult, Order | None]:
    if stock_result.status != "success":
        return ToolResult(type="order_create", status="skipped", summary="Chưa tạo đơn vì tồn kho chưa đủ hoặc chưa xác định được sản phẩm."), None
    slots = plan.slots
    if not slots.customer_phone:
        return ToolResult(type="order_create", status="skipped", summary="Chưa tạo đơn vì thiếu số điện thoại khách."), None
    if not slots.shipping_address:
        return ToolResult(type="order_create", status="skipped", summary="Chưa tạo đơn vì thiếu địa chỉ giao hàng."), None

    quantity = max(slots.quantity, 1)
    price = Decimal(str(product_result.data.get("base_price") or 0))
    total = price * quantity
    item = {
        "product_id": product_result.data["product_id"],
        "kiotviet_product_id": product_result.data["kiotviet_product_id"],
        "name": product_result.data["name"],
        "quantity": quantity,
        "price": float(price),
    }
    order = Order(
        workspace_id=DEFAULT_WORKSPACE_ID,
        conversation_id=conversation_id,
        customer_id=customer_id,
        status="draft",
        total=total,
        customer_name=slots.customer_name,
        customer_phone=slots.customer_phone,
        shipping_address=slots.shipping_address,
        items=[item],
        raw_json={"source": plan.source, "payment_method": slots.payment_method, "real_kiotviet_order_enabled": get_settings().kiotviet_create_real_orders},
    )
    db.add(order)
    db.flush()
    return ToolResult(type="order_create", status="success", summary=f"Đã tạo đơn nháp #{order.id} tổng {int(total):,}đ.", data={"order_id": order.id, "total": float(total)}), order


def create_support_ticket(db: Session, *, conversation_id: int, issue: str, resolution: str, order_id: int | None = None) -> ToolResult:
    return ToolResult(
        type="support_ticket_create",
        status="success",
        summary="Đã tạo ticket hỗ trợ để nhân viên theo dõi.",
        data={"conversation_id": conversation_id, "order_id": order_id, "issue": issue, "resolution": resolution},
    )


def create_shipping_order(db: Session, *, order: Order) -> ToolResult:
    shipment, summary = create_ghn_shipment_for_order(db, order)
    if not shipment:
        return ToolResult(type="shipping_order_create", status="skipped", summary=summary)
    return ToolResult(
        type="shipping_order_create",
        status="success",
        summary=summary,
        data={
            "provider": shipment.provider,
            "order_id": order.id,
            "order_code": shipment.provider_order_code,
            "client_order_code": shipment.client_order_code,
            "status": shipment.status,
            "fee": float(shipment.fee or 0),
            "expected_delivery_time": shipment.expected_delivery_time,
        },
    )


def track_shipping_order(db: Session, *, order: Order | None = None, order_code: str | None = None) -> ToolResult:
    shipment = None
    if order:
        shipment = latest_shipment_for_order(db, order.id)
    if not shipment and order_code:
        shipment = db.scalar(select(Shipment).where(Shipment.provider == "ghn", Shipment.provider_order_code == order_code))
    if not shipment:
        return ToolResult(type="shipping_track", status="failed", summary="Chưa tìm thấy vận đơn GHN cho đơn hàng này.")
    shipment, summary = refresh_ghn_tracking(db, shipment)
    return ToolResult(
        type="shipping_track",
        status="success" if shipment.provider_order_code else "failed",
        summary=summary,
        data={
            "provider": shipment.provider,
            "order_code": shipment.provider_order_code,
            "status": shipment.status,
            "fee": float(shipment.fee or 0),
            "expected_delivery_time": shipment.expected_delivery_time,
        },
    )


def book_appointment(*, customer_name: str, customer_phone: str, slot: str, clinic: str, reason: str) -> ToolResult:
    return ToolResult(
        type="appointment_book",
        status="success",
        summary=f"Đã đặt lịch {slot} tại {clinic} cho {customer_name}.",
        data={"customer_name": customer_name, "customer_phone": customer_phone, "slot": slot, "clinic": clinic, "reason": reason},
    )


def _product_score(product: ProductCache, query_norm: str) -> int:
    if not query_norm:
        return 1
    name_norm = normalize_text(product.name)
    code_norm = normalize_text(product.code or "")
    metadata_norm = normalize_text(" ".join(str(value) for value in (product.raw_json or {}).values()))
    haystack = f"{name_norm} {code_norm} {metadata_norm}"
    score = 0
    if query_norm in haystack:
        score += 100
    for token in query_norm.split():
        if len(token) > 2 and token in haystack:
            score += 10
    if "kem chong nang" in query_norm and ("spf" in haystack or "uv" in haystack):
        score += 40
    if "ceramide" in query_norm and "ceramide" in haystack:
        score += 50
    return score


def _recommendation_reason(product: ProductCache) -> str:
    raw = product.raw_json or {}
    reasons: list[str] = []
    skin_types = raw.get("skin_types")
    if isinstance(skin_types, list) and skin_types:
        reasons.append("phù hợp " + ", ".join(str(item) for item in skin_types))
    if raw.get("texture"):
        reasons.append(str(raw["texture"]))
    if raw.get("notes"):
        reasons.append(str(raw["notes"]))
    if reasons:
        return "; ".join(reasons) + "."
    return "Phù hợp với nhu cầu tư vấn và đang có dữ liệu tồn kho từ KiotViet."
