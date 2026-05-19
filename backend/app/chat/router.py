from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.chat.schemas import ActionResponse, ConversationResponse, DemoMessageRequest, DemoMessageResponse, MessageResponse, OrderSummary
from app.chat.service import list_actions, list_conversations, list_messages, receive_demo_message
from app.database import get_db

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/channels/demo/messages", response_model=DemoMessageResponse)
async def demo_message(payload: DemoMessageRequest, db: Session = Depends(get_db)) -> DemoMessageResponse:
    conversation, reply, actions, order = await receive_demo_message(db, payload)
    return DemoMessageResponse(
        conversation_id=conversation.id,
        reply=reply,
        actions=[ActionResponse(type=action.type, status=action.status, summary=action.summary) for action in actions],
        order=OrderSummary.model_validate(order, from_attributes=True) if order else None,
    )


@router.get("/conversations", response_model=list[ConversationResponse])
def conversations(db: Session = Depends(get_db)) -> list[ConversationResponse]:
    rows = list_conversations(db)
    return [
        ConversationResponse(
            id=conversation.id,
            customer_name=customer.name,
            customer_phone=customer.phone,
            channel=conversation.channel,
            status=conversation.status,
            created_at=conversation.created_at,
        )
        for conversation, customer in rows
    ]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
def messages(conversation_id: int, db: Session = Depends(get_db)) -> list[MessageResponse]:
    return [MessageResponse.model_validate(message, from_attributes=True) for message in list_messages(db, conversation_id)]


@router.get("/conversations/{conversation_id}/actions", response_model=list[ActionResponse])
def actions(conversation_id: int, db: Session = Depends(get_db)) -> list[ActionResponse]:
    return [ActionResponse(type=action.action_type, status=action.status, summary=action.summary) for action in list_actions(db, conversation_id)]

