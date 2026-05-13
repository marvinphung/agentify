## **1. Tổng quan dự án**

**Tên dự án:** Agentify

**Positioning mới:** Agentify là **AI Agent Platform** giúp doanh nghiệp SME Việt Nam tự động hóa hoàn toàn luồng bán hàng và chăm sóc khách hàng trên Zalo OA và Facebook — từ trả lời câu hỏi, tra đơn hàng, đặt lịch, đến tạo đơn và gửi xác nhận — bằng cách kết nối trực tiếp với các nền tảng nội địa như KiotViet, Sapo, Pancake, MISA mà không cần lập trình.

**Khác biệt cốt lõi so với chatbot thông thường:**
- Chatbot thông thường: **trả lời câu hỏi** → người dùng vẫn phải tự xử lý đơn hàng, CRM.
- Agentify AI Agent: **hiểu intent → gọi tool → thực hiện hành động → phản hồi** → toàn bộ workflow tự động end-to-end.

---

## **2. Problem & Painpoint**

### **2.1. Vấn đề thực tế**

Social commerce (bán hàng qua Facebook, Zalo) là kênh bán hàng chủ lực của hàng triệu SME Việt Nam. Tuy nhiên, toàn bộ luồng vận hành vẫn là **thủ công 100%**:

| Workflow hiện tại | Người làm | Vấn đề |
|-------------------|-----------|--------|
| Trả lời hỏi giá, hỏi hàng trên Zalo/Facebook | Nhân viên CSKH | Lặp đi lặp lại, tốn 4-6h/ngày |
| Check tồn kho trong KiotViet/Sapo | Nhân viên kho | Phải mở phần mềm riêng, trả lời chậm |
| Ghi nhận đơn hàng từ tin nhắn | Nhân viên sale | Hay nhầm, thiếu thông tin, không lưu CRM |
| Gửi xác nhận đơn / cập nhật trạng thái | Nhân viên CSKH | Thủ công, chậm, quên nhiều |
| Đặt lịch tư vấn, nhắc lịch | Nhân viên admin | Sai lịch, thiếu reminder |

**Hậu quả đo được:**
- Một SME bán hàng qua social commerce nhận trung bình **100–300 tin nhắn/ngày** trên Zalo + Facebook.
- Một nhân viên CSKH xử lý được ~80–100 tin/ngày → mỗi SME cần ít nhất **1–3 nhân viên chỉ để trả lời tin nhắn**.
- Chi phí nhân sự CSKH: **8–18 triệu VND/tháng/người** (lương + BHXH + đào tạo).
- Tỷ lệ bỏ lỡ tin nhắn ngoài giờ hoặc giờ cao điểm: **30–50%** → mất khách trực tiếp.
- Tỷ lệ ghi nhận đơn sai do thủ công: **10–20%** → hoàn đơn, khiếu nại.

### **2.2. Tại sao chưa có giải pháp?**

- **Chatbot scripted (Subiz, BotBan, Hana):** Chỉ trả lời câu hỏi theo kịch bản cứng, không thể tra KiotViet, không tạo được đơn, không gửi ZNS.
- **FPT AI:** Hướng enterprise lớn, chatbot NLP nhưng không có agentic workflow, không tích hợp sâu với KiotViet/Sapo/Pancake.
- **Global tools (Make.com, Zapier, Relevance AI):** Không có Zalo OA, không có connector KiotViet/Sapo/MISA, tiếng Anh, USD pricing.
- **Tự xây:** Cần đội dev 3–6 người, mất 6–12 tháng, chi phí 500 triệu – 2 tỷ VND.

**Kết luận: Không có sản phẩm nào trên thị trường Việt Nam hiện tại có thể tự động hóa end-to-end workflow bán hàng qua Zalo/Facebook, kết nối với KiotViet/Sapo/Pancake, dùng AI để hiểu ngôn ngữ tự nhiên tiếng Việt.**

---

## **3. Market Research**

### **3.1. Thị trường mục tiêu (TAM–SAM–SOM)**

**TAM — Social commerce + AI automation, Việt Nam**
- Việt Nam có **~900.000 SME** đăng ký chính thức + ~5–6 triệu hộ kinh doanh cá thể.
- **68% SME Việt Nam** bán hàng qua Facebook/Zalo là kênh chính hoặc phụ (nguồn: Ipsos, Meta Vietnam 2023).
- Chi phí nhân sự CSKH bình quân: **12 triệu VND/tháng/nhân viên** × trung bình 1.5 nhân viên/doanh nghiệp = **~18 triệu VND/tháng**.
- Nếu Agentify thay thế được 50% công việc này, **willingness to pay** ước tính **3–8 triệu VND/tháng** (17–44% chi phí hiện tại).
- **TAM ước tính:** 900.000 × 68% × 3M VND/tháng = **~18.360 tỷ VND/năm (~720M USD/năm)**.

