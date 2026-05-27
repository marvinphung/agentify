from datetime import UTC, datetime
from urllib.parse import quote_plus

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.service import process_customer_message
from app.chat.schemas import ActionResponse, ProductRecommendationResponse, ShipmentSummary
from app.config import get_settings
from app.integrations.zalo.schemas import (
    ZaloConnectStartResponse,
    ZaloConnectionStatusResponse,
    ZaloDemoConnectResponse,
    ZaloManualConnectRequest,
    ZaloManualConnectResponse,
    ZaloMessageRequest,
    ZaloMessageResponse,
)
from app.integrations.zalo.service import (
    build_authorize_url,
    exchange_code_for_access_token,
    get_status,
    is_demo_connection,
    save_demo_connection,
    save_manual_access_token,
    send_message,
)
from app.database import get_db
from app.models import Conversation, Customer, Message
from app.shared.workspace import DEFAULT_WORKSPACE_ID
from app.shared.workspace import ensure_default_workspace

router = APIRouter(prefix="/api/channels/zalo", tags=["zalo"])


@router.get("/connect/status", response_model=ZaloConnectionStatusResponse)
def status(db: Session = Depends(get_db)) -> ZaloConnectionStatusResponse:
    result = get_status(db, workspace_id=DEFAULT_WORKSPACE_ID)
    return ZaloConnectionStatusResponse(**result)


@router.get("/connect/start", response_model=ZaloConnectStartResponse)
def start_connect() -> ZaloConnectStartResponse:
    result = build_authorize_url(workspace_id=DEFAULT_WORKSPACE_ID)
    return ZaloConnectStartResponse(**result)


@router.get("/connect/manual")
def is_manual_connect_enabled() -> dict[str, bool]:
    return {"enabled": True}


@router.post("/connect/manual", response_model=ZaloManualConnectResponse)
async def connect_manual(payload: ZaloManualConnectRequest, db: Session = Depends(get_db)) -> ZaloManualConnectResponse:
    integration = save_manual_access_token(db, payload.access_token, oa_id=payload.oa_id, workspace_id=DEFAULT_WORKSPACE_ID)
    db.commit()
    db.refresh(integration)
    return ZaloManualConnectResponse(status=integration.status, oa_id=integration.oa_id)


@router.post("/connect/demo", response_model=ZaloDemoConnectResponse)
async def connect_demo(db: Session = Depends(get_db)) -> ZaloDemoConnectResponse:
    integration = save_demo_connection(db, workspace_id=DEFAULT_WORKSPACE_ID)
    db.commit()
    db.refresh(integration)
    return ZaloDemoConnectResponse(
        status=integration.status,
        oa_id=integration.oa_id,
        message="Đã bật Zalo Demo Mode. OAuth thật vẫn có thể dùng sau khi OA được xác thực.",
    )


@router.get("/connect/callback", response_class=RedirectResponse)
async def callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_message: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if state and not _validate_state(state):
        return RedirectResponse(url=_callback_url(success=False, message="Liên kết OAuth không hợp lệ."), status_code=302)
    if error:
        return RedirectResponse(url=_callback_url(success=False, message=error_message or error), status_code=302)
    if not code:
        return RedirectResponse(url=_callback_url(success=False, message="Không nhận được OAuth code từ Zalo."), status_code=302)

    integration = await exchange_code_for_access_token(db, code, workspace_id=DEFAULT_WORKSPACE_ID)
    db.commit()
    db.refresh(integration)
    return RedirectResponse(url=_callback_url(success=True), status_code=302)


