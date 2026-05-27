import pytest

from app.chat.schemas import DemoMessageRequest
from app.chat.service import receive_demo_message
from tests.test_agent_scenarios import _seed_catalog, _session


@pytest.mark.anyio
async def test_sunscreen_cheapest_and_pregnancy_questions() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="Shop tư vấn kem chống nắng giúp mình"),
        )

        _, reply, _, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Loại nào rẻ nhất vậy shop?"),
        )
        assert order is None and invoice is None
        assert "SunCare Aqua SPF50+" in reply
        assert "320.000" in reply

        _, reply, _, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Bà bầu dùng được không?"),
        )
        assert order is None and invoice is None
        assert "bác sĩ" in reply.lower() or "thành phần" in reply.lower()
        assert "Derma Shield Sensitive SPF50" in reply


@pytest.mark.anyio
async def test_severe_irritation_prioritizes_medical_care() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="Dùng serum xong mình sưng mắt với khó thở"),
        )
        assert order is None and invoice is None
        assert "đi khám" in reply.lower()
        assert any(action.type == "irritation_urgent" for action in actions)


@pytest.mark.anyio
async def test_direct_order_missing_customer_info_does_not_create_invoice() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="Đặt cho mình 1 SunCare Aqua SPF50+"),
        )
        assert order is None and invoice is None
        assert not any(action.type == "order_confirmation_pending" for action in actions)
        assert "tên người nhận" in reply.lower()


@pytest.mark.anyio
async def test_sunscreen_can_order_without_detail_step() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="Shop tư vấn kem chống nắng giúp mình"),
        )
        await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Da mình dầu, dễ bí da."),
        )

        _, reply, _, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Ok lấy mình 1 tuýp."),
        )
        assert order is None and invoice is None
        assert "Họ tên" in reply
        assert "Số điện thoại" in reply
        assert "Địa chỉ" in reply


@pytest.mark.anyio
async def test_sunscreen_direct_product_order_then_contact_line() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="tư vấn kem chống nắng"),
        )
        _, reply, _, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Em muốn đặt Moist UV Cream SPF50+"),
        )
        assert order is None and invoice is None
        assert "Họ tên" in reply
        assert "Số điện thoại" in reply
        assert "Địa chỉ" in reply

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Nguyễn Thị B. 0386883000. 19 lê thanh nghị, hà nội"),
        )
        assert order is None and invoice is None
        assert "Nguyễn Thị B" in reply
        assert "0386883000" in reply
        assert "19 lê thanh nghị" in reply
        assert any(action.type == "order_confirmation_pending" for action in actions)


@pytest.mark.anyio
async def test_generic_order_contact_line_completes_missing_info() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, reply, _, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="Em muốn đặt Kem dưỡng Ceramide Cream"),
        )
        assert order is None and invoice is None
        assert "tên người nhận" in reply.lower()

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Phùng Minh Vũ, 0386883000, 19 lê thanh nghị"),
        )
        assert order is None and invoice is None
        assert "Phùng Minh Vũ" in reply
        assert "0386883000" in reply
        assert "19 lê thanh nghị" in reply
        assert any(action.type == "order_confirmation_pending" for action in actions)


@pytest.mark.anyio
async def test_new_consultation_clears_stale_order_state() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="Em muốn đặt Kem dưỡng Ceramide Cream"),
        )

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="tôi muốn tư vấn kem chống nắng"),
        )

        assert order is None and invoice is None
        assert "SunCare Aqua SPF50+" in reply
        assert any(action.type == "product_recommendation" for action in actions)


@pytest.mark.anyio
async def test_suncare_spf50_order_contact_line_creates_one_item_invoice() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, reply, _, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="Em muốn đặt SunCare Aqua SPF50+"),
        )
        assert order is None and invoice is None
        assert "tên người nhận" in reply.lower() or "họ tên" in reply.lower()

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(
                conversation_id=conversation.id,
                customer_name="Khách Zalo",
                message="Nguyễn Thảo, 0901234567, 12 Nguyễn Trãi Hà Nội, nhận giờ hành chính",
            ),
        )
        assert order is None and invoice is None
        assert any(action.type == "order_confirmation_pending" for action in actions)
        assert "SunCare Aqua SPF50+" in reply
        assert "50 sản phẩm" not in reply

        _, _, _, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Đúng rồi"),
        )
        assert order is not None
        assert invoice is not None
        assert invoice.total == 320000
        assert invoice.items[0].quantity == 1


@pytest.mark.anyio
async def test_sunscreen_consultation_respects_under_350k_budget() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(
                customer_name="Khách Zalo",
                message="Da mình dầu, dễ mụn, cần kem chống nắng dưới 350k, shop tư vấn giúp",
            ),
        )

        assert order is None and invoice is None
        assert "SunCare Aqua SPF50+" in reply
        assert "Derma Shield Sensitive SPF50" not in reply
        assert "390.000" not in reply
        recommendation = next(action for action in actions if action.type == "product_recommendation")
        assert all(product["price"] <= 350000 for product in recommendation.data["products"])
