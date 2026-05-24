from pydantic import BaseModel, Field


class AgentChatRequest(BaseModel):
    conversation_id: int | None = None
    customer_name: str = "Khách hàng"
    customer_phone: str | None = None
    message: str = Field(min_length=1)


class AgentRecommendedProduct(BaseModel):
    id: int
    name: str
    price: float
    stock: int
    reason: str


class AgentChatResponse(BaseModel):
    conversation_id: int | None = None
    intent: str
    reply: str
    invoice: dict | None = None
    recommended_products: list[AgentRecommendedProduct] = Field(default_factory=list)
    quick_replies: list[str] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)
    ui_events: list[dict[str, str]] = Field(default_factory=list)
