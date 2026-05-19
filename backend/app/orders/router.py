from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Order
from app.orders.schemas import OrderResponse
from app.shared.workspace import DEFAULT_WORKSPACE_ID

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("", response_model=list[OrderResponse])
def list_orders(db: Session = Depends(get_db)) -> list[OrderResponse]:
    rows = db.scalars(select(Order).where(Order.workspace_id == DEFAULT_WORKSPACE_ID).order_by(desc(Order.created_at)).limit(50))
    return [OrderResponse.model_validate(row, from_attributes=True) for row in rows]


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)) -> OrderResponse:
    row = db.get(Order, order_id)
    return OrderResponse.model_validate(row, from_attributes=True)

