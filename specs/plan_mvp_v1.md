# Agentify MVP V1 Plan

## 1. Mục tiêu MVP

MVP V1 cần chứng minh được giá trị cốt lõi của Agentify:

> Khách nhắn tin -> Agentify hiểu nhu cầu -> kiểm tra tồn kho trong KiotViet -> tạo đơn/đặt hàng -> trả lời lại khách.

MVP này chưa cần tích hợp thật Zalo/Facebook. Thay vào đó, hệ thống có một kênh chat demo trong app để mô phỏng webhook từ Zalo/Facebook. Kiến trúc vẫn phải thiết kế sao cho sau này thay kênh demo bằng Zalo/Facebook webhook không phải viết lại agent core.

## 2. Scope V1

### Có trong MVP

- Backend Python FastAPI.
- PostgreSQL database.
- Kết nối KiotViet Retail bằng `retailer`, `client_id`, `client_secret`.
- Test credential KiotViet bằng token endpoint.
- Gọi KiotViet API thật để lấy sản phẩm.
- Cache danh sách sản phẩm từ KiotViet vào database.
- Kênh chat demo để user/khách nhắn tin vào hệ thống.
- Agent xử lý tin nhắn bằng kiến trúc tool-calling: LLM chọn tool cần gọi nếu có API key, fallback rule-based nếu chưa cấu hình LLM.
- Tìm sản phẩm từ nội dung tin nhắn.
- Check tồn kho/giá từ KiotViet hoặc product cache.
- Tạo đơn đặt hàng trong KiotViet nếu đủ thông tin.
- Lưu conversation, message, agent action và order mapping.
- Frontend gọi backend thật cho flow connect KiotViet, chat demo và order result.

### Chưa có trong MVP

- Login/auth nhiều user đầy đủ.
- Tích hợp thật Zalo OA webhook.
- Tích hợp thật Facebook Messenger webhook.
- Thanh toán.
- Multi-tenant phức tạp.
- AI LLM production-grade, memory nâng cao và fine-tuning.
- RAG, fine-tuning, agent memory nâng cao.
- Approval workflow thực sự cho nhân viên.
- Billing/subscription.

## 3. Quyết định kỹ thuật

### Backend

- Framework: **FastAPI**
- Runtime: **Python 3.11+**
- DB: **PostgreSQL**
- ORM: **SQLAlchemy 2.x**
- Migration: **Alembic**
- Validation: **Pydantic**
- HTTP client: **httpx**
- Server: **Uvicorn**

Lý do: FastAPI đủ nhẹ cho MVP, dễ viết endpoint, dễ validate request/response, phù hợp triển khai lên VPS/server riêng.

### Database

Sử dụng **PostgreSQL** ngay từ đầu.

Lý do:

- Phù hợp kế hoạch production sau này.
- Dễ deploy trên server riêng.
- Dễ nâng cấp sang multi-tenant.
- Tránh migrate từ SQLite sang PostgreSQL khi MVP bắt đầu có dữ liệu thật.

### Frontend

Frontend hiện có là React/Vite trong `frontend/`.

V1 không cần viết lại frontend. Chỉ cần:

- thay các flow mock hiện tại bằng API call thật ở những phần liên quan backend
- giữ landing page và dashboard demo hiện có
- thêm màn chat demo hoặc kết nối chat demo vào dashboard hiện tại

### Auth

MVP chưa cần login thật.

Sử dụng một workspace mặc định:

- `workspace_id = 1`
- tên hiển thị: `Demo Shop` hoặc `Lumi Clinic`

Tất cả API tạm thời dùng workspace mặc định. Sau này thêm auth/multi-tenant bằng JWT/session.

### AI / Agent

MVP dùng kiến trúc **LLM tool-calling có fallback rule-based**.

Mục tiêu demo:

