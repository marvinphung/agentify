import { useState, useEffect } from 'react';
import {
  MessageSquare,
  ArrowRight,
  Check,
  ChevronRight,
  Zap,
  ShoppingBag,
  CalendarCheck,
  Package,
  HeartHandshake,
  Menu,
  X,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Landing Page — Agentify
   Vietnamese copy, salmon brand, blue-mint surface
   ───────────────────────────────────────────── */

export default function LandingPage({
  onEnterDemo,
  onEnterChat,
}: {
  onEnterDemo: () => void;
  onEnterChat: () => void;
}) {
  return (
    <div className="landing-root">
      <NavBar onEnterDemo={onEnterDemo} onEnterChat={onEnterChat} />
      <HeroSection onEnterDemo={onEnterDemo} onEnterChat={onEnterChat} />
      <ProblemSection />
      <SolutionSection />
      <DemoPreviewSection onEnterDemo={onEnterDemo} />
      <IntegrationSection />
      <BeachheadSection />
      <PricingSection />
      <FinalCTASection onEnterDemo={onEnterDemo} onEnterChat={onEnterChat} />
      <Footer />
    </div>
  );
}

/* ─── SECTION 1: NAV ─── */

function NavBar({
  onEnterDemo,
  onEnterChat,
}: {
  onEnterDemo: () => void;
  onEnterChat: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Sản phẩm', href: '#solution' },
    { label: 'Cách hoạt động', href: '#demo' },
    { label: 'Tích hợp', href: '#integrations' },
    { label: 'Bảng giá', href: '#pricing' },
  ];

  return (
    <nav
      className={`landing-nav ${scrolled ? 'landing-nav--scrolled' : ''}`}
      id="landing-nav"
    >
      <div className="landing-container landing-nav__inner">
        <a href="#" className="landing-nav__logo" aria-label="Agentify home">
          <img
            src="/agentify-logo.png"
            alt="Agentify"
            className="landing-nav__logo-img"
          />
          <span className="landing-nav__logo-text">Agentify</span>
        </a>

        <div className="landing-nav__links">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="landing-nav__link">
              {l.label}
            </a>
          ))}
        </div>

        <div className="landing-nav__actions">
          <button
            onClick={onEnterChat}
            className="landing-btn landing-btn--outline landing-btn--sm"
          >
            Chat thử
          </button>
          <button
            onClick={onEnterDemo}
            className="landing-btn landing-btn--primary landing-btn--sm"
          >
            Dùng cho shop
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="landing-nav__hamburger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="landing-nav__mobile">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="landing-nav__mobile-link"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="landing-nav__mobile-actions">
            <button
              onClick={() => {
                setMobileOpen(false);
                onEnterChat();
              }}
              className="landing-btn landing-btn--outline"
            >
              Chat thử
            </button>
            <button
              onClick={() => {
                setMobileOpen(false);
                onEnterDemo();
              }}
              className="landing-btn landing-btn--primary"
            >
              Dùng cho shop
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── SECTION 2: HERO ─── */

function HeroSection({
  onEnterDemo,
  onEnterChat,
}: {
  onEnterDemo: () => void;
  onEnterChat: () => void;
}) {
  return (
    <section className="landing-hero" id="hero">
      <div className="landing-container landing-hero__inner">
        <div className="landing-hero__content">
          <div className="landing-eyebrow">
            <Zap size={14} />
            AI vận hành cho SME Việt Nam
          </div>
          <h1 className="landing-hero__headline">
            Thêm một nhân viên AI
            <br />
            vào đội bán hàng của bạn
          </h1>
          <p className="landing-hero__sub">
            Agentify giúp shop bán qua Zalo và Facebook tự trả lời khách, kiểm
            tra tồn kho, tạo đơn, gửi thông tin vận chuyển và chăm sóc sau bán
            — trên các hệ thống bạn đang dùng.
          </p>
          <div className="landing-hero__cta-row">
            <button
              onClick={onEnterDemo}
              className="landing-btn landing-btn--primary"
            >
              Dùng cho shop
              <ArrowRight size={18} />
            </button>
            <button
              onClick={onEnterChat}
              className="landing-btn landing-btn--secondary"
            >
              Chat thử
              <MessageSquare size={18} />
            </button>
          </div>
        </div>

        {/* Hero visual — workflow mockup */}
        <div className="landing-hero__visual">
          <HeroWorkflowMockup />
        </div>
      </div>
    </section>
  );
}

