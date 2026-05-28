import pytest
from sqlalchemy import select

from app.agent.pipeline import decide_next_tool, execute_selected_tool, generate_customer_reply, generate_quick_replies
from app.agent.schemas import AgentPlan, AgentReplyResult, AgentSuggestionResult, AgentToolDecision, ToolResult
from app.agent.schemas import AgentConversationContext
from app.agent.service import _build_pipeline_context, _set_scenario_state, process_customer_message
from app.chat.schemas import DemoMessageRequest
from app.chat.service import receive_demo_message
from app.models import AgentAction, Conversation, Customer, Message
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace
from tests.agent_test_helpers import seed_catalog as _seed_catalog
from tests.agent_test_helpers import session_factory as _session


def test_tool_decision_defaults_are_safe() -> None:
    decision = AgentToolDecision()

    assert decision.intent == "unknown"
    assert decision.needs_tool is False
    assert decision.selected_tool is None
    assert decision.tool_args == {}
    assert decision.handoff is False


def test_suggestion_result_limits_are_enforced_by_generator_not_schema() -> None:
    result = AgentSuggestionResult(quick_replies=["A", "B", "C", "D", "E"])

    assert result.quick_replies == ["A", "B", "C", "D", "E"]


def test_execute_selected_tool_rejects_unknown_tool() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        decision = AgentToolDecision(needs_tool=True, selected_tool="delete_products")

        result = execute_selected_tool(db, decision)

        assert result is not None
        assert result.type == "tool_execution"
        assert result.status == "skipped"
        assert "khong hop le" in result.summary.lower()
        assert result.data["selected_tool"] == "delete_products"


def test_execute_selected_tool_returns_none_when_tool_not_needed() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        decision = AgentToolDecision(needs_tool=False, selected_tool="recommend_products")

        result = execute_selected_tool(db, decision)

        assert result is None


def test_execute_selected_tool_searches_recommendations() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)
        decision = AgentToolDecision(
            needs_tool=True,
            selected_tool="recommend_products",
            tool_args={"query": "kem chong nang da kho"},
        )

        result = execute_selected_tool(db, decision)

        assert result is not None
        assert result.type == "product_recommendation"
        assert result.status == "success"
        assert any(product["name"] == "Moist UV Cream SPF50+" for product in result.data["products"])


def test_execute_selected_tool_does_not_create_draft_order_yet() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        decision = AgentToolDecision(needs_tool=True, selected_tool="create_draft_order")

        result = execute_selected_tool(db, decision)

        assert result is not None
        assert result.type == "tool_execution"
        assert result.status == "skipped"
        assert result.type != "order_create"
        assert result.data["selected_tool"] == "create_draft_order"


def test_pipeline_context_includes_active_scenario_and_product_focus() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        ensure_default_workspace(db)
        customer = Customer(
            workspace_id=DEFAULT_WORKSPACE_ID,
            name="Khach Zalo",
            phone=None,
            channel="user_chat",
        )
        db.add(customer)
        db.flush()
        conversation = Conversation(
            workspace_id=DEFAULT_WORKSPACE_ID,
            customer_id=customer.id,
            channel="user_chat",
            status="open",
        )
        db.add(conversation)
        db.flush()
        db.add(Message(conversation_id=conversation.id, sender="customer", content="tu van kem chong nang"))
        db.add(Message(conversation_id=conversation.id, sender="ai", content="Da minh thien dau, kho hay nhay cam a?"))
        db.add(Message(conversation_id=conversation.id, sender="customer", content="Da kho"))
        db.add(Message(conversation_id=conversation.id, sender="ai", content="Em uu tien Moist UV Cream SPF50+ cho da kho. Chi muon em tu van ky hon dong Moist UV khong a?"))
        _set_scenario_state(
            db,
            conversation.id,
            "sunscreen",
            "awaiting_product_detail",
            {"selected_product": "Moist UV Cream SPF50+", "skin_type": "da kho"},
        )
        db.commit()

        context = _build_pipeline_context(
            db,
            conversation=conversation,
            customer_name="Khach Zalo",
            customer_phone=None,
            message="co",
        )

        assert context.active_scenario is not None
        assert context.active_scenario["scenario"] == "sunscreen"
        assert context.active_scenario["step"] == "awaiting_product_detail"
        assert context.active_product_focus == "Moist UV Cream SPF50+"
        assert context.history[-1]["content"].startswith("Em uu tien Moist UV")


