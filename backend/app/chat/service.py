from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.agent.service import handle_customer_message
from app.chat.schemas import DemoMessageRequest
from app.models import AgentAction, Conversation, Customer, Message
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace


async def receive_demo_message(db: Session, payload: DemoMessageRequest):
    ensure_default_workspace(db)
    customer = _find_or_create_customer(db, payload)
    conversation = Conversation(workspace_id=DEFAULT_WORKSPACE_ID, customer_id=customer.id, channel="demo", status="open")
    db.add(conversation)
    db.flush()
    db.add(Message(conversation_id=conversation.id, sender="customer", content=payload.message))

    reply, actions, order = await handle_customer_message(
        db,
        conversation=conversation,
        customer_id=customer.id,
        customer_name=customer.name,
        customer_phone=customer.phone,
        message=payload.message,
    )
    db.commit()
    db.refresh(conversation)
    if order:
        db.refresh(order)
    return conversation, reply, actions, order


def _find_or_create_customer(db: Session, payload: DemoMessageRequest) -> Customer:
    customer = None
    if payload.customer_phone:
        customer = db.scalar(
            select(Customer).where(
                Customer.workspace_id == DEFAULT_WORKSPACE_ID,
                Customer.phone == payload.customer_phone,
                Customer.channel == "demo",
            )
        )
    if customer:
        customer.name = payload.customer_name
        return customer
    customer = Customer(workspace_id=DEFAULT_WORKSPACE_ID, name=payload.customer_name, phone=payload.customer_phone, channel="demo")
    db.add(customer)
    db.flush()
    return customer


def list_conversations(db: Session) -> list[tuple[Conversation, Customer]]:
    return list(
        db.execute(
            select(Conversation, Customer)
            .join(Customer, Customer.id == Conversation.customer_id)
            .where(Conversation.workspace_id == DEFAULT_WORKSPACE_ID)
            .order_by(desc(Conversation.created_at))
            .limit(50)
        ).all()
    )


def list_messages(db: Session, conversation_id: int) -> list[Message]:
    return list(db.scalars(select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)))


def list_actions(db: Session, conversation_id: int) -> list[AgentAction]:
    return list(db.scalars(select(AgentAction).where(AgentAction.conversation_id == conversation_id).order_by(AgentAction.created_at)))

