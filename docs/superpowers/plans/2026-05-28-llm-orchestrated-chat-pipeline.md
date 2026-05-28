# LLM Orchestrated Chat Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the demo chat system so every customer message is handled by a structured pipeline: LLM tool decision, whitelisted tool execution, LLM customer-facing reply, and LLM quick reply suggestions.

**Architecture:** Keep the current endpoint surface and business tools intact. Add a focused orchestration layer under `backend/app/agent/` and route `process_customer_message()` through it where it is safe, while preserving existing scenario and order guardrails. The immediate regression target is the sunscreen flow: after `Da kho`, a customer message `co` must continue the Moist UV consultation instead of triggering unrelated product recommendations.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, pytest/anyio, existing OpenAI-compatible `generate_llm_json()` client, existing KiotViet product cache tools.

---

## Current Problem

The current system already has an LLM planner in `backend/app/agent/llm.py`, but the main consultation flow still has rule-based response generation. In `backend/app/agent/service.py`, `process_customer_message()` clears active scenarios before handling them when the LLM/parser labels a message as `product_consultation` or `ask_stock`. That makes short replies like `co`, `ok`, or `tu van ky hon` vulnerable to context loss.

In the screenshot flow:

1. Customer asks for sunscreen consultation.
2. Bot asks skin type and recommends sunscreen options.
3. Customer says `Da kho`.
4. Bot correctly picks `Moist UV Cream SPF50+`.
5. Customer says `co`.
6. Bot loses the active sunscreen state and returns unrelated recommendations such as toner, cica gel, acne patches.

The fix needs two parts:

- State handling fix: short messages must be interpreted against active scenario/history before clearing state.
- LLM pipeline: the demo assistant should behave like a Lumi Beauty beauty consultant, with tool calls and suggestions chosen from structured context.

## File Structure

Create:

- `backend/app/agent/pipeline.py` - LLM decision, tool execution, reply generation, quick reply generation.
- `backend/tests/test_agent_pipeline.py` - unit and integration tests for the new pipeline and the screenshot regression.

Modify:

- `backend/app/agent/schemas.py` - add pipeline Pydantic schemas.
- `backend/app/agent/service.py` - build context, fix scenario ordering, wire pipeline into safe paths.
- `backend/app/chat/router.py` - prefer LLM-generated quick replies from action data.
- `backend/app/integrations/zalo/router.py` - same quick reply extraction behavior as demo route.
- `frontend/src/app/App.tsx` - light demo UX copy and ensure panels only render backend-provided products.

Do not modify:

- Order creation, invoice generation, GHN shipping creation, or KiotViet product cache behavior except through existing tool calls.

---

### Task 1: Add Pipeline Schemas

**Files:**
- Modify: `backend/app/agent/schemas.py`
- Test: `backend/tests/test_agent_pipeline.py`

- [ ] **Step 1: Add pipeline models to `backend/app/agent/schemas.py`**

Append these models after the existing agent models:

```python
class AgentConversationContext(BaseModel):
    conversation_id: int
    customer_name: str | None = None
    customer_phone: str | None = None
    message: str
    history: list[dict[str, str]] = Field(default_factory=list)
    active_scenario: dict | None = None
    active_product_focus: str | None = None


class AgentToolDecision(BaseModel):
    intent: str = "unknown"
    needs_tool: bool = False
    selected_tool: str | None = None
    tool_args: dict = Field(default_factory=dict)
    active_product_focus: str | None = None
    next_state: dict | None = None
    handoff: bool = False
    confidence: float = 0.0
    reason: str | None = None


class AgentReplyResult(BaseModel):
    reply: str
    actions: list[str] = Field(default_factory=list)
    state_update: dict | None = None


class AgentSuggestionResult(BaseModel):
    quick_replies: list[str] = Field(default_factory=list)
```

- [ ] **Step 2: Write schema validation tests in `backend/tests/test_agent_pipeline.py`**

```python
from app.agent.schemas import AgentSuggestionResult, AgentToolDecision


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
```