def test_pipeline_context_ignores_malformed_active_scenario_payload() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        ensure_default_workspace(db)
        customer = Customer(
            workspace_id=DEFAULT_WORKSPACE_ID,
            name="Khach Zalo",
            phone=None,
            channel="user_chat",
        )
        db.add(customer)
        db.flush()
        conversation = Conversation(
            workspace_id=DEFAULT_WORKSPACE_ID,
            customer_id=customer.id,
            channel="user_chat",
            status="open",
        )
        db.add(conversation)
        db.flush()
        db.add(Message(conversation_id=conversation.id, sender="customer", content="co"))
        db.add(
            AgentAction(
                conversation_id=conversation.id,
                action_type="scenario_state",
                status="active",
                summary="legacy:bad",
                raw_json=["legacy", "payload"],
            )
        )
        db.commit()

        context = _build_pipeline_context(
            db,
            conversation=conversation,
            customer_name="Khach Zalo",
            customer_phone=None,
            message="co",
        )

        assert context.active_scenario is None
        assert context.active_product_focus is None


def test_pipeline_context_ignores_malformed_scenario_data() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        ensure_default_workspace(db)
        customer = Customer(
            workspace_id=DEFAULT_WORKSPACE_ID,
            name="Khach Zalo",
            phone=None,
            channel="user_chat",
        )
        db.add(customer)
        db.flush()
        conversation = Conversation(
            workspace_id=DEFAULT_WORKSPACE_ID,
            customer_id=customer.id,
            channel="user_chat",
            status="open",
        )
        db.add(conversation)
        db.flush()
        db.add(
            AgentAction(
                conversation_id=conversation.id,
                action_type="scenario_state",
                status="active",
                summary="legacy:data",
                raw_json={"scenario": "sunscreen", "step": "awaiting_product_detail", "data": ["bad"]},
            )
        )
        db.commit()

        context = _build_pipeline_context(
            db,
            conversation=conversation,
            customer_name="Khach Zalo",
            customer_phone=None,
            message="co",
        )

        assert context.active_scenario == {"scenario": "sunscreen", "step": "awaiting_product_detail", "data": ["bad"]}
        assert context.active_product_focus is None


@pytest.mark.anyio
async def test_process_customer_message_uses_pipeline_for_active_product_detail(monkeypatch) -> None:
    async def fake_decide_next_tool(context):
        return AgentToolDecision(
            intent="product_consultation_detail",
            needs_tool=False,
            selected_tool=None,
            active_product_focus=context.active_product_focus,
            confidence=0.95,
            reason="Khach dong y nghe tu van ky hon san pham dang focus.",
        )

    async def fake_generate_customer_reply(context, decision, tool_result):
        return AgentReplyResult(
            reply="Dạ có ạ. Moist UV Cream SPF50+ hợp da khô vì có thêm dưỡng ẩm, dùng ban ngày sẽ đỡ khô căng hơn.",
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
        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khach Zalo", message="tu van kem chong nang"),
        )
        await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khach Zalo", message="Da kho"),
        )

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khach Zalo", message="co"),
        )

        assert order is None
        assert invoice is None
        assert "Moist UV Cream SPF50+" in reply
        assert any(action.type == "llm_tool_decision" for action in actions)
        assert any(action.type == "suggested_replies" for action in actions)
        assert sum(action.type == "product_consultation_detail" for action in actions) == 1
        active_state = db.scalar(
            select(AgentAction).where(
                AgentAction.conversation_id == conversation.id,
                AgentAction.action_type == "scenario_state",
                AgentAction.status == "active",
            )
        )
        assert active_state is not None
        assert active_state.raw_json["step"] == "awaiting_order_decision"
        assert active_state.raw_json["data"]["selected_product"] == "Moist UV Cream SPF50+"


@pytest.mark.anyio
async def test_active_scenario_with_malformed_data_does_not_crash() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        ensure_default_workspace(db)
        customer = Customer(
            workspace_id=DEFAULT_WORKSPACE_ID,
            name="Khach Zalo",
            phone=None,
            channel="user_chat",
        )
        db.add(customer)
        db.flush()
        conversation = Conversation(
            workspace_id=DEFAULT_WORKSPACE_ID,
            customer_id=customer.id,
            channel="user_chat",
            status="open",
        )
        db.add(conversation)
        db.flush()
        db.add(Message(conversation_id=conversation.id, sender="customer", content="co"))
        db.add(
            AgentAction(
                conversation_id=conversation.id,
                action_type="scenario_state",
                status="active",
                summary="sunscreen:awaiting_product_detail",
                raw_json={"scenario": "sunscreen", "step": "awaiting_product_detail", "data": ["bad"]},
            )
        )
        db.commit()

        _, reply, actions, _, _, _ = await process_customer_message(
            db,
            conversation=conversation,
            customer_id=customer.id,
            customer_name=customer.name,
            customer_phone=customer.phone,
            message="co",
        )

        assert reply
        assert any(action.type == "product_consultation_detail" for action in actions)


