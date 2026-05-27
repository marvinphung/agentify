from decimal import Decimal

import httpx
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.config import get_settings
from app.database import Base
from app.integrations.ghn.service import create_ghn_shipment_for_order, refresh_ghn_tracking
from app.models import Conversation, Customer, Order, Shipment, ShipmentEvent
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)


def _seed_order(db) -> Order:
    ensure_default_workspace(db)
    customer = Customer(workspace_id=DEFAULT_WORKSPACE_ID, name="Nguyễn Thảo", phone="0987654321", channel="zalo")
    db.add(customer)
    db.flush()
    conversation = Conversation(workspace_id=DEFAULT_WORKSPACE_ID, customer_id=customer.id, channel="zalo", status="open")
    db.add(conversation)
    db.flush()
    order = Order(
        workspace_id=DEFAULT_WORKSPACE_ID,
        conversation_id=conversation.id,
        customer_id=customer.id,
        status="draft",
        total=Decimal("320000"),
        customer_name="Nguyễn Thảo",
        customer_phone="0987654321",
        shipping_address="12 Láng Hạ, Hà Nội",
        items=[{"name": "SunCare Aqua SPF50+", "quantity": 1, "price": 320000}],
        raw_json={},
    )
    db.add(order)
    db.flush()
    return order


def _configure_ghn(monkeypatch) -> None:
    monkeypatch.setenv("GHN_TOKEN", "sandbox-token")
    monkeypatch.setenv("GHN_SHOP_ID", "885")
    monkeypatch.setenv("GHN_FROM_PHONE", "0900000000")
    monkeypatch.setenv("GHN_FROM_ADDRESS", "Kho Lumi Beauty")
    monkeypatch.setenv("GHN_FROM_DISTRICT_ID", "1442")
    monkeypatch.setenv("GHN_FROM_WARD_CODE", "21211")
    monkeypatch.setenv("GHN_DEFAULT_TO_DISTRICT_ID", "1482")
    monkeypatch.setenv("GHN_DEFAULT_TO_WARD_CODE", "1A0307")
    get_settings.cache_clear()


def test_create_ghn_shipment_for_order(monkeypatch) -> None:
    _configure_ghn(monkeypatch)
    captured = {}

    def fake_post(url, *, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return httpx.Response(
            200,
            json={
                "code": 200,
                "message": "Success",
                "data": {
                    "order_code": "GHN123456",
                    "status": "ready_to_pick",
                    "total_fee": 28000,
                    "expected_delivery_time": "2026-05-30T10:00:00Z",
                },
            },
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    SessionLocal = _session()
    with SessionLocal() as db:
        order = _seed_order(db)
        shipment, summary = create_ghn_shipment_for_order(db, order)
        db.commit()

        assert shipment is not None
        assert shipment.provider_order_code == "GHN123456"
        assert "GHN123456" in summary
        assert captured["url"].endswith("/v2/shipping-order/create")
        assert captured["headers"]["Token"] == "sandbox-token"
        assert captured["headers"]["ShopId"] == "885"
        assert captured["json"]["client_order_code"] == f"AGENTIFY-{order.id}"
        assert captured["json"]["to_name"] == "Nguyễn Thảo"
        assert captured["json"]["to_district_id"] == 1482
        assert db.scalar(select(Shipment)).provider_order_code == "GHN123456"
        assert db.scalar(select(ShipmentEvent)).status == "ready_to_pick"


def test_refresh_ghn_tracking(monkeypatch) -> None:
    _configure_ghn(monkeypatch)

    def fake_post(url, *, headers, json, timeout):
        return httpx.Response(
            200,
            json={
                "code": 200,
                "message": "Success",
                "data": {
                    "order_code": json["order_code"],
                    "status": "delivering",
                    "status_name": "Đang giao hàng",
                    "expected_delivery_time": "2026-05-30T10:00:00Z",
                },
            },
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    SessionLocal = _session()
    with SessionLocal() as db:
        order = _seed_order(db)
        shipment = Shipment(
            workspace_id=DEFAULT_WORKSPACE_ID,
            order_id=order.id,
            provider="ghn",
            provider_order_code="GHN123456",
            client_order_code=f"AGENTIFY-{order.id}",
            status="ready_to_pick",
            fee=Decimal("28000"),
            raw_json={},
        )
        db.add(shipment)
        db.flush()

        refreshed, summary = refresh_ghn_tracking(db, shipment)
        db.commit()

        assert refreshed.status == "delivering"
        assert "GHN123456" in summary
        assert db.scalar(select(ShipmentEvent).where(ShipmentEvent.shipment_id == shipment.id)).description == "Đang giao hàng"
