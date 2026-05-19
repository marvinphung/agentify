from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class OrderResponse(BaseModel):
    id: int
    status: str
    total: Decimal
    customer_name: str | None
    customer_phone: str | None
    shipping_address: str | None
    items: list[dict[str, Any]]
    kiotviet_order_code: str | None
    created_at: datetime

