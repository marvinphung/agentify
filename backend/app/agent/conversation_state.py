from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.schemas import AgentPlan, AgentSlots
from app.agent.parser import parse_message
from app.models import Message


def resolve_pending_order_intent(db: Session, conversation_id: int, *, current: AgentPlan, current_message: str, limit: int = 8) -> AgentPlan:
    history = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(limit)
        )
    )
    # Include previous customer messages in reverse chronological order while skipping the current one.
    current_message = current_message.strip()
    for message in history:
        content = (message.content or "").strip()
        if content == current_message:
            continue
        if message.sender != "customer":
            continue
        # Best effort: use parser fallback on each prior message.
        parsed = parse_message(message.content, customer_name=current.slots.customer_name, customer_phone=current.slots.customer_phone)
        merged = _merge_slots(current.slots, parsed.slots)
        current.slots = merged
        if current.intent == "unknown" and parsed.intent in {"buy_product", "ask_stock"}:
            current.intent = parsed.intent
        if not _is_missing_order_info(current):
            break
    return current


def _merge_slots(current: AgentSlots, previous: AgentSlots) -> AgentSlots:
    if not current.customer_name and previous.customer_name:
        current.customer_name = previous.customer_name
    if not current.customer_phone and previous.customer_phone:
        current.customer_phone = previous.customer_phone
    if not current.shipping_address and previous.shipping_address:
        current.shipping_address = previous.shipping_address
    if not current.product_query and previous.product_query:
        current.product_query = previous.product_query
    if current.quantity <= 1 and previous.quantity > 1:
        current.quantity = previous.quantity
    if not current.payment_method and previous.payment_method:
        current.payment_method = previous.payment_method
    return current


def _is_missing_order_info(plan: AgentPlan) -> bool:
    if plan.intent != "buy_product":
        return False
    return not bool(plan.slots.product_query) or not bool(plan.slots.customer_phone) or not bool(plan.slots.shipping_address)
