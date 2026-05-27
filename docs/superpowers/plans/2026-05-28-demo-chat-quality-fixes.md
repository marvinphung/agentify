# Demo Chat Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining demo-readiness issue where order chat treats `SPF50+` as quantity `50`, and document the correct local frontend server mode for API-backed demos.

**Architecture:** Keep the fix inside backend parsing/state handling, then cover it with parser and end-to-end chat regression tests. Frontend code is not the root cause for the chat quality bug; local static `serve dist` failed only because it lacks Vite/Vercel API rewrites.

**Tech Stack:** FastAPI, SQLAlchemy, pytest, React/Vite.

---

## Test Evidence From 2026-05-28

- `cd backend && uv run pytest`: `32 passed in 2.81s`.
- `cd frontend && npm run build`: Vite build passed.
- API smoke against `http://127.0.0.1:8763`: register, login, `/api/auth/me`, KiotViet preview/authorize, GHN preview/authorize, product listing, demo chat all returned 2xx.
- Browser smoke against Vite dev `http://127.0.0.1:5175`: landing, `/user_chat`, register, KiotViet connect, GHN connect, dashboard, login all passed.
- Browser smoke against static `serve dist -l 5173`: `/api/channels/zalo/messages` returned 404 because static serve has no API rewrite/proxy. Vercel rewrites and Vite dev proxy do handle this.
- Chat quality smoke, 4 scenarios:
  - Product consultation: mostly OK, but budget handling needs tuning. Query `dưới 350k` still listed one 390.000đ item.
  - Urgent irritation/safety: OK.
  - Delayed order/return support: OK.
  - Order flow: NEEDS_FIX. Sequence `Em muốn đặt SunCare Aqua SPF50+` -> `Nguyễn Thảo, 0901234567, 12 Nguyễn Trãi...` produced `SunCare Aqua SPF50+ chỉ còn 10, không đủ số lượng 50.`

## Root Cause

`backend/app/agent/parser.py` uses:

```python
quantity_match = re.search(r"(\d+)\s*(cái|hop|hộp|chai|tuýp|túyp|gói|goi|sp|sản phẩm)?", lower)
```

Because the unit is optional, product attributes, phone numbers, and addresses can become order quantities:

```text
SunCare Aqua SPF50+ -> quantity 50
0901234567 -> quantity 901234567
12 Nguyễn Trãi -> quantity 12
```

`backend/app/agent/service.py` also has `_extract_quantity()` with the same broad behavior:

```python
match = re.search(r"\b(\d+)\b", message)
```

The first message stores generic order scenario state with `quantity=50`; the contact-line step reuses that quantity and blocks invoice creation through stock check.

---

### Task 1: Add Parser Regression Tests

**Files:**
- Modify: `backend/tests/test_parser.py`

- [ ] **Step 1: Add tests that fail on current parser**

Append these tests to `backend/tests/test_parser.py`:

```python
def test_parse_order_ignores_spf_number_as_quantity():
    plan = parse_message("Em muốn đặt SunCare Aqua SPF50+")

    assert plan.intent == "buy_product"
    assert plan.slots.quantity == 1
    assert "suncare" in plan.slots.product_query.lower()
    assert "spf50" in plan.slots.product_query.lower()


def test_parse_contact_line_ignores_phone_and_address_numbers_as_quantity():
    plan = parse_message("Nguyễn Thảo, 0901234567, 12 Nguyễn Trãi Hà Nội, nhận giờ hành chính")

    assert plan.intent == "unknown"
    assert plan.slots.quantity == 1
    assert plan.slots.customer_phone == "0901234567"
```

- [ ] **Step 2: Run parser tests and verify they fail**

Run:

```bash
cd backend
uv run pytest tests/test_parser.py -q
```

Expected before implementation: the two new tests fail because quantity is `50` or `901234567`, and product query may drop `50`.

---

### Task 2: Replace Broad Quantity Parsing

**Files:**
- Modify: `backend/app/agent/parser.py`

