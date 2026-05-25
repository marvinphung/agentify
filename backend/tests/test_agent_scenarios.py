from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401
from app.chat.schemas import DemoMessageRequest
from app.chat.service import receive_demo_message
from app.database import Base
from app.models import AgentAction, Conversation, Customer, Order, ProductCache
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)


def create_engine(*args, **kwargs):
    from sqlalchemy import create_engine as _create_engine

    return _create_engine(*args, **kwargs)


def _seed_product(db: Session, *, kv_id: int, code: str, name: str, price: int, stock: int, raw: dict | None = None) -> ProductCache:
    product = ProductCache(
        workspace_id=DEFAULT_WORKSPACE_ID,
        kiotviet_product_id=kv_id,
        code=code,
        name=name,
        base_price=Decimal(str(price)),
        stock=stock,
        raw_json=raw or {},
    )
    db.add(product)
    db.flush()
    return product


def _seed_catalog(db: Session) -> None:
    ensure_default_workspace(db)
    _seed_product(
        db,
        kv_id=910001,
        code="SUNCARE-AQUA",
        name="SunCare Aqua SPF50+",
        price=320000,
        stock=20,
        raw={"skin_types": ["da dầu", "da hỗn hợp"], "texture": "gel mỏng nhẹ"},
    )
    _seed_product(
        db,
        kv_id=910002,
        code="DERMA-SHIELD-SENSITIVE",
        name="Derma Shield Sensitive SPF50",
        price=390000,
        stock=12,
        raw={"skin_types": ["da nhạy cảm", "da treatment"], "notes": "không cồn, không hương liệu"},
    )
    _seed_product(
        db,
        kv_id=910003,
        code="MOIST-UV-CREAM",
        name="Moist UV Cream SPF50+",
        price=350000,
        stock=10,
        raw={"skin_types": ["da khô"], "notes": "có dưỡng ẩm"},
    )
    _seed_product(db, kv_id=910004, code="RETINOL-03", name="Retinol Night Repair 0.3%", price=420000, stock=9)
    _seed_product(db, kv_id=910005, code="GENTLE-FOAM", name="Sữa rửa mặt Gentle Foam", price=180000, stock=18)
    _seed_product(db, kv_id=910006, code="CLEAN-GENTLE", name="Cleanser Gentle Foam", price=190000, stock=15)
    _seed_product(db, kv_id=910007, code="NIA-10", name="Serum Niacinamide 10%", price=260000, stock=21)
    _seed_product(db, kv_id=910008, code="CERAMIDE-CREAM", name="Kem dưỡng Ceramide Cream", price=280000, stock=16)
    db.commit()


def _seed_order(
    db: Session,
    *,
    customer_name: str,
    customer_phone: str,
    items: list[dict],
    code: str | None = None,
    address: str = "Địa chỉ cũ",
) -> Order:
    customer = Customer(workspace_id=DEFAULT_WORKSPACE_ID, name=customer_name, phone=customer_phone, channel="user_chat")
    db.add(customer)
    db.flush()
    conversation = Conversation(workspace_id=DEFAULT_WORKSPACE_ID, customer_id=customer.id, channel="user_chat", status="open")
    db.add(conversation)
    db.flush()
    total = sum(Decimal(str(item["price"])) * int(item.get("quantity", 1)) for item in items)
    order = Order(
        workspace_id=DEFAULT_WORKSPACE_ID,
        conversation_id=conversation.id,
        customer_id=customer.id,
        kiotviet_order_code=code,
        status="delivered",
        total=total,
        customer_name=customer_name,
        customer_phone=customer_phone,
        shipping_address=address,
        items=items,
        raw_json={"source": "test_seed", "delivered_days_ago": 3},
    )
    db.add(order)
    db.commit()
    return order


async def _send(db: Session, message: str, conversation_id: int | None = None):
    return await receive_demo_message(
        db,
        DemoMessageRequest(conversation_id=conversation_id, customer_name="Khách Zalo", message=message),
    )


