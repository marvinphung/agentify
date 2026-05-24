# Agentify MVP Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng MVP thành demo thuyết phục với luồng duy nhất: connect Zalo -> connect KiotViet -> khách nhắn trên giao diện giống Zalo -> agent tư vấn, xin thiếu thông tin, tạo đơn nháp và gửi hóa đơn tạm tính lại trong chat.

**Architecture:** Hợp nhất hai agent hiện tại thành một orchestration service dùng chung cho `/api/agent/chat`, `/api/channels/demo/messages` và webhook Zalo giả lập. Backend chịu trách nhiệm quản lý trạng thái hội thoại, tạo đơn, xuất invoice payload; frontend chỉ render trạng thái và gửi tin nhắn, không tự hard-code logic bán hàng. Bản plan này đã được cập nhật sau khi CodeGraph được khởi tạo ngày 2026-05-23.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL, Pydantic, httpx, React, Vite, TypeScript, Tailwind CSS, pytest.

---

## CodeGraph Findings 2026-05-23

CodeGraph index hiện có 95 files, 945 nodes và 1695 edges. Các symbol sau là điểm neo triển khai, không cần grep lại khi thực thi plan:

- `handle_customer_message` ở `backend/app/agent/service.py:9` chỉ có 1 caller là `receive_demo_message`. Đây là nơi ít rủi ro nhất để đổi return type từ tuple sang `AgentChatResult`.
- `agent_chat` ở `backend/app/agent/chat_router.py:46` đang tự xử lý LLM, fallback, recommendations, persist message/action và commit DB. Đây là flow agent thứ hai cần gom về service chung.
- `DemoMessageResponse` chỉ ảnh hưởng `backend/app/chat/schemas.py` và `backend/app/chat/router.py`, nên thêm `invoice`/`ui_events` vào response này có blast radius nhỏ.
- `apiRequest` chỉ được gọi trong `App`, `UserChatScreen`, `InboxScreen`, `IntegrationsScreen`, nên có thể extract sang `frontend/src/app/agentApi.ts` theo từng bước mà không ảnh hưởng toàn bộ codebase.
- `InvoiceCard` ở `frontend/src/app/App.tsx:2829` hiện nhận `ChatOrder`; phải đổi sang `InvoicePayload` server-sent để chứng minh "agent gửi hóa đơn" thay vì UI tự dựng từ order.
- `Customer` chưa có `external_channel_user_id`; Zalo demo adapter giai đoạn này phải nhận `conversation_id` hoặc dùng `phone + channel` để nối tiếp hội thoại, không tạo customer/conversation mới cho từng message.
- `KiotVietClient.create_order()` đã tồn tại ở `backend/app/integrations/kiotviet/client.py:75`; plan chỉ cần thêm payload builder và gọi sau local draft khi `KIOTVIET_CREATE_REAL_ORDERS=true`.

### Updated Technical Direction

Implementation không nên viết thêm "agent thứ ba" cho Zalo. Thay vào đó:

1. `receive_demo_message()` và `agent_chat()` cùng tạo hoặc tìm `Customer`/`Conversation`, persist customer message, rồi gọi `handle_customer_message()`.
2. `handle_customer_message()` đọc lịch sử từ DB, resolve pending order intent, chạy planner/tool, persist AI text, persist `invoice_sent` action, trả `AgentChatResult`.
3. Zalo demo webhook chỉ là adapter: request Zalo-like -> same `handle_customer_message()` -> response Zalo-like gồm text + invoice event.
4. Frontend chat render `ui_events`; nếu event type là `invoice`, render `InvoiceCard`.

---

## Senior Review Hiện Tại

### Nhận định tổng quan

MVP hiện có đủ nền tảng kỹ thuật để demo một agent bán hàng: backend FastAPI, database, KiotViet connect/sync, product cache, conversation/message/order models và frontend chat. Nhưng trải nghiệm demo chưa "đóng vòng" vì có quá nhiều màn phụ, quá nhiều logic giả lập ở frontend, và backend có hai đường agent khác nhau với hành vi khác nhau.

Với vai trò ban giám khảo, điểm chưa đạt không phải là thiếu tính năng lớn, mà là thiếu một câu chuyện demo sắc: "tôi connect 2 hệ thống, nhắn Zalo, agent tự xử lý và gửi hóa đơn". Hiện người xem phải hiểu landing page, onboarding 3 bước, dashboard, inbox, web chat, quick replies, appointment, calendar, approval, workflows. Những phần đó làm sản phẩm trông rộng nhưng chưa sâu.

### Các vấn đề chính

1. **Agent bị tách làm hai nhân cách**
   - `backend/app/agent/chat_router.py` xử lý `/api/agent/chat`, chủ yếu tư vấn, trả recommendations và quick replies, nhưng không tạo đơn/hóa đơn.
   - `backend/app/agent/service.py` xử lý qua `/api/channels/demo/messages`, có tool search/check/create order và trả `order`.
   - `frontend/src/app/App.tsx` gọi cả hai endpoint tùy nhánh UI. Vì vậy khách nhắn "Đặt serum vitamin C" có thể đi qua tư vấn, còn tạo hóa đơn lại phụ thuộc logic frontend hỏi tiếp rồi gọi endpoint khác.

2. **Agent chưa đủ stateful để giống người bán hàng**
   - Backend planner ở `backend/app/agent/llm.py` chỉ nhận message hiện tại, customer name/phone; không nhận `conversation_history`, active product, pending order slots.
   - `chat_router.py` có conversation history, nhưng là một flow khác và không tạo đơn.
   - Các trạng thái như `pendingPurchaseIntent`, `pendingProduct`, `pendingOrderMessage`, `pendingOrderDraft`, `paymentMethod` đang nằm trong React component, nên nếu refresh, đổi thiết bị, hoặc demo từ Zalo thật thì mất luồng.

3. **Hóa đơn có UI nhưng chưa là sản phẩm của agent**
   - `InvoiceCard` trong frontend render tốt, nhưng chỉ xuất hiện khi frontend nhận `result.order` từ `/api/channels/demo/messages`.
   - Reply backend `_order_reply()` chỉ nói "gửi hóa đơn tạm tính trong khung chat", nhưng message lưu vào DB chỉ là text; không lưu invoice event/payload để admin hoặc Zalo renderer hiển thị lại.
   - `/api/agent/chat` không trả `order`, nên với luồng tư vấn tự nhiên người xem dễ không thấy hóa đơn.

4. **Demo setup đang lệch mục tiêu**
   - User mong: B1 connect Zalo, B2 connect KiotViet, sau đó chạy trên Zalo.
   - App hiện có thêm landing, Calendar optional, dashboard lớn, reports, workflows, settings, approval, Facebook/Pancake/Sapo. Các phần này làm demo bị nhiễu và khiến giám khảo nghi ngờ là mock dashboard hơn là agent tự động hóa.

