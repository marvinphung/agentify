from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.schemas import AgentPlan, ToolResult
from app.config import get_settings
from app.models import Order, ProductCache
from app.shared.text import normalize_text
from app.shared.workspace import DEFAULT_WORKSPACE_ID


def search_products(db: Session, query: str | None) -> ToolResult:
    if not query:
        return ToolResult(type="product_search", status="failed", summary="Chưa có tên sản phẩm.")
    products = list(db.scalars(select(ProductCache).where(ProductCache.workspace_id == DEFAULT_WORKSPACE_ID).limit(200)))
    query_norm = normalize_text(query)
    scored: list[tuple[int, ProductCache]] = []
    for product in products:
        name_norm = normalize_text(product.name)
        score = 0
        if query_norm in name_norm:
            score += 100
        score += sum(10 for token in query_norm.split() if token in name_norm)
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
