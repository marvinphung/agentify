from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.auth.dependencies import get_optional_current_user
from app.auth.service import primary_workspace_for_user
from app.integrations.ghn.service import get_ghn_integration, refresh_ghn_tracking
from app.models import Shipment, ShipmentEvent, User
from app.shared.workspace import DEFAULT_WORKSPACE_ID
from app.shipments.schemas import ShipmentEventResponse, ShipmentResponse, ShippingStatusResponse

router = APIRouter(prefix="/api/shipments", tags=["shipments"])


@router.get("/status", response_model=ShippingStatusResponse)
def shipping_status(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> ShippingStatusResponse:
    settings = get_settings()
    if user:
        workspace = primary_workspace_for_user(db, user)
        integration = get_ghn_integration(db, workspace.id) if workspace else None
        if integration:
            return ShippingStatusResponse(
                provider="GHN",
                status=integration.status,
                env=integration.env,
                shop_id=integration.shop_id,
                from_name=integration.from_name,
                from_phone=integration.from_phone,
                from_address=integration.from_address,
            )
        return ShippingStatusResponse(
            provider="GHN",
            status="disconnected",
            env=settings.ghn_env,
            shop_id=None,
            from_name=settings.ghn_from_name or None,
            from_phone=settings.ghn_from_phone or None,
            from_address=settings.ghn_from_address or None,
        )
    return ShippingStatusResponse(
        provider="GHN",
        status="connected" if settings.ghn_enabled else "disconnected",
        env=settings.ghn_env,
        shop_id=settings.ghn_shop_id or None,
        from_name=settings.ghn_from_name or None,
        from_phone=settings.ghn_from_phone or None,
        from_address=settings.ghn_from_address or None,
    )


@router.get("", response_model=list[ShipmentResponse])
def list_shipments(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> list[ShipmentResponse]:
    workspace_id = DEFAULT_WORKSPACE_ID
    if user:
        workspace = primary_workspace_for_user(db, user)
        if workspace:
            workspace_id = workspace.id
    rows = db.scalars(
        select(Shipment)
        .where(Shipment.workspace_id == workspace_id)
        .order_by(desc(Shipment.created_at), desc(Shipment.id))
        .limit(50)
    )
    return [ShipmentResponse.model_validate(row, from_attributes=True) for row in rows]


@router.post("/{shipment_id}/refresh", response_model=ShipmentResponse)
def refresh_shipment(
    shipment_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> ShipmentResponse:
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if user:
        workspace = primary_workspace_for_user(db, user)
        if not workspace or shipment.workspace_id != workspace.id:
            raise HTTPException(status_code=404, detail="Shipment not found")
    shipment, _ = refresh_ghn_tracking(db, shipment)
    db.commit()
    db.refresh(shipment)
    return ShipmentResponse.model_validate(shipment, from_attributes=True)


@router.get("/{shipment_id}/events", response_model=list[ShipmentEventResponse])
def shipment_events(
    shipment_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> list[ShipmentEventResponse]:
    if user:
        shipment = db.get(Shipment, shipment_id)
        workspace = primary_workspace_for_user(db, user)
        if not shipment or not workspace or shipment.workspace_id != workspace.id:
            raise HTTPException(status_code=404, detail="Shipment not found")
    rows = db.scalars(
        select(ShipmentEvent)
        .where(ShipmentEvent.shipment_id == shipment_id)
        .order_by(desc(ShipmentEvent.created_at), desc(ShipmentEvent.id))
        .limit(100)
    )
    return [ShipmentEventResponse.model_validate(row, from_attributes=True) for row in rows]