@pytest.mark.anyio
async def test_sunscreen_consultation_to_order_invoice() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, reply, actions, order, invoice, _ = await _send(db, "Shop ơi tư vấn cho mình kem chống nắng với.")
        assert order is None and invoice is None
        assert "SunCare Aqua SPF50+" in reply
        assert "Derma Shield Sensitive SPF50" in reply
        assert "Moist UV Cream SPF50+" in reply
        assert any(action.type == "product_recommendation" for action in actions)

        _, reply, _, order, invoice, _ = await _send(db, "Da mình dầu, dễ bí da.", conversation.id)
        assert order is None and invoice is None
        assert "SunCare Aqua SPF50+" in reply
        assert "gel mỏng nhẹ" in reply

        _, reply, _, order, invoice, _ = await _send(db, "Tư vấn kỹ hơn loại SunCare Aqua đi.", conversation.id)
        assert order is None and invoice is None
        assert "SPF50+" in reply
        assert "320.000" in reply

        _, reply, _, order, invoice, _ = await _send(db, "Ok lấy mình 1 tuýp.", conversation.id)
        assert order is None and invoice is None
        assert "Họ tên" in reply
        assert "Số điện thoại" in reply
        assert "Địa chỉ" in reply

        _, reply, actions, order, invoice, _ = await _send(db, "Nguyễn Thảo, 0987654321, 12 Láng Hạ, Hà Nội.", conversation.id)
        assert order is None and invoice is None
        assert "Nguyễn Thảo" in reply
        assert "0987654321" in reply
        assert "SunCare Aqua SPF50+" in reply
        assert any(action.type == "order_confirmation_pending" for action in actions)

        _, reply, _, order, invoice, _ = await _send(db, "Đúng rồi.", conversation.id)
        assert order is not None
        assert invoice is not None
        assert invoice.total == 320000
        assert "2-4 ngày" in reply


@pytest.mark.anyio
async def test_irritation_complaint_lookup_and_appointment() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)
        _seed_order(
            db,
            customer_name="Lê Mai Anh",
            customer_phone="0912345678",
            items=[{"name": "Retinol Night Repair 0.3%", "quantity": 1, "price": 420000}],
        )

        conversation, reply, actions, order, invoice, _ = await _send(db, "Shop ơi mình dùng serum hôm trước mua bị đỏ mặt với hơi rát, không biết có sao không?")
        assert order is None and invoice is None
        assert "ngưng sử dụng" in reply
        assert "họ tên" in reply.lower()
        assert any(action.type == "irritation_intake" for action in actions)

        _, reply, _, order, invoice, _ = await _send(db, "Mình tên Lê Mai Anh, số 0912345678.", conversation.id)
        assert order is None and invoice is None
        assert "Retinol Night Repair 0.3%" in reply
        assert "15:00 hôm nay" in reply
        assert "10:00 ngày mai" in reply

        _, reply, _, order, invoice, _ = await _send(db, "Cho mình 10h ngày mai.", conversation.id)
        assert order is None and invoice is None
        assert "Beauty Clinic Cầu Giấy" in reply
        assert "10:00 ngày mai" in reply
        assert "xác nhận" in reply.lower()

        _, reply, actions, order, invoice, _ = await _send(db, "Đúng rồi.", conversation.id)
        assert order is None and invoice is None
        assert "đã xác nhận lịch" in reply.lower()
        assert any(action.type == "appointment_confirmed" for action in actions)


@pytest.mark.anyio
async def test_feedback_routine_and_upsell_without_spam() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)
        _seed_order(
            db,
            customer_name="Khách feedback",
            customer_phone="0900000000",
            items=[
                {"name": "Cleanser Gentle Foam", "quantity": 1, "price": 190000},
                {"name": "Serum Niacinamide 10%", "quantity": 1, "price": 260000},
            ],
        )

        conversation, reply, actions, order, invoice, _ = await _send(db, "Shop ơi serum niacinamide mình dùng thấy da đỡ dầu hơn rồi.")
        assert order is None and invoice is None
        assert "phản hồi" in reply.lower()
        assert "khô căng" in reply
        assert any(action.type == "feedback_recorded" for action in actions)

        _, reply, _, order, invoice, _ = await _send(db, "Không bị châm chích, nhưng hơi khô vùng má.", conversation.id)
        assert order is None and invoice is None
        assert "Ceramide Cream" in reply
        assert "Buổi sáng" in reply
        assert "Buổi tối" in reply

        _, reply, actions, order, invoice, _ = await _send(db, "Có, check giúp mình.", conversation.id)
        assert order is None and invoice is None
        assert "280.000" in reply
        assert any(action.type == "stock_check" for action in actions)

        _, reply, _, order, invoice, _ = await _send(db, "Để mình suy nghĩ thêm.", conversation.id)
        assert order is None and invoice is None
        assert "ghi nhận phản hồi" in reply.lower()


