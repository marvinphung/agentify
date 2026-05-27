# Agent Chatbot Demo Polish Design

## Goal

Improve the Agentify chatbot for the next-day demo by making replies feel more natural while keeping runtime fast and preserving the existing reliable flows.

The change is intentionally conservative. It should polish prompt behavior, reply copy, and quick replies without replacing the current agent architecture or adding extra LLM calls to the normal response path.

## Current State

The main chatbot path is `process_customer_message` in `backend/app/agent/service.py`. It receives the customer message, gets an `AgentPlan`, handles scenario state, runs backend tools, persists actions, and writes the AI reply.

The planner prompt lives in `backend/app/agent/llm.py`. It asks the LLM to classify intent, extract slots, and choose a tool plan. If the LLM is unavailable or returns invalid JSON, the system falls back to `parse_message` in `backend/app/agent/parser.py`.

Most customer-facing replies are deterministic templates in `backend/app/agent/service.py`. These templates make the demo reliable, but they also make the chatbot feel scripted in repeated turns. The generic LLM reply prompt is only used when intent is `unknown`.

The tool surface already covers the demo needs: product search, product recommendations, stock checks, order lookup, draft order creation, invoice payload creation, GHN shipping creation, GHN tracking, appointment stubs, and support ticket stubs.

## Constraints

- Preserve all existing backend tests.
- Do not add a second LLM call for the main known flows.
- Do not create orders, invoices, shipments, appointments, or support tickets unless the existing safety gates allow it.
- Keep the parser fallback usable when LLM credentials are missing or the LLM times out.
- Keep the implementation small enough to complete and verify before the demo.
- Avoid frontend churn unless backend quick replies require a small display adjustment.

## Recommended Approach

Use a demo-safe polish layer:

1. Strengthen the planner prompt so it handles short contextual Vietnamese messages better.
2. Rewrite the most visible deterministic reply templates to be warmer, shorter, and less repetitive.
3. Improve quick replies so the UI gives natural next actions during the demo.
4. Add regression tests for the demo phrases most likely to appear.

This keeps the existing deterministic orchestration while improving the perceived naturalness of the conversation.

## Prompt Changes

Update `SYSTEM_PROMPT` in `backend/app/agent/llm.py` to clarify:

- Short messages such as "ok", "lấy loại đó", "da dầu", and "rẻ nhất" must be interpreted against the recent conversation state when available.
- Consultation intent must not become order intent unless the customer clearly asks to buy, take, order, or confirm a purchase.
- `create_draft_order` can only appear after the customer has clearly ordered and the required order fields are present or being collected.
- Customer names, phone numbers, addresses, and payment method should be extracted carefully from natural Vietnamese messages.
- The planner should prefer `ask_clarification` when the message is ambiguous or a safe action requires missing information.

Update `GENERAL_LLM_PROMPT` in `backend/app/agent/service.py` to clarify:

- Reply in natural Vietnamese for a beauty shop.
- Keep replies concise: usually 1-4 short sentences unless the customer asks for detailed routine guidance.
- Ask one next question at a time.
- Do not mention tool names or internal system behavior.
- Do not claim stock, order, invoice, shipping, or appointment status unless provided by context or tool results.
- Avoid repeating the same opening phrase in every reply.

## Reply Template Polish

Polish these functions in `backend/app/agent/service.py`:

- `_consultation_reply`
- `_missing_info_reply`
- `_confirmation_reply`
- `_order_reply`
- `_order_support_reply`
- `_stock_reply`
- sunscreen scenario replies
- irritation scenario replies
- appointment scenario replies
- fulfillment complaint replies

The target style:

- Warm and direct.
- Short enough for a Zalo-style chat screen.
- Clear about the next step.
- No long scripted blocks when a concise reply works.
- No repeated "Dạ shop chào chị" on every turn.
- No over-selling when the customer is still exploring.

Example consultation shape:

```text
Dạ với da dầu và dễ bí, em nghiêng về SunCare Aqua SPF50+ vì chất gel nhẹ và ráo hơn. Dòng này còn hàng, giá 320.000đ.
Chị muốn em so thêm với dòng dịu nhẹ cho da treatment không ạ?
```

Example missing-info shape:

```text
Dạ sản phẩm còn hàng. Chị gửi giúp em tên người nhận để em xác nhận đơn cho đúng nhé.
```

Example confirmation shape:

```text
Em đọc lại đơn giúp chị trước khi tạo hóa đơn nhé:
Sản phẩm: 1 SunCare Aqua SPF50+
Tổng tạm tính: 320.000đ
Người nhận: Nguyễn Thảo
SĐT: 0901234567
Địa chỉ: 12 Nguyễn Trãi

Nếu đúng, chị nhắn "Đúng rồi". Nếu cần sửa, chị gửi lại phần muốn đổi giúp em.
```

## Quick Replies

Update quick replies in both response routers:

- `backend/app/chat/router.py`
- `backend/app/integrations/zalo/router.py`

Recommended defaults:

- Product recommendation: `Da dầu`, `Da khô`, `Da nhạy cảm`, `Dưới 350k`
- Pending confirmation: `Đúng rồi`, `Sửa SĐT`, `Đổi địa chỉ`
- Invoice created: `Kiểm tra trạng thái đơn`, `Mua thêm`, `Gặp nhân viên`
- Order support: `Gửi mã đơn`, `Gửi SĐT mua hàng`, `Gặp nhân viên`

If implementation time allows, missing-info quick replies should be based on the missing field rather than a generic product recommendation state.

## Runtime And Reliability

The implementation should not add new network dependencies or additional blocking LLM calls for known flows.

Expected runtime behavior:

- Known demo flows remain deterministic and fast.
- LLM planner still improves slot extraction when available.
- Parser fallback handles the same flows when the LLM is unavailable.
- The user sees a polished response even when the reply came from a deterministic template.

## Demo Regression Cases

Add or adjust tests to cover:

- Product consultation followed by "Da mình dầu, dễ bí da."
- Product consultation followed by "Loại nào rẻ nhất vậy shop?"
- Product consultation followed by "Ok lấy mình 1 tuýp."
- Direct order with missing name, phone, or address does not create invoice.
- Pending order confirmation only creates invoice after explicit confirmation.
- Customer asks "đơn chị tới đâu rồi" and the system uses order lookup or asks for phone/order code.
- Customer reports irritation and severe symptoms still prioritize medical guidance.

Tests should assert safety and key content, not exact full prose, so copy can remain natural without making tests brittle.

## Out Of Scope Before Demo

- Full Agent v2 architecture.
- Long-term memory tables.
- Multi-tool autonomous planning loop.
- Real appointment scheduling integration.
- Real support ticket persistence beyond current stubs.
- Full frontend redesign.

## Acceptance Criteria

- Backend test suite passes.
- Demo conversations feel less scripted in the key flows.
- No extra LLM call is added to known flows.
- Unknown/fallback LLM replies remain JSON-only and safe.
- Quick replies guide the next demo action naturally.
- No order, invoice, shipment, appointment, or support ticket is created before the required confirmation or lookup step.