5. **Zalo hiện chỉ là mô phỏng bằng chữ, chưa có contract kỹ thuật**
   - Không có module `integrations/zalo`.
   - Không có endpoint webhook hoặc adapter để convert message Zalo -> agent request -> Zalo reply.
   - Frontend nói "Zalo OA connected", nhưng backend không có trạng thái Zalo. Đây là rủi ro trust lớn trong demo.

6. **KiotViet tạo đơn thật chưa khép vòng**
   - `KiotVietClient.create_order()` đã có, config `kiotviet_create_real_orders` đã có, nhưng `create_draft_order()` chỉ tạo local draft và raw_json ghi flag.
   - Demo có thể chấp nhận local draft, nhưng phải trình bày rõ "draft local + payload sẵn sàng push KiotViet" hoặc bật real order khi demo với tenant sandbox.

7. **Test coverage chưa bảo vệ demo path**
   - Hiện có test parser và context recommendations.
   - Chưa có integration test cho luồng: tư vấn -> đồng ý đặt -> xin địa chỉ -> tạo order -> trả invoice payload.
   - Chưa có frontend smoke test đảm bảo invoice card xuất hiện sau message demo.

## Demo Narrative Mới

Màn đầu tiên sau khi mở app phải là setup wizard tối giản:

1. **Connect Zalo**
   - Hiển thị trạng thái `Disconnected / Demo connected / Real connected`.
   - Cho phép chọn "Use Zalo demo sandbox" để không cần OA thật.
   - Sau khi connected, hiện số/kênh demo và nút "Open Zalo demo chat".

2. **Connect KiotViet**
   - Nhập retailer, client id, secret hoặc dùng demo cosmetics seed.
   - Sync products và hiển thị số sản phẩm + 3 sản phẩm mẫu.

3. **Run Demo**
   - Mở màn chat giống Zalo, không mở dashboard trước.
   - Script demo chuẩn:
     - Khách: "Chị cần serum vitamin C"
     - Agent: tư vấn ngắn, hỏi loại da/ngân sách hoặc gợi ý sản phẩm.
     - Khách: "Ok đặt loại đó"
     - Agent: hỏi địa chỉ/khung giờ nếu thiếu.
     - Khách: "Giao tới 12 Nguyễn Trãi, nhận sau 18h"
     - Agent: tạo đơn nháp, gửi invoice card trong chat, cho chọn COD/QR.
     - Khách: "Chị chọn COD"
     - Agent: xác nhận thanh toán khi nhận, trạng thái đơn chờ shop xác nhận.

## File Structure Đề Xuất

- Modify: `backend/app/agent/schemas.py`
  - Thêm response contract thống nhất cho agent: `AgentChatResult`, `AgentUiEvent`, `InvoicePayload`.
- Modify: `backend/app/agent/service.py`
  - Biến thành service duy nhất cho cả tư vấn và tạo đơn.
  - Nhận conversation history, merge slot theo hội thoại, trả text + ui_events + order.
- Modify: `backend/app/agent/chat_router.py`
  - Gọi service thống nhất thay vì tự xử lý LLM/fallback riêng.
  - Giữ endpoint `/api/agent/chat` nhưng response có invoice/order.
- Modify: `backend/app/chat/service.py`
  - `/api/channels/demo/messages` dùng cùng service và trả cùng contract.
- Create: `backend/app/agent/conversation_state.py`
  - Trích xuất active product, pending slots, payment choice từ history/actions/order gần nhất.
- Create: `backend/app/agent/invoice.py`
  - Build invoice payload từ `Order`, dùng chung cho web chat/Zalo/admin.
- Create: `backend/app/integrations/zalo/router.py`
  - Demo webhook endpoint: nhận Zalo-like message, gọi agent service, trả payload Zalo-like.
- Create: `backend/app/integrations/zalo/schemas.py`
  - Request/response models cho Zalo demo contract.
- Modify: `backend/app/main.py`
  - Include Zalo router.
- Modify: `frontend/src/app/App.tsx`
  - Rút gọn onboarding còn 2 bước.
  - Đưa "Run Demo" lên ngay sau setup.
  - `UserChatScreen` chỉ gọi một endpoint agent thống nhất và render `ui_events`.
- Create: `frontend/src/app/agentApi.ts`
  - API client typed cho setup, chat, products.
- Create: `frontend/src/app/components/InvoiceCard.tsx`
  - Tách invoice card khỏi `App.tsx`.
- Test: `backend/tests/test_agent_sales_flow.py`
  - Test end-to-end service flow không cần LLM key.
- Test: `backend/tests/test_zalo_demo_webhook.py`
  - Test webhook demo trả invoice event.
- Test: `backend/tests/conftest.py`
  - SQLite fixture cho service-level tests.
- Modify: `backend/pyproject.toml`
  - Thêm `pytest-asyncio` vì plan có async endpoint/service tests.
- Test: `frontend` build verification via `npm run build`.

---

## Phase Overview

| Phase | Outcome | Tasks | Verification Gate |
|---|---|---:|---|
| Phase 0 | Test harness sẵn sàng | 0 | Existing backend tests pass |
| Phase 1 | Contract thống nhất cho agent + invoice | 1-3 | Schema/import/unit tests pass |
| Phase 2 | Backend tự tạo order và invoice | 4-5 | Demo + agent chat API tests pass |
| Phase 3 | Zalo demo adapter dùng chung agent | 6 | Zalo webhook test pass |
| Phase 4 | UI demo tập trung vào Zalo/KiotViet/chat invoice | 7-9 | Frontend build + manual chat flow pass |
| Phase 5 | KiotViet order push rõ ràng và an toàn | 10 | Payload test pass |
| Phase 6 | Copy/runbook demo ngày thi | 11-12 | Full backend tests + frontend build pass |

## How To Execute This Plan

Implement tuần tự theo phase, không nhảy thẳng vào frontend. Mỗi phase phải qua gate trước khi sang phase tiếp theo.

1. Tạo branch riêng:

```bash
git checkout -b upgrade/mvp-agent-invoice-demo
```

2. Làm từng task theo thứ tự checkbox.
3. Sau mỗi task, chạy đúng command verify trong task đó.
4. Commit sau mỗi task để rollback dễ.
5. Sau mỗi phase, chạy gate của phase.
6. Sau Phase 4, chạy demo bằng tay trước khi làm KiotViet real-order readiness.
7. Chỉ bật `KIOTVIET_CREATE_REAL_ORDERS=true` khi có tenant KiotViet sandbox và đã kiểm tra payload.

## Phase Dependency Graph

```text
Phase 0
  -> Phase 1
    -> Phase 2
      -> Phase 3
        -> Phase 4
          -> Phase 5
            -> Phase 6
```

