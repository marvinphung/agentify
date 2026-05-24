from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.chat.schemas import ActionResponse, ProductRecommendationResponse


class ZaloMessageRequest(BaseModel):
    conversation_id: int | None = None
    customer_id: str | None = None
    customer_name: str = Field(default="Khách Zalo", min_length=1)
    customer_phone: str | None = None
    channel_user_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    message: str = Field(min_length=1)


class ZaloMessageResponse(BaseModel):
    conversation_id: int
    reply: str
    invoice: dict | None = None
    actions: list[ActionResponse] = Field(default_factory=list)
    recommended_products: list[ProductRecommendationResponse] = Field(default_factory=list)
    quick_replies: list[str] = Field(default_factory=list)
    ui_events: list[dict] = Field(default_factory=list)


class ZaloConnectionStatusResponse(BaseModel):
    status: str
    app_id: str | None = None
    oa_id: str | None = None
    token_expires_at: datetime | None = None


class ZaloConnectStartResponse(BaseModel):
    authorize_url: str
    state: str


class ZaloOAuthCallbackResponse(BaseModel):
    ok: bool
    status: str
    message: str


class ZaloManualConnectRequest(BaseModel):
    access_token: str = Field(min_length=1)
    oa_id: str | None = None


class ZaloManualConnectResponse(BaseModel):
    status: str
    oa_id: str | None = None


class ZaloDemoConnectResponse(BaseModel):
    status: str
    oa_id: str | None = None
    message: str