- User nhắn: "Đặt cho chị 2 Bánh AFC, giao tới 12 Nguyễn Trãi, SĐT 0901234567".
- Agent nhận diện ý định đặt hàng.
- Agent chọn tool để tìm sản phẩm, check tồn kho và tạo đơn.
- Backend trả lời lại bằng tiếng Việt, có log các tool đã gọi.

Thiết kế:

- Nếu có `LLM_API_KEY`, agent gọi LLM theo chuẩn OpenAI-compatible chat completions để lấy kế hoạch tool-call dạng JSON.
- Nếu chưa có `LLM_API_KEY`, agent dùng parser rule-based để demo không bị phụ thuộc API ngoài.
- Tool thực thi vẫn nằm trong backend, không để LLM tự gọi API trực tiếp.
- Agent service tách khỏi router để sau này thay model hoặc thêm Zalo/Facebook webhook không đổi API.

Các tool V1:

- `search_products`: tìm sản phẩm theo nội dung khách nhắn.
- `check_stock`: kiểm tra tồn kho và giá từ cache/KiotViet.
- `create_draft_order`: tạo đơn nháp local để demo an toàn.
- `create_kiotviet_order`: tạo đơn thật KiotViet, mặc định tắt bằng env để tránh tạo dữ liệu rác.
- `ask_clarification`: hỏi lại nếu thiếu sản phẩm, số điện thoại, địa chỉ hoặc match chưa chắc chắn.

## 4. Kiến trúc thư mục backend

Tạo thư mục:

```text
backend/
  app/
    main.py
    config.py
    database.py
    errors.py
    deps.py
    integrations/
      kiotviet/
        router.py
        service.py
        schemas.py
        client.py
    chat/
      router.py
      service.py
      schemas.py
    agent/
      service.py
      parser.py
      llm.py
      tools.py
      schemas.py
    orders/
      router.py
      service.py
      schemas.py
    models/
      workspace.py
      integration.py
      product.py
      customer.py
      conversation.py
      message.py
      order.py
      agent_action.py
  alembic/
  alembic.ini
  pyproject.toml
  .env.example
```

Nguyên tắc:

- Router chỉ parse request và gọi service.
- Service chứa business logic.
- KiotViet client chỉ gọi API ngoài.
- Agent parser không gọi DB trực tiếp.
- DB access đi qua service/repository đơn giản.

## 5. Environment variables

File `.env.example`:

```env
APP_ENV=development
API_HOST=0.0.0.0
API_PORT=8000

DATABASE_URL=postgresql+psycopg://agentify:agentify@localhost:5432/agentify

SECRET_KEY=change-me
FERNET_KEY=generate-a-fernet-key

CORS_ORIGINS=http://localhost:5173

KIOTVIET_TOKEN_URL=https://id.kiotviet.vn/connect/token
KIOTVIET_API_BASE_URL=https://public.kiotapi.com

LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

KIOTVIET_CREATE_REAL_ORDERS=false
```

Không commit `.env` thật.

## 6. Data model

### `workspaces`

Lưu workspace/shop.

Columns:

- `id`
- `name`
- `created_at`
- `updated_at`

### `kiotviet_integrations`

Lưu credential KiotViet.

Columns:

- `id`
- `workspace_id`
- `retailer`
- `client_id`
- `encrypted_client_secret`
- `access_token`
- `token_expires_at`
- `status`: `connected`, `failed`, `disconnected`
- `last_sync_at`
- `created_at`
- `updated_at`

Ghi chú:

- `client_secret` phải mã hóa bằng Fernet trước khi lưu.
- Token có thể lưu để tái sử dụng đến khi hết hạn.

### `products_cache`

Cache sản phẩm từ KiotViet.

Columns:

- `id`
- `workspace_id`
- `kiotviet_product_id`
- `code`
- `name`
- `base_price`
- `stock`
- `raw_json` JSONB
- `updated_at`

Index:

- `(workspace_id, kiotviet_product_id)`
- `(workspace_id, name)`
- `(workspace_id, code)`

