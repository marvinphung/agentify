from pydantic import BaseModel, Field


class InvoiceLineItem(BaseModel):
    name: str
    quantity: int = 1
    unit_price: float
    line_total: float


class InvoicePayload(BaseModel):
    order_id: int
    status: str
    total: float
    currency: str = "VND"
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    items: list[InvoiceLineItem] = Field(default_factory=list)
    payment_method: str | None = None


class AgentUiEvent(BaseModel):
    type: str
    status: str
    title: str
    detail: str | None = None


class AgentSlots(BaseModel):
    product_query: str | None = None
    quantity: int = 1
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    payment_method: str | None = None


class AgentPlan(BaseModel):
    intent: str = "unknown"
    slots: AgentSlots = Field(default_factory=AgentSlots)
    tool_plan: list[str] = Field(default_factory=list)
    reply_if_missing: str | None = None
    source: str = "rule"


class ToolResult(BaseModel):
    type: str
    status: str
    summary: str
    data: dict = Field(default_factory=dict)
