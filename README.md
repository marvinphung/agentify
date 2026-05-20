# Agentify

Agentify là nhân viên bán hàng AI cho doanh nghiệp social commerce tại Việt Nam. Sản phẩm giúp shop, spa, clinic và SME tự động xử lý hội thoại khách hàng, tư vấn sản phẩm, kiểm tra tồn kho, tạo đơn nháp, gửi hóa đơn tạm tính và hỗ trợ sau mua trên các kênh như Zalo, Facebook và hệ thống quản lý sẵn có như KiotViet.

MVP hiện tập trung vào kịch bản beauty/spa bán mỹ phẩm online.

## Bài Toán

Nhiều SME Việt Nam đã có phần mềm quản lý như KiotViet, Sapo hoặc Pancake, nhưng vận hành sales và chăm sóc khách hàng vẫn phụ thuộc nhiều vào con người.

Các vấn đề thường gặp:

- Shop nhận nhiều tin nhắn mỗi ngày, dễ bỏ sót khách ngoài giờ.
- Nhân viên phải đọc chat, tư vấn, hỏi thông tin, kiểm tra tồn kho và tạo đơn thủ công.
- Follow-up sau mua, đổi trả, phản hồi kích ứng hoặc đơn giao trễ chưa được xử lý đều.
- Dữ liệu nằm trong nhiều hệ thống khác nhau, nhưng chưa có lớp tự động hóa biết hành động.

## Giải Pháp

Agentify đóng vai trò một lớp nhân viên AI nằm trên hệ thống hiện tại.

Thay vì chỉ trả lời như chatbot, Agentify có thể:

- Hiểu ý định khách hàng từ tiếng Việt tự nhiên.
- Tư vấn sản phẩm theo nhu cầu, loại da và ngân sách.
- Hỏi thêm thông tin còn thiếu trước khi tạo đơn.
- Kiểm tra sản phẩm và tồn kho từ KiotViet.
- Tạo đơn nháp và hiển thị hóa đơn trong khung chat.
- Ghi nhận hội thoại vào database để admin theo dõi.
- Tra lịch sử đơn hàng theo số điện thoại khi khách hỏi đơn trễ, trả hàng hoặc hỗ trợ sau mua.
- Chuyển các tình huống rủi ro cho nhân viên xử lý.

## Luồng Demo MVP

### 1. Landing Page

Người dùng vào landing page của Agentify và có thể:

- Bấm `Bắt đầu ngay` để đi qua luồng kết nối hệ thống.
- Bấm `Liên hệ với shop` để vào màn chat khách hàng tại `/user_chat`.

### 2. Onboarding Kết Nối

Luồng setup mô phỏng:

1. Kết nối Zalo.
2. Kết nối KiotViet.
3. Kết nối Calendar tuỳ chọn.
4. Vào dashboard admin.

### 3. Chat Khách Hàng

Tại `/user_chat`, khách hàng nhập tên và số điện thoại trước khi chat. Thông tin này được lưu lại để:

- Cá nhân hóa cách xưng hô.
- Tạo đơn với đúng tên và số điện thoại.
- Tra lịch sử mua hàng khi khách hỏi về đơn cũ.

Ví dụ luồng đặt hàng:

1. Khách nhắn: `Đặt serum vitamin C`.
2. Shop tư vấn serum trước, không tạo đơn ngay.
3. Khách xác nhận: `Đồng ý đặt`.
4. Shop hỏi địa chỉ và khung giờ nhận hàng.
5. Khách gửi thông tin giao hàng.
6. Agentify tạo đơn nháp, gửi hóa đơn tạm tính và cho chọn hình thức thanh toán.

Ví dụ luồng sau mua:

1. Khách nhắn: `Đơn của chị bị trễ, chị muốn trả hàng`.
2. Agentify tra lịch sử đơn theo số điện thoại.
3. Trả lời theo đơn gần nhất và hỏi khách muốn kiểm tra giao trễ, đổi/trả hàng hay gặp nhân viên.

### 4. Admin Inbox

Màn `Hộp thư` trong dashboard admin đọc dữ liệu hội thoại thật từ backend:

- Danh sách hội thoại từ `GET /api/conversations`.
- Tin nhắn từng hội thoại từ `GET /api/conversations/{id}/messages`.
- Các hội thoại từ `/user_chat` được lưu vào PostgreSQL và hiển thị lại cho admin.

## Kiến Trúc

```text
frontend/         React + Vite UI
backend/          FastAPI backend
PostgreSQL        Lưu workspace, customer, conversation, message, order
KiotViet API      Đồng bộ sản phẩm, kiểm tra dữ liệu bán hàng
OpenRouter LLM    Hiểu ý định, tư vấn và tạo phản hồi tiếng Việt
```

## Công Nghệ

Frontend:

- React
- Vite
- TypeScript
- Tailwind CSS
- Lucide icons

Backend:

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- httpx
- OpenRouter-compatible LLM API

Infrastructure:

- Docker Compose cho backend và PostgreSQL
- Frontend chạy bằng Vite dev server

## Cấu Trúc Thư Mục