- [ ] **Step 1: Add explicit quantity helper**

In `backend/app/agent/parser.py`, after `CONSULT_WORDS`, add:

```python
QUANTITY_UNITS = r"cái|hop|hộp|chai|tuýp|túyp|tube|gói|goi|sp|sản phẩm|san pham"
QUANTITY_WITH_UNIT_RE = re.compile(rf"(?<![A-Za-zÀ-ỹ0-9])(\d{{1,3}})\s*(?:{QUANTITY_UNITS})(?![A-Za-zÀ-ỹ0-9])", re.IGNORECASE)
QUANTITY_AFTER_BUY_RE = re.compile(
    r"(?<![A-Za-zÀ-ỹ0-9])(?:mua|lấy|lay|đặt|dat|chốt|chot|order)\s+"
    r"(?:cho\s+(?:chị|chi|em|mình|minh)\s+)?"
    r"(\d{1,3})(?!\s*(?:ml|g|kg|cm|mm|\+))(?![A-Za-zÀ-ỹ0-9])",
    re.IGNORECASE,
)
```

Then add this function before `parse_message()`:

```python
def extract_quantity(message: str) -> int:
    unit_match = QUANTITY_WITH_UNIT_RE.search(message)
    if unit_match:
        return max(int(unit_match.group(1)), 1)

    buy_match = QUANTITY_AFTER_BUY_RE.search(message)
    if buy_match:
        return max(int(buy_match.group(1)), 1)

    return 1
```

- [ ] **Step 2: Use the helper in `parse_message()`**

Replace:

```python
quantity = 1
quantity_match = re.search(r"(\d+)\s*(cái|hop|hộp|chai|tuýp|túyp|gói|goi|sp|sản phẩm)?", lower)
if quantity_match:
    quantity = max(int(quantity_match.group(1)), 1)
```

with:

```python
quantity = extract_quantity(raw)
```

- [ ] **Step 3: Preserve product attributes in product query**

In `extract_product_query()`, replace:

```python
text = re.sub(r"\d+\s*(cái|hop|hộp|chai|tuýp|túyp|gói|goi|sp|sản phẩm)?", " ", text, flags=re.IGNORECASE)
```

with:

```python
text = QUANTITY_WITH_UNIT_RE.sub(" ", text)
text = QUANTITY_AFTER_BUY_RE.sub(" ", text)
```

This removes explicit quantities like `2 tuýp` and `đặt 2`, while preserving product attributes like `SPF50+` and `40ml`.

- [ ] **Step 4: Run parser tests**

Run:

```bash
cd backend
uv run pytest tests/test_parser.py -q
```

Expected: all parser tests pass.

---

### Task 3: Reuse Safe Quantity Parsing In Scenario State

**Files:**
- Modify: `backend/app/agent/service.py`

- [ ] **Step 1: Import parser quantity helper**

Change the parser import near the top of `backend/app/agent/service.py` from:

```python
from app.agent.parser import parse_message
```

to:

```python
from app.agent.parser import extract_quantity as parse_quantity
from app.agent.parser import parse_message
```

- [ ] **Step 2: Replace service-level broad quantity extraction**

Replace `_extract_quantity()` in `backend/app/agent/service.py`:

```python
def _extract_quantity(message: str) -> int:
    match = re.search(r"\b(\d+)\b", message)
    return max(int(match.group(1)), 1) if match else 1
```

with:

```python
def _extract_quantity(message: str) -> int:
    return parse_quantity(message)
```

- [ ] **Step 3: Run affected tests**

Run:

```bash
cd backend
uv run pytest tests/test_agent_edge_cases.py tests/test_agent_scenarios.py tests/test_order_confirmation_flow.py -q
```

Expected: all targeted chat/order tests pass.

---

### Task 4: Add End-To-End Chat Regression Test

**Files:**
- Modify: `backend/tests/test_agent_edge_cases.py`

- [ ] **Step 1: Add failing regression test**

Append:

```python
@pytest.mark.anyio
async def test_suncare_spf50_order_contact_line_creates_one_item_invoice() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        _seed_catalog(db)

        conversation, reply, actions, order, invoice, _ = await receive_demo_message(
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

        _, reply, actions, order, invoice, _ = await receive_demo_message(
            db,
            DemoMessageRequest(conversation_id=conversation.id, customer_name="Khách Zalo", message="Đúng rồi"),
        )
        assert order is not None
        assert invoice is not None
        assert invoice.total == 320000
        assert invoice.items[0].quantity == 1
```

- [ ] **Step 2: Verify regression passes after implementation**

Run:

```bash
cd backend
uv run pytest tests/test_agent_edge_cases.py::test_suncare_spf50_order_contact_line_creates_one_item_invoice -q
```

Expected: test passes.

- [ ] **Step 3: Run full backend suite**

Run:

```bash
cd backend
uv run pytest
```

Expected: all tests pass.

---

### Task 5: Respect Budget In Product Recommendations

**Files:**
- Modify: `backend/app/agent/tools.py`
- Modify: `backend/tests/test_agent_edge_cases.py`

- [ ] **Step 1: Add budget recommendation regression test**

Append to `backend/tests/test_agent_edge_cases.py`:

```python
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
```

- [ ] **Step 2: Add max-budget extraction helper**

In `backend/app/agent/tools.py`, add `import re` at the top if missing.

Add this helper near `search_product_recommendations()`:

```python
def _extract_max_budget(query: str | None) -> float | None:
    normalized = normalize_text(query or "")
    match = re.search(
        r"(?:duoi|toi da|khong qua|nho hon|<=|<)\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|trieu|m)?",
        normalized,
    )
    if not match:
        return None
    amount = float(match.group(1).replace(",", "."))
    unit = match.group(2) or ""
    if unit in {"k", "nghin", "ngan"}:
        amount *= 1000
    elif unit in {"trieu", "m"}:
        amount *= 1_000_000
    elif amount < 10_000:
        amount *= 1000
    return amount
```

- [ ] **Step 3: Filter recommendation candidates by max budget**

In `search_product_recommendations()`, after `query_norm = normalize_text(query)`, add:

```python
max_budget = _extract_max_budget(query)
```

Inside the product loop, before appending to `scored`, add:

```python
if max_budget is not None and float(product.base_price or 0) > max_budget:
    continue
```

- [ ] **Step 4: Run targeted recommendation test**

Run:

```bash
cd backend
uv run pytest tests/test_agent_edge_cases.py::test_sunscreen_consultation_respects_under_350k_budget -q
```

Expected: test passes and over-budget products are excluded.

---

### Task 6: Document Correct Local Demo Mode

**Files:**
- Modify: `frontend/README.md`

- [ ] **Step 1: Add local demo note**

Append this section:

````markdown
## Local API-backed demo

Use Vite dev server when testing chat, auth, KiotViet, or GHN locally:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

`vite.config.ts` proxies `/api` and `/health` to `VITE_PROXY_API_TARGET`.

Do not use `serve dist -l 5173` for local API smoke unless the app was built with `VITE_API_BASE_URL` pointing at a backend, because static serve does not apply Vite proxy or Vercel rewrites.
````

- [ ] **Step 2: Verify frontend build still passes**

Run:

```bash
cd frontend
npm run build
```

Expected: Vite build passes.

---

### Task 7: Final Verification

**Files:**
- No new source files.

- [ ] **Step 1: Run backend test suite**

Run:

```bash
cd backend
uv run pytest
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: build passes.

- [ ] **Step 3: Re-run manual chat quality scenario**

Against local backend, send:

```text
Em muốn đặt SunCare Aqua SPF50+
Nguyễn Thảo, 0901234567, 12 Nguyễn Trãi Hà Nội, nhận giờ hành chính
Đúng rồi
```

Expected:

- Contact line creates `order_confirmation_pending`.
- Confirmation creates invoice.
- Invoice has `quantity == 1`.
- Reply never says `không đủ số lượng 50`.
