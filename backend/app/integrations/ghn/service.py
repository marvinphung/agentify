from __future__ import annotations

from decimal import Decimal

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.integrations.ghn.client import GHNClient, GHNClientError
from app.integrations.ghn.schemas import GHNCreateOrderRequest, GHNItem
from app.models import Order, Shipment, ShipmentEvent
from app.shared.workspace import DEFAULT_WORKSPACE_ID


def is_ghn_configured() -> bool:
    return get_settings().ghn_enabled


def latest_shipment_for_order(db: Session, order_id: int) -> Shipment | None:
    return db.scalar(
        select(Shipment)
        .where(Shipment.order_id == order_id, Shipment.provider == "ghn")
        .order_by(desc(Shipment.created_at), desc(Shipment.id))
    )


def create_ghn_shipment_for_order(db: Session, order: Order) -> tuple[Shipment | None, str]:
    settings = get_settings()
    if not settings.ghn_enabled:
        return None, "Chưa cấu hình GHN_TOKEN/GHN_SHOP_ID nên chưa gửi vận đơn sang GHN."
    if not order.customer_name or not order.customer_phone or not order.shipping_address:
        return None, "Thiếu tên, SĐT hoặc địa chỉ khách để tạo vận đơn GHN."
    if not settings.ghn_from_phone or not settings.ghn_from_address or not settings.ghn_from_district_id or not settings.ghn_from_ward_code:
        return None, "Thiếu thông tin kho lấy hàng GHN trong backend/.env."
    to_district_id, to_ward_code = _resolve_destination_codes(order)
    if not to_district_id or not to_ward_code:
        return None, "Thiếu mã quận/huyện hoặc phường/xã GHN cho địa chỉ nhận hàng."

    existing = latest_shipment_for_order(db, order.id)
    if existing and existing.provider_order_code:
        return existing, f"Đơn đã có mã vận đơn GHN {existing.provider_order_code}."

    payload = _build_create_order_payload(order, to_district_id=to_district_id, to_ward_code=to_ward_code)
    try:
        result = GHNClient(settings).create_order(payload)
    except GHNClientError as exc:
        return None, str(exc)

    shipment = Shipment(
        workspace_id=DEFAULT_WORKSPACE_ID,
        order_id=order.id,
        provider="ghn",
        provider_order_code=result.order_code,
        client_order_code=payload.client_order_code,
        status=result.status,
        fee=Decimal(str(result.total_fee)),
        expected_delivery_time=result.expected_delivery_time,
        raw_json=result.raw,
    )
    db.add(shipment)
    db.flush()
    db.add(
        ShipmentEvent(
            shipment_id=shipment.id,
            status=result.status,
            description="Đã tạo vận đơn trên GHN sandbox.",
            raw_json=result.raw,
        )
    )
    return shipment, f"Đã gửi thông tin đơn hàng sang GHN, mã vận đơn {result.order_code}."


def refresh_ghn_tracking(db: Session, shipment: Shipment) -> tuple[Shipment, str]:
    settings = get_settings()
    if not settings.ghn_enabled:
        return shipment, "Chưa cấu hình GHN_TOKEN/GHN_SHOP_ID nên chưa cập nhật được tracking."
    if not shipment.provider_order_code:
        return shipment, "Shipment chưa có mã vận đơn GHN."

    try:
        result = GHNClient(settings).order_detail(shipment.provider_order_code)
    except GHNClientError as exc:
        return shipment, str(exc)

    shipment.status = result.status
    if result.expected_delivery_time:
        shipment.expected_delivery_time = result.expected_delivery_time
    shipment.raw_json = result.raw
    db.add(
        ShipmentEvent(
            shipment_id=shipment.id,
            status=result.status,
            description=result.status_name or "Đã cập nhật trạng thái từ GHN.",
            raw_json=result.raw,
        )
    )
    return shipment, _tracking_summary(shipment)


def _build_create_order_payload(order: Order, *, to_district_id: int, to_ward_code: str) -> GHNCreateOrderRequest:
    settings = get_settings()
    items = [
        GHNItem(
            name=str(item.get("name") or "Sản phẩm"),
            quantity=int(item.get("quantity") or 1),
            price=int(float(item.get("price") or 0)),
            weight=settings.ghn_default_weight_gram,
        )
        for item in order.items
        if isinstance(item, dict)
    ]
    total = int(order.total or 0)
    return GHNCreateOrderRequest(
        payment_type_id=settings.ghn_payment_type_id,
        note="Đơn tạo tự động bởi Agentify.",
        required_note=settings.ghn_default_required_note,
        return_phone=settings.ghn_from_phone,
        return_address=settings.ghn_from_address,
        return_district_id=settings.ghn_from_district_id,
        return_ward_code=settings.ghn_from_ward_code,
        client_order_code=f"AGENTIFY-{order.id}",
        from_name=settings.ghn_from_name,
        from_phone=settings.ghn_from_phone,
        from_address=settings.ghn_from_address,
        to_name=order.customer_name or "Khách hàng",
        to_phone=order.customer_phone or "",
        to_address=order.shipping_address or "",
        to_district_id=to_district_id,
        to_ward_code=to_ward_code,
        cod_amount=total,
        content=", ".join(item.name for item in items)[:2000] or "Mỹ phẩm Lumi Beauty",
        weight=max(settings.ghn_default_weight_gram, sum(item.weight * item.quantity for item in items)),
        length=settings.ghn_default_length_cm,
        width=settings.ghn_default_width_cm,
        height=settings.ghn_default_height_cm,
        insurance_value=min(total, 5_000_000),
        service_type_id=settings.ghn_service_type_id,
        items=items,
    )


def _resolve_destination_codes(order: Order) -> tuple[int, str]:
    raw = order.raw_json if isinstance(order.raw_json, dict) else {}
    shipment = raw.get("shipment") if isinstance(raw.get("shipment"), dict) else {}
    district_id = int(shipment.get("to_district_id") or get_settings().ghn_default_to_district_id or 0)
    ward_code = str(shipment.get("to_ward_code") or get_settings().ghn_default_to_ward_code or "")
    return district_id, ward_code


def _tracking_summary(shipment: Shipment) -> str:
    code = shipment.provider_order_code or "chưa có mã"
    status = shipment.status or "unknown"
    eta = f", dự kiến giao {shipment.expected_delivery_time}" if shipment.expected_delivery_time else ""
    return f"Mã vận đơn GHN {code} đang ở trạng thái {status}{eta}."