@pytest.mark.anyio
async def test_sunscreen_dry_skin_yes_keeps_moist_uv_focus() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="tu van kem chong nang"),
        )
        _, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Da kho"),
        )
        _, reply, actions, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="co"),
        )

        unrelated_products = ["Nuoc hoa hong", "Cica Recovery Gel", "Mieng dan mun"]
        assert "Moist UV Cream SPF50+" in reply
        assert not any(product in reply for product in unrelated_products)

        recommendation_products = [
            product.get("name")
            for action in actions
            if action.type == "product_recommendation"
            for product in (action.data or {}).get("products", [])
        ]
        assert not any(product in recommendation_products for product in unrelated_products)


@pytest.mark.anyio
async def test_active_scenario_handles_contextual_yes_before_product_consultation_clear(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="tu van kem chong nang"),
        )
        _, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Da kho"),
        )

        async def consultation_plan(
            message: str,
            *,
            customer_name: str | None,
            customer_phone: str | None,
        ) -> AgentPlan:
            return AgentPlan(
                intent="product_consultation",
                slots={
                    "product_query": "kem chong nang",
                    "customer_name": customer_name,
                    "customer_phone": customer_phone,
                },
                tool_plan=["search_products"],
                source="test",
            )

        monkeypatch.setattr("app.agent.service.plan_with_llm", consultation_plan)

        _, reply, actions, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="co"),
        )

        assert "Moist UV Cream SPF50+" in reply
        assert any(action.type == "product_consultation_detail" for action in actions)


@pytest.mark.anyio
async def test_decide_next_tool_keeps_short_yes_on_active_product(monkeypatch) -> None:
    async def fake_generate_llm_json(system_prompt, user_payload, *, temperature, settings):
        assert system_prompt
        assert user_payload["message"] == "co"
        assert user_payload["active_product_focus"] == "Moist UV Cream SPF50+"
        return {
            "intent": "product_consultation_detail",
            "needs_tool": False,
            "selected_tool": None,
            "tool_args": {},
            "active_product_focus": "Moist UV Cream SPF50+",
            "confidence": 0.92,
            "reason": "Khach dong y nghe tu van ky hon san pham dang focus.",
        }

    monkeypatch.setattr("app.agent.pipeline.llm_available", lambda settings: True)
    monkeypatch.setattr("app.agent.pipeline.generate_llm_json", fake_generate_llm_json)

    context = AgentConversationContext(
        conversation_id=1,
        customer_name="Khach Zalo",
        message="co",
        history=[
            {"role": "assistant", "content": "Em uu tien Moist UV Cream SPF50+ cho da kho. Chi muon em tu van ky hon khong a?"}
        ],
        active_scenario={
            "scenario": "sunscreen",
            "step": "awaiting_product_detail",
            "data": {"selected_product": "Moist UV Cream SPF50+"},
        },
        active_product_focus="Moist UV Cream SPF50+",
    )

    decision = await decide_next_tool(context)

    assert decision.intent == "product_consultation_detail"
    assert decision.needs_tool is False
    assert decision.selected_tool is None
    assert decision.active_product_focus == "Moist UV Cream SPF50+"


@pytest.mark.anyio
async def test_decide_next_tool_rejects_non_catalog_tool(monkeypatch) -> None:
    async def fake_generate_llm_json(system_prompt, user_payload, *, temperature, settings):
        return {
            "intent": "support",
            "needs_tool": True,
            "selected_tool": "delete_products",
            "tool_args": {"id": 1},
            "confidence": 0.9,
        }

    monkeypatch.setattr("app.agent.pipeline.llm_available", lambda settings: True)
    monkeypatch.setattr("app.agent.pipeline.generate_llm_json", fake_generate_llm_json)

    context = AgentConversationContext(conversation_id=1, message="xoa san pham")

    decision = await decide_next_tool(context)

    assert decision.needs_tool is False
    assert decision.selected_tool is None
    assert decision.tool_args == {}


