import pytest

from app.agent.schemas import AgentReplyResult, AgentSuggestionResult, AgentToolDecision, ToolResult
from app.chat.router import _quick_replies_from_actions as demo_quick_replies
from app.chat.router import demo_message
from app.chat.schemas import DemoMessageRequest
from app.integrations.zalo.router import _quick_replies_from_actions as zalo_quick_replies
from tests.test_agent_scenarios import _seed_catalog, _session


@pytest.mark.anyio
async def test_demo_message_returns_pipeline_suggestions_as_quick_replies(monkeypatch) -> None:
    async def fake_decide_next_tool(context):
        return AgentToolDecision(
            intent="product_consultation_detail",
            needs_tool=False,
            selected_tool=None,
            active_product_focus=context.active_product_focus,
            confidence=0.95,
        )

    async def fake_generate_customer_reply(context, decision, tool_result):
        return AgentReplyResult(
            reply="Dạ có ạ. Moist UV Cream SPF50+ hợp da khô vì có thêm dưỡng ẩm.",
            actions=["Tư vấn chi tiết Moist UV Cream SPF50+"],
        )

    async def fake_generate_quick_replies(context, decision, tool_result, reply_result):
        return AgentSuggestionResult(quick_replies=["Đặt 1 tuýp", "So sánh thêm"])

    monkeypatch.setattr("app.agent.service.decide_next_tool", fake_decide_next_tool)
    monkeypatch.setattr("app.agent.service.generate_customer_reply", fake_generate_customer_reply)
    monkeypatch.setattr("app.agent.service.generate_quick_replies", fake_generate_quick_replies)

    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)
        first = await demo_message(
            DemoMessageRequest(customer_name="Khach Zalo", message="tu van kem chong nang"),
            db=db,
        )
        await demo_message(
            DemoMessageRequest(conversation_id=first.conversation_id, customer_name="Khach Zalo", message="Da kho"),
            db=db,
        )

        response = await demo_message(
            DemoMessageRequest(conversation_id=first.conversation_id, customer_name="Khach Zalo", message="co"),
            db=db,
        )

        assert response.quick_replies == ["Đặt 1 tuýp", "So sánh thêm"]


@pytest.mark.anyio
async def test_consultation_reply_avoids_internal_system_words_and_has_budget_quick_reply() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        response = await demo_message(
            DemoMessageRequest(customer_name="Khách Zalo", message="Shop tư vấn kem chống nắng giúp mình"),
            db=db,
        )

        assert response.order is None
        assert response.invoice is None
        assert "KiotViet" not in response.reply
        assert "SunCare Aqua SPF50+" in response.reply
        assert "Derma Shield Sensitive SPF50" in response.reply
        assert "Dưới 350k" in response.quick_replies


@pytest.mark.anyio
async def test_order_confirmation_reply_reads_back_order_before_invoice() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        response = await demo_message(
            DemoMessageRequest(
                customer_name="Khách Zalo",
                message=(
                    "Đặt cho chị 1 SunCare Aqua SPF50+, "
                    "chị là Nguyễn Thảo, SĐT 0901234567, giao tới 12 Nguyễn Trãi Hà Nội"
                ),
            ),
            db=db,
        )

        assert response.order is None
        assert response.invoice is None
        assert "Em đọc lại đơn" in response.reply
        assert "trước khi tạo hóa đơn" in response.reply
        assert "SunCare Aqua SPF50+" in response.reply
        assert "Nguyễn Thảo" in response.reply
        assert response.quick_replies == ["Đúng rồi", "Sửa SĐT", "Đổi địa chỉ"]


@pytest.mark.anyio
async def test_created_invoice_quick_replies_are_short_for_demo_chat() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        first = await demo_message(
            DemoMessageRequest(
                customer_name="Khách Zalo",
                message=(
                    "Đặt cho chị 1 SunCare Aqua SPF50+, "
                    "chị là Nguyễn Thảo, SĐT 0901234567, giao tới 12 Nguyễn Trãi Hà Nội"
                ),
            ),
            db=db,
        )
        confirmed = await demo_message(
            DemoMessageRequest(
                conversation_id=first.conversation_id,
                customer_name="Khách Zalo",
                message="Đúng rồi",
            ),
            db=db,
        )

        assert confirmed.order is not None
        assert confirmed.invoice is not None
        assert confirmed.quick_replies == ["Kiểm tra trạng thái đơn", "Mua thêm", "Gặp nhân viên"]


def test_demo_and_zalo_quick_reply_defaults_match() -> None:
    recommendation = [ToolResult(type="product_recommendation", status="success", summary="ok")]
    pending = [ToolResult(type="order_confirmation_pending", status="pending", summary="ok")]
    support = [ToolResult(type="order_support", status="success", summary="ok")]
    suggested = [
        ToolResult(type="product_recommendation", status="success", summary="ok"),
        ToolResult(type="suggested_replies", status="success", summary="ok", data={"quick_replies": ["Tư vấn Moist UV", "Giá bao nhiêu"]}),
    ]
    older_suggested = [
        ToolResult(type="suggested_replies", status="success", summary="old", data={"quick_replies": ["Cũ"]}),
        ToolResult(type="suggested_replies", status="success", summary="new", data={"quick_replies": ["Mới", "Gặp nhân viên"]}),
    ]

    assert demo_quick_replies(recommendation, has_invoice=False) == ["Da dầu", "Da khô", "Da nhạy cảm", "Dưới 350k"]
    assert zalo_quick_replies(recommendation, has_invoice=False) == ["Da dầu", "Da khô", "Da nhạy cảm", "Dưới 350k"]
    assert demo_quick_replies(pending, has_invoice=False) == ["Đúng rồi", "Sửa SĐT", "Đổi địa chỉ"]
    assert zalo_quick_replies(pending, has_invoice=False) == ["Đúng rồi", "Sửa SĐT", "Đổi địa chỉ"]
    assert demo_quick_replies(support, has_invoice=True) == ["Kiểm tra trạng thái đơn", "Mua thêm", "Gặp nhân viên"]
    assert zalo_quick_replies(support, has_invoice=True) == ["Kiểm tra trạng thái đơn", "Mua thêm", "Gặp nhân viên"]
    assert demo_quick_replies(suggested, has_invoice=False) == ["Tư vấn Moist UV", "Giá bao nhiêu"]
    assert zalo_quick_replies(suggested, has_invoice=False) == ["Tư vấn Moist UV", "Giá bao nhiêu"]
    assert demo_quick_replies(older_suggested, has_invoice=False) == ["Mới", "Gặp nhân viên"]
    assert zalo_quick_replies(older_suggested, has_invoice=False) == ["Mới", "Gặp nhân viên"]