- [ ] **Step 3: Run the schema tests**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py -q
```

Expected:

```text
2 passed
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/agent/schemas.py backend/tests/test_agent_pipeline.py
git commit -m "feat: add agent pipeline schemas"
```

---

### Task 2: Add Conversation Context Builder

**Files:**
- Modify: `backend/app/agent/service.py`
- Test: `backend/tests/test_agent_pipeline.py`

- [ ] **Step 1: Add a failing test for context preserving the active sunscreen product**

Append this to `backend/tests/test_agent_pipeline.py`:

```python
from app.agent.service import _build_pipeline_context, _set_scenario_state
from app.models import Conversation, Customer, Message
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace
from tests.test_agent_scenarios import _session


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
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py::test_pipeline_context_includes_active_scenario_and_product_focus -q
```

Expected:

```text
FAILED
```

The failure should mention `_build_pipeline_context` missing.

- [ ] **Step 3: Implement `_build_pipeline_context()` in `backend/app/agent/service.py`**

Add this helper near `_latest_active_scenario()`:

```python
def _build_pipeline_context(
    db: Session,
    *,
    conversation: Conversation,
    customer_name: str | None,
    customer_phone: str | None,
    message: str,
    history_limit: int = 16,
) -> AgentConversationContext:
    history_rows = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(desc(Message.created_at), desc(Message.id))
            .limit(history_limit)
        )
    )
    history_rows.reverse()
    active = _latest_active_scenario(db, conversation.id)
    active_payload = active.raw_json if active and isinstance(active.raw_json, dict) else None
    active_product_focus = None
    if active_payload:
        data = active_payload.get("data") or {}
        if isinstance(data, dict):
            active_product_focus = data.get("selected_product") or data.get("product_query")
    return AgentConversationContext(
        conversation_id=conversation.id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        message=message,
        history=[
            {"role": "assistant" if row.sender == "ai" else "user", "content": row.content}
            for row in history_rows
        ],
        active_scenario=active_payload,
        active_product_focus=active_product_focus,
    )
```

Update imports in `service.py`:

```python
from app.agent.schemas import AgentConversationContext, AgentPlan, AgentUiEvent, InvoicePayload, ToolResult
```

- [ ] **Step 4: Run the context test**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py::test_pipeline_context_includes_active_scenario_and_product_focus -q
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/service.py backend/tests/test_agent_pipeline.py
git commit -m "feat: build agent pipeline context"
```

---

### Task 3: Fix Active Scenario Ordering Regression

**Files:**
- Modify: `backend/app/agent/service.py`
- Test: `backend/tests/test_agent_pipeline.py`

- [ ] **Step 1: Add the screenshot regression test**

Append this to `backend/tests/test_agent_pipeline.py`:

```python
import pytest

from app.chat.schemas import DemoMessageRequest
from app.chat.service import receive_demo_message
from tests.test_agent_scenarios import _seed_catalog


@pytest.mark.anyio
async def test_sunscreen_dry_skin_yes_keeps_moist_uv_focus() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(customer_name="Khach Zalo", message="tu van kem chong nang"),
        )
        assert order is None
        assert invoice is None
        assert "Moist UV Cream SPF50+" in reply

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khach Zalo", message="Da kho"),
        )
        assert order is None
        assert invoice is None
        assert "Moist UV Cream SPF50+" in reply

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khach Zalo", message="co"),
        )

        assert order is None
        assert invoice is None
        assert "Moist UV Cream SPF50+" in reply
        assert "Nuoc hoa hong" not in reply
        assert "Cica Recovery Gel" not in reply
        assert "Mieng dan mun" not in reply
        assert not any(
            action.type == "product_recommendation"
            and "Nuoc hoa hong" in str(action.data)
            for action in actions
        )
```

- [ ] **Step 2: Run the failing regression test**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py::test_sunscreen_dry_skin_yes_keeps_moist_uv_focus -q
```

Expected before the fix:

```text
FAILED
```

- [ ] **Step 3: Move active scenario handling before scenario clearing**

In `process_customer_message()`, replace this ordering:

```python
if plan.intent in {"product_consultation", "ask_stock"}:
    _clear_active_scenarios(db, conversation.id)

active_scenario = _latest_active_scenario(db, conversation.id)
if active_scenario:
    handled = _handle_active_scenario(...)
```

with this ordering:

```python
active_scenario = _latest_active_scenario(db, conversation.id)
if active_scenario:
    handled = _handle_active_scenario(
        db,
        active_scenario=active_scenario,
        conversation=conversation,
        customer_id=customer_id,
        message=message,
        actions=actions,
    )
    if handled:
        return _finalize_agent_reply(db, conversation.id, plan, *handled)

if plan.intent in {"product_consultation", "ask_stock"} and _message_switches_topic(message, active_scenario):
    _clear_active_scenarios(db, conversation.id)
