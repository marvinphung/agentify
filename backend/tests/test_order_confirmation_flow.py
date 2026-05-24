from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.chat.schemas import DemoMessageRequest
from app.chat.service import receive_demo_message
from app.database import Base
from app.models import Order, ProductCache
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace


@pytest.mark.anyio
async def test_consult_then_confirm_before_invoice() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as db:
        ensure_default_workspace(db)
        db.add(
            ProductCache(
                workspace_id=DEFAULT_WORKSPACE_ID,
                kiotviet_product_id=1001,
                code="KCN001",
                name="Kem chống nắng dạng sữa Aqua Light SPF50 40ml",
                base_price=Decimal("260000"),
                stock=12,
                raw_json={},
            )
        )
        db.commit()

        conversation, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="tư vấn kem chống nắng"),
        )
        assert order is None
        assert invoice is None
        assert any(action.type == "product_recommendation" for action in actions)
        assert "Kem chống nắng" in reply

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(
                conversation_id=conversation.id,
                customer_name="Khách Zalo",
                message=(
                    "Đặt cho chị 1 Kem chống nắng dạng sữa Aqua Light SPF50 40ml, "
                    "chị là Nguyễn Thảo, SĐT 0901234567, giao tới 12 Nguyễn Trãi"
                ),
            ),
        )
        assert order is None
        assert invoice is None
        assert any(action.type == "order_confirmation_pending" for action in actions)
        assert "xác nhận" in reply.lower()
        assert db.scalar(select(Order)) is None

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(
                conversation_id=conversation.id,
                customer_name="Khách Zalo",
                message="đúng rồi",
            ),
        )
        assert order is not None
        assert invoice is not None
        assert invoice.order_id == order.id
        assert "hóa đơn" in reply.lower()