### `customers`

Khách hàng từ chat demo.

Columns:

- `id`
- `workspace_id`
- `name`
- `phone`
- `channel`: `demo`, `zalo`, `facebook`
- `kiotviet_customer_id`
- `created_at`
- `updated_at`

### `conversations`

Luồng hội thoại.

Columns:

- `id`
- `workspace_id`
- `customer_id`
- `channel`
- `status`: `open`, `resolved`, `needs_human`, `order_created`
- `created_at`
- `updated_at`

### `messages`

Tin nhắn.

Columns:

- `id`
- `conversation_id`
- `sender`: `customer`, `ai`, `staff`, `system`
- `content`
- `created_at`

### `agent_actions`

Log các hành động Agentify đã làm.

Columns:

- `id`
- `conversation_id`
- `action_type`: `intent_detected`, `product_search`, `stock_check`, `order_create`, `reply`, `handoff`
- `status`: `success`, `failed`, `skipped`
- `summary`
- `raw_json` JSONB
- `created_at`

### `orders`

Mapping đơn KiotViet.

Columns:

- `id`
- `workspace_id`
- `conversation_id`
- `customer_id`
- `kiotviet_order_id`
- `kiotviet_order_code`
- `status`
- `total`
- `customer_name`
- `customer_phone`
- `shipping_address`
- `items` JSONB
- `raw_json` JSONB
- `created_at`

## 7. KiotViet Integration

### 7.1 Connect flow

Frontend form cho user nhập:

- `retailer`
- `client_id`
- `client_secret`

Backend:

1. Nhận credential.
2. Gọi token endpoint:

```http
POST https://id.kiotviet.vn/connect/token
Content-Type: application/x-www-form-urlencoded

scopes=PublicApi.Access
grant_type=client_credentials
client_id=...
client_secret=...
```

3. Nếu token OK, gọi thử:

```http
GET https://public.kiotapi.com/products?pageSize=3
Authorization: Bearer <token>
Retailer: <retailer>
```

4. Nếu OK:
   - mã hóa `client_secret`
   - lưu integration
   - lưu token
   - status = `connected`
5. Trả response thành công.

### 7.2 KiotViet client

`KiotVietClient` cần có các hàm:

- `get_access_token()`
- `ensure_access_token()`
- `list_products(page_size, current_item, search_term?)`
- `get_product(product_id)`
- `create_customer(...)`
- `create_order(...)`

Token reuse:

- Nếu token còn hạn, dùng lại.
- Nếu token hết hạn, lấy token mới và update DB.

### 7.3 Product sync

Endpoint:

```http
POST /api/integrations/kiotviet/sync-products
```

Behavior:

- gọi KiotViet `/products`
- lấy tối thiểu 100 sản phẩm đầu tiên
- lưu vào `products_cache`
- trả số sản phẩm đã sync

## 8. API endpoints

### Health

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

### KiotViet

```http
POST /api/integrations/kiotviet/connect
```

Request:

```json
{
  "retailer": "bietkhongnhe123",
  "client_id": "...",
  "client_secret": "..."
}
```

Response:

```json
{
  "status": "connected",
  "retailer": "bietkhongnhe123",
  "sample_product_count": 3
}
```

```http
GET /api/integrations/kiotviet/status
```

```http
POST /api/integrations/kiotviet/sync-products
```

```http
GET /api/kiotviet/products?search=banh
```

### Demo chat

```http
POST /api/channels/demo/messages
```

Request:

```json
{
  "customer_name": "Nguyễn Thảo",
  "customer_phone": "0901234567",
  "message": "Mình muốn mua 2 Bánh AFC còn hàng không?"
}
```

Response:

```json
{
  "conversation_id": 1,
  "reply": "Dạ sản phẩm Bánh AFC 200g còn hàng. Em đã tạo đơn cho chị với số lượng 2.",
  "actions": [
    {
      "type": "product_search",
      "status": "success",
      "summary": "Tìm thấy Bánh AFC 200g"
    },
    {
      "type": "stock_check",
      "status": "success",
      "summary": "Còn hàng"
    },
    {
      "type": "order_create",
      "status": "success",
      "summary": "Đã tạo đơn KiotViet"
    }
  ],
  "order": {
    "id": 1,
    "kiotviet_order_code": "DH000123",
    "total": 24000
  }
}
```

```http
GET /api/conversations
```

```http
GET /api/conversations/{conversation_id}/messages
```

```http
GET /api/conversations/{conversation_id}/actions
```

### Orders

```http
GET /api/orders
```

```http
GET /api/orders/{order_id}
```

## 9. Agent MVP logic

### Input

Tin nhắn từ demo chat.

Ví dụ:

- "Mình muốn mua 2 Bánh AFC còn hàng không?"
- "Cho mình lấy 1 kem dưỡng Johnson xanh"
- "Shop còn sữa rửa mặt không?"

### Agent tool-calling flow

1. Lưu message khách vào DB.
2. Agent lấy context hội thoại gần nhất.
3. Nếu có LLM key:
   - gửi prompt tiếng Việt cho LLM
   - yêu cầu output JSON gồm `intent`, `slots`, `tool_plan`, `reply_if_missing`
   - validate JSON bằng Pydantic
4. Nếu không có LLM key hoặc LLM lỗi:
   - dùng rule-based parser fallback
5. Backend thực thi tool theo thứ tự:
   - tìm sản phẩm
   - check tồn
   - tạo draft order hoặc KiotViet order nếu đủ thông tin
6. Lưu `agent_actions`.
7. Lưu message trả lời của AI.

LLM không được nhận `client_secret` hoặc access token. LLM chỉ thấy dữ liệu cần thiết như tên sản phẩm, số lượng, số điện thoại, địa chỉ và kết quả tool đã được backend lọc.

### LLM output contract

LLM phải trả JSON thuần:

```json
{
  "intent": "buy_product",
  "slots": {
    "product_query": "Bánh AFC",
    "quantity": 2,
    "customer_name": "chị",
    "customer_phone": "0901234567",
    "shipping_address": "12 Nguyễn Trãi"
  },
  "tool_plan": ["search_products", "check_stock", "create_draft_order"],
  "reply_if_missing": null
}
```

Nếu thiếu dữ liệu:

```json
{
  "intent": "buy_product",
  "slots": {
    "product_query": "Bánh AFC",
    "quantity": 2,
    "customer_phone": null,
    "shipping_address": null
  },
  "tool_plan": ["search_products", "check_stock", "ask_clarification"],
  "reply_if_missing": "Dạ chị cho em xin số điện thoại và địa chỉ giao hàng để em lên đơn nhé."
}
```

### Parser rule-based fallback

Extract:

- `intent`: `ask_stock`, `buy_product`, `unknown`
- `quantity`: số lượng, default = 1
- `product_query`: phần tên sản phẩm
- `customer_phone`: nếu có trong message hoặc request
- `shipping_address`: đoạn sau từ khóa `giao tới`, `giao đến`, `địa chỉ`

Rule gợi ý:

- Nếu có từ khóa `mua`, `lấy`, `đặt`, `ship`, `giao`: `buy_product`
- Nếu có từ khóa `còn`, `còn hàng`, `tồn`, `giá`: `ask_stock`
- Quantity regex:
  - `(\d+)\s*(cái|hộp|chai|tuýp|gói|sp|sản phẩm)?`
- Product query:
  - bỏ stopwords như `mình`, `muốn`, `mua`, `còn`, `hàng`, `không`, `shop`, `cho`
  - fuzzy match với `products_cache.name`

### Product matching

MVP đơn giản:

- Load products_cache.
- Normalize text lower-case, remove accents.
- Score theo substring match.
- Nếu không tìm thấy trong cache, gọi KiotViet `/products?search=<query>`.
- Chọn match tốt nhất.

