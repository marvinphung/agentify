from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ShipmentResponse(BaseModel):
    id: int
    order_id: int
    provider: str
    provider_order_code: str | None
    client_order_code: str | None
    status: str
    fee: float
    expected_delivery_time: str | None
    raw_json: dict[str, Any]
    created_at: datetime


class ShipmentEventResponse(BaseModel):
    id: int
    shipment_id: int
    status: str
    description: str | None
    raw_json: dict[str, Any]
    created_at: datetime


class ShippingStatusResponse(BaseModel):
    provider: str
    status: str
    env: str
    shop_id: str | None
    from_name: str | None
    from_phone: str | None
    from_address: str | None