**SAM — SME có digital stack (Zalo OA + KiotViet/Sapo/Pancake)**
- KiotViet: ~120.000 merchant hoạt động.
- Sapo: ~100.000 merchant hoạt động.
- Pancake: ~50.000 người dùng active (social commerce manager).
- Overlap và tổng target có digital stack: ước tính **150.000–200.000 doanh nghiệp**.
- **SAM ước tính:** 200.000 × 3M VND/tháng × 12 = **~7.200 tỷ VND/năm (~280M USD/năm)**.

**SOM — 2 năm đầu**
- Beachhead: SME bán hàng qua Zalo OA, đang dùng KiotViet hoặc Pancake, có 1–5 nhân viên CSKH.
- Mục tiêu 12 tháng: **1.000 khách hàng trả phí** ở mức trung bình **2M VND/tháng**.
- **SOM Year 1:** 1.000 × 2M × 12 = **24 tỷ VND/năm (~960K USD/năm)**.
- **SOM Year 2:** 5.000 × 2.5M × 12 = **150 tỷ VND/năm (~6M USD/năm)**.

### **3.2. Xu hướng thị trường hỗ trợ**

- **Zalo:** 75M+ người dùng tại Việt Nam; Zalo OA đang mở rộng tính năng API cho doanh nghiệp (ZNS, Mini App).
- **KiotViet** đang mở rộng REST API và webhook → window of opportunity để xây integration trước khi họ tự làm.
- **Agentic AI toàn cầu:** Thị trường AI agent toàn cầu dự báo tăng từ $5.1B (2024) lên $47B (2030), CAGR ~45% (Grand View Research, 2024).
- **Social commerce SEA:** Dự báo đạt $89B vào 2028, Việt Nam là thị trường tăng trưởng nhanh nhất khu vực (Momentum Works, 2024).

---

## **4. Target User**

### **Primary Target: SME Social Commerce Owner**

**Chân dung cụ thể:**
- **Ai:** Chủ shop online hoặc quản lý vận hành, 25–45 tuổi, tại TP.HCM / Hà Nội / Đà Nẵng.
- **Kênh bán:** Facebook Page + Zalo OA là kênh chính; có thể thêm TikTok Shop, Shopee.
- **Hệ thống đang dùng:** KiotViet hoặc Sapo (quản lý kho/đơn), Pancake hoặc Hana (inbox unified), Zalo ZNS (thông báo đơn hàng).
- **Quy mô:** 2–20 nhân viên; có 1–3 người chuyên trả lời inbox.
- **Ngành:** Thời trang, mỹ phẩm, thực phẩm, nội thất, phụ kiện, dịch vụ (spa, trung tâm đào tạo).
- **Pain:** Tốn nhân sự trả lời câu hỏi lặp, bỏ lỡ tin ngoài giờ, ghi đơn sai, không follow-up được lead.
- **Willingness to pay:** 1.5–5M VND/tháng nếu thay được 1 nhân viên.

### **Secondary Target: Marketing Agency**

- **Ai:** Agency digital marketing / social media, quản lý 10–50 brand/fanpage.
- **Pain:** Cần deploy chatbot AI cho nhiều client nhanh, không có white-label solution ở Việt Nam.
- **Model:** Dùng Agentify white-label, charge client 2–5M VND/tháng, margin 50–70%.

---

## **5. Solution & Product**

### **5.1. Cách Agentify hoạt động**

```
Khách hàng nhắn tin Zalo OA / Facebook Messenger
        ↓
Agentify AI Agent (LLM + tool-use)
        ↓ hiểu intent (hỏi giá / check đơn / đặt hàng / đặt lịch)
        ↓ gọi tool phù hợp (KiotViet API / Sapo API / Calendar API)
        ↓ thực hiện action (tạo đơn / check tồn kho / book lịch)
        ↓ phản hồi tiếng Việt tự nhiên
        ↓ gửi ZNS xác nhận nếu cần
Nhân viên chỉ cần xử lý các case phức tạp (escalation)
```

