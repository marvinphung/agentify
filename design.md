# Thiết kế landing page Agentify

## Mục tiêu

Landing page cần giới thiệu Agentify trong 30-60 giây cho đối tác, mentor hoặc khách hàng pilot. Trang không chỉ đẹp mà phải làm rõ ngay ba ý:

1. SME Việt Nam đã có phần mềm quản lý nhưng công việc sales/chăm sóc khách hàng vẫn làm thủ công.
2. Agentify là nhân viên AI chạy trên hệ thống hiện có, không thay thế Pancake, KiotViet, Sapo hay Zalo OA.
3. Agentify tự hoàn thành các workflow đủ điều kiện như tư vấn, đặt lịch, tạo đơn, nhắc lịch, follow-up và chuyển ca rủi ro cho nhân viên.

## Hướng thiết kế

Phong cách: B2B SaaS cao cấp, rõ ràng, tin cậy, phù hợp để dùng trong pitch startup và gặp đối tác Việt Nam - Nhật Bản. Giao diện dùng tiếng Việt, tránh cảm giác chatbot phổ thông hoặc landing page AI chung chung.

Màu sắc:
- Nền trắng ngà và xanh rất nhạt để tạo cảm giác sạch, chuyên nghiệp.
- Xanh teal làm màu chính cho automation và trạng thái tích cực.
- Coral/cam dùng cho điểm nhấn về việc cần duyệt hoặc vấn đề vận hành.
- Chữ đen/xám đậm để đảm bảo dễ đọc.

Ngôn ngữ thị giác:
- Không dùng robot hoạt hình, mascot, blob gradient tím.
- Ưu tiên dashboard mockup, luồng hội thoại, thẻ KPI và sơ đồ workflow.
- Hero phải cho thấy sản phẩm ngay ở màn hình đầu tiên, không chỉ là slogan.

## Cấu trúc trang

### 1. Hero

Thông điệp chính:
“Giữ nguyên hệ thống hiện tại. Thêm một nhân viên AI để tự hoàn thành công việc.”

Nội dung phụ:
Agentify giúp doanh nghiệp bán hàng và dịch vụ tại Việt Nam tự động xử lý hội thoại, đặt lịch, tạo đơn và follow-up trên Zalo, Facebook và các hệ thống sẵn có.

CTA:
- “Xem demo sản phẩm”: chuyển vào dashboard prototype hiện có.
- “Tải pitch ngắn”: hiển thị phản hồi demo, chưa cần tải file thật.

Hero bên phải là mockup command center nhỏ:
- 248 hội thoại hôm nay
- 176 hội thoại AI tự xử lý
- 38 lịch hẹn đã tạo
- 11 việc cần duyệt
- Một luồng chat Zalo ngắn dẫn đến đặt lịch.

### 2. Vấn đề

Các thẻ số liệu:
- 300-500 tin nhắn mỗi ngày
- 30-50% khách có thể bị bỏ sót ngoài giờ cao điểm
- 8-18M VND/tháng cho một nhân sự chăm sóc khách hàng

Thông điệp:
SME không thiếu phần mềm. Họ thiếu một lớp thực thi tự động trên phần mềm đã có.

### 3. Agentify làm gì

Trình bày thành ba bước:
1. Hiểu hội thoại tiếng Việt.
2. Gọi dữ liệu và công cụ trên stack hiện có.
3. Hoàn thành workflow và báo kết quả.

Ví dụ workflow:
Khách hỏi dịch vụ -> AI tư vấn -> kiểm tra lịch -> đặt lịch -> gửi xác nhận -> nhắc lịch -> chuyển ca rủi ro cho nhân viên.

### 4. Tích hợp

Hiển thị các hệ thống quen thuộc:
- Zalo OA
- Facebook
- KiotViet
- Sapo
- Pancake
- Lịch Google

Thông điệp:
Agentify là lớp AI trung lập với vendor, chạy bên trên stack hiện có.

### 5. Beachhead

Tập trung ngành beauty / spa / clinic vì có nhiều lead, workflow đặt lịch rõ ràng, no-show và missed follow-up gây mất doanh thu trực tiếp.

KPI hiển thị:
- booking rate
- show-up rate
- response time
- lead recovery rate
- tỷ lệ workflow AI xử lý trọn vẹn

### 6. CTA cuối

Thông điệp:
“Bắt đầu bằng một workflow hẹp. Tự động hóa trọn vẹn. Mở rộng dần tới vận hành tự động.”

CTA:
- “Xem demo sản phẩm”
- “Trao đổi pilot”

## Hành vi tương tác

- Landing page là màn hình đầu tiên khi mở app.
- Nút “Xem demo sản phẩm” không đi thẳng vào dashboard. Nút này mở luồng onboarding kết nối hệ thống để video demo có câu chuyện rõ hơn.
- Luồng onboarding theo thứ tự:
  1. Kết nối Zalo OA.
  2. Hiển thị màn hình loading chính giữa trong 3 giây, sau đó coi như kết nối thành công.
  3. Kết nối KiotViet.
  4. Hiển thị màn hình loading chính giữa trong 3 giây, sau đó coi như kết nối thành công.
  5. Kết nối Lịch Google là bước tuỳ chọn. Người dùng có thể bấm “Kết nối Lịch Google” hoặc “Bỏ qua bước này”.
  6. Sau bước Calendar, chuyển vào dashboard prototype hiện tại.
- Nút “Tải pitch ngắn” và “Trao đổi pilot” hiển thị toast demo.
- Trong dashboard có thêm nút quay lại landing để tiện demo.

## Phạm vi triển khai

Triển khai trong `frontend/src/app/App.tsx` để tận dụng app hiện có. Không thêm backend. Không thay đổi các màn hình dashboard đã hoạt động, chỉ bọc thêm landing page và các CTA điều hướng.
