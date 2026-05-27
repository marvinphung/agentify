from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.integrations.ghn.service import refresh_ghn_tracking
from app.models import Shipment, ShipmentEvent
from app.shared.workspace import DEFAULT_WORKSPACE_ID
from app.shipments.schemas import ShipmentEventResponse, ShipmentResponse

router = APIRouter(prefix="/api/shipments", tags=["shipments"])


@router.get("", response_model=list[ShipmentResponse])
def list_shipments(db: Session = Depends(get_db)) -> list[ShipmentResponse]:
    rows = db.scalars(
        select(Shipment)
        .where(Shipment.workspace_id == DEFAULT_WORKSPACE_ID)
        .order_by(desc(Shipment.created_at), desc(Shipment.id))
        .limit(50)
    )
    return [ShipmentResponse.model_validate(row, from_attributes=True) for row in rows]


@router.post("/{shipment_id}/refresh", response_model=ShipmentResponse)
def refresh_shipment(shipment_id: int, db: Session = Depends(get_db)) -> ShipmentResponse:
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    shipment, _ = refresh_ghn_tracking(db, shipment)
    db.commit()
    db.refresh(shipment)
    return ShipmentResponse.model_validate(shipment, from_attributes=True)


@router.get("/{shipment_id}/events", response_model=list[ShipmentEventResponse])
def shipment_events(shipment_id: int, db: Session = Depends(get_db)) -> list[ShipmentEventResponse]:
    rows = db.scalars(
        select(ShipmentEvent)
        .where(ShipmentEvent.shipment_id == shipment_id)
        .order_by(desc(ShipmentEvent.created_at), desc(ShipmentEvent.id))
        .limit(100)
    )
    return [ShipmentEventResponse.model_validate(row, from_attributes=True) for row in rows]