### **5.2. Các workflow tự động hóa (MVP)**

| Workflow | Input | Action | Output |
|----------|-------|--------|--------|
| **Hỏi sản phẩm / giá** | Tin nhắn Zalo/FB | Query KiotViet catalog | Trả lời giá, mô tả, ảnh |
| **Check tồn kho** | "Còn hàng không?" | Call KiotViet stock API | "Còn 5 sản phẩm, giao trong 2 ngày" |
| **Tạo đơn hàng** | Khách xác nhận mua | Tạo order trong KiotViet/Sapo | Order created + gửi ZNS xác nhận |
| **Check trạng thái đơn** | "Đơn của tôi đến đâu rồi?" | Query order status | Trả lời realtime |
| **Đặt lịch tư vấn** | "Tôi muốn đặt lịch thứ 6" | Tạo event + ghi vào CRM | Confirm lịch + reminder ZNS |
| **Escalate to human** | Câu hỏi phức tạp | Chuyển sang inbox nhân viên | Thông báo handoff có context |

### **5.3. Integration layer (Middleware core)**

| Nền tảng | Loại tích hợp | MVP |
|----------|--------------|-----|
| **Zalo OA** | Inbound message, ZNS, profile | ✅ |
| **Facebook Messenger** | Inbound message, comment-to-DM | ✅ |
| **KiotViet** | Orders, products, inventory, customers | ✅ |
| **Sapo** | Orders, products, inventory | ✅ |
| **Pancake** | Unified inbox sync, order management | Q2 |
| **MISA SME** | Invoice creation from orders | Q3 |
| **GetFly / Base.vn** | Lead creation, CRM update | Q3 |

### **5.4. Setup no-code cho SME**

1. Kết nối Zalo OA / Facebook Page (OAuth).
2. Kết nối KiotViet / Sapo (API key).
3. Chọn các workflow muốn tự động hóa.
4. Test trong 10 phút.
5. Go live.

---

## **6. 10 Câu hỏi Business Model**

### **Q1: Bạn đang giải quyết vấn đề gì và ai đang gặp vấn đề đó?**

SME Việt Nam bán hàng qua Zalo/Facebook đang lãng phí **8–18 triệu VND/tháng** cho nhân sự trả lời câu hỏi lặp và xử lý đơn hàng thủ công, với tỷ lệ bỏ lỡ tin nhắn 30–50% và sai đơn 10–20%. Vấn đề này ảnh hưởng trực tiếp đến **150.000–200.000 SME** đang dùng KiotViet/Sapo và bán qua Zalo/Facebook.

### **Q2: Thị trường lớn đến đâu?**

- **SAM tại Việt Nam:** ~280M USD/năm (200.000 SME × $1.400/năm ARPU).
- **SOM Year 1:** ~1M USD ARR (1.000 khách).
- **SOM Year 2:** ~6M USD ARR (5.000 khách).
- Thị trường social commerce SEA dự báo $89B vào 2028 → AI automation layer là cơ hội tất yếu.

### **Q3: Giải pháp hoạt động thế nào? Tại sao tốt hơn hiện tại?**

Agentify là AI Agent có khả năng **tự suy luận và thực hiện hành động** (không phải chatbot kịch bản cứng). Agent kết nối trực tiếp với KiotViet/Sapo qua API để tra hàng, tạo đơn, gửi ZNS — toàn bộ trong 1 luồng tự động không cần con người. Không có sản phẩm nào trên thị trường Việt Nam hiện tại có thể làm điều này.

### **Q4: Bạn kiếm tiền như thế nào?**

**Revenue streams:**

| Tier | Đối tượng | Giá | Giới hạn |
|------|-----------|-----|----------|
| **Starter** | SME nhỏ | 990K VND/tháng | 1 kênh, 500 conversations/tháng |
| **Growth** | SME vừa | 2.5M VND/tháng | 3 kênh, 3.000 conversations/tháng, 2 integration |
| **Scale** | SME lớn | 5M VND/tháng | Unlimited kênh, 15.000 conversations, full integrations |
| **Agency** | Marketing agency | 8M VND/tháng | White-label, 20 client accounts |

**Overage:** 500 VND/conversation vượt gói.
**Add-on:** Tích hợp MISA, custom API: 1–2M VND/tháng.

**Target blended ARPU:** ~2M VND/tháng (~80 USD).

### **Q5: Đối thủ cạnh tranh là ai và bạn thắng thế nào?**

