# Agent Chatbot Demo Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Agentify chatbot feel more natural for the next-day demo while preserving fast deterministic runtime and existing safety gates.

**Architecture:** Keep the current `process_customer_message` orchestration and parser/LLM fallback. Improve the planner and fallback prompts, polish the deterministic reply templates used by known demo flows, and align quick replies in both demo and Zalo routers. No extra LLM call is added to known flows.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy, Pydantic, pytest/anyio.

---

## File Structure

- Modify `backend/app/agent/llm.py`: sharpen `SYSTEM_PROMPT` only; keep `plan_with_llm` behavior unchanged.
- Modify `backend/app/agent/service.py`: update `GENERAL_LLM_PROMPT` and high-visibility reply template functions.
- Modify `backend/app/chat/router.py`: update demo quick reply defaults.
- Modify `backend/app/integrations/zalo/router.py`: update Zalo quick reply defaults to match demo.
- Create `backend/tests/test_agent_demo_polish.py`: focused regression tests for natural demo copy, quick replies, and safety.

---

### Task 1: Add Demo Polish Regression Tests

**Files:**
- Create: `backend/tests/test_agent_demo_polish.py`
- Read: `backend/tests/test_agent_edge_cases.py`
- Read: `backend/tests/test_agent_scenarios.py`

- [ ] **Step 1: Create the failing test file**

Create `backend/tests/test_agent_demo_polish.py` with:

```python
import pytest

from app.agent.schemas import ToolResult
from app.chat.router import _quick_replies_from_actions as demo_quick_replies
from app.chat.router import demo_message
from app.chat.schemas import DemoMessageRequest
from app.integrations.zalo.router import _quick_replies_from_actions as zalo_quick_replies
from tests.test_agent_scenarios import _seed_catalog, _session


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

    assert demo_quick_replies(recommendation, has_invoice=False) == ["Da dầu", "Da khô", "Da nhạy cảm", "Dưới 350k"]
    assert zalo_quick_replies(recommendation, has_invoice=False) == ["Da dầu", "Da khô", "Da nhạy cảm", "Dưới 350k"]
    assert demo_quick_replies(pending, has_invoice=False) == ["Đúng rồi", "Sửa SĐT", "Đổi địa chỉ"]
    assert zalo_quick_replies(pending, has_invoice=False) == ["Đúng rồi", "Sửa SĐT", "Đổi địa chỉ"]
    assert demo_quick_replies(support, has_invoice=True) == ["Kiểm tra trạng thái đơn", "Mua thêm", "Gặp nhân viên"]
    assert zalo_quick_replies(support, has_invoice=True) == ["Kiểm tra trạng thái đơn", "Mua thêm", "Gặp nhân viên"]
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```bash
backend/.venv/bin/python -m pytest backend/tests/test_agent_demo_polish.py -q
```

Expected: FAIL. The current code still mentions `KiotViet` in consultation copy, uses `Sửa số điện thoại`, uses `Mua thêm sản phẩm`, and does not start confirmation with `Em đọc lại đơn`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add backend/tests/test_agent_demo_polish.py
git commit -m "test: add agent demo polish regressions"
```

---

### Task 2: Polish Planner And Fallback Prompts

**Files:**
- Modify: `backend/app/agent/llm.py:10-32`
- Modify: `backend/app/agent/service.py:34-50`
- Test: `backend/tests/test_agent_demo_polish.py`

- [ ] **Step 1: Replace `SYSTEM_PROMPT` in `backend/app/agent/llm.py`**

Replace the existing `SYSTEM_PROMPT` string with:

```python
SYSTEM_PROMPT = """Bạn là planner cho Agentify, một nhân viên AI bán hàng tiếng Việt cho Lumi Beauty.
Chỉ trả JSON thuần, không markdown, không giải thích ngoài JSON.

Schema phải khớp AgentPlan:
{
  "intent": "product_consultation|buy_product|ask_stock|unknown",
  "slots": {
    "product_query": string|null,
    "quantity": number,
    "customer_name": string|null,
    "customer_phone": string|null,
    "shipping_address": string|null,
    "payment_method": "cod|prepaid"|null
  },
  "tool_plan": string[],
  "reply_if_missing": string|null
}

Tool hợp lệ nằm trong tool_catalog. Không tự bịa tool.
Các tool quan trọng:
- list_products: lấy danh sách hàng hóa KiotViet/cache.
- search_products: tìm sản phẩm theo tên/nhu cầu.
- recommend_products: gợi ý nhiều sản phẩm theo loại da/ngân sách.
- check_stock: kiểm tra tồn kho.
- lookup_order: tra cứu đơn theo SĐT/mã đơn.
- create_draft_order: chỉ dùng khi đã đủ sản phẩm, số lượng, tên người nhận, SĐT, địa chỉ và khách đã xác nhận.
- create_invoice: xuất hóa đơn từ đơn đã tạo.
- book_appointment: đặt lịch sau khi khách xác nhận.
- create_support_ticket: tạo ticket khiếu nại.
- ask_clarification: hỏi thêm thông tin.

Quy tắc intent:
- Nếu khách hỏi "tư vấn", "gợi ý", "nên dùng", "phù hợp", "loại nào", "rẻ nhất", hoặc mô tả loại da/ngân sách mà chưa nói mua/đặt/lấy/chốt, intent là product_consultation.
- Nếu khách nói mua/đặt/lấy/chốt/đồng ý lấy rõ ràng, intent là buy_product.
- Nếu khách hỏi còn hàng/tồn kho, intent là ask_stock.
- Tin nhắn ngắn như "ok", "lấy loại đó", "da dầu", "rẻ nhất" phải giữ ngữ cảnh sản phẩm đang được nói tới nếu message hoặc fallback parser có product_query.
- Không chuyển product_consultation thành buy_product chỉ vì khách nói "tư vấn kỹ hơn" hoặc "phù hợp".

Quy tắc slot:
- Trích xuất product_query ngắn gọn, giữ tên sản phẩm hoặc nhóm sản phẩm chính.
- quantity mặc định là 1, không lấy số trong SPF50/30ml/10% làm quantity.
- Nếu khách viết "chị là", "tên chị", "người nhận là", đó là customer_name.
- Nếu khách viết "giao tới", "giao đến", "địa chỉ", shipping_address chỉ lấy phần địa chỉ; dừng trước SĐT, tên người nhận, giờ nhận hàng, hình thức thanh toán.
- payment_method là "cod" nếu khách trả khi nhận hàng/trả sau; là "prepaid" nếu khách chuyển khoản/QR/thanh toán trước.
- Nếu thiếu tên, SĐT hoặc địa chỉ khi đặt hàng, vẫn có thể dùng search_products/check_stock nhưng phải thêm ask_clarification và không dùng create_draft_order.
"""
```

- [ ] **Step 2: Replace `GENERAL_LLM_PROMPT` in `backend/app/agent/service.py`**

Replace the existing `GENERAL_LLM_PROMPT` string with:

