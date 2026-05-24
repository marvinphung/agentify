from __future__ import annotations

from app.agent.schemas import InvoiceLineItem, InvoicePayload
from app.models import Order


def build_invoice_payload(order: Order) -> InvoicePayload:
    items = [
        InvoiceLineItem(
            name=str(item.get("name") or "Sản phẩm"),
            quantity=int(item.get("quantity") or 1),
            unit_price=float(item.get("price") or 0),
            line_total=float(item.get("price") or 0) * int(item.get("quantity") or 1),
        )
        for item in order.items
        if isinstance(order.items, list)
    ]
    total = float(order.total or 0)
    return InvoicePayload(
        order_id=order.id,
        status=order.status,
        total=total,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        shipping_address=order.shipping_address,
        items=items,
        payment_method=get_payment_method(order),
    )


def get_payment_method(order: Order) -> str | None:
    raw_payment = None
    raw = order.raw_json
    if isinstance(raw, dict):
        raw_payment = raw.get("payment_method")
    if isinstance(raw_payment, str):
        return raw_payment
    return None
