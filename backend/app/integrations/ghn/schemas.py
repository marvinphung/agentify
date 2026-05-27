from __future__ import annotations

from pydantic import BaseModel, Field


class GHNItem(BaseModel):
    name: str
    quantity: int = 1
    price: int = 0
    weight: int = 500


class GHNCreateOrderRequest(BaseModel):
    payment_type_id: int
    note: str = ""
    required_note: str
    return_phone: str | None = None
    return_address: str | None = None
    return_district_id: int | None = None
    return_ward_code: str | None = None
    client_order_code: str
    from_name: str
    from_phone: str
    from_address: str
    from_ward_name: str | None = None
    from_district_name: str | None = None
    from_province_name: str | None = None
    to_name: str
    to_phone: str
    to_address: str
    to_ward_code: str
    to_district_id: int
    cod_amount: int = 0
    content: str
    weight: int
    length: int
    width: int
    height: int
    insurance_value: int = 0
    service_type_id: int
    items: list[GHNItem] = Field(default_factory=list)


class GHNShipmentResult(BaseModel):
    order_code: str
    status: str = "created"
    total_fee: int = 0
    expected_delivery_time: str | None = None
    raw: dict = Field(default_factory=dict)


class GHNTrackingResult(BaseModel):
    order_code: str
    status: str
    status_name: str | None = None
    expected_delivery_time: str | None = None
    raw: dict = Field(default_factory=dict)