```python
GENERAL_LLM_PROMPT = """Bạn là nhân viên AI tiếng Việt cho Lumi Beauty, shop mỹ phẩm online dùng Agentify.
Trả JSON thuần:
{
  "reply": "tin nhắn ngắn gửi khách",
  "actions": ["việc đã làm"],
  "quick_replies": ["0-4 lựa chọn ngắn nếu thật sự cần"]
}

Giọng trả lời:
- Tự nhiên như nhân viên shop đang chat Zalo: ấm, rõ, không quá trang trọng.
- Thường trả lời 1-4 câu ngắn. Chỉ viết dài khi khách hỏi routine hoặc cần hướng dẫn an toàn.
- Hỏi một bước tiếp theo, không hỏi dồn nhiều nhóm thông tin nếu chưa cần.
- Không lặp cùng một mở đầu trong mọi tin nhắn.
- Không nhắc tên tool, database, KiotViet, GHN hay Agentify trừ khi khách hỏi nội bộ.

Quy tắc an toàn:
- Nếu khách chưa chốt mua, không hỏi tên/SĐT/địa chỉ.
- Nếu khách chỉ tư vấn sản phẩm, dùng context sản phẩm để gợi ý tự nhiên và hỏi thêm loại da/ngân sách nếu thiếu.
- Nếu khách muốn đặt hàng nhưng thiếu thông tin, hỏi đúng thông tin còn thiếu.
- Không nói đã tạo đơn, hóa đơn, vận đơn hoặc lịch hẹn nếu context chưa có dữ liệu đó.
- Với hoàn tiền/đổi trả/hủy đơn, hỏi mã đơn hoặc SĐT nếu chưa có; nếu có lịch sử đơn thì nhắc đơn gần nhất.
- Với kích ứng nặng như khó thở, sưng mắt/môi, đau rát dữ dội hoặc phồng rộp, khuyên đi khám/cơ sở y tế trước và không chẩn đoán bệnh.
- Khi ngoài kịch bản, nếu thiếu dữ liệu để hành động an toàn thì hỏi thêm thay vì bịa kết quả.
"""
```

- [ ] **Step 3: Run the new tests**

Run:

```bash
backend/.venv/bin/python -m pytest backend/tests/test_agent_demo_polish.py -q
```

Expected: still FAIL. Prompt changes alone do not modify deterministic template copy or quick replies.

- [ ] **Step 4: Commit prompt polish**

```bash
git add backend/app/agent/llm.py backend/app/agent/service.py
git commit -m "feat: polish agent demo prompts"
```

---

### Task 3: Polish High-Visibility Reply Templates

**Files:**
- Modify: `backend/app/agent/service.py:852-928`
- Modify: `backend/app/agent/service.py:1228-1256`
- Modify: `backend/app/agent/service.py:1329-1393`
- Test: `backend/tests/test_agent_demo_polish.py`

- [ ] **Step 1: Replace `_sunscreen_intro_reply`**

In `backend/app/agent/service.py`, replace `_sunscreen_intro_reply` with:

```python
def _sunscreen_intro_reply(recommendation_result: ToolResult | None = None) -> str:
    products = list((recommendation_result.data or {}).get("products") or []) if recommendation_result else []
    if products:
        lines = [
            f"{product.get('name')}: {product.get('reason')} Giá {_format_vnd(int(product.get('price') or 0))}đ."
            for product in products
        ]
        product_lines = "\n".join(lines)
        return (
            "Dạ được ạ. Với kem chống nắng, em đang có vài lựa chọn dễ tư vấn theo loại da:\n\n"
            f"{product_lines}\n\n"
            "Da mình thiên dầu, khô, hỗn hợp hay nhạy cảm để em chọn sát hơn cho chị?"
        )
    return (
        "Dạ được ạ. Với kem chống nắng, em đang có vài lựa chọn dễ tư vấn theo loại da:\n\n"
        "SunCare Aqua SPF50+: hợp da dầu/da hỗn hợp, chất gel mỏng nhẹ, giá 320.000đ.\n"
        "Derma Shield Sensitive SPF50: hợp da nhạy cảm hoặc da đang treatment, không cồn, không hương liệu, giá 390.000đ.\n"
        "Moist UV Cream SPF50+: hợp da khô, có thêm dưỡng ẩm, giá 350.000đ.\n\n"
        "Da mình thiên dầu, khô, hỗn hợp hay nhạy cảm để em chọn sát hơn cho chị?"
    )
```

- [ ] **Step 2: Replace `_sunscreen_detail_reply`**

Replace `_sunscreen_detail_reply` with:

```python
def _sunscreen_detail_reply(product_name: str, price: int) -> str:
    if normalize_text(product_name) == "derma shield sensitive spf50":
        return (
            "Derma Shield Sensitive SPF50 hợp hơn khi da nhạy cảm hoặc đang treatment vì công thức thiên về dịu nhẹ, không cồn và không hương liệu.\n\n"
            f"Dòng này còn hàng, giá {_format_vnd(price)}đ. Chị muốn lấy 1 tuýp hay để em so thêm với dòng khác?"
        )
    if normalize_text(product_name) == "moist uv cream spf50+":
        return (
            "Moist UV Cream SPF50+ hợp da khô hơn vì có thêm dưỡng ẩm, dùng hằng ngày sẽ đỡ cảm giác căng da.\n\n"
            f"Dòng này còn hàng, giá {_format_vnd(price)}đ. Chị muốn lấy 1 tuýp không ạ?"
        )
    return (
        "SunCare Aqua SPF50+ hợp da dầu và da hỗn hợp vì chất gel nhẹ, thấm nhanh và đỡ bí mặt hơn các dòng kem đặc.\n\n"
        f"Dòng này còn hàng, giá {_format_vnd(price)}đ. Chị muốn lấy 1 tuýp không ạ?"
    )
```

- [ ] **Step 3: Replace `_stock_reply`, `_consultation_reply`, and `_missing_info_reply`**

Replace those three functions with:

```python
def _stock_reply(product_result: ToolResult, stock_result: ToolResult) -> str:
    if product_result.status != "success":
        return f"Dạ em chưa tìm thấy đúng sản phẩm này. {product_result.summary}"
    return f"Dạ {stock_result.summary} Chị muốn em giữ sản phẩm này để lên đơn không ạ?"


def _consultation_reply(recommendation_result: ToolResult, query: str | None) -> str:
    products = recommendation_result.data.get("products") or []
    if recommendation_result.status != "success" or not products:
        return f"Dạ em chưa thấy sản phẩm thật sát với nhu cầu {query or 'này'}. Chị cho em thêm loại da hoặc ngân sách mong muốn để em lọc lại nhé."
    lines = ["Dạ em gợi ý vài lựa chọn hợp nhu cầu của chị:"]
    for index, product in enumerate(products[:4], start=1):
        price = int(product.get("price") or 0)
        stock = int(product.get("stock") or 0)
        reason = str(product.get("reason") or "phù hợp nhu cầu chị mô tả").rstrip(".")
        lines.append(f"{index}. {product.get('name')} - {_format_vnd(price)}đ, còn {stock}. {reason}.")
    lines.append("Chị cho em biết da mình thiên dầu, khô, mụn hay nhạy cảm để em chốt loại sát nhất nhé.")
    return "\n".join(lines)


def _missing_info_reply(plan: AgentPlan, order_result: ToolResult) -> str:
    if not plan.slots.customer_name:
        return "Dạ sản phẩm còn hàng. Chị gửi giúp em tên người nhận để em xác nhận đơn cho đúng nhé."
    if not plan.slots.customer_phone:
        return "Dạ sản phẩm còn hàng. Chị gửi giúp em số điện thoại nhận hàng nhé."
    if not plan.slots.shipping_address:
        return "Dạ sản phẩm còn hàng. Chị gửi giúp em địa chỉ nhận hàng để em xác nhận đơn nhé."
    return f"Dạ em chưa thể tạo đơn lúc này. {order_result.summary}"
```

- [ ] **Step 4: Replace `_order_reply` and `_confirmation_reply`**

Replace both functions with:

```python
def _order_reply(product_result: ToolResult, quantity: int, order: Order | None, shipping_result: ToolResult | None = None) -> str:
    name = product_result.data.get("name", "sản phẩm")
    order_code = f"#{order.id}" if order else ""
    total = int(order.total) if order else 0
    shipping_line = "Đơn dự kiến giao trong khoảng 2-4 ngày tùy khu vực."
    if shipping_result and shipping_result.status == "success":
        ghn_code = shipping_result.data.get("order_code")
        eta = shipping_result.data.get("expected_delivery_time")
        shipping_line = f"Em cũng đã gửi thông tin sang GHN. Mã vận đơn của chị là {ghn_code}."
        if eta:
            shipping_line += f" Dự kiến giao: {eta}."
        shipping_line += " Khi cần, chị nhắn \"kiểm tra đơn\" để em cập nhật trạng thái."
    elif shipping_result and shipping_result.status == "skipped":
        shipping_line = "Đơn dự kiến giao trong khoảng 2-4 ngày. Phần tạo vận đơn GHN sẽ chạy khi shop cấu hình đủ thông tin giao hàng."
    return (
        f"Dạ em đã tạo hóa đơn cho đơn {order_code}: {quantity} {name}, tổng {_format_vnd(total)}đ.\n"
        f"{shipping_line} Em cảm ơn chị."
    )


def _confirmation_reply(product_result: ToolResult, plan: AgentPlan) -> str:
    name = product_result.data.get("name", plan.slots.product_query or "sản phẩm")
    quantity = max(plan.slots.quantity, 1)
    price = int(product_result.data.get("base_price") or 0)
    total = price * quantity
    return (
        "Em đọc lại đơn giúp chị trước khi tạo hóa đơn nhé:\n"
        f"Sản phẩm: {quantity} {name}\n"
        f"Tổng tạm tính: {_format_vnd(total)}đ\n"
        f"Người nhận: {plan.slots.customer_name}\n"
        f"SĐT: {plan.slots.customer_phone}\n"
        f"Địa chỉ: {plan.slots.shipping_address}\n\n"
        "Nếu đúng, chị nhắn \"Đúng rồi\". Nếu cần sửa, chị gửi lại phần muốn đổi giúp em."
    )
```

- [ ] **Step 5: Replace `_tracking_reply` and `_order_support_reply`**

Replace both functions with:

```python
def _tracking_reply(order: Order, track_result: ToolResult) -> str:
    if track_result.status != "success":
        return (
            f"Dạ em thấy đơn #{order.id} rồi, nhưng hiện chưa lấy được mã vận đơn GHN cho đơn này. "
            f"{track_result.summary} Em sẽ để shop kiểm tra lại giúp chị."
        )
    code = track_result.data.get("order_code") or "chưa có mã"
    status = track_result.data.get("status") or "đang xử lý"
    eta = track_result.data.get("expected_delivery_time")
    eta_line = f"\nDự kiến giao: {eta}" if eta else ""
    return f"Dạ em kiểm tra được rồi ạ.\nMã vận đơn: {code}\nTrạng thái hiện tại: {status}{eta_line}"


def _order_support_reply(db: Session, conversation_id: int, customer_name: str | None, customer_phone: str | None) -> str:
    order = _latest_order_for_customer(db, customer_phone)
    display_name = customer_name if customer_name and customer_name != "Khách Zalo" else "chị"
    if order:
        first_item = "sản phẩm"
        if order.items and isinstance(order.items[0], dict):
            first_item = order.items[0].get("name") or first_item
        return (
            f"Dạ {display_name}, em thấy đơn gần nhất #{order.id} gồm {first_item}, tổng {_format_vnd(int(order.total))}đ. "
            "Chị mô tả thêm giúp em vấn đề đang gặp là giao trễ, muốn đổi/trả hay cần hoàn tiền để em chuyển đúng hướng xử lý nhé."
        )
    return (
        f"Dạ {display_name}, chị gửi giúp em mã đơn hoặc số điện thoại đã đặt hàng nhé. "
        "Em sẽ tra đơn gần nhất rồi hỗ trợ tiếp phần giao hàng, đổi trả hoặc hoàn tiền."
    )
```

- [ ] **Step 6: Run the new tests**

Run:

```bash
backend/.venv/bin/python -m pytest backend/tests/test_agent_demo_polish.py -q
```