## MVP Demo Script After All Phases

```text
1. Open app.
2. Connect Zalo demo channel.
3. Connect KiotViet or seed cosmetics data.
4. Open Zalo demo chat.
5. Send: Chị cần serum vitamin C
6. Agent recommends serum and asks/keeps context.
7. Send: Ok đặt loại đó
8. Agent asks shipping address if missing.
9. Send: Giao tới 12 Nguyễn Trãi, nhận sau 18h
10. Agent creates draft order.
11. Chat shows invoice card from backend `invoice` payload.
12. Choose COD or QR.
13. Open admin inbox and show same conversation/actions/order.
```

---

## Phase 0: Baseline And Test Harness

**Objective:** Chuẩn bị nền test để các phase sau có thể chạy async endpoint/service tests ổn định.

**Implement first because:** Các task backend sau dùng `@pytest.mark.asyncio` và `httpx.AsyncClient`. Nếu thiếu hạ tầng này, người implement sẽ gặp lỗi test trước khi chạm logic sản phẩm.

**Exit Gate:**
- `uv run pytest tests/test_parser.py tests/test_chat_context.py -q` pass.
- Không thay đổi hành vi app.

### Task 0: Prepare Async Test Infrastructure

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/uv.lock`

- [ ] **Step 1: Add pytest-asyncio**

In `backend/pyproject.toml`, change:

```toml
[project.optional-dependencies]
dev = [
  "pytest>=8.0.0",
]
```

To:

```toml
[project.optional-dependencies]
dev = [
  "pytest>=8.0.0",
  "pytest-asyncio>=0.23.0",
]
```

- [ ] **Step 2: Update lockfile**

Run:

```bash
cd backend
uv lock
```

Expected:

```text
Resolved
```

- [ ] **Step 3: Verify existing tests still pass**

Run:

```bash
cd backend
uv run pytest tests/test_parser.py tests/test_chat_context.py -q
```

Expected:

```text
6 passed
```

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock
git commit -m "test: enable async backend tests"
```

---

## Phase 1: Unified Agent Contract

**Objective:** Chốt response contract để mọi kênh chat đều có thể nhận text, actions, invoice và UI events theo cùng format.

**Implement after Phase 0 because:** Schema là nền cho toàn bộ service, router, Zalo adapter và frontend rendering.

**Exit Gate:**
- Backend import/schema tests pass.
- `DemoMessageResponse` và `AgentChatResponse` đều có `invoice` và `ui_events`.
- Chưa cần đổi business logic trong phase này.

### Task 1: Chốt Agent Response Contract

**Files:**
- Modify: `backend/app/agent/schemas.py`
- Modify: `backend/app/chat/schemas.py`
- Modify: `backend/app/agent/chat_schemas.py`

- [ ] **Step 1: Thêm schema thống nhất**

Trong `backend/app/agent/schemas.py`, giữ `AgentSlots`, `AgentPlan`, `ToolResult`, rồi thêm các model sau:

```python
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal


class InvoiceLineItem(BaseModel):
    name: str
    quantity: int
    price: Decimal
    total: Decimal


class InvoicePayload(BaseModel):
    order_id: int
    status: str
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    delivery_preference: str | None = None
    payment_method: str | None = None
    payment_status: Literal["unselected", "pending", "paid", "cod"] = "unselected"
    items: list[InvoiceLineItem] = Field(default_factory=list)
    subtotal: Decimal
    total: Decimal
    created_at: datetime | None = None


class AgentUiEvent(BaseModel):
    type: Literal["text", "invoice", "quick_replies", "handoff"]
    payload: dict[str, Any] = Field(default_factory=dict)


class AgentChatResult(BaseModel):
    conversation_id: int
    reply: str
    intent: str
    actions: list[ToolResult] = Field(default_factory=list)
    ui_events: list[AgentUiEvent] = Field(default_factory=list)
    order_id: int | None = None
    invoice: InvoicePayload | None = None
```

- [ ] **Step 2: Update API response schemas**

Trong `backend/app/chat/schemas.py`, thêm field:

```python
from app.agent.schemas import AgentUiEvent, InvoicePayload


class DemoMessageResponse(BaseModel):
    conversation_id: int
    reply: str
    actions: list[ActionResponse]
    order: OrderSummary | None = None
    ui_events: list[AgentUiEvent] = Field(default_factory=list)
    invoice: InvoicePayload | None = None
```

Trong `backend/app/agent/chat_schemas.py`, thêm field:

```python
from app.agent.schemas import AgentUiEvent, InvoicePayload


class AgentChatResponse(BaseModel):
    conversation_id: int | None = None
    intent: str
    reply: str
    recommended_products: list[AgentRecommendedProduct] = Field(default_factory=list)
    quick_replies: list[str] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)
    ui_events: list[AgentUiEvent] = Field(default_factory=list)
    order_id: int | None = None
    invoice: InvoicePayload | None = None
```

- [ ] **Step 3: Run schema import test**

Run:

```bash
cd backend
uv run pytest tests/test_parser.py -q
```

Expected:

```text
4 passed
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/agent/schemas.py backend/app/chat/schemas.py backend/app/agent/chat_schemas.py
git commit -m "feat: add unified agent chat contract"
```

---

### Task 2: Build Invoice Payload Server-Side

**Files:**
- Create: `backend/app/agent/invoice.py`
- Modify: `backend/app/agent/service.py`
- Test: `backend/tests/test_agent_invoice.py`

- [ ] **Step 1: Write failing invoice test**

Create `backend/tests/test_agent_invoice.py`:

```python
from datetime import UTC, datetime
from decimal import Decimal

from app.agent.invoice import build_invoice_payload
from app.models import Order


def test_build_invoice_payload_from_order():
    order = Order(
        id=123,
        status="draft",
        total=Decimal("640000"),
        customer_name="Nguyễn Thảo",
        customer_phone="0901234567",
        shipping_address="12 Nguyễn Trãi",
        items=[
            {
                "name": "Serum vitamin C sáng da 30ml",
                "quantity": 2,
                "price": 320000,
            }
        ],
        raw_json={"payment_method": "cod", "delivery_preference": "sau 18h"},
        created_at=datetime(2026, 5, 22, tzinfo=UTC),
    )

    invoice = build_invoice_payload(order)

    assert invoice.order_id == 123
    assert invoice.customer_name == "Nguyễn Thảo"
    assert invoice.payment_method == "cod"
    assert invoice.payment_status == "cod"
    assert invoice.items[0].total == Decimal("640000")
    assert invoice.total == Decimal("640000")
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_agent_invoice.py -q
```

Expected:

```text
ModuleNotFoundError: No module named 'app.agent.invoice'
```

- [ ] **Step 3: Implement invoice builder**

Create `backend/app/agent/invoice.py`:

```python
from decimal import Decimal

from app.agent.schemas import InvoiceLineItem, InvoicePayload
from app.models import Order


def _decimal(value: object) -> Decimal:
    return Decimal(str(value or 0))


def build_invoice_payload(order: Order) -> InvoicePayload:
    raw = order.raw_json or {}
    payment_method = raw.get("payment_method")
    payment_status = "unselected"
    if payment_method == "cod":
        payment_status = "cod"
    elif payment_method == "prepaid":
        payment_status = "pending"

    items = []
    for item in order.items or []:
        quantity = int(item.get("quantity") or 1)
        price = _decimal(item.get("price"))
        items.append(
            InvoiceLineItem(
                name=str(item.get("name") or "Sản phẩm"),
                quantity=quantity,
                price=price,
                total=price * quantity,
            )
        )

    subtotal = sum((item.total for item in items), Decimal("0"))
    total = _decimal(order.total) or subtotal
    return InvoicePayload(
        order_id=order.id,
        status=order.status,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        shipping_address=order.shipping_address,
        delivery_preference=raw.get("delivery_preference"),
        payment_method=payment_method,
        payment_status=payment_status,
        items=items,
        subtotal=subtotal,
        total=total,
        created_at=order.created_at,
    )
```

- [ ] **Step 4: Run invoice test**

Run:

```bash
cd backend
uv run pytest tests/test_agent_invoice.py -q
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/invoice.py backend/tests/test_agent_invoice.py
git commit -m "feat: build invoice payload from orders"
```

---

### Task 3: Persist Conversation State in Backend

**Files:**
- Create: `backend/app/agent/conversation_state.py`
- Modify: `backend/app/agent/parser.py`
- Test: `backend/tests/test_conversation_state.py`

- [ ] **Step 1: Write failing state test**

Create `backend/tests/test_conversation_state.py`:

```python
from app.agent.conversation_state import resolve_pending_order_intent
from app.models import Message


def _message(sender: str, content: str) -> Message:
    return Message(sender=sender, content=content)


def test_resolve_pending_order_intent_from_previous_product():
    messages = [
        _message("customer", "Chị cần serum vitamin C"),
        _message("ai", "Dạ chị, em đề xuất Serum vitamin C sáng da 30ml. Nếu đồng ý, chị nhắn Đồng ý đặt giúp em."),
        _message("customer", "Đồng ý đặt"),
    ]

    assert resolve_pending_order_intent(messages) == "Đặt cho chị 1 Serum vitamin C sáng da 30ml"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_conversation_state.py -q
```

Expected:

```text
ModuleNotFoundError: No module named 'app.agent.conversation_state'
```

- [ ] **Step 3: Implement state resolver**

Create `backend/app/agent/conversation_state.py`:

```python
import re

from app.models import Message


CONFIRM_WORDS = ("đồng ý", "dong y", "ok", "chốt", "chot", "đặt mua", "dat mua", "mua ngay")


def is_order_confirmation(text: str) -> bool:
    lower = text.lower()
    return any(word in lower for word in CONFIRM_WORDS)


def resolve_pending_order_intent(messages: list[Message]) -> str | None:
    if not messages:
        return None
    last = messages[-1].content or ""
    if not is_order_confirmation(last):
        return None

    for message in reversed(messages[:-1]):
        content = message.content or ""
        match = re.search(r"(Serum[^.!\n]+|Kem chống nắng[^.!\n]+|Sữa rửa mặt[^.!\n]+|Tẩy da chết[^.!\n]+|Mặt nạ[^.!\n]+)", content, flags=re.IGNORECASE)
        if match:
            product_name = match.group(1).strip(" .,!?:")
            return f"Đặt cho chị 1 {product_name}"
    return None
```

- [ ] **Step 4: Run state test**

Run:

```bash
cd backend
uv run pytest tests/test_conversation_state.py -q
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/conversation_state.py backend/tests/test_conversation_state.py
git commit -m "feat: resolve pending order intent from chat history"
```

---

## Phase 2: Backend Owns The Sales Flow

**Objective:** Chuyển trách nhiệm tư vấn -> xin thông tin -> tạo đơn -> gửi hóa đơn về backend, không để React tự quyết định luồng bán hàng.

**Implement after Phase 1 because:** Service cần dùng `AgentChatResult`, `InvoicePayload` và `AgentUiEvent` đã có contract ổn định.

**Exit Gate:**
- `/api/channels/demo/messages` trả `invoice` và `ui_events`.
- `AgentAction` có action `invoice_sent` khi tạo đơn thành công.
- Service-level test chứng minh tin nhắn đặt hàng tạo được order + invoice.

### Task 4: Make One Agent Service Own the Full Sales Flow

**Files:**
- Modify: `backend/app/agent/service.py`
- Modify: `backend/app/chat/service.py`
- Modify: `backend/app/chat/router.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_agent_sales_flow.py`

- [ ] **Step 1: Add concrete test database fixture**

Create `backend/tests/conftest.py`:

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401
from app.database import Base


@pytest.fixture
def db_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
```

- [ ] **Step 2: Write failing sales-flow test**

Create `backend/tests/test_agent_sales_flow.py` with a DB fixture matching the existing test setup style. Minimum behavior to assert:

```python
import pytest

from app.chat.schemas import DemoMessageRequest
from app.chat.service import receive_demo_message
from app.integrations.kiotviet.service import seed_cosmetic_products
from app.shared.workspace import ensure_default_workspace


@pytest.mark.asyncio
async def test_demo_message_creates_order_and_invoice(db_session):
    ensure_default_workspace(db_session)
    seed_cosmetic_products(db_session)

    conversation, reply, actions, order, invoice, ui_events = await receive_demo_message(
        db_session,
        DemoMessageRequest(
            customer_name="Nguyễn Thảo",
            customer_phone="0901234567",
            message="Đặt cho chị 2 serum vitamin C, giao tới 12 Nguyễn Trãi, nhận sau 18h",
        ),
    )

    assert conversation.id
    assert order is not None
    assert invoice is not None
    assert invoice.total > 0
    assert any(event.type == "invoice" for event in ui_events)
    assert "hóa đơn" in reply.lower()
    assert any(action.type == "order_create" and action.status == "success" for action in actions)
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_agent_sales_flow.py -q
```

Expected: fail because `receive_demo_message()` currently returns 4 values and no invoice/ui events.

- [ ] **Step 4: Update service return shape**

In `backend/app/agent/service.py`:

```python
from app.agent.invoice import build_invoice_payload
from app.agent.schemas import AgentChatResult, AgentUiEvent, InvoicePayload, ToolResult
from app.agent.conversation_state import resolve_pending_order_intent
from sqlalchemy import select
```

Change `handle_customer_message()` to return `AgentChatResult`. The key behavior:

```python
async def handle_customer_message(...) -> AgentChatResult:
    history = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at, Message.id)
        )
    )
    # `receive_demo_message()` and `agent_chat()` already add and flush the current
    # customer message before calling this service, so `history` includes it.
    effective_message = resolve_pending_order_intent(history) or message
    plan = await plan_with_llm(effective_message, customer_name=customer_name, customer_phone=customer_phone)
    ...
    invoice = build_invoice_payload(order) if order else None
    ui_events = [AgentUiEvent(type="text", payload={"text": reply})]
    if invoice:
        ui_events.append(AgentUiEvent(type="invoice", payload=invoice.model_dump(mode="json")))
    return AgentChatResult(
        conversation_id=conversation.id,
        reply=reply,
        intent=plan.intent,
        actions=actions,
        ui_events=ui_events,
        order_id=order.id if order else None,
        invoice=invoice,
    )
