from pydantic import BaseModel, Field


class AgentSlots(BaseModel):
    product_query: str | None = None
    quantity: int = 1
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None


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