| Đối thủ | Họ có gì | Họ thiếu gì | Agentify thắng ở đâu |
|---------|----------|-------------|----------------------|
| FPT AI | NLP tiếng Việt, brand lớn | Không có agentic workflow, không tích hợp KiotViet/Sapo, enterprise-only | Agentic action-taking + SME pricing |
| Subiz / BotBan | Chatbot scripted | Không có AI agent, không tích hợp POS | True AI agent + KiotViet/Sapo native |
| Make.com / Zapier | Automation mạnh | Không có Zalo OA, không có KiotViet/Sapo/Pancake, tiếng Anh | Vietnamese-native integrations |
| Relevance AI | AI agent mạnh nhất | Không có Zalo, không có VN platforms, $USD | Localized for Vietnam |
| GoHighLevel | White-label tốt | $297/tháng USD, không có Zalo | VND pricing + Zalo native |

**Moat:** Độ sâu tích hợp với nền tảng Việt Nam — mỗi integration mất 2–4 tháng để build và maintain, tạo switching cost cao cho cả Agentify lẫn khách hàng.

### **Q6: Lợi thế bất đối xứng (Unfair Advantage) là gì?**

1. **Integration-first:** Build sâu KiotViet/Sapo/Zalo OA trước khi bất kỳ global player nào vào Việt Nam.
2. **Founder market fit:** Hiểu luồng vận hành social commerce Việt Nam từ thực tế, không phải lý thuyết.
3. **Timing:** Zalo OA đang mở API; KiotViet đang mở webhook → window of opportunity trong 12–18 tháng.
4. **Distribution qua agency:** Mỗi agency là multiplier × 20–50 end clients → growth không tuyến tính.
5. **Data moat:** Sau 6–12 tháng, Agentify có dataset về hàng nghìn workflow bán hàng Việt Nam → fine-tune model tốt hơn bất kỳ global player nào.

### **Q7: Bạn tiếp cận khách hàng thế nào?**

**Giai đoạn 0–3 tháng (10 khách đầu tiên):**
- Direct outreach đến chủ shop trong cộng đồng Facebook (Kinh doanh online, Group KiotViet Users ~200K members).
- Demo live: "Xem AI agent tự tạo đơn từ tin nhắn Zalo trong 30 giây" — visual, shareable, viral potential.
- Offer: Dùng thử 30 ngày miễn phí, setup miễn phí cho 10 khách đầu.

**Giai đoạn 3–12 tháng:**
- **Agency channel:** 5–10 agency partner → mỗi agency deploy cho 10–30 client → 50–300 clients từ kênh này.
- **KiotViet / Sapo partner program:** Xuất hiện trên marketplace/partner directory của họ → inbound leads.
- **Content marketing:** Video "Tôi để AI agent chạy Zalo OA 1 tuần" → seeding trong cộng đồng chủ shop.

**CAC mục tiêu:** < 1M VND (< 1 tháng ARPU ở tier Growth).

### **Q8: Unit Economics trông như thế nào?**

| Chỉ số | Giá trị mục tiêu |
|--------|-----------------|
| **ARPU** | 2M VND/tháng (~80 USD) |
| **CAC** | < 1M VND (outreach + content) |
| **LTV** (churn 3%/tháng, 33 tháng) | ~66M VND |
| **LTV/CAC** | > 60x |
| **Gross Margin** | ~75–80% (LLM API cost ~15–20% of revenue) |
| **Payback period** | < 1 tháng |

**Chi phí vận hành chính:**
- LLM API (Claude/GPT-4o): ~10–15% revenue.
- Infrastructure (hosting, DB, queue): ~5% revenue.
- Team: 2 founders + 1–2 engineer Year 1.

### **Q9: Rủi ro chính và cách giảm thiểu?**

| Rủi ro | Xác suất | Giảm thiểu |
|--------|----------|------------|
| KiotViet/Sapo thay đổi API | Trung bình | Xây abstraction layer; maintain relationship với họ; đa dạng hóa integration |
| Zalo API bị hạn chế thêm | Trung bình | Zalo cần partner doanh nghiệp → trở thành official partner sớm |
| FPT AI clone sản phẩm | Thấp | FPT AI hướng enterprise; SME không phải thị trường họ muốn |
| LLM cost tăng cao | Thấp | Cache responses; fine-tune model nhỏ hơn cho workflow cụ thể |
| Churn cao do SME ít ngân sách | Cao | Focus vào ROI rõ ràng: "Agent này thay thế 1 nhân viên 10M/tháng, bạn trả 2.5M" |