```

Keep `_persist_actions()` and `_persist_ai_message()`, but persist the invoice signal as an action:

```python
if invoice:
    db.add(
        AgentAction(
            conversation_id=conversation.id,
            action_type="invoice_sent",
            status="success",
            summary=f"Đã gửi hóa đơn tạm tính cho đơn #{invoice.order_id}.",
            raw_json=invoice.model_dump(mode="json"),
        )
    )
```

- [ ] **Step 5: Update chat service and router**

In `backend/app/chat/service.py`, change return:

```python
result = await handle_customer_message(...)
db.commit()
db.refresh(conversation)
if result.order_id:
    order = db.get(Order, result.order_id)
return conversation, result.reply, result.actions, order, result.invoice, result.ui_events
```

In `backend/app/chat/router.py`, return:

```python
conversation, reply, actions, order, invoice, ui_events = await receive_demo_message(db, payload)
return DemoMessageResponse(
    conversation_id=conversation.id,
    reply=reply,
    actions=[ActionResponse(type=action.type, status=action.status, summary=action.summary) for action in actions],
    order=OrderSummary.model_validate(order, from_attributes=True) if order else None,
    invoice=invoice,
    ui_events=ui_events,
)
```

- [ ] **Step 6: Run sales-flow test**

Run:

```bash
cd backend
uv run pytest tests/test_agent_sales_flow.py -q
```

Expected:

```text
1 passed
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/agent/service.py backend/app/chat/service.py backend/app/chat/router.py backend/tests/conftest.py backend/tests/test_agent_sales_flow.py
git commit -m "feat: return invoice events from agent sales flow"
```

---

### Task 5: Route `/api/agent/chat` Through the Same Sales Service

**Files:**
- Modify: `backend/app/agent/chat_router.py`
- Test: `backend/tests/test_agent_chat_order.py`

- [ ] **Step 1: Write failing API-level test**

Create `backend/tests/test_agent_chat_order.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_agent_chat_can_create_invoice():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/agent/chat",
            json={
                "customer_name": "Nguyễn Thảo",
                "customer_phone": "0901234567",
                "message": "Đặt cho chị 1 serum vitamin C, giao tới 12 Nguyễn Trãi",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["invoice"]["order_id"]
    assert any(event["type"] == "invoice" for event in body["ui_events"])
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_agent_chat_order.py -q
```

Expected: fail because current `/api/agent/chat` does not return invoice.

- [ ] **Step 3: Replace duplicated logic with unified service**

In `backend/app/agent/chat_router.py`, keep helper functions only if still needed for product recommendation. In `agent_chat()`, call the same service used by demo endpoint:

```python
from app.agent.service import handle_customer_message


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(payload: AgentChatRequest, db: Session = Depends(get_db)) -> AgentChatResponse:
    ensure_default_workspace(db)
    customer = _find_or_create_customer(db, payload)
    conversation = _find_or_create_conversation(db, payload.conversation_id, customer.id)
    db.add(Message(conversation_id=conversation.id, sender="customer", content=payload.message))
    db.flush()

    result = await handle_customer_message(
        db,
        conversation=conversation,
        customer_id=customer.id,
        customer_name=customer.name,
        customer_phone=customer.phone,
        message=payload.message,
    )
    db.commit()

    return AgentChatResponse(
        conversation_id=conversation.id,
        intent=result.intent,
        reply=result.reply,
        recommended_products=[],
        quick_replies=[],
        actions=[action.summary for action in result.actions],
        ui_events=result.ui_events,
        order_id=result.order_id,
        invoice=result.invoice,
    )
```

- [ ] **Step 4: Preserve post-purchase response**

Move current `_order_history_response()` behavior into `handle_customer_message()` or call it before product/order tools when `_is_order_support_message(message)` and history exists. Add a focused test later if this branch matters for the demo.

- [ ] **Step 5: Run API test**

Run:

```bash
cd backend
uv run pytest tests/test_agent_chat_order.py -q
```

Expected:

```text
1 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/chat_router.py backend/tests/test_agent_chat_order.py
git commit -m "feat: unify agent chat with order flow"
```

---

## Phase 3: Zalo Demo Adapter

**Objective:** Có một endpoint Zalo-like để demo "chạy trên Zalo" mà không cần chờ OA thật, nhưng vẫn dùng đúng agent service.

**Implement after Phase 2 because:** Zalo adapter không được tự xử lý agent; nó chỉ map request/response vào service chung.

**Exit Gate:**
- `/api/integrations/zalo/demo-webhook` trả text message và invoice message khi khách đặt đủ thông tin.
- Webhook có thể nối tiếp hội thoại qua `conversation_id`.
- Không tạo một luồng agent mới.

### Task 6: Add Zalo Demo Webhook Adapter

**Files:**
- Create: `backend/app/integrations/zalo/schemas.py`
- Create: `backend/app/integrations/zalo/router.py`
- Create: `backend/app/integrations/zalo/__init__.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_zalo_demo_webhook.py`

- [ ] **Step 1: Write failing webhook test**

Create `backend/tests/test_zalo_demo_webhook.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_zalo_demo_webhook_returns_invoice_event():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/integrations/zalo/demo-webhook",
            json={
                "zalo_user_id": "zalo-demo-1",
                "name": "Nguyễn Thảo",
                "phone": "0901234567",
                "text": "Đặt cho chị 1 serum vitamin C, giao tới 12 Nguyễn Trãi",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["messages"][0]["type"] == "text"
    assert any(message["type"] == "invoice" for message in body["messages"])
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_zalo_demo_webhook.py -q
```

Expected:

```text
404 Not Found
```

- [ ] **Step 3: Add schemas**

Create `backend/app/integrations/zalo/schemas.py`:

```python
from typing import Any, Literal

from pydantic import BaseModel, Field


class ZaloDemoWebhookRequest(BaseModel):
    conversation_id: int | None = None
    zalo_user_id: str
    name: str = "Khách Zalo"
    phone: str | None = None
    text: str = Field(min_length=1)


class ZaloDemoMessage(BaseModel):
    type: Literal["text", "invoice", "quick_replies"]
    payload: dict[str, Any]


class ZaloDemoWebhookResponse(BaseModel):
    zalo_user_id: str
    conversation_id: int
    messages: list[ZaloDemoMessage]
```

- [ ] **Step 4: Add router**

Create `backend/app/integrations/zalo/router.py`:

```python
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.service import handle_customer_message
from app.database import get_db
from app.integrations.zalo.schemas import ZaloDemoMessage, ZaloDemoWebhookRequest, ZaloDemoWebhookResponse
from app.models import Conversation, Customer, Message
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace

router = APIRouter(prefix="/api/integrations/zalo", tags=["zalo"])


@router.post("/demo-webhook", response_model=ZaloDemoWebhookResponse)
async def demo_webhook(payload: ZaloDemoWebhookRequest, db: Session = Depends(get_db)) -> ZaloDemoWebhookResponse:
    ensure_default_workspace(db)
    customer = _find_or_create_zalo_customer(db, payload)
    conversation = _find_or_create_zalo_conversation(db, payload.conversation_id, customer.id)
    db.add(Message(conversation_id=conversation.id, sender="customer", content=payload.text))
    db.flush()

    result = await handle_customer_message(
        db,
        conversation=conversation,
        customer_id=customer.id,
        customer_name=customer.name,
        customer_phone=customer.phone,
        message=payload.text,
    )
    db.commit()

    messages = [ZaloDemoMessage(type="text", payload={"text": result.reply})]
    if result.invoice:
        messages.append(ZaloDemoMessage(type="invoice", payload=result.invoice.model_dump(mode="json")))
    return ZaloDemoWebhookResponse(zalo_user_id=payload.zalo_user_id, conversation_id=conversation.id, messages=messages)


def _find_or_create_zalo_customer(db: Session, payload: ZaloDemoWebhookRequest) -> Customer:
    customer = None
    if payload.phone:
        customer = db.scalar(
            select(Customer).where(
                Customer.workspace_id == DEFAULT_WORKSPACE_ID,
                Customer.phone == payload.phone,
                Customer.channel == "zalo_demo",
            )
        )
    if customer:
        customer.name = payload.name
        return customer
    customer = Customer(workspace_id=DEFAULT_WORKSPACE_ID, name=payload.name, phone=payload.phone, channel="zalo_demo")
    db.add(customer)
    db.flush()
    return customer


def _find_or_create_zalo_conversation(db: Session, conversation_id: int | None, customer_id: int) -> Conversation:
    if conversation_id:
        conversation = db.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.workspace_id == DEFAULT_WORKSPACE_ID,
            )
        )
        if conversation:
            conversation.customer_id = customer_id
            conversation.updated_at = datetime.now(UTC)
            return conversation
    conversation = Conversation(workspace_id=DEFAULT_WORKSPACE_ID, customer_id=customer_id, channel="zalo_demo", status="open")
    db.add(conversation)
    db.flush()
    return conversation