function HeroWorkflowMockup() {
  const steps = [
    {
      icon: '💬',
      label: 'Khách nhắn Zalo',
      detail: '"Em ơi kem chống nắng nào phù hợp da dầu?"',
      color: 'blue',
    },
    {
      icon: '🧠',
      label: 'AI hiểu ý định',
      detail: 'Tư vấn sản phẩm – Da dầu – Kem chống nắng',
      color: 'salmon',
    },
    {
      icon: '📦',
      label: 'Check KiotViet',
      detail: 'SkinPure SPF50 – Còn 48 hộp – 235,000đ',
      color: 'mint',
    },
    {
      icon: '✅',
      label: 'Tạo đơn & vận đơn',
      detail: 'Đơn #1204 – GHN – Giao nhanh 2 ngày',
      color: 'salmon',
    },
    {
      icon: '📨',
      label: 'Trả lời khách',
      detail: 'Đã tạo đơn, mã vận đơn GHN: A12B3C',
      color: 'green',
    },
  ];

  return (
    <div className="hero-mockup">
      <div className="hero-mockup__header">
        <div className="hero-mockup__dot hero-mockup__dot--salmon" />
        <span className="hero-mockup__title">Workflow AI đang xử lý</span>
        <div className="hero-mockup__badge">Live</div>
      </div>
      <div className="hero-mockup__steps">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`hero-mockup__step hero-mockup__step--${s.color}`}
            style={{ animationDelay: `${i * 0.12}s` }}
          >
            <div className="hero-mockup__step-icon">{s.icon}</div>
            <div className="hero-mockup__step-body">
              <div className="hero-mockup__step-label">{s.label}</div>
              <div className="hero-mockup__step-detail">{s.detail}</div>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight
                size={14}
                className="hero-mockup__step-arrow"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SECTION 3: PROBLEM ─── */

function ProblemSection() {
  const problems = [
    {
      value: '300–500',
      unit: 'tin nhắn/ngày',
      desc: 'Nhân viên trả lời lặp đi lặp lại các câu hỏi giá, tồn kho và lịch hẹn.',
    },
    {
      value: '30–50%',
      unit: 'bị bỏ lỡ',
      desc: 'Câu hỏi ngoài giờ hoặc giờ cao điểm không được phản hồi kịp thời.',
    },
    {
      value: '8–18M',
      unit: 'VND/tháng',
      desc: 'Chi phí trung bình cho mỗi nhân viên CSKH toàn thời gian.',
    },
  ];

  return (
    <section className="landing-section landing-section--cream" id="problem">
      <div className="landing-container">
        <div className="landing-section__header">
          <div className="landing-eyebrow">Vấn đề</div>
          <h2 className="landing-section__title">
            Bán hàng qua inbox vẫn còn quá thủ công
          </h2>
          <p className="landing-section__desc">
            Pancake, KiotViet và Sapo giúp quản lý dữ liệu. Nhưng nhân viên vẫn
            phải đọc chat, check tồn, báo giá, tạo đơn và follow-up từng bước.
          </p>
        </div>

        <div className="landing-grid landing-grid--3">
          {problems.map((p, i) => (
            <div key={i} className="problem-card">
              <div className="problem-card__value">
                {p.value}
                <span className="problem-card__unit">{p.unit}</span>
              </div>
              <p className="problem-card__desc">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 4: SOLUTION ─── */

function SolutionSection() {
  const steps = [
    {
      num: '01',
      title: 'Khách nhắn qua Zalo OA hoặc Facebook Page',
      desc: 'Tin nhắn đổ về Agentify tự động, không cần chuyển app.',
    },
    {
      num: '02',
      title: 'AI hiểu intent và ngữ cảnh tiếng Việt',
      desc: 'Xác định ý định: mua hàng, đặt lịch, hỏi giá, khiếu nại…',
    },
    {
      num: '03',
      title: 'AI gọi dữ liệu từ POS/CRM/lịch hẹn',
      desc: 'Truy vấn KiotViet, Sapo hoặc hệ thống nội bộ theo thời gian thực.',
    },
    {
      num: '04',
      title: 'AI tạo đơn, đặt lịch, gửi vận chuyển',
      desc: 'Tự động hoàn tất hành động mà trước đây nhân viên phải làm thủ công.',
    },
    {
      num: '05',
      title: 'Nhân viên chỉ xử lý case cần duyệt',
      desc: 'Các tình huống rủi ro hoặc phức tạp sẽ được chuyển cho con người.',
    },
  ];

  return (
    <section className="landing-section landing-section--white" id="solution">
      <div className="landing-container">
        <div className="landing-section__header">
          <div className="landing-eyebrow">Giải pháp</div>
          <h2 className="landing-section__title">
            Agentify biến workflow thành hành động tự động
          </h2>
        </div>

        <div className="solution-steps">
          {steps.map((s, i) => (
            <div key={i} className="solution-step">
              <div className="solution-step__num">{s.num}</div>
              <div className="solution-step__body">
                <h3 className="solution-step__title">{s.title}</h3>
                <p className="solution-step__desc">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 5: DEMO PREVIEW ─── */

function DemoPreviewSection({ onEnterDemo }: { onEnterDemo: () => void }) {
  return (
    <section className="landing-section landing-section--ink" id="demo">
      <div className="landing-container">
        <div className="landing-section__header landing-section__header--light">
          <div className="landing-eyebrow landing-eyebrow--light">
            Demo sản phẩm
          </div>
          <h2 className="landing-section__title landing-section__title--light">
            Một workflow chạy từ tin nhắn đến kết quả
          </h2>
        </div>

        <div className="demo-preview">
          {/* Left: chat */}
          <div className="demo-preview__panel demo-preview__panel--chat">
            <div className="demo-preview__panel-header">
              <MessageSquare size={16} />
              Khung chat khách hàng
            </div>
            <div className="demo-chat-bubble demo-chat-bubble--customer">
              Em ơi đặt cho chị 2 serum vitamin C, giao tới 12 Nguyễn Trãi
            </div>
            <div className="demo-chat-bubble demo-chat-bubble--ai">
              Dạ chị, em kiểm tra tồn kho và tạo đơn luôn ạ. Serum Vitamin C
              30ml hiện còn 24 hộp, giá 320,000đ/hộp.
            </div>
            <div className="demo-chat-bubble demo-chat-bubble--ai">
              Đã tạo đơn #1204, tổng 640,000đ. Mã vận đơn GHN: A12B3C. Giao
              nhanh dự kiến trong 2 ngày ạ!
            </div>
          </div>

          {/* Center: actions */}
          <div className="demo-preview__panel demo-preview__panel--actions">
            <div className="demo-preview__panel-header">
              <Zap size={16} />
              Hành động AI
            </div>
            <DemoAction
              label="Hiểu ý định"
              detail="Đặt hàng + giao hàng"
              status="done"
            />
            <DemoAction
              label="Tìm sản phẩm"
              detail="Serum Vitamin C 30ml"
              status="done"
            />
            <DemoAction
              label="Kiểm tra tồn kho"
              detail="Còn 24 hộp"
              status="done"
            />
            <DemoAction
              label="Tạo đơn KiotViet"
              detail="Đơn #1204"
              status="done"
            />
            <DemoAction
              label="Gửi vận đơn GHN"
              detail="Mã A12B3C"
              status="done"
            />
          </div>

          {/* Right: result */}
          <div className="demo-preview__panel demo-preview__panel--result">
            <div className="demo-preview__panel-header">
              <Package size={16} />
              Kết quả dashboard
            </div>
            <div className="demo-result-card">
              <div className="demo-result-card__label">Đơn hàng</div>
              <div className="demo-result-card__value">#1204</div>
              <div className="demo-result-card__meta">
                2× Serum Vitamin C · 640,000đ
              </div>
            </div>
            <div className="demo-result-card">
              <div className="demo-result-card__label">Vận đơn</div>
              <div className="demo-result-card__value">A12B3C</div>
              <div className="demo-result-card__meta">
                GHN · Giao nhanh · 2 ngày
              </div>
            </div>
          </div>
        </div>

        <div className="demo-preview__cta">
          <button
            onClick={onEnterDemo}
            className="landing-btn landing-btn--primary"
          >
            Dùng cho shop
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

function DemoAction({
  label,
  detail,
  status,
}: {
  label: string;
  detail: string;
  status: 'done' | 'pending';
}) {
  return (
    <div className="demo-action">
      <div
        className={`demo-action__icon ${status === 'done' ? 'demo-action__icon--done' : ''}`}
      >
        <Check size={12} />
      </div>
      <div>
        <div className="demo-action__label">{label}</div>
        <div className="demo-action__detail">{detail}</div>
      </div>
    </div>
  );
}

/* ─── SECTION 6: INTEGRATIONS ─── */

function IntegrationSection() {
  const integrations = [
    { name: 'Zalo OA', emoji: '💬' },
    { name: 'Facebook Page', emoji: '📘' },
    { name: 'KiotViet', emoji: '📦' },
    { name: 'Sapo', emoji: '🛍' },
    { name: 'Pancake', emoji: '🥞' },
    { name: 'Đơn vị vận chuyển', emoji: '🚚' },
  ];

  return (
    <section
      className="landing-section landing-section--cream"
      id="integrations"
    >
      <div className="landing-container">
        <div className="landing-section__header">
          <div className="landing-eyebrow">Tích hợp</div>
          <h2 className="landing-section__title">Giữ nguyên stack hiện tại</h2>
          <p className="landing-section__desc">
            Agentify nằm phía trên các hệ thống này để tự xử lý các bước lặp
            lại — không bắt shop thay đổi toàn bộ quy trình.
          </p>
        </div>

        <div className="integration-grid">
          {integrations.map((item) => (
            <div key={item.name} className="integration-tile">
              <span className="integration-tile__emoji">{item.emoji}</span>
              <span className="integration-tile__name">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 7: BEACHHEAD ─── */

function BeachheadSection() {
  const useCases = [
    {
      icon: <ShoppingBag size={24} />,
      title: 'Tư vấn sản phẩm/dịch vụ',
      desc: 'AI tư vấn dựa trên nhu cầu khách, loại da, dịch vụ phù hợp.',
    },
    {
      icon: <CalendarCheck size={24} />,
      title: 'Kiểm tra tồn kho hoặc lịch trống',
      desc: 'Truy vấn tồn kho, lịch hẹn theo thời gian thực.',
    },
    {
      icon: <Package size={24} />,
      title: 'Tạo đơn hoặc đặt lịch',
      desc: 'Tự động tạo đơn, đặt lịch, không cần tab ra ngoài.',
    },
    {
      icon: <HeartHandshake size={24} />,
      title: 'Nhắc khách và chăm sóc sau bán',
      desc: 'Follow-up sau dịch vụ, nhắc lịch tái khám, khảo sát hài lòng.',
    },
  ];

  return (
    <section className="landing-section landing-section--white" id="beachhead">
      <div className="landing-container">
        <div className="landing-section__header">
          <div className="landing-eyebrow">Use case</div>
          <h2 className="landing-section__title">
            Bắt đầu từ mỹ phẩm, spa và salon
          </h2>
        </div>

        <div className="landing-grid landing-grid--4">
          {useCases.map((uc, i) => (
            <div key={i} className="usecase-card">
              <div className="usecase-card__icon">{uc.icon}</div>
              <h3 className="usecase-card__title">{uc.title}</h3>
              <p className="usecase-card__desc">{uc.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 8: PRICING ─── */

function PricingSection() {
  const plans = [
    {
      name: 'Starter',
      price: '399k',
      period: 'VND/tháng',
      features: [
        '1 kênh Zalo OA',
        '500 tin nhắn AI/tháng',
        '1 workflow cơ bản',
        'Hỗ trợ email',
      ],
      cta: 'Dùng thử',
      featured: false,
    },
    {
      name: 'Grow',
      price: '699k',
      period: 'VND/tháng',
      features: [
        '2 kênh (Zalo + Facebook)',
        '2,000 tin nhắn AI/tháng',
        '5 workflow tùy chỉnh',
        'KiotViet / Sapo tích hợp',
        'Hỗ trợ chat',
      ],
      cta: 'Chọn Grow',
      featured: true,
    },
    {
      name: 'Pro',
      price: '1,299k',
      period: 'VND/tháng',
      features: [
        'Unlimited kênh',
        'Unlimited tin nhắn',
        'Workflow không giới hạn',
        'API & webhook',
        'Onboarding 1-1',
        'SLA & hỗ trợ ưu tiên',
      ],
      cta: 'Liên hệ triển khai',
      featured: false,
    },
  ];

  return (
    <section className="landing-section landing-section--white" id="pricing">
      <div className="landing-container">
        <div className="landing-section__header">
          <div className="landing-eyebrow">Bảng giá</div>
          <h2 className="landing-section__title">Bảng giá dễ bắt đầu</h2>
        </div>

        <div className="pricing-grid">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`pricing-card ${plan.featured ? 'pricing-card--featured' : ''}`}
            >
              {plan.featured && (
                <div className="pricing-card__badge">Phổ biến nhất</div>
              )}
              <div className="pricing-card__name">{plan.name}</div>
              <div className="pricing-card__price">
                {plan.price}
                <span className="pricing-card__period">{plan.period}</span>
              </div>
              <ul className="pricing-card__features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`landing-btn ${plan.featured ? 'landing-btn--primary' : 'landing-btn--outline'} pricing-card__cta`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 9: FINAL CTA ─── */

function FinalCTASection({
  onEnterDemo,
  onEnterChat,
}: {
  onEnterDemo: () => void;
  onEnterChat: () => void;
}) {
  return (
    <section className="landing-section landing-section--salmon" id="final-cta">
      <div className="landing-container landing-final-cta">
        <h2 className="landing-final-cta__title">
          Để AI xử lý phần lặp lại,
          <br />
          đội của bạn tập trung vào khách quan trọng
        </h2>
        <div className="landing-final-cta__actions">
          <button
            onClick={onEnterDemo}
            className="landing-btn landing-btn--secondary"
          >
            Dùng cho shop
            <ArrowRight size={18} />
          </button>
          <button
            onClick={onEnterChat}
            className="landing-btn landing-btn--glass"
          >
            Chat thử
            <MessageSquare size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── FOOTER ─── */

function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer__inner">
        <div className="landing-footer__brand">
          <img
            src="/agentify-logo.png"
            alt="Agentify"
            className="landing-footer__logo"
          />
          <span className="landing-footer__name">Agentify</span>
        </div>
        <p className="landing-footer__tagline">
          Let AI run your sales operations.
        </p>
        <p className="landing-footer__copy">
          © 2026 Agentify. AI vận hành cho SME Việt Nam.
        </p>
      </div>
    </footer>
  );
}