### Order creation condition

Tạo đơn nếu:

- intent = `buy_product`
- tìm thấy product
- quantity > 0
- customer_name có
- customer_phone có
- shipping_address có, hoặc config cho phép tạo đơn không địa chỉ

Nếu thiếu phone:

- Không tạo đơn.
- Reply hỏi số điện thoại.
- status conversation vẫn `open`.

Nếu không đủ tồn kho:

- Không tạo đơn.
- Reply báo hết/không đủ hàng.

### KiotViet order

MVP ưu tiên tạo **đặt hàng** thay vì hóa đơn bán hàng.

Lý do:

- Ít rủi ro hơn hóa đơn bán ngay.
- Phù hợp social commerce: khách đặt trước, shop xác nhận/giao sau.

Mặc định V1 dùng `create_draft_order` để tránh tạo dữ liệu rác trong KiotViet khi quay demo. Khi cần test thật, bật:

```env
KIOTVIET_CREATE_REAL_ORDERS=true
```

Nếu endpoint đặt hàng khó hơn trong API thực tế hoặc API trả lỗi, fallback MVP:

- tạo customer trong KiotViet
- không tạo order thật
- lưu order local với status `draft`
- UI vẫn hiển thị agent đã chuẩn bị đơn

Nhưng mục tiêu ưu tiên vẫn là tạo order thật nếu API cho phép.

## 10. Frontend changes

### Onboarding connect KiotViet

Thay màn connect KiotViet mock bằng form thật:

- Tên gian hàng
- Client ID
- Client Secret

Khi bấm connect:

- gọi `POST /api/integrations/kiotviet/connect`
- hiển thị loading 3 giây hoặc đến khi API trả về
- nếu thành công: chuyển bước tiếp theo
- nếu thất bại: hiển thị lỗi rõ ràng

### Demo chat

Thêm màn hoặc panel:

- nhập tên khách
- nhập số điện thoại
- nhập tin nhắn
- nút gửi
- hiển thị reply từ Agentify
- hiển thị action log: tìm sản phẩm, check tồn, tạo đơn
- nếu có order: hiển thị mã đơn KiotViet

### Dashboard

Dashboard hiện tại có thể giữ mock, nhưng các phần sau nên lấy API thật:

- trạng thái KiotViet connected
- danh sách sản phẩm đã sync
- hội thoại demo gần nhất
- order mới tạo

## 11. Development phases

### Phase 1: Backend foundation

- Tạo `backend/`
- Setup FastAPI.
- Setup config/env.
- Setup PostgreSQL connection.
- Setup Alembic.
- Tạo health endpoint.
- Tạo workspace seed mặc định.

Acceptance:

- `GET /health` trả `{"status":"ok"}`
- Backend chạy được local.
- Migration tạo DB thành công.

### Phase 2: KiotViet integration

- Tạo model `kiotviet_integrations`.
- Tạo encryption helper cho client secret.
- Implement token call.
- Implement connect endpoint.
- Implement product list endpoint.
- Implement product sync.

Acceptance:

- Dùng credential thật của `bietkhongnhe123` connect OK.
- Gọi `/api/kiotviet/products` trả được sản phẩm thật.
- Sync lưu products vào Postgres.

### Phase 3: Demo chat + conversation storage

- Tạo customer/conversation/message model.
- Tạo endpoint gửi message demo.
- Lưu message customer.
- Tạo reply đơn giản.
- Trả conversation id.

Acceptance:

- Gửi message từ frontend hoặc curl tạo conversation.
- DB có customer, conversation, message.

### Phase 4: Agent parser + product matching

- Implement LLM planner optional.
- Implement tool registry.
- Implement rule parser fallback.
- Implement product matching từ cache/KiotViet.
- Log agent actions.
- Reply tồn kho/giá.

Acceptance:

- Message "Đặt cho chị 2 Bánh AFC, giao tới 12 Nguyễn Trãi, SĐT 0901234567" match được sản phẩm thật.
- Reply có tên sản phẩm, giá/tồn.
- Agent action log ghi rõ.

### Phase 5: Order creation

- Implement create customer/order với KiotViet.
- Lưu order mapping local.
- Reply mã đơn.
- Nếu thiếu phone, hỏi phone thay vì tạo đơn.

Acceptance:

- Message có phone + sản phẩm + số lượng tạo được đơn hoặc draft order.
- UI hiển thị order result.

### Phase 6: Frontend integration

- Connect KiotViet form thật.
- Demo chat screen thật.
- Product sync button.
- Show action log/order result.

Acceptance:

- User có thể connect KiotViet từ UI.
- User gửi message trong demo chat.
- Agent check sản phẩm thật.
- Agent tạo đơn/draft và hiển thị kết quả.

## 12. Test plan

### Backend tests

- Test config load.
- Test KiotViet token success/failure bằng mocked httpx.
- Test parser:
  - quantity extraction
  - intent detection
  - product query extraction
  - phone/address extraction
- Test LLM planner fallback khi thiếu key.
- Test tool registry không gọi KiotViet order thật nếu env đang tắt.
- Test product matching.
- Test demo message endpoint.

### Manual integration tests

1. Start backend.
2. Connect KiotViet with real credential.
3. Sync products.
4. Send demo message:

```text
Đặt cho chị 2 Bánh AFC, giao tới 12 Nguyễn Trãi, SĐT 0901234567
```

5. Verify:
   - product matched
   - action log created
   - order created or draft created
   - reply meaningful

## 13. Local run commands

Backend:

```bash
cd backend
uv venv
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

PostgreSQL local option:

```bash
docker run --name agentify-postgres \
  -e POSTGRES_USER=agentify \
  -e POSTGRES_PASSWORD=agentify \
  -e POSTGRES_DB=agentify \
  -p 5432:5432 \
  -d postgres:16
```

## 14. Deployment direction

Frontend:

- Deploy Vercel.
- Set `VITE_API_BASE_URL=https://api.agentify...`

Backend:

- Deploy on VPS/server.
- Run FastAPI with Uvicorn/Gunicorn.
- Use PostgreSQL on same server or managed DB.
- Configure CORS for Vercel domain.

Database:

- PostgreSQL.
- Regular backup.
- Store secrets encrypted.

## 15. Open questions

1. KiotViet order endpoint thực tế nên dùng endpoint nào cho đặt hàng trong Retail API?
2. MVP có cần tạo khách hàng trong KiotViet trước khi tạo đơn không, hay order có thể chứa thông tin khách trực tiếp?
3. Có cần dùng branch mặc định không? Nếu shop có nhiều chi nhánh, chọn chi nhánh nào?
4. Có cần cho user chọn sản phẩm khi agent match chưa chắc chắn không?
5. Khi tạo đơn thật, có cần chặn tạo đơn nếu đang demo để tránh dữ liệu rác trong KiotViet không?
6. Dùng LLM provider nào cho V1: OpenAI-compatible, Gemini, hay self-hosted?

## 16. Đề xuất mặc định cho các câu hỏi mở

- Dùng branch đầu tiên làm mặc định trong MVP.
- Nếu match sản phẩm không chắc chắn, agent hỏi lại khách.
- Nếu thiếu phone, agent hỏi số điện thoại.
- Tạo đặt hàng thật nếu API thuận lợi; nếu không, tạo draft order local và ghi rõ trên UI.
- Không thêm auth cho V1; chỉ có workspace demo.
- Dùng OpenAI-compatible API nếu cần LLM; backend không phụ thuộc SDK riêng, chỉ cần `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`.
- Mặc định tạo draft order local; chỉ tạo đơn thật khi bật `KIOTVIET_CREATE_REAL_ORDERS=true`.