```text
.
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── agent/           # LLM planner, chat router, tool logic
│   │   ├── chat/            # Conversations/messages API
│   │   ├── integrations/    # KiotViet integration
│   │   ├── models/          # SQLAlchemy models
│   │   └── orders/          # Order API/schema
│   └── tests/
├── frontend/                # React/Vite frontend
│   └── src/app/App.tsx      # Main MVP UI
├── specs/                   # MVP planning docs
├── docs/                    # Supporting docs
├── docker-compose.yml
└── README.md
```

## Chạy Local

### 1. Chuẩn Bị `.env`

Tạo file `.env` ở root repo. Không commit file này lên GitHub.

Các biến thường dùng:

```env
POSTGRES_USER=agentify
POSTGRES_PASSWORD=agentify
POSTGRES_DB=agentify
POSTGRES_HOST_PORT=5433
API_PORT=8763
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://agentify-olive.vercel.app

LLM_API_KEY=your_openrouter_or_llm_key
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=your_model
LLM_HTTP_REFERER=https://agentify-olive.vercel.app
LLM_APP_TITLE=Agentify MVP

KIOTVIET_RETAILER=your_retailer
KIOTVIET_CLIENT_ID=your_client_id
KIOTVIET_CLIENT_SECRET=your_client_secret
```

### 2. Chạy Backend Và PostgreSQL

Từ root repo:

```bash
docker compose up -d --build
```

Backend chạy tại:

```text
http://127.0.0.1:8763
```

Khi backend start với database trống, hệ thống tự khởi tạo dữ liệu demo ban đầu:

- Workspace mặc định.
- Danh sách sản phẩm mỹ phẩm demo.
- Khách hàng mẫu.
- Hội thoại mẫu.
- Đơn nháp mẫu để demo tra lịch sử đơn hàng.

Health check:

```bash
curl http://127.0.0.1:8763/health
```

### 3. Chạy Frontend

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend chạy tại:

```text
http://127.0.0.1:5173
```

Các route quan trọng:

```text
/              Landing page
/user_chat     Chat khách hàng
```

## API Chính

Gửi tin nhắn khách hàng qua agent chat:

```bash
curl -X POST http://127.0.0.1:8763/api/agent/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_name": "Nguyễn Thảo",
    "customer_phone": "0901234567",
    "message": "Đơn của chị bị trễ, chị muốn trả hàng"
  }'
```

Tạo đơn nháp từ tin nhắn:

```bash
curl -X POST http://127.0.0.1:8763/api/channels/demo/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_name": "Nguyễn Thảo",
    "customer_phone": "0901234567",
    "message": "Đặt cho chị 1 serum vitamin C, giao tới 12 Nguyễn Trãi, nhận hàng sau 18h"
  }'
```

Lấy danh sách hội thoại:

```bash
curl http://127.0.0.1:8763/api/conversations
```

Lấy tin nhắn trong một hội thoại:

```bash
curl http://127.0.0.1:8763/api/conversations/1/messages
```

## KiotViet

MVP có tích hợp KiotViet để đồng bộ sản phẩm mỹ phẩm demo và dùng dữ liệu sản phẩm/tồn kho khi tư vấn hoặc tạo đơn.

Các endpoint liên quan:

```text
POST /api/integrations/kiotviet/connect
POST /api/integrations/kiotviet/sync-products
GET  /api/kiotviet/products
POST /api/demo/create-cosmetics-in-kiotviet
```

## Trạng Thái MVP

Đã có:

- Landing page sản phẩm.
- Luồng onboarding kết nối Zalo/KiotViet/Calendar mô phỏng.
- Chat khách hàng tại `/user_chat`.
- Form nhập tên và số điện thoại trước khi chat.
- LLM trả lời tư vấn sản phẩm.
- Tạo đơn nháp và hóa đơn tạm tính.
- Chọn thanh toán khi nhận hàng hoặc thanh toán trước bằng QR demo.
- Lưu hội thoại vào PostgreSQL.
- Admin inbox đọc hội thoại thật từ database.
- Tra lịch sử đơn hàng khi khách hỏi đơn trễ, trả hàng hoặc hỗ trợ sau mua.
- Đồng bộ và tạo danh sách mỹ phẩm demo trên KiotViet.

Chưa hoàn thiện cho production:

- Xác thực người dùng và phân quyền workspace.
- Kết nối Zalo/Facebook thật.
- Tạo đơn KiotViet production có kiểm soát.
- Webhook hai chiều từ kênh chat thật.
- Hàng đợi background job và retry.
- Logging/observability đầy đủ.
- Chính sách bảo mật dữ liệu khách hàng.

## Mục Tiêu Sản Phẩm

Mục tiêu của Agentify là giúp doanh nghiệp giữ nguyên hệ thống hiện tại, nhưng có thêm một nhân viên AI biết tự hoàn thành công việc:

```text
Khách nhắn tin -> Agentify hiểu nhu cầu -> gọi dữ liệu/API -> hoàn thành workflow -> lưu lại cho admin theo dõi
```

Trong giai đoạn đầu, Agentify ưu tiên nhóm beauty, spa và clinic vì workflow rõ ràng, nhu cầu phản hồi nhanh cao và giá trị mỗi khách hàng đủ lớn để chứng minh ROI.