```

- [ ] **Step 5: Include router**

In `backend/app/main.py`:

```python
from app.integrations.zalo.router import router as zalo_router

...
app.include_router(zalo_router)
```

- [ ] **Step 6: Run webhook test**

Run:

```bash
cd backend
uv run pytest tests/test_zalo_demo_webhook.py -q
```

Expected:

```text
1 passed
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/integrations/zalo backend/app/main.py backend/tests/test_zalo_demo_webhook.py
git commit -m "feat: add zalo demo webhook adapter"
```

---

## Phase 4: Judge-Facing Demo UI

**Objective:** Đưa demo về đúng câu chuyện: connect Zalo, connect KiotViet, mở chat và thấy agent gửi hóa đơn.

**Implement after Phase 3 because:** Frontend nên render contract backend đã ổn định thay vì tiếp tục giả lập flow.

**Exit Gate:**
- Màn đầu chỉ còn setup Zalo/KiotViet rồi vào chat.
- `UserChatScreen` gọi endpoint agent thống nhất.
- Invoice card render từ server-sent `invoice`/`ui_events`.

### Task 7: Simplify Frontend Onboarding to Two Steps

**Files:**
- Modify: `frontend/src/app/App.tsx`
- Create: `frontend/src/app/agentApi.ts`

- [ ] **Step 1: Extract API client**

Create `frontend/src/app/agentApi.ts`:

```typescript
export type KiotVietStatus = { status: string; retailer?: string | null; last_sync_at?: string | null };
export type ProductItem = { id: number; name: string; code?: string | null; base_price: string; stock: number };
export type ChatAction = { type: string; status: string; summary: string };
export type InvoicePayload = {
  order_id: number;
  status: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  shipping_address?: string | null;
  delivery_preference?: string | null;
  payment_method?: string | null;
  payment_status: 'unselected' | 'pending' | 'paid' | 'cod';
  items: { name: string; quantity: number; price: string; total: string }[];
  subtotal: string;
  total: string;
};
export type AgentUiEvent = { type: 'text' | 'invoice' | 'quick_replies' | 'handoff'; payload: Record<string, unknown> };
export type AgentChatResponse = {
  conversation_id: number | null;
  intent: string;
  reply: string;
  actions: string[];
  ui_events: AgentUiEvent[];
  order_id?: number | null;
  invoice?: InvoicePayload | null;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Backend error ${response.status}`);
  }
  return response.json();
}
```

- [ ] **Step 2: Update app modes**

In `frontend/src/app/App.tsx`, replace:

```typescript
type AppMode = 'landing' | 'connect-zalo' | 'loading-zalo' | 'connect-kiotviet' | 'loading-kiotviet' | 'connect-calendar' | 'loading-calendar' | 'dashboard';
```

With:

```typescript
type AppMode = 'setup-zalo' | 'setup-kiotviet' | 'run-demo' | 'dashboard';
```

- [ ] **Step 3: Make initial app mode setup**

Change:

```typescript
const [appMode, setAppMode] = useState<AppMode>('landing');
```

To:

```typescript
const [appMode, setAppMode] = useState<AppMode>('setup-zalo');
```

- [ ] **Step 4: Remove Calendar setup path**

Remove the `connect-calendar` and `loading-calendar` branches from `App.tsx`. The demo path after successful KiotViet sync should set:

```typescript
setAppMode('run-demo');
```

- [ ] **Step 5: Add run-demo branch**

Add:

```tsx
if (appMode === 'run-demo') {
  return <UserChatScreen />;
}
```

- [ ] **Step 6: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/App.tsx frontend/src/app/agentApi.ts
git commit -m "feat: simplify demo onboarding"
```

---

### Task 8: Render Server-Sent Invoice Events in Chat

**Files:**
- Create: `frontend/src/app/components/InvoiceCard.tsx`
- Modify: `frontend/src/app/App.tsx`

- [ ] **Step 1: Extract InvoiceCard**

Move the existing `InvoiceCard` and `FakeQrCode` functions from `App.tsx` into `frontend/src/app/components/InvoiceCard.tsx`. Use props based on `InvoicePayload`:

```tsx
import { Clock, MapPin, Phone, Users } from 'lucide-react';
import type { InvoicePayload } from '../agentApi';

type PaymentMethod = 'cod' | 'prepaid' | null;

export function InvoiceCard({
  invoice,
  paymentMethod,
  paymentConfirmed = false,
  onPaymentChange,
}: {
  invoice: InvoicePayload;
  paymentMethod?: PaymentMethod;
  paymentConfirmed?: boolean;
  onPaymentChange?: (method: Exclude<PaymentMethod, null>) => void;
}) {
  const paymentLabel = paymentConfirmed ? 'Đã thanh toán' : paymentMethod === 'cod' ? 'Thanh toán khi nhận' : paymentMethod === 'prepaid' ? 'Chờ chuyển khoản' : 'Chờ chọn thanh toán';

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-xl rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase text-teal-700">Hóa đơn tạm tính</div>
            <div className="mt-1 text-xl font-bold text-slate-950">Đơn #{invoice.order_id}</div>
          </div>
          <div className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{paymentLabel}</div>
        </div>
        <div className="space-y-3 border-y border-slate-200 py-4">
          {invoice.items.map((item, index) => (
            <div key={index} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-semibold text-slate-900">{item.name}</div>
                <div className="text-slate-500">Số lượng: {item.quantity}</div>
              </div>
              <div className="font-semibold text-slate-900">{Number(item.total).toLocaleString('vi-VN')}đ</div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-teal-600" />{invoice.customer_name || 'Chưa có tên người nhận'}</div>
          <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-teal-600" />{invoice.customer_phone || 'Chưa có số điện thoại'}</div>
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-teal-600" />{invoice.shipping_address || 'Chưa có địa chỉ giao hàng'}</div>
          {invoice.delivery_preference && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-teal-600" />Khung giờ nhận hàng: {invoice.delivery_preference}</div>}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3">
          <span className="font-semibold text-teal-950">Tổng thanh toán</span>
          <span className="text-xl font-bold text-teal-700">{Number(invoice.total).toLocaleString('vi-VN')}đ</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={() => onPaymentChange?.('cod')} className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold hover:border-teal-200 hover:bg-teal-50">
            Thanh toán khi nhận hàng
          </button>
          <button onClick={() => onPaymentChange?.('prepaid')} className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold hover:border-teal-200 hover:bg-teal-50">
            Thanh toán trước bằng QR
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Store invoice from server**

In `UserChatScreen`, replace `order` state with:

```typescript
const [invoice, setInvoice] = useState<InvoicePayload | null>(null);
```

After calling `/api/agent/chat`, add:

```typescript
if (result.invoice) {
  setInvoice(result.invoice);
}
```

- [ ] **Step 3: Render invoice**

Replace:

```tsx
{order && <InvoiceCard order={order} ... />}
```

With:

```tsx
{invoice && (
  <InvoiceCard
    invoice={invoice}
    paymentMethod={paymentMethod}
    paymentConfirmed={paymentConfirmed}
    onPaymentChange={(method) => {
      setPaymentMethod(method);
      setPaymentConfirmed(false);
      appendCustomer(method === 'prepaid' ? 'Chị chọn thanh toán trước bằng QR' : 'Chị chọn thanh toán khi nhận hàng');
      appendAi(method === 'prepaid'
        ? `Dạ em đã cập nhật đơn #${invoice.order_id} sang thanh toán trước và gửi QR trong hóa đơn ạ.`
        : `Dạ em đã cập nhật đơn #${invoice.order_id} thanh toán khi nhận hàng. Đơn dự kiến giao trong 2-3 ngày làm việc.`
      );
    }}
  />
)}
```

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/App.tsx frontend/src/app/components/InvoiceCard.tsx
git commit -m "feat: render agent invoice events in chat"
```

---

### Task 9: Remove Frontend Hard-Coded Sales Branches

**Files:**
- Modify: `frontend/src/app/App.tsx`

- [ ] **Step 1: Route all customer text through one backend endpoint**

In `sendMessage()`, remove branches that call `consultBeforeOrder`, `createDirectOrderFromMessage`, `beginPendingOrder`, and `confirmPendingOrder`. Replace the body after `appendCustomer(text)` with:

```typescript
setMessage('');
appendCustomer(text);
await askBackendAgent(text);
```

- [ ] **Step 2: Keep only UI state rendering**

Delete or stop using these frontend-only sales states:

```typescript
pendingPurchaseIntent
pendingProduct
pendingOrderMessage
pendingOrderDraft
selectedProduct
showSunscreens
showBudgetChoices
```

Keep `paymentMethod` and `paymentConfirmed` because payment interaction is still a UI action for demo unless moved server-side later.

- [ ] **Step 3: Replace quick chips with demo script chips**

Use chips:

```typescript
['Chị cần serum vitamin C', 'Ok đặt loại đó', 'Giao tới 12 Nguyễn Trãi, nhận sau 18h', 'Chị chọn COD']
```

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 5: Manual acceptance test**

Run app and demo:

```bash
docker compose -f backend/docker-compose.yml up -d --build
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173
```

Expected:

```text
Step 1: Connect Zalo
Step 2: Connect KiotViet
Run Demo opens chat
After shipping message, invoice card appears in chat
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/App.tsx
git commit -m "refactor: move sales conversation logic to backend"
```

---

## Phase 5: KiotViet Order Readiness

**Objective:** Làm rõ ranh giới local draft và real KiotViet order để demo trung thực, có thể bật real push khi có tenant sandbox.

**Implement after Phase 4 because:** Ban giám khảo cần thấy invoice trước; real KiotViet push là bằng chứng nâng cao nhưng không nên chặn demo chính.

**Exit Gate:**
- Có payload builder cho KiotViet order.
- Default vẫn an toàn: `KIOTVIET_CREATE_REAL_ORDERS=false`.
- UI/docs nói rõ trạng thái draft local hoặc pushed to KiotViet.

### Task 10: Make KiotViet Order Push Explicit

**Files:**
- Modify: `backend/app/agent/tools.py`
- Modify: `backend/app/integrations/kiotviet/service.py`
- Test: `backend/tests/test_kiotviet_order_payload.py`

- [ ] **Step 1: Write payload test**

Create `backend/tests/test_kiotviet_order_payload.py`:

```python
from decimal import Decimal

from app.integrations.kiotviet.service import build_kiotviet_order_payload
from app.models import Order


def test_build_kiotviet_order_payload():
    order = Order(
        id=12,
        customer_name="Nguyễn Thảo",
        customer_phone="0901234567",
        shipping_address="12 Nguyễn Trãi",
        total=Decimal("320000"),
        items=[{"kiotviet_product_id": 900001, "name": "Serum vitamin C sáng da 30ml", "quantity": 1, "price": 320000}],
    )

    payload = build_kiotviet_order_payload(order)

    assert payload["description"] == "Agentify demo order #12"
    assert payload["orderDetails"][0]["productId"] == 900001
    assert payload["orderDetails"][0]["quantity"] == 1
```

- [ ] **Step 2: Implement payload builder**

In `backend/app/integrations/kiotviet/service.py`:

```python
from app.models import Order


def build_kiotviet_order_payload(order: Order) -> dict:
    return {
        "description": f"Agentify demo order #{order.id}",
        "method": "Zalo/Agentify",
        "customer": {
            "name": order.customer_name,
            "contactNumber": order.customer_phone,
            "address": order.shipping_address,
        },
        "orderDetails": [
            {
                "productId": int(item["kiotviet_product_id"]),
                "quantity": int(item.get("quantity") or 1),
                "price": float(item.get("price") or 0),
            }
            for item in order.items or []
            if item.get("kiotviet_product_id")
        ],
    }
```

- [ ] **Step 3: Use config flag**

In `create_draft_order()`, after local order flush:

```python
if get_settings().kiotviet_create_real_orders:
    # call KiotViet and update order.kiotviet_order_code from response
```

For demo safety, keep default `false`. In UI/admin, label this clearly:

```text
Draft local. KiotViet payload ready.
```

- [ ] **Step 4: Run test**

Run:

```bash
cd backend
uv run pytest tests/test_kiotviet_order_payload.py -q
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/integrations/kiotviet/service.py backend/app/agent/tools.py backend/tests/test_kiotviet_order_payload.py
git commit -m "feat: prepare kiotviet order payload"
```

---

## Phase 6: Demo Narrative And Runbook

**Objective:** Dọn thông điệp sản phẩm, giảm bề mặt gây nhiễu, và có runbook để demo ngày thi không phụ thuộc trí nhớ.

**Implement after Phase 5 because:** Copy/runbook phải phản ánh đúng behavior cuối cùng của backend/frontend.

**Exit Gate:**
- README mô tả đúng luồng 2 bước + Zalo demo chat + invoice.
- Dashboard không phóng đại Facebook/Calendar/Pancake/Sapo là đã connected.
- Có `docs/demo_runbook.md` để chạy demo end-to-end.

### Task 11: Tighten MVP Copy and Remove Distracting Surfaces

**Files:**
- Modify: `README.md`
- Modify: `frontend/src/app/App.tsx`

- [ ] **Step 1: Update README demo flow**

Replace "Luồng Demo MVP" with:

```markdown
## Luồng Demo MVP

1. Connect Zalo demo channel.
2. Connect KiotViet or seed demo cosmetics.
3. Open Zalo demo chat.
4. Customer asks for a product.
5. Agent consults, asks missing order information, checks stock, creates draft order.
6. Agent sends invoice card back in chat with COD/QR options.
7. Admin inbox shows the same conversation, actions and order.
```

- [ ] **Step 2: Hide low-confidence navigation during demo**

In dashboard sidebar, keep only:

```text
Tổng quan
Hộp thư
Kết nối hệ thống
```

Move Calendar, Reports, Workflows, Approval, Settings behind a "More" or remove for pitch demo. This improves judge focus.

- [ ] **Step 3: Replace broad claims**

Replace UI copy such as:

```text
Facebook connected
Lịch Google connected
Pancake
Sapo
```

With:

```text
Coming soon
```

or remove from first-viewport demo.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 5: Commit**

```bash
git add README.md frontend/src/app/App.tsx
git commit -m "docs: focus mvp demo narrative"
```

---

### Task 12: Final Verification Script for Demo Day

**Files:**
- Create: `docs/demo_runbook.md`

- [ ] **Step 1: Create runbook**

Create `docs/demo_runbook.md`:

```markdown
# Agentify Demo Runbook

## Preconditions

- Backend and PostgreSQL are running.
- Product cache has cosmetics data.
- Frontend points to backend.

## Start

```bash
docker compose -f backend/docker-compose.yml up -d --build
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

## Verify Backend

```bash
curl http://127.0.0.1:8763/health
curl http://127.0.0.1:8763/api/kiotviet/products
```

## Demo Script

1. Open `http://127.0.0.1:5173`.
2. Connect Zalo demo.
3. Connect KiotViet or seed demo cosmetics.
4. Open Zalo demo chat.
5. Send: `Chị cần serum vitamin C`.
6. Send: `Ok đặt loại đó`.
7. Send: `Giao tới 12 Nguyễn Trãi, nhận sau 18h`.
8. Confirm invoice appears.
9. Choose `Thanh toán khi nhận hàng`.
10. Open admin inbox and show conversation actions.

## Expected Judge Takeaway

Agentify is not a chatbot. It is an AI sales operator that reads chat, uses product/order data, creates a draft order and sends a customer-facing invoice.
```

- [ ] **Step 2: Run all backend tests**

Run:

```bash
cd backend
uv run pytest -q
```

Expected:

```text
all tests pass
```

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 4: Commit**

```bash
git add docs/demo_runbook.md
git commit -m "docs: add demo day runbook"
```

---

## Priority Order

1. Task 0-5 are mandatory. They fix the core problem: one tested agent flow that sends invoice.
2. Task 6 is mandatory for the "demo trên Zalo" story, even if it is a Zalo demo adapter first.
3. Task 7-9 are mandatory for judge-facing clarity.
4. Task 10 is important if you want to claim KiotViet order readiness.
5. Task 11-12 are polish and demo reliability.

## Acceptance Criteria

- Opening the app shows only two setup steps before demo: Zalo and KiotViet.
- A user can run the full order flow from chat without touching dashboard controls.
- The same backend endpoint can create invoice from `/api/agent/chat`, `/api/channels/demo/messages`, and Zalo demo webhook.
- Invoice is returned as structured payload, rendered in chat, and logged in agent actions.
- Admin inbox shows the same conversation and order result.
- Frontend no longer owns sales decision logic; it renders backend output.
- `uv run pytest -q` passes in backend.
- `npm run build` passes in frontend.

## Residual Risks

- Real Zalo OA integration still needs credentials, webhook verification, token handling and message send API. This plan creates a demo adapter first so the product story is credible without blocking on OA approval.
- Real KiotViet order creation may require exact tenant-specific order payload fields. Keep real order push behind `KIOTVIET_CREATE_REAL_ORDERS=false` until tested with a sandbox tenant.
- LLM output can still be inconsistent. The deterministic fallback path must cover the demo script completely.