### **Q10: Roadmap 12 tháng đầu trông như thế nào?**

| Giai đoạn | Thời gian | Mục tiêu |
|-----------|-----------|----------|
| **MVP** | Tháng 1–2 | Agent Zalo OA + KiotViet: check hàng, tạo đơn, check trạng thái. 10 khách beta. |
| **Channel mở rộng** | Tháng 3–4 | Thêm Facebook Messenger + Sapo integration. Gói pricing chính thức. 50 khách. |
| **Agency & Pancake** | Tháng 5–6 | White-label cho agency. Tích hợp Pancake. 5 agency partners = 100+ end clients. |
| **Tăng trưởng** | Tháng 7–9 | KiotViet/Sapo marketplace listing. Content seeding. 300–500 khách trả phí. |
| **Scale & MISA** | Tháng 10–12 | MISA integration. Advanced analytics. 1.000 khách trả phí. ARR ~24 tỷ VND. |

---

## **7. Competitive Landscape (Updated)**

### **Ma trận định vị**

| | Agentic AI | Zalo OA Native | KiotViet/Sapo | SME Pricing VND | White-label |
|--|:--:|:--:|:--:|:--:|:--:|
| **Agentify** | ✅ | ✅ | ✅ | ✅ | ✅ |
| FPT AI | ❌ | ✅ | ❌ | ❌ (Enterprise) | ❌ |
| Subiz / BotBan | ❌ | Partial | ❌ | ✅ | ❌ |
| OnCustomer | ❌ | ✅ | ❌ | ✅ | ❌ |
| Pancake | ❌ | ✅ | Partial | ✅ | ❌ |
| Make.com | Partial | ❌ | ❌ | ❌ (USD) | ❌ |
| Relevance AI | ✅ | ❌ | ❌ | ❌ (USD) | ❌ |
| GoHighLevel | ❌ | ❌ | ❌ | ❌ (USD) | ✅ |

**Kết luận: Agentify là sản phẩm duy nhất đạt đủ 5 tiêu chí cho thị trường SME Việt Nam.**

---

## **8. Go-to-Market Strategy**

### **Beachhead market cụ thể**

**Nhóm 1 (tháng 1–3):** Shop thời trang / mỹ phẩm online, 5–20 nhân viên, đang dùng KiotViet + Zalo OA, có 1–2 nhân viên CSKH. Đây là nhóm đau nhất với volume tin nhắn cao và sản phẩm có thể demo trực quan.

**Nhóm 2 (tháng 3–6):** Agency marketing quản lý 10+ fanpage. Một agency = 10–50 end clients ngay lập tức.

**Nhóm 3 (tháng 6–12):** Dịch vụ có lịch hẹn (spa, trung tâm đào tạo, phòng khám nhỏ) — workflow đặt lịch qua Zalo là cao giá trị.

### **Kênh phân phối**

1. **Community outreach:** Group Facebook "Kinh doanh online Việt Nam" (2M+ members), Group KiotViet Users, Group Zalo OA Business.
2. **Demo video viral:** "AI agent tự đặt đơn từ tin nhắn Zalo" — 30 giây, không cần giải thích dài.
3. **Agency partner:** Revenue share 20% cho agency giới thiệu khách.
4. **Platform marketplace:** KiotViet App Store / Sapo App Market (target Q3).

---

## **9. Founder Market Fit**

**Founder:** Trần Quốc Việt Quang | **Co-Founder:** Phùng Minh Vũ

**Unfair advantage của founding team:**
- Hiểu sâu kỹ thuật: RAG, LLM agent, API integration, SaaS architecture.
- Hiểu thực tế vận hành social commerce tại Việt Nam: Zalo OA, KiotViet, Pancake workflow.
- Mạng lưới SME và agency sẵn có → có thể có 10 khách beta trong tháng đầu.
- Không cần dạy thị trường — bán ROI rõ ràng: "Thay 1 nhân viên CSKH 12M/tháng bằng 2.5M/tháng."

**Timing advantage:** Zalo OA đang mở API, KiotViet mở webhook, thị trường AI agent global đang tăng tốc nhưng chưa có player nào vào đúng niche này tại Việt Nam. **Window of opportunity: 12–18 tháng.**

---

*Link giao diện (MVP mockup): [https://cube-fifth-48565985.figma.site](https://cube-fifth-48565985.figma.site)*
