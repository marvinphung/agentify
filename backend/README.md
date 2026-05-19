# Agentify Backend MVP

Backend MVP dùng FastAPI + PostgreSQL để demo luồng:

Khách nhắn tin -> Agentify nhận diện nhu cầu -> tìm sản phẩm -> check tồn -> tạo đơn nháp.

## Chạy local

```bash
cd backend
uv sync --extra dev
cp .env.example .env
uv run uvicorn app.main:app --reload --port 8000
```

## Chạy bằng Docker Compose

Từ root repo:

```bash
docker compose up --build
```

API chạy ở:

```text
http://localhost:8000
```

PostgreSQL expose ra host ở port `5433` để tránh đụng Postgres local port `5432`.

PostgreSQL local:

```bash
docker run --name agentify-postgres \
  -e POSTGRES_USER=agentify \
  -e POSTGRES_PASSWORD=agentify \
  -e POSTGRES_DB=agentify \
  -p 5432:5432 \
  -d postgres:16-alpine
```

## KiotViet

Connect KiotViet:

```bash
curl -X POST http://127.0.0.1:8000/api/integrations/kiotviet/connect \
  -H 'Content-Type: application/json' \
  -d '{"retailer":"<retailer>","client_id":"<client_id>","client_secret":"<client_secret>"}'
```

Sync sản phẩm:

```bash
curl -X POST http://127.0.0.1:8000/api/integrations/kiotviet/sync-products
```

Gửi tin nhắn demo:

```bash
curl -X POST http://127.0.0.1:8000/api/channels/demo/messages \
  -H 'Content-Type: application/json' \
  -d '{"customer_name":"Nguyễn Thảo","message":"Đặt cho chị 2 Bánh AFC, giao tới 12 Nguyễn Trãi, SĐT 0901234567"}'
```

## LLM

Mặc định backend chạy parser fallback, không cần LLM key.

Muốn bật LLM planner thì set:

```env
LLM_API_KEY=...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Với OpenRouter:

```env
LLM_API_KEY=sk-or-v1-...
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openrouter/owl-alpha
LLM_HTTP_REFERER=http://localhost:5173
LLM_APP_TITLE="Agentify MVP"
```

LLM chỉ tạo kế hoạch tool-call dạng JSON. Backend mới là nơi thực thi API KiotViet.