@pytest.mark.anyio
async def test_generate_customer_reply_uses_beauty_consultant_role(monkeypatch) -> None:
    async def fake_generate_llm_json(system_prompt, user_payload, *, temperature, settings):
        assert "Lumi Beauty" in system_prompt
        assert user_payload["decision"]["active_product_focus"] == "Moist UV Cream SPF50+"
        assert user_payload["tool_result"] is None
        return {
            "reply": "Moist UV Cream SPF50+ hop voi da kho vi co duong am va SPF50+.",
            "actions": ["product_consultation_detail"],
        }

    monkeypatch.setattr("app.agent.pipeline.llm_available", lambda settings: True)
    monkeypatch.setattr("app.agent.pipeline.generate_llm_json", fake_generate_llm_json)

    context = AgentConversationContext(
        conversation_id=1,
        customer_name="Khach Zalo",
        message="co",
        history=[
            {"role": "assistant", "content": "Em uu tien Moist UV Cream SPF50+ cho da kho."},
        ],
        active_scenario={
            "scenario": "sunscreen",
            "step": "awaiting_product_detail",
            "data": {"selected_product": "Moist UV Cream SPF50+"},
        },
        active_product_focus="Moist UV Cream SPF50+",
    )
    decision = AgentToolDecision(
        intent="product_consultation_detail",
        active_product_focus="Moist UV Cream SPF50+",
    )

    result = await generate_customer_reply(context, decision, None)

    assert "Moist UV" in result.reply
    assert "KiotViet" not in result.reply
    assert result.actions == ["product_consultation_detail"]


@pytest.mark.anyio
async def test_generate_customer_reply_fallback_keeps_active_product() -> None:
    context = AgentConversationContext(
        conversation_id=1,
        customer_name="Khach Zalo",
        message="co",
        active_scenario={
            "scenario": "sunscreen",
            "step": "awaiting_product_detail",
            "data": {"selected_product": "Moist UV Cream SPF50+"},
        },
        active_product_focus="Moist UV Cream SPF50+",
    )
    decision = AgentToolDecision(
        intent="product_consultation_detail",
        active_product_focus="Moist UV Cream SPF50+",
    )

    result = await generate_customer_reply(context, decision, None)

    assert "Moist UV" in result.reply
    assert "Về" in result.reply
    assert "San pham" not in result.reply


@pytest.mark.anyio
async def test_generate_customer_reply_fallback_with_successful_tool_result_summarizes_tool_result() -> None:
    context = AgentConversationContext(
        conversation_id=1,
        customer_name="Khach Zalo",
        message="tu van kem chong nang",
    )
    decision = AgentToolDecision(intent="product_consultation", active_product_focus=None)
    tool_result = ToolResult(
        type="product_recommendation",
        status="success",
        summary="Tim thay 3 san pham chong nang phu hop.",
        data={"products": [{"name": "SunCare Aqua SPF50+"}]},
    )

    result = await generate_customer_reply(context, decision, tool_result)

    assert "tư vấn" in result.reply.lower()
    assert "Tim thay 3 san pham chong nang phu hop." in result.actions


@pytest.mark.anyio
async def test_generate_customer_reply_falls_back_when_llm_mentions_internal_terms(monkeypatch) -> None:
    async def fake_generate_llm_json(system_prompt, user_payload, *, temperature, settings):
        return {
            "reply": "Em đã dùng tool KiotViet để đọc database và thấy Moist UV Cream SPF50+.",
            "actions": ["internal"],
        }

    monkeypatch.setattr("app.agent.pipeline.llm_available", lambda settings: True)
    monkeypatch.setattr("app.agent.pipeline.generate_llm_json", fake_generate_llm_json)

    context = AgentConversationContext(
        conversation_id=1,
        customer_name="Khach Zalo",
        message="co",
        active_product_focus="Moist UV Cream SPF50+",
    )
    decision = AgentToolDecision(
        intent="product_consultation_detail",
        active_product_focus="Moist UV Cream SPF50+",
    )

    result = await generate_customer_reply(context, decision, None)

    assert "Moist UV Cream SPF50+" in result.reply
    assert "KiotViet" not in result.reply
    assert "database" not in result.reply.lower()
    assert "tool" not in result.reply.lower()


@pytest.mark.anyio
async def test_generate_customer_reply_prompt_blocks_personal_info_during_consultation(monkeypatch) -> None:
    captured_prompt = ""

    async def fake_generate_llm_json(system_prompt, user_payload, *, temperature, settings):
        nonlocal captured_prompt
        captured_prompt = system_prompt
        return {
            "reply": "Dạ em tư vấn dòng Moist UV Cream SPF50+ trước cho chị nhé.",
            "actions": ["product_consultation_detail"],
        }

    monkeypatch.setattr("app.agent.pipeline.llm_available", lambda settings: True)
    monkeypatch.setattr("app.agent.pipeline.generate_llm_json", fake_generate_llm_json)

    context = AgentConversationContext(conversation_id=1, message="co", active_product_focus="Moist UV Cream SPF50+")
    decision = AgentToolDecision(intent="product_consultation_detail", active_product_focus="Moist UV Cream SPF50+")

    await generate_customer_reply(context, decision, None)

    assert "khong hoi ten" in captured_prompt
    assert "so dien thoai" in captured_prompt
    assert "dia chi" in captured_prompt