```

Add this helper near the scenario helpers:

```python
def _message_switches_topic(message: str, active_scenario: AgentAction | None) -> bool:
    if not active_scenario:
        return True
    normalized = normalize_text(message)
    short_contextual_replies = {
        "co",
        "ok",
        "oki",
        "okay",
        "duoc",
        "duoc a",
        "tu van ky hon",
        "ky hon",
        "loai do",
        "dong do",
        "san pham do",
    }
    if normalized in short_contextual_replies:
        return False
    explicit_topic_words = (
        "tu van serum",
        "tu van sua rua mat",
        "tu van toner",
        "kiem tra don",
        "trang thai don",
        "dat san pham khac",
        "doi san pham",
    )
    return any(word in normalized for word in explicit_topic_words)
```

- [ ] **Step 4: Run the regression test**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py::test_sunscreen_dry_skin_yes_keeps_moist_uv_focus -q
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Run existing scenario tests**

Run:

```bash
cd backend && uv run pytest tests/test_agent_scenarios.py tests/test_agent_demo_polish.py -q
```

Expected:

```text
all selected tests passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/service.py backend/tests/test_agent_pipeline.py
git commit -m "fix: preserve active consultation scenario for short replies"
```

---

### Task 4: Add LLM Tool Decision Pipeline

**Files:**
- Create: `backend/app/agent/pipeline.py`
- Test: `backend/tests/test_agent_pipeline.py`

- [ ] **Step 1: Add tests for LLM tool decision behavior**

Append this to `backend/tests/test_agent_pipeline.py`:

```python
from app.agent.pipeline import decide_next_tool
from app.agent.schemas import AgentConversationContext


@pytest.mark.anyio
async def test_decide_next_tool_keeps_short_yes_on_active_product(monkeypatch) -> None:
    async def fake_generate_llm_json(system_prompt, user_payload, *, temperature, settings):
        assert "nhan vien Lumi Beauty" in system_prompt
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

    monkeypatch.setenv("LLM_API_KEY", "test")
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
```

- [ ] **Step 2: Create `backend/app/agent/pipeline.py`**

```python
from __future__ import annotations

from pydantic import ValidationError

from app.agent.llm_client import LLMClientError, generate_llm_json, llm_available
from app.agent.schemas import AgentConversationContext, AgentToolDecision
from app.agent.tools import list_agent_tools
from app.config import get_settings


TOOL_DECISION_PROMPT = """Ban la nhan vien Lumi Beauty chuyen tu van my pham/skincare qua Zalo, dong thoi la bo dieu phoi tool noi bo.
Chi tra JSON thuan, khong markdown.

Nhiem vu:
- Doc message moi, lich su hoi thoai, active_scenario va active_product_focus.
- Quyet dinh co can goi tool hay khong.
- Neu message ngan nhu "co", "ok", "duoc", "loai do", phai giu ngu canh san pham dang focus.
- Khong goi recommend_products/search_product_recommendations neu khach chi dong y nghe tu van ky hon ve san pham dang focus.
- Khong tao don neu khach chua chot mua ro rang hoac chua co du thong tin nhan hang.
- Chi chon tool co trong tool_catalog.

JSON schema:
{
  "intent": "product_consultation|product_consultation_detail|buy_product|ask_stock|order_status|support|unknown",
  "needs_tool": true|false,
  "selected_tool": "search_products|search_product_recommendations|check_stock|create_draft_order|track_shipping_order"|null,
  "tool_args": {},
  "active_product_focus": string|null,
  "next_state": object|null,
  "handoff": true|false,
  "confidence": number,
  "reason": string|null
}
"""


def _fallback_tool_decision(context: AgentConversationContext) -> AgentToolDecision:
    normalized = context.message.strip().lower()
    if context.active_product_focus and normalized in {"co", "ok", "oki", "okay", "duoc"}:
        return AgentToolDecision(
            intent="product_consultation_detail",
            needs_tool=False,
            selected_tool=None,
            active_product_focus=context.active_product_focus,
            confidence=0.7,
            reason="Short contextual reply keeps active product focus.",
        )
    return AgentToolDecision(
        intent="unknown",
        needs_tool=False,
        selected_tool=None,
        active_product_focus=context.active_product_focus,
        confidence=0.0,
        reason="LLM unavailable or invalid.",
    )