@router.post("/messages", response_model=ZaloMessageResponse)
async def receive_zalo_message(payload: ZaloMessageRequest, db: Session = Depends(get_db)) -> ZaloMessageResponse:
    ensure_default_workspace(db)
    customer = _find_or_create_customer(db, payload)
    conversation = _find_or_create_conversation(db, payload.conversation_id, customer.id, channel="zalo")
    db.add(Message(conversation_id=conversation.id, sender="customer", content=payload.message))
    db.flush()
    channel_user_id = _extract_channel_user_id(payload)

    _, reply, actions, order, invoice_payload, ui_events = await process_customer_message(
        db,
        conversation=conversation,
        customer_id=customer.id,
        customer_name=customer.name,
        customer_phone=customer.phone,
        message=payload.message,
    )
    ui_payload = _to_ui_payload(ui_events)
    await _schedule_invoice_send_if_ready(
        db,
        channel_user_id=channel_user_id,
        invoice_payload=invoice_payload.model_dump() if invoice_payload else None,
        ui_events=ui_payload,
        order_id=order.id if order else None,
    )

    db.commit()
    db.refresh(conversation)
    if order:
        db.refresh(order)

    return ZaloMessageResponse(
        conversation_id=conversation.id,
        reply=reply,
        invoice=invoice_payload.model_dump() if invoice_payload else None,
        shipment=_shipment_from_actions(actions),
        actions=[ActionResponse(type=action.type, status=action.status, summary=action.summary) for action in actions],
        recommended_products=_recommendations_from_actions(actions),
        quick_replies=_quick_replies_from_actions(actions, has_invoice=invoice_payload is not None),
        ui_events=ui_payload,
    )


def _recommendations_from_actions(actions: list) -> list[ProductRecommendationResponse]:
    for action in actions:
        if action.type == "product_recommendation" and action.status == "success":
            return [ProductRecommendationResponse(**product) for product in action.data.get("products", [])[:5]]
    return []


def _shipment_from_actions(actions: list) -> ShipmentSummary | None:
    for action in actions:
        if action.type in {"shipping_order_create", "shipping_track"} and action.status == "success":
            return ShipmentSummary(
                provider=str(action.data.get("provider") or "ghn"),
                order_code=action.data.get("order_code"),
                status=str(action.data.get("status") or "created"),
                fee=float(action.data.get("fee") or 0),
                expected_delivery_time=action.data.get("expected_delivery_time"),
            )
    return None


def _quick_replies_from_actions(actions: list, *, has_invoice: bool) -> list[str]:
    if has_invoice:
        return ["Kiểm tra trạng thái đơn", "Mua thêm", "Gặp nhân viên"]
    if any(action.type == "order_confirmation_pending" for action in actions):
        return ["Đúng rồi", "Sửa SĐT", "Đổi địa chỉ"]
    if any(action.type == "product_recommendation" and action.status == "success" for action in actions):
        return ["Da dầu", "Da khô", "Da nhạy cảm", "Dưới 350k"]
    if any(action.type == "order_support" for action in actions):
        return ["Gửi mã đơn", "Gửi SĐT mua hàng", "Gặp nhân viên"]
    for action in actions:
        if action.type == "reply" and action.data.get("quick_replies"):
            return list(action.data["quick_replies"])[:4]
    return []


def _append_invoice_send_event(
    ui_events: list[dict[str, str]],
    status: str,
    title: str,
    detail: str,
) -> None:
    ui_events.append(
        {"type": "zalo_invoice_send", "status": status, "title": title, "detail": detail}
    )


async def _schedule_invoice_send_if_ready(
    db: Session,
    *,
    channel_user_id: str | None,
    invoice_payload: object | None,
    ui_events: list[dict[str, str]],
    order_id: int | None,
) -> None:
    if not invoice_payload:
        return
    if not channel_user_id:
        if is_demo_connection(db, workspace_id=DEFAULT_WORKSPACE_ID):
            _append_invoice_send_event(
                ui_events,
                status="success",
                title="Đã gửi hóa đơn demo qua Zalo",
                detail=f"Đơn #{order_id}: mô phỏng gửi hóa đơn trong Zalo Demo Mode.",
            )
            return
        _append_invoice_send_event(
            ui_events,
            status="warn",
            title="Chưa gửi được hóa đơn cho khách",
            detail="Phiên chat hiện tại chưa có Zalo user id; vui lòng dùng webhook thật để nhận ID người dùng.",
        )
        return
    message = _format_invoice_message(invoice_payload)
    success, detail = await send_message(db, recipient_user_id=channel_user_id, message=message, workspace_id=DEFAULT_WORKSPACE_ID)
    _append_invoice_send_event(
        ui_events,
        status="success" if success else "error",
        title=f"{'Đã gửi' if success else 'Không gửi được'} hóa đơn cho khách",
        detail=f"Đơn #{order_id}: {detail}",
    )


