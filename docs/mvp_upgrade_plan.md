# Plan nâng cấp MVP Agentify (phiên bản judge demo)

Mục tiêu cuối: người demo chỉ thấy luồng **2 bước connect** rồi vào `/user_chat`, gửi tin nhắn Zalo mẫu và nhìn thấy AI trả lời kèm **hóa đơn + xác nhận gửi hóa đơn cho khách**.

## Phase 0 — Chuẩn bị môi trường

### Mục tiêu
- Đảm bảo backend & frontend chạy được trong một cơ chế tương tự judge.

### Checklist
- Khởi backend trên `http://127.0.0.1:8000`.
- Khởi frontend trên `http://localhost:5173`.
- `API` phải expose:
  - `/health`
  - `/api/channels/zalo/messages`
  - `/api/integrations/kiotviet/connect`
  - `/api/integrations/kiotviet/status`
  - `/api/kiotviet/products`

### Xử lý thất bại
- Nếu `/health` fail: kiểm tra CORS/DB/`uv run python` dependencies trước khi đi vào phase tiếp theo.

---

## Phase 1 — Backend contract (đã hoàn thiện)

### 1.1 Chuẩn hóa response chat
- Mục tiêu: mọi endpoint chat đều trả cùng schema:
  - `reply`
  - `actions`
  - `invoice`
  - `ui_events`
- Trạng thái: **DONE**
  - `backend/app/agent/service.py`: `order` thành công -> build `invoice` + `ui_event invoice_ready`.
  - `backend/app/chat/service.py` + `backend/app/chat/router.py`: thêm `invoice` & `ui_events`.
  - `backend/app/agent/chat_router.py` + `backend/app/agent/chat_schemas.py`: thêm `invoice`, `ui_events` cho API `/api/agent/chat`.
  - `backend/app/integrations/zalo/router.py`: route `/api/channels/zalo/messages` trả chuẩn giống demo/chat.

### 1.2 Onboarding context state
- Mục tiêu: AI nhớ thông tin liên quan giữa các tin nhắn.
- Trạng thái: **DONE**
  - `backend/app/agent/conversation_state.py` ghi nhớ `product_query`, `shipping_address`, `customer_phone`, `quantity`.

### 1.3 Kiểm thử nhanh backend
- Chạy: `UV_CACHE_DIR=/tmp/uv-cache-temp uv run pytest -q`
- Trạng thái hiện tại: **PASS 6 tests**.

---

## Phase 2 — Demo UI: chỉ hai bước, rõ ràng (đang hoàn thiện)

### 2.1 Landing đơn giản hóa
- Mục tiêu: mở app chỉ thấy 2 box bước:
  1) Connect Zalo OA
  2) Connect KiotViet
- Trạng thái: **DONE**
  - `frontend/src/app/App.tsx` `LandingPage` đã được rút gọn, bỏ phần marketing nhiều section.

### 2.2 Onboarding trải nghiệm
- Mục tiêu: không rối, chỉ tập trung flow kết nối.
- Trạng thái: **DONE**
  - `AppMode` đã giữ đúng chuỗi: `landing -> connect-zalo -> loading-zalo -> connect-kiotviet -> loading-kiotviet -> /user_chat`.

### 2.3 Chat demo hiển thị gửi hóa đơn
- Mục tiêu: user thấy rõ AI đã tạo hóa đơn và gửi hóa đơn về Zalo.
- Trạng thái: **DONE**
  - `UserChatScreen`:
    - gửi tin qua `/api/channels/zalo/messages`.
    - render card `invoice` (order id, sản phẩm, tổng, địa chỉ).
    - tự động append tin nhắn AI: “đã tạo hóa đơn” + “đã gửi hóa đơn lại cho khách”.
    - giữ nút `Gửi hóa đơn cho khách` cho trường hợp phải tái xác nhận.

### 2.4 Kết nối KiotViet giao diện
- Mục tiêu: bước 2 rõ ràng, cho người dùng biết trạng thái kết nối và sản phẩm đã sync.
- Trạng thái: **DONE**
  - `KiotVietConnectScreen` đã giữ trạng thái backend/connected/product-count ngay đầu card.

---

## Phase 3 — Đóng gói để judge

### 3.1 Build frontend
- Chạy: `cd frontend && npm run build`
- Trạng thái: **PASS**
  - Build hoàn tất, bundle sinh thành công.

### 3.2 Check quy trình demo thủ công
- B1: Mở landing -> click card "Kết nối Zalo OA".
- B2: Bấm connect Zalo -> chờ loading -> connect KiotViet.
- B3: Vào `/user_chat`, nhập tên/SĐT.
- B4: Gửi mẫu: `Đặt cho em 1 serum vitamin C, giao tới 12 Nguyễn Trãi, SĐT 0901234567`.
- B5: Kiểm tra:
  - có bản tin trả lời,
  - có thẻ invoice,
  - có ghi nhận gửi hóa đơn lại cho khách.

### 3.3 Phase mở rộng (nếu còn thời gian)
- Tách `LandingPage`/`Onboarding` thành component riêng để giảm tải `App.tsx`.
- Bổ sung endpoint mô phỏng gửi hóa đơn thực (`/api/channels/zalo/messages/send-invoice`) thay cho mô phỏng text.
- Bổ sung contract test cho `ui_events` (zalo/demo/agent).
- Thêm nút “Re-send invoice” trong trường hợp API trả `invoice_ready` nhưng chưa mark delivered.