async def decide_next_tool(context: AgentConversationContext) -> AgentToolDecision:
    settings = get_settings()
    if not llm_available(settings):
        return _fallback_tool_decision(context)
    try:
        parsed = await generate_llm_json(
            TOOL_DECISION_PROMPT,
            {
                "message": context.message,
                "customer_name": context.customer_name,
                "customer_phone": context.customer_phone,
                "history": context.history,
                "active_scenario": context.active_scenario,
                "active_product_focus": context.active_product_focus,
                "tool_catalog": list_agent_tools(),
            },
            temperature=0,
            settings=settings,
        )
        decision = AgentToolDecision.model_validate(parsed)
    except (LLMClientError, ValidationError, KeyError, TypeError, ValueError):
        return _fallback_tool_decision(context)
    allowed_tools = {
        "search_products",
        "search_product_recommendations",
        "check_stock",
        "create_draft_order",
        "track_shipping_order",
    }
    if decision.selected_tool not in allowed_tools:
        decision.needs_tool = False
        decision.selected_tool = None
        decision.tool_args = {}
    return decision
```

- [ ] **Step 3: Run the tool decision test**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py::test_decide_next_tool_keeps_short_yes_on_active_product -q
```

Expected:

```text
1 passed
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/agent/pipeline.py backend/tests/test_agent_pipeline.py
git commit -m "feat: add llm tool decision pipeline"
```

---

### Task 5: Add Whitelisted Tool Executor

**Files:**
- Modify: `backend/app/agent/pipeline.py`
- Test: `backend/tests/test_agent_pipeline.py`

- [ ] **Step 1: Add tests for invalid and valid tool execution**

Append this to `backend/tests/test_agent_pipeline.py`:

```python
from app.agent.pipeline import execute_selected_tool
from app.agent.schemas import AgentToolDecision


def test_execute_selected_tool_rejects_unknown_tool() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        result = execute_selected_tool(
            db,
            AgentToolDecision(needs_tool=True, selected_tool="delete_products", tool_args={}),
        )

        assert result is not None
        assert result.type == "tool_execution"
        assert result.status == "skipped"
        assert "khong hop le" in result.summary.lower()


def test_execute_selected_tool_searches_recommendations() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)
        result = execute_selected_tool(
            db,
            AgentToolDecision(
                needs_tool=True,
                selected_tool="search_product_recommendations",
                tool_args={"query": "kem chong nang da kho"},
            ),
        )

        assert result is not None
        assert result.type == "product_recommendation"
        assert result.status == "success"
        assert any(product["name"] == "Moist UV Cream SPF50+" for product in result.data["products"])
```

- [ ] **Step 2: Implement `execute_selected_tool()`**

Append this to `backend/app/agent/pipeline.py`:

```python
from sqlalchemy.orm import Session

from app.agent.schemas import ToolResult
from app.agent.tools import check_stock, search_product_recommendations, search_products


def execute_selected_tool(db: Session, decision: AgentToolDecision) -> ToolResult | None:
    if not decision.needs_tool:
        return None
    selected_tool = decision.selected_tool
    args = decision.tool_args or {}
    if selected_tool == "search_product_recommendations":
        return search_product_recommendations(db, args.get("query") or decision.active_product_focus)
    if selected_tool == "search_products":
        return search_products(db, args.get("query") or decision.active_product_focus)
    if selected_tool == "check_stock":
        product_result = search_products(db, args.get("query") or decision.active_product_focus)
        quantity = int(args.get("quantity") or 1)
        return check_stock(product_result, quantity)
    return ToolResult(
        type="tool_execution",
        status="skipped",
        summary=f"Tool khong hop le hoac chua duoc phep: {selected_tool}",
        data={"selected_tool": selected_tool},
    )
```

This first version intentionally excludes `create_draft_order` and `track_shipping_order` from the executor. Existing service scenario/order code should keep handling those until the reply pipeline is stable.

- [ ] **Step 3: Run executor tests**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py::test_execute_selected_tool_rejects_unknown_tool tests/test_agent_pipeline.py::test_execute_selected_tool_searches_recommendations -q
```

Expected:

```text
2 passed
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/agent/pipeline.py backend/tests/test_agent_pipeline.py
git commit -m "feat: add whitelisted agent tool executor"
```

---

### Task 6: Add Beauty Consultant Reply LLM

**Files:**
- Modify: `backend/app/agent/pipeline.py`
- Test: `backend/tests/test_agent_pipeline.py`

- [ ] **Step 1: Add tests for reply generation role and fallback**

Append this to `backend/tests/test_agent_pipeline.py`:

```python
from app.agent.pipeline import generate_customer_reply
from app.agent.schemas import ToolResult