@pytest.mark.anyio
async def test_generate_quick_replies_limits_to_four(monkeypatch) -> None:
    async def fake_generate_llm_json(system_prompt, user_payload, *, temperature, settings):
        assert system_prompt
        assert user_payload["context"]["message"] == "co"
        assert user_payload["context"]["active_product_focus"] == "Moist UV Cream SPF50+"
        return {
            "quick_replies": [
                "Tư vấn kỹ hơn",
                "Giá bao nhiêu",
                "Còn hàng không",
                "Mua sản phẩm",
                "Gặp nhân viên",
            ]
        }

    monkeypatch.setattr("app.agent.pipeline.llm_available", lambda settings: True)
    monkeypatch.setattr("app.agent.pipeline.generate_llm_json", fake_generate_llm_json)

    context = AgentConversationContext(
        conversation_id=1,
        message="co",
        active_product_focus="Moist UV Cream SPF50+",
    )
    decision = AgentToolDecision(intent="product_consultation_detail", active_product_focus="Moist UV Cream SPF50+")
    reply = await generate_customer_reply(context, decision, None)

    suggestions = await generate_quick_replies(context, decision, None, reply)

    assert suggestions.quick_replies == ["Tư vấn kỹ hơn", "Giá bao nhiêu", "Còn hàng không", "Mua sản phẩm"]


@pytest.mark.anyio
async def test_generate_quick_replies_fallback_uses_active_product_focus(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.pipeline.llm_available", lambda settings: False)
    context = AgentConversationContext(
        conversation_id=1,
        message="co",
        active_product_focus="Moist UV Cream SPF50+",
    )
    decision = AgentToolDecision(intent="product_consultation_detail", active_product_focus="Moist UV Cream SPF50+")
    reply = await generate_customer_reply(context, decision, None)

    suggestions = await generate_quick_replies(context, decision, None, reply)

    internal_terms = ("tool", "database", "kiotviet", "ghn", "agentify")
    assert 0 < len(suggestions.quick_replies) <= 4
    assert any("Moist UV" in suggestion for suggestion in suggestions.quick_replies)
    assert not any(term in suggestion.lower() for suggestion in suggestions.quick_replies for term in internal_terms)


@pytest.mark.anyio
async def test_active_scenario_topic_switch_clears_stale_state_for_order_support() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="tu van kem chong nang"),
        )
        await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Da kho"),
        )

        _, reply, actions, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="kiem tra don"),
        )

        active_state = db.scalar(
            select(AgentAction).where(
                AgentAction.conversation_id == conversation.id,
                AgentAction.action_type == "scenario_state",
                AgentAction.status == "active",
            )
        )
        assert active_state is None
        assert "số điện thoại" in reply.lower() or "sdt" in reply.lower()
        assert any(action.type == "shipping_track" for action in actions)


@pytest.mark.anyio
async def test_active_scenario_switches_to_new_product_consultation_topic() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="tu van kem chong nang"),
        )
        await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Da kho"),
        )

        _, reply, actions, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="tu van kem duong cho da kho"),
        )

        assert "Ceramide Cream" in reply
        assert any(action.type == "product_recommendation" for action in actions)
        assert not any(action.type == "product_consultation_detail" for action in actions)


@pytest.mark.anyio
async def test_active_scenario_stock_question_for_other_product_clears_stale_state() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="tu van kem chong nang"),
        )
        await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Da kho"),
        )
        await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="co"),
        )

        _, reply, actions, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="con serum niacinamide khong"),
        )

        active_state = db.scalar(
            select(AgentAction).where(
                AgentAction.conversation_id == conversation.id,
                AgentAction.action_type == "scenario_state",
                AgentAction.status == "active",
            )
        )
        assert active_state is None
        assert "Serum Niacinamide 10%" in reply
        assert any(action.type == "stock_check" for action in actions)


@pytest.mark.anyio
async def test_generic_order_state_clears_for_sunscreen_stock_question() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, _, _, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khách Zalo", message="Em muốn đặt Kem dưỡng Ceramide Cream"),
        )

        _, reply, actions, _, _, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="con kem chong nang khong"),
        )

        active_state = db.scalar(
            select(AgentAction).where(
                AgentAction.conversation_id == conversation.id,
                AgentAction.action_type == "scenario_state",
                AgentAction.status == "active",
            )
        )
        assert active_state is None
        assert "SunCare Aqua SPF50+" in reply
        assert any(action.type == "stock_check" for action in actions)