def _format_invoice_message(invoice_payload: object) -> str:
    invoice = invoice_payload if isinstance(invoice_payload, dict) else {}
    total = invoice.get("total", 0)
    customer = invoice.get("customer_name") or "Khách"
    order_id = invoice.get("order_id", "")
    try:
        total_text = f"{float(total):,.0f}đ"
    except (TypeError, ValueError):
        total_text = f"{total}đ"
    return (
        f"Đơn hàng #{order_id} đã tạo thành công.\n"
        f"Khách: {customer}\n"
        f"Tổng tiền: {total_text}\n"
        "Vui lòng xác nhận và chuẩn bị giao hàng."
    )


def _find_or_create_customer(db: Session, payload: ZaloMessageRequest) -> Customer:
    query = select(Customer).where(
        Customer.workspace_id == DEFAULT_WORKSPACE_ID,
        Customer.phone == payload.customer_phone,
        Customer.channel == "zalo",
    )
    customer = db.scalar(query)
    if customer:
        customer.name = payload.customer_name or customer.name
        if payload.customer_phone:
            customer.phone = payload.customer_phone
        return customer
    customer = Customer(
        workspace_id=DEFAULT_WORKSPACE_ID,
        name=payload.customer_name,
        phone=payload.customer_phone,
        channel="zalo",
    )
    db.add(customer)
    db.flush()
    return customer


def _find_or_create_conversation(db: Session, conversation_id: int | None, customer_id: int, *, channel: str) -> Conversation:
    if conversation_id:
        conversation = db.scalar(
            select(Conversation)
            .where(Conversation.id == conversation_id, Conversation.workspace_id == DEFAULT_WORKSPACE_ID)
        )
        if conversation:
            conversation.customer_id = customer_id
            conversation.status = "open"
            conversation.updated_at = datetime.now(UTC)
            return conversation
    conversation = Conversation(workspace_id=DEFAULT_WORKSPACE_ID, customer_id=customer_id, channel=channel, status="open")
    db.add(conversation)
    db.flush()
    return conversation


def _callback_url(*, success: bool, message: str | None = None) -> str:
    settings = get_settings()
    target = settings.zalo_callback_success_redirect if success else settings.zalo_callback_error_redirect
    if message:
        sep = "&" if "?" in target else "?"
        target = f"{target}{sep}message={quote_plus(message)}"
    return target


def _validate_state(state: str) -> bool:
    if ":" not in state:
        return False
    prefix, workspace_part = state.split(":", 1)
    if not prefix.startswith("workspace-"):
        return False
    return workspace_part == str(DEFAULT_WORKSPACE_ID)


def _extract_channel_user_id(payload: ZaloMessageRequest) -> str | None:
    if payload.channel_user_id:
        return payload.channel_user_id
    metadata = payload.metadata
    if not metadata:
        return None
    if isinstance(metadata, dict):
        for key in ("sender", "user", "from"):
            nested = metadata.get(key)
            if isinstance(nested, dict):
                candidate = nested.get("user_id") or nested.get("id")
                if isinstance(candidate, str):
                    return candidate
        candidate = metadata.get("user_id") or metadata.get("id")
        if isinstance(candidate, str):
            return candidate
    return None


def _to_ui_payload(events: list[object]) -> list[dict[str, str]]:
    return [
        {
            "type": getattr(item, "type", ""),
            "status": getattr(item, "status", ""),
            "title": getattr(item, "title", ""),
            "detail": getattr(item, "detail", ""),
        }
        for item in events
    ]