@pytest.mark.anyio
async def test_generate_customer_reply_uses_beauty_consultant_role(monkeypatch) -> None:
    async def fake_generate_llm_json(system_prompt, user_payload, *, temperature, settings):
        assert "chuyen vien tu van my pham cua Lumi Beauty" in system_prompt
        assert user_payload["decision"]["active_product_focus"] == "Moist UV Cream SPF50+"
        assert user_payload["tool_result"] is None
        return {
            "reply": "Dạ có ạ. Với da khô, Moist UV Cream SPF50+ hợp hơn vì có thêm dưỡng ẩm, giúp hạn chế khô căng khi dùng ban ngày.",
            "actions": ["Tư vấn chi tiết Moist UV Cream SPF50+ theo loại da khô"],
        }

    monkeypatch.setenv("LLM_API_KEY", "test")
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
    assert result.actions == ["Tư vấn chi tiết Moist UV Cream SPF50+ theo loại da khô"]


@pytest.mark.anyio
async def test_generate_customer_reply_fallback_keeps_active_product() -> None:
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
```

- [ ] **Step 2: Implement reply generation**

Append this to `backend/app/agent/pipeline.py`:

```python
from app.agent.schemas import AgentReplyResult


BEAUTY_CONSULTANT_REPLY_PROMPT = """Ban la chuyen vien tu van my pham cua Lumi Beauty dang chat voi khach qua Zalo.
Chi tra JSON thuan, khong markdown.

JSON schema:
{
  "reply": "tin nhan gui khach",
  "actions": ["tom tat viec da lam"],
  "state_update": object|null
}

Giong dieu:
- Tu nhien nhu nhan vien shop beauty, am, ngan gon, ro y.
- Xung ho "em" voi khach, goi khach la "chi" neu khong co thong tin khac.
- Khong nhac tool, database, KiotViet, GHN, Agentify.
- Khong bia gia, ton kho, hoa don, van don ngoai tool_result.
- Neu active_product_focus co gia tri va khach dang hoi tiep, phai tu van dung san pham do.
- Neu khach chua chot mua, khong hoi ten, so dien thoai, dia chi.
- Neu da dang kich ung nang, uu tien an toan va khuyen di kham/coso y te.
"""


def _fallback_reply(context: AgentConversationContext, decision: AgentToolDecision, tool_result: ToolResult | None) -> AgentReplyResult:
    focus = decision.active_product_focus or context.active_product_focus
    if focus:
        return AgentReplyResult(
            reply=(
                f"Dạ có ạ. Với nhu cầu hiện tại, em sẽ tư vấn kỹ hơn dòng {focus} cho chị. "
                "Chị cho em biết thêm da mình có đang treatment, dễ kích ứng hoặc hay khô căng vào ban ngày không ạ?"
            ),
            actions=[f"Tư vấn tiếp sản phẩm đang focus: {focus}"],
        )
    if tool_result and tool_result.status == "success":
        return AgentReplyResult(
            reply="Dạ em đã lọc được vài lựa chọn phù hợp. Chị cho em thêm loại da hoặc ngân sách để em chốt sản phẩm sát hơn nhé.",
            actions=[tool_result.summary],
        )
    return AgentReplyResult(
        reply="Dạ chị nói thêm giúp em nhu cầu hoặc loại da hiện tại để em tư vấn sát hơn nhé.",
        actions=[],
    )


async def generate_customer_reply(
    context: AgentConversationContext,
    decision: AgentToolDecision,
    tool_result: ToolResult | None,
) -> AgentReplyResult:
    settings = get_settings()
    if not llm_available(settings):
        return _fallback_reply(context, decision, tool_result)
    try:
        parsed = await generate_llm_json(
            BEAUTY_CONSULTANT_REPLY_PROMPT,
            {
                "message": context.message,
                "customer_name": context.customer_name,
                "customer_phone": context.customer_phone,
                "history": context.history,
                "active_scenario": context.active_scenario,
                "active_product_focus": context.active_product_focus,
                "decision": decision.model_dump(),
                "tool_result": tool_result.model_dump() if tool_result else None,
            },
            temperature=0.2,
            settings=settings,
        )
        result = AgentReplyResult.model_validate(parsed)
    except (LLMClientError, ValidationError, KeyError, TypeError, ValueError):
        return _fallback_reply(context, decision, tool_result)
    if not result.reply.strip():
        return _fallback_reply(context, decision, tool_result)
    return result
```

- [ ] **Step 3: Run reply generation tests**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py::test_generate_customer_reply_uses_beauty_consultant_role tests/test_agent_pipeline.py::test_generate_customer_reply_fallback_keeps_active_product -q
```

Expected:

```text
2 passed
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/agent/pipeline.py backend/tests/test_agent_pipeline.py
git commit -m "feat: add beauty consultant reply generator"
```

