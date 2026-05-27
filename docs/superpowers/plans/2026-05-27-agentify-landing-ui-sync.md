# Agentify Landing Page & UI Sync Plan

**Goal:** Thiết kế và triển khai landing page tiếng Việt cho Agentify, sau đó đồng bộ toàn bộ UI hiện tại theo cùng hệ nhận diện từ `DESIGN.md` và `docs/logo.png`.

**Scope:** Plan này chỉ mô tả hướng triển khai. Chưa thực hiện code frontend.

---

## 1. Design Constraints

### 1.1. Ngôn ngữ

- Landing page phải dùng **tiếng Việt** cho toàn bộ UI copy.
- Các phần bắt buộc tiếng Việt: navigation, CTA, headline, section title, pricing, mô tả tính năng, form, trạng thái, tooltip, thông báo.
- Tagline tiếng Anh chỉ được dùng như một brand line phụ nếu cần, ví dụ: "Let AI run your sales operations." Không dùng tiếng Anh làm headline chính.

### 1.2. Brand Source

Nguồn nhận diện chính:

- `docs/logo.png`
- `DESIGN.md`

Palette đã chỉnh trong `DESIGN.md`:

- Primary salmon/coral: `#e88080`
- Primary strong: `#d96f6f`
- Primary soft: `#f5caca`
- Canvas soft blue-mint: `#e8f0f0`
- Canvas: `#fffefe`
- Ink: `#201515`

Không dùng:

- Zapier orange `#ff4f00`
- teal/blue SaaS generic cho brand surface
- purple AI gradient
- robot/mascot hoạt hình
- landing page kiểu quá marketing, tách rời sản phẩm thật

### 1.3. Visual Tone

Landing page cần có cảm giác:

- sản phẩm AI vận hành thật cho SME Việt Nam
- ấm, rõ ràng, đáng tin
- workflow-focused
- nhìn vào hiểu ngay: Agentify nằm trên stack hiện tại và tự xử lý việc lặp lại

Dashboard/app UI cần:

- dense hơn landing page
- sạch, dễ scan
- phù hợp công cụ làm việc hằng ngày
- không biến dashboard thành brochure

---

## 2. Current Frontend Context

Frontend hiện tại:

- Framework: Vite + React + Tailwind CSS
- Entry chính: `frontend/src/app/App.tsx`
- Styles chính:
  - `frontend/src/styles/theme.css`
  - `frontend/src/styles/index.css`
  - `frontend/src/styles/tailwind.css`
- App hiện có các mode:
  - landing
  - connect Zalo
  - connect KiotViet
  - manage dashboard
  - `/user_chat`

Các màn chính cần đồng bộ:

- Landing page hiện tại
- Onboarding/connect Zalo
- Connect KiotViet
- Loading screens
- Dashboard shell
- Tổng quan
- Hộp thư
- Lịch hẹn
- Việc cần duyệt
- Quy trình tự động
- Kết nối hệ thống
- Vận chuyển
- Báo cáo
- Cài đặt
- User chat
- Modals
- Toast

---

## 3. Recommended Approach

### Approach: Landing-first, then UI sync

Làm landing page mới trước, dùng nó làm visual reference cho toàn bộ app. Sau đó đồng bộ UI hiện tại theo cùng token và component style.

Lý do:

- Landing page là bề mặt public quan trọng nhất.
- Landing định nghĩa rõ màu, typography, CTA, card, section rhythm.
- Dashboard hiện đã có logic demo, nên không nên rewrite cấu trúc ngay.
- Đồng bộ style trước giúp giảm rủi ro so với tách file/refactor sâu ngay từ đầu.

Không làm ngay:

- Không rewrite toàn bộ `App.tsx` thành nhiều module trong pass đầu.
- Không đổi flow demo/backend.
- Không đổi business logic.
- Không thêm route phức tạp nếu chưa cần.

---

## 4. Landing Page Plan

### 4.1. Landing Page Objective

Người xem cần hiểu trong 10-15 giây:

- Agentify là lớp AI vận hành cho SME Việt Nam.
- Agentify không thay thế Pancake/KiotViet/Sapo.
- Agentify tự xử lý workflow bán hàng và CSKH trên Zalo/Facebook.
- Sản phẩm có demo thật: shop dashboard và giao diện khách nhắn tin.

### 4.2. Proposed Page Structure

#### Section 1: Navigation

Nội dung tiếng Việt:

- Logo: Agentify
- Link: "Sản phẩm", "Cách hoạt động", "Tích hợp", "Bảng giá"
- CTA phụ: "Chat thử"
- CTA chính: "Mở demo shop"

Visual:

- Background `canvas`
- Text `ink`
- CTA chính salmon `primary`
- Không dùng nav dày hoặc nhiều menu cấp 2

#### Section 2: Hero

Headline tiếng Việt:

> Thêm một nhân viên AI vào đội bán hàng của bạn

Supporting copy:

> Agentify giúp shop bán qua Zalo và Facebook tự trả lời khách, kiểm tra tồn kho, tạo đơn, gửi thông tin vận chuyển và chăm sóc sau bán trên các hệ thống bạn đang dùng.

CTA:

- "Mở demo shop"
- "Chat như khách hàng"

Visual:

- Product mockup thật, không minh họa generic.
- Hiển thị luồng: khách nhắn Zalo -> AI hiểu ý định -> check KiotViet -> tạo đơn/vận đơn -> trả lời khách.
- Dùng salmon highlight cho AI action, blue-mint surface cho panel.

#### Section 3: Problem

Title:

> Bán hàng qua inbox vẫn còn quá thủ công

Cards:

- `300-500` tin nhắn mỗi ngày
- `30-50%` câu hỏi ngoài giờ hoặc giờ cao điểm bị bỏ lỡ
- `8-18M VND` chi phí mỗi nhân viên CS mỗi tháng

Copy:

> Pancake, KiotViet và Sapo giúp quản lý dữ liệu. Nhưng nhân viên vẫn phải đọc chat, check tồn, báo giá, tạo đơn và follow-up từng bước.

#### Section 4: Solution

Title:

> Agentify biến workflow thành hành động tự động

Steps:

1. Khách nhắn qua Zalo OA hoặc Facebook Page
2. AI hiểu intent và ngữ cảnh tiếng Việt
3. AI gọi dữ liệu từ POS/CRM/hệ thống lịch hẹn
4. AI tạo đơn, đặt lịch, gửi vận chuyển hoặc follow-up
5. Nhân viên chỉ xử lý case cần duyệt

#### Section 5: Product Demo Preview

Title:

> Một workflow chạy từ tin nhắn đến kết quả

Layout:

- Trái: khung chat khách hàng
- Giữa: danh sách hành động AI đã làm
- Phải: kết quả trong dashboard như đơn/lịch/vận đơn

CTA:

- "Xem demo vận hành"

#### Section 6: Integrations

Title:

> Giữ nguyên stack hiện tại

Tiles:

- Zalo OA
- Facebook Page
- KiotViet
- Sapo
- Pancake
- Đơn vị vận chuyển

Copy:

> Agentify nằm phía trên các hệ thống này để tự xử lý các bước lặp lại, không bắt shop thay đổi toàn bộ quy trình.

#### Section 7: Beachhead Use Case

Title:

> Bắt đầu từ mỹ phẩm, spa và salon

Cards:

- Tư vấn sản phẩm/dịch vụ
- Kiểm tra tồn kho hoặc lịch trống
- Tạo đơn hoặc đặt lịch
- Nhắc khách và chăm sóc sau bán

#### Section 8: Pricing

Title:

> Bảng giá dễ bắt đầu

Cards:

- Starter - `399k VND/tháng`
- Grow - `699k VND/tháng`
- Pro - `1,299k VND/tháng`

CTA trên từng card:

- Starter: "Dùng thử"
- Grow: "Chọn Grow"
- Pro: "Liên hệ triển khai"

#### Section 9: Final CTA

Title:

> Để AI xử lý phần lặp lại, đội của bạn tập trung vào khách quan trọng

CTA:

- "Mở demo shop"
- "Chat như khách hàng"

---

## 5. UI Synchronization Plan

### 5.1. Theme Tokens

Update `frontend/src/styles/theme.css` để map token hiện tại sang Agentify palette:

- `--primary`: `#e88080`
- `--primary-foreground`: `#fffefe`
- `--background`: `#fffefe`
- `--foreground`: `#201515`
- `--card`: `#fffefe`
- `--muted`: `#e8f0f0`
- `--accent`: `#f5caca`
- `--border`: `#c9d4d4`

Thêm semantic tokens nếu cần:

- success: `#3a8b73`
- warning: `#d58a2a`
- danger: `#b84646`

### 5.2. Shared Visual Rules

Apply toàn app:

- Primary buttons dùng salmon.
- Secondary buttons dùng ink.
- App background dùng blue-mint hoặc canvas.
- Active nav dùng salmon indicator hoặc salmon-soft background.
- Cards dùng `canvas` hoặc `canvas-soft`.
- Không dùng teal làm brand color.
- Blue chỉ dùng khi mô phỏng Zalo/Facebook hoặc trạng thái kênh thật.
- Warning/approval dùng warning/danger, không dùng coral brand nếu ý nghĩa là lỗi.

### 5.3. Landing Page Sync Targets

Update các component landing hiện có:

- `LandingPage`
- `HeroProductMockup`
- `LandingMiniStat`
- `ProblemCard`
- `SolutionStep`
- `MetricPill`

Thay đổi:

- Copy sang tiếng Việt.
- Thêm landing sections đầy đủ.
- Dùng logo `docs/logo.png` hoặc public asset tương ứng nếu app đã có asset logo.
- Đổi visual từ teal/slate sang salmon/blue-mint/ink.

### 5.4. Onboarding Screens

Update:

- `OnboardingScreen`
- `ZaloConnectScreen`
- `KiotVietConnectScreen`
- `ConnectionLoadingScreen`

Rules:

- Giữ flow hiện tại.
- Đổi background sang blue-mint/canvas.
- CTA chính salmon, secondary ink/outline.
- Zalo blue chỉ nằm trong logo/nút mô phỏng Zalo authorization, không thành brand color.
- Progress/loading dùng salmon.

### 5.5. Dashboard Shell

Update:

- sidebar
- topbar
- `NavItem`

Rules:

- Sidebar background `canvas`
- Active nav: salmon left indicator hoặc salmon-soft fill
- Topbar: clean, compact, ink text
- Workspace/status pill dùng salmon-soft hoặc success tùy ý nghĩa

### 5.6. Product Screens

Update từng screen:

- Overview: cards, stat colors, workflow timeline
- Inbox: filter chips, chat panel, AI action panel
- Calendar: appointment cards and status badges
- Approval: warning/danger hierarchy
- Workflows: play/pause states, progress bars
- Integrations: connected status and integration cards
- Shipping: tables and status badges
- Reports: charts and progress bars
- Settings: toggles, member cards
- UserChat: retain Zalo-like context but align Agentify-owned components

Rules:

- Không đổi dữ liệu demo hoặc API behavior.
- Không đổi route `/user_chat`.
- Không đổi các action callback hiện tại.

### 5.7. Modals & Toast

Update:

- `CreateWorkflowModal`
- `ConnectSystemModal`
- `EditConversationModal`
- `DemoModal`
- `Toast`

Rules:

- Modal surface `canvas`
- Backdrop giữ đơn giản
- Primary action salmon
- Dangerous action danger
- Toast dùng canvas + ink, accent salmon only for success/brand signal

---

## 6. Suggested Implementation Order

### Task 1: Confirm Design Tokens

- Ensure `DESIGN.md` is the source of truth.
- Confirm no remaining Zapier/orange references should influence implementation.
- Confirm landing page copy is Vietnamese.

### Task 2: Update Theme

- Update CSS variables in `frontend/src/styles/theme.css`.
- Add Agentify semantic variables if useful.
- Keep Tailwind compatibility.

### Task 3: Rebuild Landing Page

- Replace current two-card role chooser with full landing page.
- Preserve CTA behavior:
  - "Mở demo shop" -> current demo/onboarding flow
  - "Chat như khách hàng" -> `/user_chat`
- Use Vietnamese copy.
- Use product mockups based on existing demo.

### Task 4: Sync Onboarding Flow

- Apply Agentify palette and component rules to Zalo/KiotViet/loading screens.
- Keep flow logic unchanged.

### Task 5: Sync Dashboard Shell

- Update sidebar/topbar/nav active states.
- Ensure dashboard still feels like a work app, not a landing page.

### Task 6: Sync Core Screens

Priority order:

1. Overview
2. Inbox
3. Workflows
4. Integrations
5. Calendar
6. Shipping
7. Reports
8. Settings
9. Approval
10. UserChat

### Task 7: Sync Modals, Toast, Small Components

- Normalize cards/buttons/inputs/badges.
- Remove teal/slate/blue brand leftovers where inappropriate.

### Task 8: QA & Verification

Run:

- `npm run build`
- local dev server
- Playwright visual checks

Viewports:

- desktop landing
- mobile landing
- dashboard overview
- inbox
- onboarding
- `/user_chat`

Acceptance criteria:

- Landing page UI copy is Vietnamese.
- Brand colors match `docs/logo.png`.
- No Zapier orange remains in implementation.
- No generic teal brand surfaces remain.
- CTA behavior still works.
- Dashboard routes/screens still render.
- Text does not overlap on mobile or desktop.

---

## 7. Open Decisions Before Coding

1. Có giữ tagline tiếng Anh "Let AI run your sales operations." như một dòng phụ trong hero không?
2. Logo trong app nên dùng trực tiếp `docs/logo.png`, hay cần copy sang `frontend/public` với tên asset cố định?
3. Landing page nên mở đầu bằng use case beauty/spa/salon ngay, hay giữ positioning rộng cho SME social commerce rồi đưa beauty/spa/salon xuống section sau?

Recommendation:

- Giữ headline chính tiếng Việt.
- Tagline tiếng Anh chỉ đặt nhỏ dưới logo hoặc cuối hero nếu muốn.
- Copy logo sang public asset khi implement để frontend build truy cập ổn định.
- Hero nên nói rộng về SME social commerce, section use case mới đi sâu beauty/spa/salon.