Expected: FAIL only on quick replies if Task 4 has not been implemented yet; otherwise PASS.

- [ ] **Step 7: Commit reply template polish**

```bash
git add backend/app/agent/service.py
git commit -m "feat: polish demo chatbot replies"
```

---

### Task 4: Align Demo And Zalo Quick Replies

**Files:**
- Modify: `backend/app/chat/router.py:51-63`
- Modify: `backend/app/integrations/zalo/router.py:159-171`
- Test: `backend/tests/test_agent_demo_polish.py`

- [ ] **Step 1: Update `_quick_replies_from_actions` in `backend/app/chat/router.py`**

Replace the function with:

```python
def _quick_replies_from_actions(actions: list, *, has_invoice: bool) -> list[str]:
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

- [ ] **Step 2: Update `_quick_replies_from_actions` in `backend/app/integrations/zalo/router.py`**

Replace the function with the same implementation:

```python
def _quick_replies_from_actions(actions: list, *, has_invoice: bool) -> list[str]:
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

- [ ] **Step 3: Run the new tests**

Run:

```bash
backend/.venv/bin/python -m pytest backend/tests/test_agent_demo_polish.py -q
```

Expected: PASS.

- [ ] **Step 4: Commit quick reply alignment**

```bash
git add backend/app/chat/router.py backend/app/integrations/zalo/router.py
git commit -m "feat: align demo quick replies"
```

---

### Task 5: Full Regression And Demo Smoke Verification

**Files:**
- Verify: `backend/tests/test_agent_demo_polish.py`
- Verify: `backend/tests/test_agent_edge_cases.py`
- Verify: `backend/tests/test_agent_scenarios.py`
- Verify: all backend tests

- [ ] **Step 1: Run focused demo and existing scenario tests**

Run:

```bash
backend/.venv/bin/python -m pytest backend/tests/test_agent_demo_polish.py backend/tests/test_agent_edge_cases.py backend/tests/test_agent_scenarios.py -q
```

Expected: PASS.

- [ ] **Step 2: Run full backend suite**

Run:

```bash
backend/.venv/bin/python -m pytest backend/tests -q
```

Expected: PASS.

- [ ] **Step 3: Check no accidental extra LLM calls were added**

Run:

```bash
rg -n "generate_llm_json\\(" backend/app/agent backend/app/chat backend/app/integrations/zalo
```

Expected output locations remain limited to:

```text
backend/app/agent/llm.py
backend/app/agent/service.py
backend/app/agent/chat_router.py
```

The `service.py` call should still be inside `_reply_with_general_llm`, not in every known scenario path.

- [ ] **Step 4: Review changed files**

Run:

```bash
git diff --stat HEAD~4..HEAD
git diff HEAD~4..HEAD -- backend/app/agent/service.py backend/app/agent/llm.py backend/app/chat/router.py backend/app/integrations/zalo/router.py backend/tests/test_agent_demo_polish.py
```

Expected: only prompt text, deterministic reply text, quick replies, and tests changed.

- [ ] **Step 5: Commit final verification note if any test fixture had to be adjusted**

If no additional file changes are needed, do not create a commit. If a small test assertion adjustment is required after full regression, commit only that adjustment:

```bash
git add backend/tests/test_agent_demo_polish.py backend/tests/test_agent_edge_cases.py backend/tests/test_agent_scenarios.py
git commit -m "test: stabilize demo chatbot assertions"
```

---

## Self-Review

- Spec coverage: prompt polish is covered by Task 2; reply template polish is covered by Task 3; quick replies are covered by Task 4; regression and runtime checks are covered by Tasks 1 and 5.
- Scope check: the plan does not add memory tables, new tools, a new agent loop, real appointment scheduling, or a frontend redesign.
- Type consistency: new tests use existing `DemoMessageRequest`, `DemoMessageResponse`, `ToolResult`, and existing router helper signatures.
- Runtime check: no task adds an LLM call to known scenario paths.