---

### Task 7: Add LLM Quick Reply Suggestions

**Files:**
- Modify: `backend/app/agent/pipeline.py`
- Modify: `backend/app/chat/router.py`
- Modify: `backend/app/integrations/zalo/router.py`
- Test: `backend/tests/test_agent_pipeline.py`
- Test: `backend/tests/test_agent_demo_polish.py`

- [ ] **Step 1: Add tests for suggestion generation**

Append this to `backend/tests/test_agent_pipeline.py`:

```python
from app.agent.pipeline import generate_quick_replies


@pytest.mark.anyio
async def test_generate_quick_replies_limits_to_four(monkeypatch) -> None:
    async def fake_generate_llm_json(system_prompt, user_payload, *, temperature, settings):
        assert "goi y nut tra loi nhanh" in system_prompt
        return {
            "quick_replies": [
                "Dat 1 tuyp",
                "So sanh Derma Shield",
                "Da dang treatment",
                "Duoi 350k",
                "Gap nhan vien",
            ]
        }

    monkeypatch.setenv("LLM_API_KEY", "test")
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
    reply = AgentReplyResult(reply="Dạ Moist UV hợp da khô vì có thêm dưỡng ẩm.")

    result = await generate_quick_replies(context, decision, reply)

    assert result.quick_replies == [
        "Dat 1 tuyp",
        "So sanh Derma Shield",
        "Da dang treatment",
        "Duoi 350k",
    ]
```

- [ ] **Step 2: Implement `generate_quick_replies()`**

Append this to `backend/app/agent/pipeline.py`:

```python
from app.agent.schemas import AgentSuggestionResult


QUICK_REPLY_PROMPT = """Ban la bo goi y nut tra loi nhanh cho chat Zalo cua Lumi Beauty.
Chi tra JSON thuan, khong markdown.

JSON schema:
{
  "quick_replies": ["0 den 4 lua chon ngan"]
}

Quy tac:
- Moi lua chon toi da 24 ky tu.
- Goi y phai bam sat reply vua gui va active_product_focus.
- Khong dua thong tin noi bo, tool, database, KiotViet, Agentify vao quick replies.
- Neu dang cho xac nhan don, uu tien "Dung roi", "Sua SDT", "Doi dia chi".
- Neu da tao hoa don, uu tien "Kiem tra trang thai don", "Mua them", "Gap nhan vien".
- Neu dang tu van san pham, uu tien cac buoc tiep theo tu nhien nhu dat hang, so sanh, loai da, ngan sach.
"""


def _fallback_quick_replies(context: AgentConversationContext, decision: AgentToolDecision) -> AgentSuggestionResult:
    focus = decision.active_product_focus or context.active_product_focus
    if focus:
        return AgentSuggestionResult(quick_replies=["Dat 1 tuyp", "So sanh them", "Da dang treatment", "Gap nhan vien"])
    return AgentSuggestionResult(quick_replies=[])


async def generate_quick_replies(
    context: AgentConversationContext,
    decision: AgentToolDecision,
    reply_result: AgentReplyResult,
) -> AgentSuggestionResult:
    settings = get_settings()
    if not llm_available(settings):
        return _fallback_quick_replies(context, decision)
    try:
        parsed = await generate_llm_json(
            QUICK_REPLY_PROMPT,
            {
                "message": context.message,
                "history": context.history,
                "active_product_focus": context.active_product_focus,
                "decision": decision.model_dump(),
                "reply": reply_result.reply,
            },
            temperature=0.2,
            settings=settings,
        )
        result = AgentSuggestionResult.model_validate(parsed)
    except (LLMClientError, ValidationError, KeyError, TypeError, ValueError):
        return _fallback_quick_replies(context, decision)
    cleaned = []
    for item in result.quick_replies:
        text = str(item).strip()
        if text and text not in cleaned:
            cleaned.append(text[:24])
    return AgentSuggestionResult(quick_replies=cleaned[:4])
```

- [ ] **Step 3: Update quick reply extraction in demo and Zalo routers**

In `backend/app/chat/router.py`, modify `_quick_replies_from_actions()` so it checks LLM suggestions first:

```python
def _quick_replies_from_actions(actions: list, *, has_invoice: bool) -> list[str]:
    for action in reversed(actions):
        if action.type == "suggested_replies" and action.status == "success":
            replies = action.data.get("quick_replies", [])
            return [str(item) for item in replies[:4] if item]
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
```

Make the same change in `backend/app/integrations/zalo/router.py`.

