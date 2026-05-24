from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.chat.schemas import ActionResponse, ConversationResponse, DemoMessageRequest, DemoMessageResponse, MessageResponse, OrderSummary, ProductRecommendationResponse
from app.chat.service import list_actions, list_conversations, list_messages, receive_demo_message
from app.database import get_db

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/channels/demo/messages", response_model=DemoMessageResponse)
async def demo_message(payload: DemoMessageRequest, db: Session = Depends(get_db)) -> DemoMessageResponse:
    conversation, reply, actions, order, invoice, ui_events = await receive_demo_message(db, payload)
    ui_event_payload = [
        {"type": item.type, "status": item.status, "title": item.title, "detail": item.detail}
        for item in ui_events
    ]
    return DemoMessageResponse(
        conversation_id=conversation.id,
        reply=reply,
        actions=[ActionResponse(type=action.type, status=action.status, summary=action.summary) for action in actions],
        order=OrderSummary.model_validate(order, from_attributes=True) if order else None,
        invoice=invoice,
        recommended_products=_recommendations_from_actions(actions),
        quick_replies=_quick_replies_from_actions(actions, has_invoice=invoice is not None),
        ui_events=ui_event_payload,
    )


def _recommendations_from_actions(actions: list) -> list[ProductRecommendationResponse]:
    for action in actions:
        if action.type == "product_recommendation" and action.status == "success":
            return [ProductRecommendationResponse(**product) for product in action.data.get("products", [])[:5]]
    return []


def _quick_replies_from_actions(actions: list, *, has_invoice: bool) -> list[str]:
    if has_invoice:
        return ["Kiểm tra trạng thái đơn", "Mua thêm sản phẩm", "Gặp nhân viên"]
    if any(action.type == "order_confirmation_pending" for action in actions):
        return ["Đúng rồi", "Sửa số điện thoại", "Đổi địa chỉ"]
    if any(action.type == "product_recommendation" and action.status == "success" for action in actions):
        return ["Da dầu", "Da mụn", "Da khô", "Da nhạy cảm"]
    if any(action.type == "order_support" for action in actions):
        return ["Gửi mã đơn", "Gửi SĐT mua hàng", "Gặp nhân viên"]
    for action in actions:
        if action.type == "reply" and action.data.get("quick_replies"):
            return list(action.data["quick_replies"])[:4]
    return []


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