@pytest.mark.anyio
async def test_skin_analysis_appointment_booking() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, reply, actions, order, invoice, _ = await _send(db, "Shop có soi da không? Mình muốn đặt lịch.")
        assert order is None and invoice is None
        assert "soi da" in reply.lower()
        assert "vấn đề nào" in reply.lower()
        assert any(action.type == "appointment_intent" for action in actions)

        _, reply, _, order, invoice, _ = await _send(db, "Mình bị mụn ẩn với da dầu.", conversation.id)
        assert order is None and invoice is None
        assert "Hôm nay: 14:30, 17:00" in reply
        assert "Ngày mai: 9:30, 13:30, 18:00" in reply

        _, reply, _, order, invoice, _ = await _send(db, "Mai 18h được không?", conversation.id)
        assert order is None and invoice is None
        assert "Họ tên" in reply
        assert "Số điện thoại" in reply

        _, reply, actions, order, invoice, _ = await _send(db, "Trần Minh Ngọc, 0909999888, cơ sở Cầu Giấy.", conversation.id)
        assert order is None and invoice is None
        assert "Trần Minh Ngọc" in reply
        assert "18:00 ngày mai" in reply
        assert any(action.type == "appointment_confirmation_pending" for action in actions)

        _, reply, actions, order, invoice, _ = await _send(db, "Đúng rồi.", conversation.id)
        assert order is None and invoice is None
        assert "đã đặt lịch soi da" in reply.lower()
        assert any(action.type == "appointment_confirmed" for action in actions)


@pytest.mark.anyio
async def test_missing_item_complaint_creates_ticket() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)
        _seed_order(
            db,
            customer_name="Phạm Hải Yến",
            customer_phone="0977000111",
            code="DH10239",
            address="Địa chỉ cũ",
            items=[
                {"name": "Kem dưỡng Ceramide Cream", "quantity": 1, "price": 280000},
                {"name": "Sữa rửa mặt Gentle Foam", "quantity": 1, "price": 180000},
            ],
        )

        conversation, reply, actions, order, invoice, _ = await _send(db, "Shop ơi đơn của mình bị thiếu hàng rồi. Mình đặt 2 món mà nhận có 1 món.")
        assert order is None and invoice is None
        assert "mã đơn" in reply.lower() or "số điện thoại" in reply.lower()
        assert any(action.type == "fulfillment_complaint" for action in actions)

        _, reply, _, order, invoice, _ = await _send(db, "SĐT mình là 0977000111.", conversation.id)
        assert order is None and invoice is None
        assert "DH10239" in reply
        assert "Kem dưỡng Ceramide Cream" in reply
        assert "Sữa rửa mặt Gentle Foam" in reply

        _, reply, _, order, invoice, _ = await _send(db, "Mình chỉ nhận được kem dưỡng thôi, thiếu sữa rửa mặt.", conversation.id)
        assert order is None and invoice is None
        assert "ảnh kiện hàng" in reply
        assert "ảnh sản phẩm" in reply

        _, reply, _, order, invoice, _ = await _send(db, "Đây nhé. Gửi ảnh", conversation.id)
        assert order is None and invoice is None
        assert "Gửi bù" in reply
        assert "Hoàn tiền" in reply

        _, reply, _, order, invoice, _ = await _send(db, "Gửi bù cho mình.", conversation.id)
        assert order is None and invoice is None
        assert "địa chỉ cũ" in reply.lower()

        _, reply, actions, order, invoice, _ = await _send(db, "Đúng rồi, gửi địa chỉ cũ.", conversation.id)
        assert order is None and invoice is None
        assert "đã tạo ticket" in reply.lower()
        assert "DH10239" in reply
        assert any(action.type == "complaint_ticket_created" for action in actions)