- [ ] **Step 4: Update `test_demo_and_zalo_quick_reply_defaults_match()`**

Add this assertion before the existing defaults:

```python
    suggested = [
        ToolResult(
            type="suggested_replies",
            status="success",
            summary="Gợi ý reply",
            data={"quick_replies": ["Đặt 1 tuýp", "So sánh thêm"]},
        )
    ]

    assert demo_quick_replies(suggested, has_invoice=False) == ["Đặt 1 tuýp", "So sánh thêm"]
    assert zalo_quick_replies(suggested, has_invoice=False) == ["Đặt 1 tuýp", "So sánh thêm"]
```

- [ ] **Step 5: Run quick reply tests**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py::test_generate_quick_replies_limits_to_four tests/test_agent_demo_polish.py::test_demo_and_zalo_quick_reply_defaults_match -q
```

Expected:

```text
2 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/pipeline.py backend/app/chat/router.py backend/app/integrations/zalo/router.py backend/tests/test_agent_pipeline.py backend/tests/test_agent_demo_polish.py
git commit -m "feat: generate contextual quick replies"
```

---

### Task 8: Wire Pipeline Into `process_customer_message()` Safely

**Files:**
- Modify: `backend/app/agent/service.py`
- Test: `backend/tests/test_agent_pipeline.py`
- Test: `backend/tests/test_agent_scenarios.py`
- Test: `backend/tests/test_agent_demo_polish.py`

- [ ] **Step 1: Add integration test with mocked LLM pipeline calls**

Append this to `backend/tests/test_agent_pipeline.py`:

```python
@pytest.mark.anyio
async def test_process_customer_message_uses_pipeline_for_active_product_detail(monkeypatch) -> None:
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
            reply="Dạ có ạ. Moist UV Cream SPF50+ hợp da khô vì có thêm dưỡng ẩm, dùng ban ngày sẽ đỡ khô căng hơn.",
            actions=["Tư vấn chi tiết Moist UV Cream SPF50+"],
        )

    async def fake_generate_quick_replies(context, decision, reply_result):
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
```

- [ ] **Step 2: Import pipeline functions in `service.py`**

Add:

```python
from app.agent.pipeline import decide_next_tool, execute_selected_tool, generate_customer_reply, generate_quick_replies
```

- [ ] **Step 3: Add `_should_use_llm_pipeline()` in `service.py`**

Add:

```python
def _should_use_llm_pipeline(context: AgentConversationContext, plan: AgentPlan) -> bool:
    if context.active_product_focus:
        return True
    if plan.intent in {"product_consultation", "unknown"}:
        return True
    return False
```

- [ ] **Step 4: Wire the pipeline after active scenario handling and before generic `product_consultation` rule**

In `process_customer_message()`, after `_handle_active_scenario()` has had first chance to handle the message, add:

```python
    context = _build_pipeline_context(
        db,
        conversation=conversation,
        customer_name=effective_customer_name,
        customer_phone=customer_phone,
        message=message,
    )
    if _should_use_llm_pipeline(context, plan):
        decision = await decide_next_tool(context)
        actions.append(
            ToolResult(
                type="llm_tool_decision",
                status="success",
                summary=decision.reason or f"LLM decision: {decision.intent}",
                data=decision.model_dump(),
            )
        )
        tool_result = execute_selected_tool(db, decision)
        if tool_result:
            actions.append(tool_result)
        reply_result = await generate_customer_reply(context, decision, tool_result)
        suggestions = await generate_quick_replies(context, decision, reply_result)
        actions.extend(
            ToolResult(type="llm_context_reply", status="success", summary=summary)
            for summary in reply_result.actions[:4]
        )
        actions.append(
            ToolResult(
                type="suggested_replies",
                status="success",
                summary="Đã gợi ý câu trả lời nhanh theo ngữ cảnh.",
                data=suggestions.model_dump(),
            )
        )
        reply = reply_result.reply
        conversation.status = "open"
        actions.append(ToolResult(type="reply", status="success", summary=reply))
        _persist_actions(db, conversation.id, actions)
        _persist_ai_message(db, conversation.id, reply)
        return plan, reply, actions, None, None, ui_events
```

If this creates duplicate handling for a specialized scenario, narrow `_should_use_llm_pipeline()` to only return true when `context.active_product_focus` exists or `plan.intent == "unknown"` during this task.

- [ ] **Step 5: Run the mocked integration test**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py::test_process_customer_message_uses_pipeline_for_active_product_detail -q
```

Expected:

