from datetime import datetime
from decimal import Decimal

from typing import Any

from pydantic import BaseModel, Field


class DemoMessageRequest(BaseModel):
    customer_name: str = Field(default="Khách demo", min_length=1)
    customer_phone: str | None = None
    message: str = Field(min_length=1)


class ActionResponse(BaseModel):
    type: str
    status: str
    summary: str


class OrderSummary(BaseModel):
    id: int
    kiotviet_order_code: str | None = None
    status: str
    total: Decimal
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    items: list[dict[str, Any]] = Field(default_factory=list)


class DemoMessageResponse(BaseModel):
    conversation_id: int
    reply: str
    actions: list[ActionResponse]
    order: OrderSummary | None = None


class ConversationResponse(BaseModel):
    id: int
    customer_name: str
    customer_phone: str | None
    channel: str
    status: str
    created_at: datetime


class MessageResponse(BaseModel):
    id: int
    sender: str
    content: str
    created_at: datetime