```text
1 passed
```

- [ ] **Step 6: Run the main backend regression set**

Run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py tests/test_agent_scenarios.py tests/test_agent_demo_polish.py tests/test_order_confirmation_flow.py -q
```

Expected:

```text
all selected tests passed
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/agent/service.py backend/tests/test_agent_pipeline.py
git commit -m "feat: wire llm pipeline into chat service"
```

---

### Task 9: Keep Frontend Demo Output Clean

**Files:**
- Modify: `frontend/src/app/App.tsx`

- [ ] **Step 1: Update `/user_chat` loading copy**

In `UserChatScreen`, replace:

```tsx
{loading && <ChatMessage sender="ai" text="Đang gửi tin nhắn và xử lý đơn..." />}
```

with:

```tsx
{loading && <ChatMessage sender="ai" text="Lumi Beauty đang tư vấn..." />}
```

- [ ] **Step 2: Keep product panel rendering backend-driven**

Verify this condition remains unchanged:

```tsx
{!!recommendedProducts.length && (
  <LlmProductPanel
    products={recommendedProducts}
    onChoose={(product) => sendToAgent(`Em muốn đặt ${product.name}`)}
  />
)}
```

The backend should return `recommended_products=[]` for the screenshot `co` turn, so the panel will not show unrelated products.

- [ ] **Step 3: Update inbox loading copy**

Replace:

```tsx
{sending && <ChatMessage sender="ai" text="Agentify đang gọi LLM, tìm sản phẩm trong KiotViet và kiểm tra tồn kho..." />}
```

with:

```tsx
{sending && <ChatMessage sender="ai" text="Lumi Beauty đang đọc ngữ cảnh và soạn câu trả lời..." />}
```

- [ ] **Step 4: Run frontend checks**

Run:

```bash
cd frontend && npm run build
```

Expected:

```text
built successfully
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/App.tsx
git commit -m "chore: polish demo chat loading copy"
```

---

### Task 10: Full Verification

**Files:**
- No file changes expected.

- [ ] **Step 1: Run backend tests**

Run:

```bash
cd backend && uv run pytest -q
```

Expected:

```text
all tests passed
```

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected:

```text
built successfully
```

- [ ] **Step 3: Manual demo script**

Start the app using the repo's normal dev command, then open `/user_chat` and send:

```text
tu van kem chong nang
Da kho
co
```

Expected visible behavior:

- First reply lists sunscreen options including `Moist UV Cream SPF50+`.
- Second reply recommends `Moist UV Cream SPF50+` for dry skin.
- Third reply explains `Moist UV Cream SPF50+` in more detail.
- Third reply does not show toner, cica gel, acne patch, or unrelated product cards.
- Quick replies are contextual to Moist UV or next customer action.

- [ ] **Step 4: Inspect persisted actions**

Use the inbox action panel or database rows to confirm the `co` turn includes:

```text
llm_tool_decision
llm_context_reply
suggested_replies
reply
```

Expected:

- No unrelated `product_recommendation` for the `co` turn.
- If `product_recommendation` appears, its products must be sunscreen products related to the active context.

- [ ] **Step 5: Commit final verification notes if docs changed**

If this plan file is the only documentation change:

```bash
git add docs/superpowers/plans/2026-05-28-llm-orchestrated-chat-pipeline.md
git commit -m "docs: plan llm orchestrated chat pipeline"
```

---

## Rollback Plan

If the LLM pipeline introduces unstable demo behavior:

1. Keep Task 3's scenario ordering fix because it directly fixes the screenshot regression without relying on LLM availability.
2. Disable `_should_use_llm_pipeline()` by returning `False`.
3. Keep the new tests and schemas only if they do not affect runtime.
4. Re-run:

```bash
cd backend && uv run pytest tests/test_agent_pipeline.py::test_sunscreen_dry_skin_yes_keeps_moist_uv_focus tests/test_agent_scenarios.py tests/test_agent_demo_polish.py -q
```

Expected:

```text
all selected tests passed
```

## Implementation Notes

- The first production-safe win is Task 3. It fixes the exact bug even when LLM is disabled.
- The LLM pipeline should initially be used for consultation/detail turns, not invoice/order creation.
- The reply prompt must preserve the demo role: a Lumi Beauty beauty consultant chatting on Zalo.
- The tool executor must stay whitelist-based. Never execute a tool name solely because the LLM returned it.
- `recommended_products` should only be populated from successful `product_recommendation` tool results. A detail reply such as `co` after `Da kho` should usually return no new product panel.
