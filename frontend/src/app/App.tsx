import { Dispatch, ReactNode, SetStateAction, useEffect, useState } from 'react';
import { LayoutDashboard, Mail, Calendar, AlertCircle, Workflow, Link2, BarChart3, Settings, Bell, ChevronRight, CheckCircle2, Clock, Zap, Users, MessageSquare, Plus, X, Facebook as FacebookIcon, RefreshCw, Download, Filter, Search, ArrowUpRight, Phone, MapPin, ArrowLeft, Send, Smile, Image, Camera, ArrowRight, Play, Pause, Edit, Trash2, Truck } from 'lucide-react';
import LandingPage from './components/LandingPage';

type Screen = 'overview' | 'inbox' | 'calendar' | 'approval' | 'workflows' | 'integrations' | 'shipping' | 'reports' | 'settings';
type AppMode =
  | 'landing'
  | 'auth-login'
  | 'auth-register'
  | 'prod-kiotviet-form'
  | 'prod-kiotviet-authorize'
  | 'loading-kiotviet'
  | 'prod-ghn-form'
  | 'prod-ghn-authorize'
  | 'loading-ghn'
  | 'prod-onboarding-success'
  | 'manage';
type Modal = 'create-workflow' | 'connect-system' | 'edit-conversation' | 'appointment-detail' | 'report-filter' | 'report-export' | 'edit-setting' | 'member-detail' | 'invite-member' | 'integration-settings' | null;
type WorkflowItem = { id: number, name: string, status: 'active' | 'paused', triggers: number, conversions: number, description?: string };
type KiotVietStatus = { status: string, retailer?: string | null, last_sync_at?: string | null };
type GHNStatus = { provider: string, status: string, env: string, shop_id?: string | null, from_name?: string | null, from_phone?: string | null, from_address?: string | null };
type OnboardingStatus = 'needs_kiotviet' | 'needs_ghn' | 'ready';
type AuthUser = { id: number, name: string, email: string };
type AuthWorkspace = { id: number, name: string, onboarding_status: OnboardingStatus };
type AuthSession = { access_token: string, token_type: string, user: AuthUser, workspace: AuthWorkspace };
type KiotVietForm = { retailer: string, client_id: string, client_secret: string };
type KiotVietPreview = { status: string, retailer: string, detected_shop_name: string, sample_product_count: number };
type KiotVietAuthorize = { status: string, retailer: string, sample_product_count: number, synced_product_count: number };
type GHNForm = { shop_id: string };
type GHNPreview = { status: string, env: string, shop_id: string, detected_shop_name?: string | null, from_name?: string | null, from_phone?: string | null, from_address?: string | null };
type ProductItem = { id: number, name: string, code?: string | null, base_price: string, stock: number };
type ChatAction = { type: string, status: string, summary: string };
type ChatOrder = { id: number, kiotviet_order_code?: string | null, status: string, total: string, customer_name?: string | null, customer_phone?: string | null, shipping_address?: string | null, items?: { name: string, quantity: number, price: number }[] };
type InvoiceLineItem = { name: string, quantity: number, unit_price: number, line_total: number };
type InvoicePayload = { order_id: number, status: string, total: number, currency: string, customer_name?: string | null, customer_phone?: string | null, shipping_address?: string | null, items: InvoiceLineItem[], payment_method?: string | null };
type ShipmentSummary = { provider: string, order_code?: string | null, status: string, fee: number, expected_delivery_time?: string | null };
type ShipmentItem = { id: number, order_id: number, provider: string, provider_order_code?: string | null, client_order_code?: string | null, status: string, fee: number, expected_delivery_time?: string | null, created_at: string };
type UiEvent = { type: string, status: string, title: string, detail: string };
type DemoChatResponse = {
  conversation_id: number,
  reply: string,
  actions: ChatAction[],
  order: ChatOrder | null,
  invoice: InvoicePayload | null,
  shipment: ShipmentSummary | null,
  recommended_products: { id: number, name: string, price: number, stock: number, reason: string }[],
  quick_replies: string[],
  ui_events: UiEvent[],
};
type AgentChatResponse = { conversation_id: number | null, intent: string, reply: string, recommended_products: { id: number, name: string, price: number, stock: number, reason: string }[], quick_replies: string[], actions: string[] };
type UserChatMessage = { sender: 'customer' | 'ai', text: string };
type ConversationItem = { id: number, customer_name: string, customer_phone?: string | null, channel: string, status: string, created_at: string };
type StoredMessage = { id: number, sender: string, content: string, created_at: string };
type PaymentMethod = 'cod' | 'prepaid' | null;
type Recommendation = { name: string, price: number, fit: string, skin: string, image: string };
type PendingProduct = { name: string, price?: number, stock?: number };
type PendingOrderDraft = { intent: string, shippingAddress: string, deliveryPreference: string | null };

const CONNECT_DELAY_MS = {
  min: 2000,
  max: 4000,
};

const randomConnectDelay = () => CONNECT_DELAY_MS.min + Math.floor(Math.random() * (CONNECT_DELAY_MS.max - CONNECT_DELAY_MS.min));

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_BASE_URL = configuredApiBaseUrl === 'https://api.agentify.io.vn' ? '' : configuredApiBaseUrl;
const AUTH_TOKEN_KEY = 'agentify_owner_access_token';
const sunscreenRecommendations: Recommendation[] = [
  { name: 'Kem chống nắng kiềm dầu SkinPure SPF50 50ml', price: 235000, fit: 'Phù hợp da dầu, cần finish ráo nhẹ', skin: 'Da dầu', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80' },
  { name: 'Kem chống nắng cho da mụn AcneSafe SPF50 50ml', price: 330000, fit: 'Ưu tiên da mụn, dễ bí tắc, cần công thức nhẹ', skin: 'Da mụn', image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=600&q=80' },
  { name: 'Kem chống nắng phục hồi CicaShield SPF50 45ml', price: 360000, fit: 'Hợp da nhạy cảm, da đang treatment', skin: 'Da nhạy cảm', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80' },
  { name: 'Kem chống nắng nâng tông GlowCare SPF50 50ml', price: 295000, fit: 'Hợp da thường/da khô, muốn nâng tông nhẹ', skin: 'Da khô', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=80' },
  { name: 'Kem chống nắng vật lý Mineral Calm SPF50 50ml', price: 390000, fit: 'Hợp da dễ kích ứng, ưu tiên màng lọc vật lý', skin: 'Da nhạy cảm', image: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=600&q=80' },
];
const maskRecommendations: Recommendation[] = [
  { name: 'Mặt nạ phục hồi sau kích ứng 5 miếng', price: 180000, fit: 'Làm dịu, cấp ẩm nhanh sau khi da bị đỏ hoặc khô căng', skin: 'Da nhạy cảm', image: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=600&q=80' },
  { name: 'Mặt nạ đất sét kiềm dầu 100g', price: 230000, fit: 'Hút dầu thừa vùng chữ T, dùng 1-2 lần mỗi tuần', skin: 'Da dầu', image: 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?auto=format&fit=crop&w=600&q=80' },
  { name: 'Toner cấp ẩm rau má 250ml', price: 190000, fit: 'Có thể dùng làm lotion mask nhẹ cho da thiếu ẩm', skin: 'Da mụn', image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80' },
];
const serumRecommendations: Recommendation[] = [
  { name: 'Serum vitamin C sáng da 30ml', price: 320000, fit: 'Hợp nhu cầu làm sáng và đều màu da', skin: 'Da xỉn màu', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80' },
  { name: 'Serum cấp ẩm Hyaluronic Acid 30ml', price: 275000, fit: 'Cấp nước tốt, dễ kết hợp routine sáng/tối', skin: 'Da khô', image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=600&q=80' },
  { name: 'Tinh chất phục hồi rau má 30ml', price: 245000, fit: 'Làm dịu da sau mụn hoặc sau treatment nhẹ', skin: 'Da mụn', image: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=600&q=80' },
];
const cleanserRecommendations: Recommendation[] = [
  { name: 'Sữa rửa mặt dịu nhẹ cho da nhạy cảm 120ml', price: 185000, fit: 'Làm sạch nhẹ, ưu tiên da dễ kích ứng', skin: 'Da nhạy cảm', image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=600&q=80' },
  { name: 'Sữa rửa mặt trà xanh 150ml', price: 165000, fit: 'Hợp da dầu, da mụn nhẹ, cần cảm giác sạch thoáng', skin: 'Da dầu', image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=600&q=80' },
];

async function apiRequest<T>(path: string, options?: RequestInit, authToken?: string | null): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options?.headers || {})
    }
  });
  if (!response.ok) {
    let message = 'Không gọi được backend Agentify.';
    try {
      const body = await response.json();
      message = body?.error?.message || body?.detail || message;
    } catch {
      message = `${message} Mã lỗi ${response.status}.`;
    }
    throw new Error(message);
  }
  return response.json();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [appMode, setAppMode] = useState<AppMode>('landing');
  const [activeScreen, setActiveScreen] = useState<Screen>('overview');
  const [modal, setModal] = useState<Modal>(null);
  const [channelFilter, setChannelFilter] = useState('Tất cả');
  const [toast, setToast] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([
    { id: 1, name: 'Tự động đặt lịch tư vấn', status: 'active', triggers: 248, conversions: 38 },
    { id: 2, name: 'Nhắc lịch trước 2 tiếng', status: 'active', triggers: 38, conversions: 24 },
    { id: 3, name: 'Theo dõi khách chưa phản hồi', status: 'active', triggers: 156, conversions: 22 },
    { id: 4, name: 'Chuyển câu hỏi rủi ro cho nhân viên', status: 'active', triggers: 18, conversions: 18 },
    { id: 5, name: 'Gửi khảo sát sau dịch vụ', status: 'paused', triggers: 0, conversions: 0 }
  ]);
  const [kiotStatus, setKiotStatus] = useState<KiotVietStatus>({ status: 'disconnected' });
  const [ghnStatus, setGhnStatus] = useState<GHNStatus>({ provider: 'GHN', status: 'disconnected', env: 'sandbox' });
  const [productCount, setProductCount] = useState(0);
  const [lastDemoResult, setLastDemoResult] = useState<DemoChatResponse | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() => window.localStorage.getItem(AUTH_TOKEN_KEY));
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authWorkspace, setAuthWorkspace] = useState<AuthWorkspace | null>(null);
  const [kiotForm, setKiotForm] = useState<KiotVietForm>({ retailer: '', client_id: '', client_secret: '' });
  const [kiotPreview, setKiotPreview] = useState<KiotVietPreview | null>(null);
  const [ghnForm, setGhnForm] = useState<GHNForm>({ shop_id: '' });
  const [ghnPreview, setGhnPreview] = useState<GHNPreview | null>(null);

  const refreshBackendState = async (tokenOverride?: string | null) => {
    const token = tokenOverride === undefined ? authToken : tokenOverride;
    try {
      await apiRequest<{ status: string }>('/health');
      setBackendReady(true);
      const status = await apiRequest<KiotVietStatus>('/api/integrations/kiotviet/status', undefined, token);
      setKiotStatus(status);
      const shipping = await apiRequest<GHNStatus>('/api/shipments/status', undefined, token);
      setGhnStatus(shipping);
      const products = await apiRequest<ProductItem[]>('/api/kiotviet/products', undefined, token);
      setProductCount(products.length);
    } catch {
      setBackendReady(false);
    }
  };

  useEffect(() => {
    refreshBackendState();
  }, []);

  useEffect(() => {
    const syncPathname = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', syncPathname);
    return () => window.removeEventListener('popstate', syncPathname);
  }, []);

  if (pathname === '/user_chat') {
    return <UserChatScreen />;
  }

  const notify = (message: string) => {
    setToast(message);
  };

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setPathname(path);
  };

  const applyAuthSession = (session: AuthSession) => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
    setAuthToken(session.access_token);
    setAuthUser(session.user);
    setAuthWorkspace(session.workspace);
    refreshBackendState(session.access_token);
    routeByOnboardingStatus(session.workspace.onboarding_status);
  };

  const clearAuthSession = () => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setAuthWorkspace(null);
    setKiotPreview(null);
    setGhnPreview(null);
    setAppMode('auth-login');
  };

  const routeByOnboardingStatus = (status: OnboardingStatus) => {
    if (status === 'needs_kiotviet') setAppMode('prod-kiotviet-form');
    else if (status === 'needs_ghn') setAppMode('prod-ghn-form');
    else {
      setActiveScreen('overview');
      setAppMode('manage');
    }
  };

  const enterShopFlow = async () => {
    setToast(null);
    if (!authToken) {
      setAppMode('auth-login');
      return;
    }
    try {
      const session = await apiRequest<{ user: AuthUser, workspace: AuthWorkspace }>('/api/auth/me', undefined, authToken);
      setAuthUser(session.user);
      setAuthWorkspace(session.workspace);
      await refreshBackendState(authToken);
      routeByOnboardingStatus(session.workspace.onboarding_status);
    } catch (error) {
      clearAuthSession();
      notify(error instanceof Error ? error.message : 'Phiên đăng nhập đã hết hạn.');
    }
  };

  const selectChannel = (channel: string) => {
    setChannelFilter(channel);
    notify(`Đang lọc dữ liệu theo kênh: ${channel}`);
  };

  const previewKiotVietConnection = async () => {
    setToast(null);
    setAppMode('loading-kiotviet');
    try {
      const preview = await apiRequest<KiotVietPreview>('/api/integrations/kiotviet/preview', {
        method: 'POST',
        body: JSON.stringify(kiotForm),
      }, authToken);
      setKiotPreview(preview);
      setAppMode('prod-kiotviet-authorize');
    } catch (error) {
      setAppMode('prod-kiotviet-form');
      notify(error instanceof Error ? error.message : 'Không kết nối được KiotViet');
    }
  };

  const authorizeKiotVietConnection = async () => {
    setToast(null);
    setAppMode('loading-kiotviet');
    try {
      await delay(randomConnectDelay());
      const result = await apiRequest<KiotVietAuthorize>('/api/integrations/kiotviet/authorize', {
        method: 'POST',
        body: JSON.stringify(kiotForm),
      }, authToken);
      await refreshBackendState(authToken);
      const me = await apiRequest<{ user: AuthUser, workspace: AuthWorkspace }>('/api/auth/me', undefined, authToken);
      setAuthUser(me.user);
      setAuthWorkspace(me.workspace);
      setToast(`Kết nối KiotViet thành công, đã đồng bộ ${result.synced_product_count} sản phẩm.`);
      setAppMode('prod-ghn-form');
    } catch (error) {
      setAppMode('prod-kiotviet-authorize');
      notify(error instanceof Error ? error.message : 'Không lưu được kết nối KiotViet');
    }
  };

  const previewGHNConnection = async () => {
    setToast(null);
    setAppMode('loading-ghn');
    try {
      const preview = await apiRequest<GHNPreview>('/api/integrations/ghn/preview', {
        method: 'POST',
        body: JSON.stringify(ghnForm),
      }, authToken);
      setGhnPreview(preview);
      setAppMode('prod-ghn-authorize');
    } catch (error) {
      setAppMode('prod-ghn-form');
      notify(error instanceof Error ? error.message : 'Không kết nối được GHN');
    }
  };

  const authorizeGHNConnection = async () => {
    setToast(null);
    setAppMode('loading-ghn');
    try {
      await delay(randomConnectDelay());
      const result = await apiRequest<GHNPreview>('/api/integrations/ghn/authorize', {
        method: 'POST',
        body: JSON.stringify(ghnForm),
      }, authToken);
      setGhnPreview(result);
      await refreshBackendState(authToken);
      const me = await apiRequest<{ user: AuthUser, workspace: AuthWorkspace }>('/api/auth/me', undefined, authToken);
      setAuthUser(me.user);
      setAuthWorkspace(me.workspace);
      setToast('Kết nối GHN thành công.');
      setAppMode('prod-onboarding-success');
    } catch (error) {
      setAppMode('prod-ghn-authorize');
      notify(error instanceof Error ? error.message : 'Không lưu được kết nối GHN');
    }
  };

  const createWorkflowFromPrompt = (description: string) => {
    const prompt = description.trim();
    const lower = prompt.toLowerCase();
    const generatedName =
      lower.includes('nhắc') || lower.includes('remind') ? 'Tự động nhắc và xác nhận lịch hẹn' :
      lower.includes('follow') || lower.includes('chưa trả lời') || lower.includes('theo dõi') ? 'Tự động theo dõi lead chưa phản hồi' :
      lower.includes('đơn') || lower.includes('mua') || lower.includes('order') ? 'Tự động tạo đơn từ hội thoại' :
      lower.includes('giá') || lower.includes('bảng giá') ? 'Tự động tư vấn giá dịch vụ' :
      lower.includes('rủi ro') || lower.includes('duyệt') ? 'Tự động chuyển ca rủi ro cho nhân viên' :
      'Quy trình AI tạo từ mô tả tự nhiên';

    setWorkflows((current) => [
      {
        id: Math.max(...current.map((workflow) => workflow.id), 0) + 1,
        name: generatedName,
        status: 'active',
        triggers: 0,
        conversions: 0,
        description: prompt || 'AI tự phân tích mô tả và tạo workflow phù hợp cho Lumi Clinic.'
      },
      ...current
    ]);
    notify(`Đã tạo quy trình mới: ${generatedName}`);
  };

  if (appMode === 'landing') {
    return (
      <div className="size-full overflow-auto">
        <LandingPage
          onEnterDemo={enterShopFlow}
          onEnterChat={() => navigateTo('/user_chat')}
        />
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  if (appMode === 'auth-login') {
    return (
      <AuthScreen
        mode="login"
        onSubmit={applyAuthSession}
        onSwitch={() => setAppMode('auth-register')}
        onBack={() => setAppMode('landing')}
        toast={toast}
      />
    );
  }

  if (appMode === 'auth-register') {
    return (
      <AuthScreen
        mode="register"
        onSubmit={applyAuthSession}
        onSwitch={() => setAppMode('auth-login')}
        onBack={() => setAppMode('landing')}
        toast={toast}
      />
    );
  }

  if (appMode === 'prod-kiotviet-form') {
    return (
      <KiotVietCredentialScreen
        form={kiotForm}
        setForm={setKiotForm}
        onPrimary={previewKiotVietConnection}
        onBack={() => setAppMode('landing')}
        toast={toast}
      />
    );
  }

  if (appMode === 'prod-kiotviet-authorize') {
    return (
      <KiotVietAuthorizeScreen
        preview={kiotPreview}
        backendReady={backendReady}
        productCount={productCount}
        onPrimary={authorizeKiotVietConnection}
        onBack={() => setAppMode('prod-kiotviet-form')}
        toast={toast}
      />
    );
  }

  if (appMode === 'loading-kiotviet') {
    return <ConnectionLoadingScreen title="Đang kết nối KiotViet" description="Agentify đang kiểm tra API, đồng bộ hàng hóa và chuẩn bị workflow bán hàng." />;
  }

  if (appMode === 'prod-ghn-form') {
    return (
      <GHNCredentialScreen
        form={ghnForm}
        setForm={setGhnForm}
        onPrimary={previewGHNConnection}
        onBack={() => setAppMode('prod-kiotviet-form')}
        toast={toast}
      />
    );
  }

  if (appMode === 'prod-ghn-authorize') {
    return (
      <GHNAuthorizeScreen
        preview={ghnPreview}
        backendReady={backendReady}
        onPrimary={authorizeGHNConnection}
        onBack={() => setAppMode('prod-ghn-form')}
        toast={toast}
      />
    );
  }

  if (appMode === 'loading-ghn') {
    return <ConnectionLoadingScreen title="Đang kết nối GHN" description="Agentify đang kiểm tra token, shop ID và cấu hình kho gửi hàng GHN sandbox." />;
  }

  if (appMode === 'prod-onboarding-success') {
    return (
      <OnboardingSuccessScreen
        workspaceName={authWorkspace?.name || 'Shop của bạn'}
        onPrimary={() => {
          setActiveScreen('overview');
          setAppMode('manage');
        }}
      />
    );
  }

  return (
    <div className="size-full flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <button onClick={() => setAppMode('landing')} className="text-2xl font-bold text-teal-600 hover:text-teal-700">
            Agentify
          </button>
        </div>
        <nav className="flex-1 p-4">
          <NavItem icon={LayoutDashboard} label="Tổng quan" active={activeScreen === 'overview'} onClick={() => setActiveScreen('overview')} />
          <NavItem icon={Mail} label="Hộp thư" active={activeScreen === 'inbox'} onClick={() => setActiveScreen('inbox')} />
          <NavItem icon={Calendar} label="Lịch hẹn" active={activeScreen === 'calendar'} onClick={() => setActiveScreen('calendar')} />
          <NavItem icon={AlertCircle} label="Việc cần duyệt" active={activeScreen === 'approval'} onClick={() => setActiveScreen('approval')} badge={11} />
          <NavItem icon={Workflow} label="Quy trình tự động" active={activeScreen === 'workflows'} onClick={() => setActiveScreen('workflows')} />
          <NavItem icon={Link2} label="Kết nối hệ thống" active={activeScreen === 'integrations'} onClick={() => setActiveScreen('integrations')} />
          <NavItem icon={Truck} label="Vận chuyển" active={activeScreen === 'shipping'} onClick={() => setActiveScreen('shipping')} />
          <NavItem icon={BarChart3} label="Báo cáo" active={activeScreen === 'reports'} onClick={() => setActiveScreen('reports')} />
          <NavItem icon={Settings} label="Cài đặt" active={activeScreen === 'settings'} onClick={() => setActiveScreen('settings')} />
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Không gian làm việc:</span>
              <span className="font-semibold text-slate-900">{authWorkspace?.name || 'Lumi Clinic'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-full text-sm">
              <Zap className="w-4 h-4" />
              <span>Nhân viên AI đang hoạt động</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              {['Tất cả', 'Zalo OA', 'Facebook'].map((channel) => (
                <button
                  key={channel}
                  onClick={() => selectChannel(channel)}
                  className={`px-3 py-1.5 rounded-md ${channelFilter === channel ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  {channel}
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-600">Hôm nay</span>
            <button
              onClick={() => {
                setActiveScreen('approval');
                notify('Đã mở danh sách việc cần duyệt');
              }}
              className="relative p-2 hover:bg-slate-100 rounded-full"
            >
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-coral-500 rounded-full"></span>
            </button>
            <button
              onClick={() => {
                setActiveScreen('settings');
                notify('Đã mở cài đặt tài khoản');
              }}
              className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center hover:ring-2 hover:ring-teal-200"
            >
              <span className="text-sm font-semibold text-teal-700">{(authUser?.name || 'MA').slice(0, 2).toUpperCase()}</span>
            </button>
            <button onClick={clearAuthSession} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Đăng xuất
            </button>
          </div>
        </header>

        {/* Screen Content */}
        <main className="flex-1 overflow-auto">
          {activeScreen === 'overview' && <OverviewScreen onNavigate={setActiveScreen} kiotStatus={kiotStatus} ghnStatus={ghnStatus} productCount={productCount} lastDemoResult={lastDemoResult} />}
          {activeScreen === 'inbox' && <InboxScreen onNavigate={setActiveScreen} onOpenModal={setModal} onNotify={notify} onDemoResult={setLastDemoResult} />}
          {activeScreen === 'calendar' && <CalendarScreen onNavigate={setActiveScreen} onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'approval' && <ApprovalScreen onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'workflows' && <WorkflowsScreen workflows={workflows} setWorkflows={setWorkflows} onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'integrations' && <IntegrationsScreen onOpenModal={setModal} onNotify={notify} kiotStatus={kiotStatus} ghnStatus={ghnStatus} productCount={productCount} onRefresh={() => refreshBackendState(authToken)} authToken={authToken} />}
          {activeScreen === 'shipping' && <ShippingScreen onNotify={notify} authToken={authToken} />}
          {activeScreen === 'reports' && <ReportsScreen onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'settings' && <SettingsScreen onOpenModal={setModal} onNotify={notify} />}
        </main>
      </div>

      {/* Modals */}
      {modal === 'create-workflow' && <CreateWorkflowModal onClose={() => setModal(null)} onCreate={createWorkflowFromPrompt} />}
      {modal === 'connect-system' && <ConnectSystemModal onClose={() => setModal(null)} onNotify={notify} />}
      {modal === 'edit-conversation' && <EditConversationModal onClose={() => setModal(null)} onNotify={notify} />}
      {modal === 'appointment-detail' && <DemoModal title="Chi tiết lịch hẹn" onClose={() => setModal(null)} primary="Gửi nhắc lịch" onPrimary={() => { setModal(null); notify('Đã gửi tin nhắn nhắc lịch cho khách'); }}>
        <div className="space-y-3 text-sm text-slate-700">
          <p><strong>Khách hàng:</strong> Nguyễn Thảo</p>
          <p><strong>Dịch vụ:</strong> Soi da và tư vấn mụn</p>
          <p><strong>Thời gian:</strong> Thứ Sáu, 14:30</p>
          <p><strong>Nguồn:</strong> AI đặt lịch từ hội thoại Zalo OA</p>
        </div>
      </DemoModal>}
      {modal === 'report-filter' && <DemoModal title="Bộ lọc báo cáo" onClose={() => setModal(null)} primary="Áp dụng bộ lọc" onPrimary={() => { setModal(null); notify('Báo cáo đã được lọc theo 7 ngày gần nhất'); }}>
        <div className="grid grid-cols-2 gap-3 text-sm">
	          {['Hôm nay', '7 ngày gần nhất', 'Zalo OA', 'Facebook', 'Lịch đã đặt', 'Việc cần duyệt'].map((item) => (
	            <button
                key={item}
                onClick={() => notify(`Đã chọn bộ lọc: ${item}`)}
                className="p-3 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-left"
              >
                {item}
              </button>
	          ))}
        </div>
      </DemoModal>}
      {modal === 'report-export' && <DemoModal title="Xuất báo cáo" onClose={() => setModal(null)} primary="Tạo file báo cáo" onPrimary={() => { setModal(null); notify('Đã tạo báo cáo mẫu cho buổi demo'); }}>
        <p className="text-sm text-slate-700">Báo cáo sẽ gồm hiệu suất AI, lịch hẹn tạo được, khách được theo dõi lại và các việc cần duyệt.</p>
      </DemoModal>}
      {modal === 'edit-setting' && <DemoModal title="Chỉnh sửa cài đặt" onClose={() => setModal(null)} primary="Lưu thay đổi" onPrimary={() => { setModal(null); notify('Đã lưu cài đặt mẫu'); }}>
        <div className="space-y-3">
          <input className="w-full px-4 py-2 border border-slate-300 rounded-lg" defaultValue="Lumi Clinic" />
          <select className="w-full px-4 py-2 border border-slate-300 rounded-lg" defaultValue="GMT+7">
            <option>GMT+7 (Việt Nam)</option>
            <option>Tiếng Việt</option>
          </select>
        </div>
      </DemoModal>}
      {modal === 'member-detail' && <DemoModal title="Quản lý thành viên" onClose={() => setModal(null)} primary="Cập nhật quyền" onPrimary={() => { setModal(null); notify('Đã cập nhật quyền thành viên'); }}>
        <div className="space-y-3 text-sm text-slate-700">
          <p><strong>Thành viên:</strong> Mai Anh</p>
          <p><strong>Vai trò:</strong> Quản lý vận hành</p>
          <p><strong>Quyền:</strong> Duyệt câu trả lời AI, tiếp quản hội thoại, chỉnh quy trình</p>
        </div>
      </DemoModal>}
      {modal === 'invite-member' && <DemoModal title="Mời thành viên mới" onClose={() => setModal(null)} primary="Gửi lời mời" onPrimary={() => { setModal(null); notify('Đã gửi lời mời mẫu tới thành viên mới'); }}>
        <input className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="Nhập email hoặc số điện thoại nhân viên" />
      </DemoModal>}
      {modal === 'integration-settings' && <DemoModal title="Cài đặt kết nối" onClose={() => setModal(null)} primary="Lưu cấu hình" onPrimary={() => { setModal(null); notify('Đã lưu cấu hình kết nối'); }}>
        <div className="space-y-3 text-sm text-slate-700">
          <p><strong>Quyền đang bật:</strong> đọc tin nhắn, gửi xác nhận, đồng bộ khách hàng</p>
          <p><strong>Lần đồng bộ gần nhất:</strong> 2 phút trước</p>
        </div>
      </DemoModal>}
      {toast && <Toast message={toast} />}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, badge }: { icon: any, label: string, active?: boolean, onClick?: () => void, badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
        active ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="px-2 py-0.5 bg-coral-500 text-white text-xs rounded-full">{badge}</span>
      )}
    </button>
  );
}

function OnboardingScreen({
  step,
  totalSteps,
  title,
  subtitle,
  systemName,
  systemDescription,
  permissions,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onBack
}: {
  step: number,
  totalSteps: number,
  title: string,
  subtitle: string,
  systemName: string,
  systemDescription: string,
  permissions: string[],
  primaryLabel: string,
  secondaryLabel?: string,
  onPrimary: () => void,
  onSecondary?: () => void,
  onBack: () => void
}) {
  return (
    <div className="size-full overflow-auto bg-[#f7faf8] text-slate-950">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-6 py-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold">Agentify</div>
              <div className="text-xs font-medium text-slate-500">Thiết lập demo sản phẩm</div>
            </div>
          </div>
          <button onClick={onBack} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-700">
            Quay lại
          </button>
        </header>

        <main className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr]">
          <section>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-sm font-semibold text-teal-700 shadow-sm">
              Bước {step}/{totalSteps}
            </div>
            <h1 className="max-w-xl text-4xl font-bold tracking-tight text-slate-950 lg:text-5xl">{title}</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">{subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={onPrimary} className="rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">
                {primaryLabel}
              </button>
              {secondaryLabel && onSecondary && (
                <button onClick={onSecondary} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-teal-300 hover:text-teal-700">
                  {secondaryLabel}
                </button>
              )}
            </div>
            <div className="mt-8 h-2 max-w-md overflow-hidden rounded-full bg-white shadow-inner">
              <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-teal-900/10">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-500">Hệ thống cần kết nối</div>
                  <div className="mt-1 text-3xl font-bold text-slate-950">{systemName}</div>
                </div>
                <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Chưa kết nối</div>
              </div>
              <p className="leading-7 text-slate-600">{systemDescription}</p>

              <div className="mt-6 space-y-3">
                {permissions.map((permission) => (
                  <div key={permission} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
                    <span className="text-sm font-medium text-slate-700">{permission}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-4">
                <div className="mb-2 text-sm font-bold text-teal-900">Sau khi kết nối</div>
                <div className="text-sm leading-6 text-teal-800">
                  Agentify sẽ dùng dữ liệu mẫu để mô phỏng luồng khách nhắn tin, AI hiểu ý định, tự xử lý workflow và cập nhật kết quả trong dashboard.
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function ConnectionLoadingScreen({ title, description }: { title: string, description: string }) {
  return (
    <div className="size-full bg-[#f7faf8] text-slate-950">
      <div className="flex min-h-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-2xl shadow-teal-900/10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-teal-50">
            <RefreshCw className="h-10 w-10 animate-spin text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          <p className="mt-3 leading-7 text-slate-600">{description}</p>
          <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-teal-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

function UserChatScreen() {
  const [customerName] = useState('Khách Zalo');
  const [customerPhone] = useState('');
  const [channelUserId, setChannelUserId] = useState(() => window.localStorage.getItem('agentify_user_chat_channel_user_id') || '');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UserChatMessage[]>([
    { sender: 'ai', text: 'Chào chị, Lumi Beauty có thể tư vấn sản phẩm, kiểm tra đơn hoặc hỗ trợ đặt hàng ngay trong Zalo.' }
  ]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<ChatAction[]>([]);
  const [invoice, setInvoice] = useState<InvoicePayload | null>(null);
  const [shipment, setShipment] = useState<ShipmentSummary | null>(null);
  const [recommendedProducts, setRecommendedProducts] = useState<AgentChatResponse['recommended_products']>([]);
  const [quickReplyOptions, setQuickReplyOptions] = useState<string[]>([]);
  const [uiEvents, setUiEvents] = useState<UiEvent[]>([]);
  const [invoiceDeliveredOrderId, setInvoiceDeliveredOrderId] = useState<number | null>(null);

  const rememberConversation = (id: number | null | undefined) => {
    if (!id) return;
    setConversationId(id);
  };

  const appendAi = (text: string) => setMessages((current) => [...current, { sender: 'ai', text }]);
  const appendCustomer = (text: string) => setMessages((current) => [...current, { sender: 'customer', text }]);

  const sendToAgent = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    window.localStorage.setItem('agentify_user_chat_channel_user_id', channelUserId);
    appendCustomer(trimmed);
    setMessage('');
    setLoading(true);
    setError(null);
    setInvoice(null);
    setShipment(null);
    setInvoiceDeliveredOrderId(null);
    setUiEvents([]);
    setRecommendedProducts([]);
    setQuickReplyOptions([]);
    setError(null);
    try {
      const result = await apiRequest<DemoChatResponse>('/api/channels/zalo/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: conversationId,
          customer_name: customerName,
          customer_phone: customerPhone,
          message: trimmed,
          ...(channelUserId ? { channel_user_id: channelUserId } : {}),
        })
      });
      rememberConversation(result.conversation_id);
      appendAi(result.reply);
      setActions(result.actions || []);
      setInvoice(result.invoice);
      setShipment(result.shipment);
      setRecommendedProducts(result.recommended_products || []);
      setQuickReplyOptions(result.quick_replies || []);
      setUiEvents(result.ui_events || []);
      if (result.invoice) {
        const deliveryEvent = (result.ui_events || []).find((event) => event.type === 'zalo_invoice_send');
        appendAi(`Dạ em đã tạo hóa đơn tạm tính #${result.invoice.order_id} trong hội thoại.`);
        appendAi(deliveryEvent?.title || `Đã gửi hóa đơn tạm tính #${result.invoice.order_id} lại cho khách qua luồng Zalo OA.`);
      }
      if (result.shipment?.order_code) {
        appendAi(`Thông tin đơn đã được gửi sang GHN. Mã vận đơn: ${result.shipment.order_code}.`);
      }
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Không gửi được tin nhắn';
      setError(fallback);
      appendAi(fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e5edf5] p-2 sm:p-4 flex items-center justify-center">
      <main className="w-full max-w-[520px] bg-[#f4f8fc] border border-slate-200 rounded-[28px] overflow-hidden shadow-xl h-[calc(100vh-1rem)] flex flex-col">
        <header className="bg-[#0092e8] text-white px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold">🛍</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Lumi Beauty</div>
            <div className="text-xs opacity-90">Shop Chat Zalo</div>
          </div>
          <button
            onClick={() => {
              setChannelUserId('');
              setConversationId(null);
              setMessages([{ sender: 'ai', text: 'Chào chị, Lumi Beauty có thể tư vấn sản phẩm, kiểm tra đơn hoặc hỗ trợ đặt hàng ngay trong Zalo.' }]);
              setInvoice(null);
              setShipment(null);
              setRecommendedProducts([]);
              setQuickReplyOptions([]);
              setUiEvents([]);
              setActions([]);
            }}
            className="text-xs font-semibold bg-white/20 rounded-full px-3 py-1.5"
          >
            Khách Zalo
          </button>
        </header>

        <div className="flex-1 overflow-auto px-3 py-4 space-y-3 bg-[#f4f8fc]">
          {messages.map((item, index) => (
            <ChatMessage key={index} sender={item.sender === 'customer' ? 'customer' : 'ai'} text={item.text} />
          ))}
          {loading && <ChatMessage sender="ai" text="Đang gửi tin nhắn và xử lý đơn..." />}

          {!!invoice && (
            <DigitalInvoiceCard
              invoice={invoice}
              customerName={invoice.customer_name || customerName}
              customerPhone={invoice.customer_phone || customerPhone}
              shippingAddress={invoice.shipping_address || ''}
            />
          )}

          {!!shipment && <ShipmentChatCard shipment={shipment} />}

          {!!recommendedProducts.length && (
            <LlmProductPanel
              products={recommendedProducts}
              onChoose={(product) => sendToAgent(`Em muốn đặt ${product.name}`)}
            />
          )}

          {!!invoice && invoiceDeliveredOrderId !== invoice.order_id && (
            <button
              onClick={() => {
                setInvoiceDeliveredOrderId(invoice?.order_id || null);
                appendAi(`Đã gửi hóa đơn #${invoice?.order_id || ''} cho khách qua kênh Zalo OA.`);
              }}
              className="w-full rounded-lg bg-[#0068d6] px-3 py-2 text-xs font-semibold text-white"
            >
              Gửi hóa đơn cho khách trên Zalo
            </button>
          )}

          {!!invoice && invoiceDeliveredOrderId === invoice.order_id && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {(uiEvents.find((event) => event.type === 'zalo_invoice_send')?.title) || 'Đã tạo hóa đơn tạm tính và thông báo cho khách.'}
            </div>
          )}

          {error && <div className="rounded-lg border border-coral-200 bg-coral-50 px-3 py-2 text-xs text-coral-700">{error}</div>}
        </div>

        <footer className="border-t border-slate-200 bg-white p-3">
          {!!quickReplyOptions.length && (
          <div className="mb-3 flex flex-wrap gap-2">
            {quickReplyOptions.map((quickReply) => (
              <button
                key={quickReply}
                onClick={() => sendToAgent(quickReply)}
                className="rounded-full border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-teal-50"
              >
                {quickReply}
              </button>
            ))}
          </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendToAgent(message);
                }
              }}
              rows={2}
              className="max-h-28 min-h-[52px] flex-1 resize-none rounded-full border border-slate-300 px-4 py-3 text-sm focus:border-[#0092e8] focus:outline-none"
              placeholder="Nhập tin nhắn khách hàng..."
            />
            <button
              onClick={() => sendToAgent(message)}
              disabled={loading}
              className="h-[52px] rounded-full bg-[#0092e8] px-5 text-sm font-semibold text-white hover:bg-[#007fd1] disabled:opacity-60"
            >
              {loading ? '...' : 'Gửi'}
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

function AuthScreen({
  mode,
  onSubmit,
  onSwitch,
  onBack,
  toast,
}: {
  mode: 'login' | 'register',
  onSubmit: (session: AuthSession) => void,
  onSwitch: () => void,
  onBack: () => void,
  toast: string | null
}) {
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRegister = mode === 'register';

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = isRegister ? { name, shop_name: shopName, email, password } : { email, password };
      const session = await apiRequest<AuthSession>(isRegister ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onSubmit(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đăng nhập được.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf3f8] px-4 py-6 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.95fr_1.05fr]">
        <section className="bg-slate-950 p-8 text-white">
          <button onClick={onBack} className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            Về landing
          </button>
          <img src="/agentify-logo.png" alt="Agentify" className="mb-5 h-14 w-14 rounded-2xl bg-white p-2" />
          <h1 className="max-w-md text-4xl font-bold leading-tight">Đăng nhập để kết nối shop thật</h1>
          <p className="mt-5 max-w-md leading-7 text-slate-300">
            Tài khoản này dùng cho chủ shop. Sau khi vào hệ thống, shop sẽ kết nối KiotViet và GHN bằng thông tin thật.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">1. Tạo workspace riêng cho shop</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">2. Lưu key kết nối đã mã hóa</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">3. Vào dashboard quản lý sau onboarding</div>
          </div>
        </section>
        <section className="flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <div className="text-sm font-bold uppercase tracking-[0.18em] text-teal-600">{isRegister ? 'Đăng ký' : 'Đăng nhập'}</div>
              <h2 className="mt-2 text-3xl font-bold text-slate-950">{isRegister ? 'Tạo tài khoản shop' : 'Vào Agentify'}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {isRegister ? 'Dùng email, mật khẩu và tên shop để bắt đầu.' : 'Dùng tài khoản chủ shop để tiếp tục onboarding.'}
              </p>
            </div>
            <div className="space-y-4">
              {isRegister && (
                <>
                  <LabeledInput label="Tên người dùng" value={name} onChange={setName} placeholder="Nhập tên người dùng" />
                  <LabeledInput label="Tên shop" value={shopName} onChange={setShopName} placeholder="Nhập tên shop" />
                </>
              )}
              <LabeledInput label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
              <LabeledInput label="Mật khẩu" value={password} onChange={setPassword} type="password" placeholder="Tối thiểu 8 ký tự" />
              {error && <div className="rounded-xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700">{error}</div>}
              <button
                onClick={submit}
                disabled={loading}
                className="w-full rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {loading ? 'Đang xử lý...' : isRegister ? 'Tạo tài khoản và tiếp tục' : 'Đăng nhập'}
              </button>
              <button onClick={onSwitch} className="w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {isRegister ? 'Đã có tài khoản, đăng nhập' : 'Chưa có tài khoản, đăng ký'}
              </button>
            </div>
          </div>
        </section>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text', placeholder }: { label: string, value: string, onChange: (value: string) => void, type?: string, placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
      />
    </label>
  );
}

function KiotVietCredentialScreen({ form, setForm, onPrimary, onBack, toast }: { form: KiotVietForm, setForm: Dispatch<SetStateAction<KiotVietForm>>, onPrimary: () => void, onBack: () => void, toast: string | null }) {
  return (
    <CredentialShell
      step="Bước 1/2"
      title="Kết nối KiotViet"
      description="Nhập thông tin API của gian hàng. Agentify sẽ kiểm tra trước, sau đó mới hiện màn authorize để chủ shop xác nhận."
      logo={<div className="h-12 w-12 rounded-2xl bg-emerald-600 text-lg font-bold text-white flex items-center justify-center">K</div>}
      guideSrc="/guide/kiotviet/video_huong_dan_lay_connect_kiotviet.mp4"
      onBack={onBack}
      onPrimary={onPrimary}
      primaryLabel="Kiểm tra KiotViet"
      toast={toast}
    >
      <LabeledInput label="Tên shop / Retailer" value={form.retailer} onChange={(value) => setForm((current) => ({ ...current, retailer: value }))} placeholder="shophihi123" />
      <LabeledInput label="Mã khách hàng / Client ID" value={form.client_id} onChange={(value) => setForm((current) => ({ ...current, client_id: value }))} />
      <LabeledInput label="Mã bí mật / Client Secret" value={form.client_secret} onChange={(value) => setForm((current) => ({ ...current, client_secret: value }))} type="password" />
    </CredentialShell>
  );
}

function GHNCredentialScreen({ form, setForm, onPrimary, onBack, toast }: { form: GHNForm, setForm: Dispatch<SetStateAction<GHNForm>>, onPrimary: () => void, onBack: () => void, toast: string | null }) {
  return (
    <CredentialShell
      step="Bước 2/2"
      title="Kết nối GHN"
      description="Nhập Shop ID GHN sandbox. Agentify dùng GHN_TOKEN đã cấu hình ở backend để nhận diện shop và kho lấy hàng."
      logo={<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white"><Truck className="h-6 w-6" /></div>}
      guideSrc="/guide/ghn/video_huong_dan_connect_ghn.mp4"
      onBack={onBack}
      onPrimary={onPrimary}
      primaryLabel="Kiểm tra GHN"
      toast={toast}
    >
      <LabeledInput label="Mã khách hàng GHN / Shop ID" value={form.shop_id} onChange={(value) => setForm({ shop_id: value })} placeholder="200457" />
    </CredentialShell>
  );
}

function CredentialShell({
  step,
  title,
  description,
  logo,
  guideSrc,
  children,
  primaryLabel,
  onPrimary,
  onBack,
  toast,
}: {
  step: string,
  title: string,
  description: string,
  logo: ReactNode,
  guideSrc: string,
  children: ReactNode,
  primaryLabel: string,
  onPrimary: () => void,
  onBack: () => void,
  toast: string | null,
}) {
  return (
    <div className="min-h-screen bg-[#edf3f8] px-4 py-6 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <button onClick={onBack} className="mb-5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Quay lại</button>
          <div className="mb-3 inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{step}</div>
          <div className="mb-5 flex items-center gap-3">
            <img src="/agentify-logo.png" alt="Agentify" className="h-12 w-12 rounded-2xl border border-slate-200 bg-white" />
            <div className="text-xl font-bold text-slate-400">+</div>
            {logo}
          </div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-3 leading-7 text-slate-600">{description}</p>
          <div className="mt-6 space-y-4">{children}</div>
          <button onClick={onPrimary} className="mt-6 w-full rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700">
            {primaryLabel}
          </button>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-3 px-2 text-sm font-bold text-slate-700">Video hướng dẫn lấy thông tin</div>
          <video className="h-full max-h-[720px] w-full rounded-2xl bg-slate-950 object-contain" src={guideSrc} controls />
        </section>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}

function KiotVietAuthorizeScreen({ preview, backendReady, productCount, onPrimary, onBack, toast }: { preview: KiotVietPreview | null, backendReady: boolean, productCount: number, onPrimary: () => void, onBack: () => void, toast: string | null }) {
  return (
    <KiotVietConnectScreen
      status={{ status: preview?.status === 'valid' ? 'connected' : 'disconnected', retailer: preview?.retailer }}
      productCount={productCount}
      backendReady={backendReady}
      onPrimary={onPrimary}
      onBack={onBack}
      onRefresh={() => {}}
      toast={toast}
    />
  );
}

function GHNAuthorizeScreen({ preview, backendReady, onPrimary, onBack, toast }: { preview: GHNPreview | null, backendReady: boolean, onPrimary: () => void, onBack: () => void, toast: string | null }) {
  return (
    <GHNConnectScreen
      status={{ provider: 'GHN', status: preview?.status === 'valid' ? 'connected' : 'disconnected', env: preview?.env || 'sandbox', shop_id: preview?.shop_id, from_name: preview?.from_name, from_phone: preview?.from_phone, from_address: preview?.from_address }}
      backendReady={backendReady}
      onPrimary={onPrimary}
      onBack={onBack}
      onRefresh={() => {}}
      toast={toast}
    />
  );
}

function OnboardingSuccessScreen({ workspaceName, onPrimary }: { workspaceName: string, onPrimary: () => void }) {
  return (
    <div className="min-h-screen bg-[#edf3f8] px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-11 w-11 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-bold">Shop đã sẵn sàng</h1>
        <p className="mt-3 max-w-md leading-7 text-slate-600">
          {workspaceName} đã kết nối KiotViet và GHN. Agentify có thể dùng dữ liệu shop để quản lý hội thoại, đơn hàng và vận chuyển.
        </p>
        <button onClick={onPrimary} className="mt-8 rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white hover:bg-teal-700">
          Vào giao diện quản lý
        </button>
      </div>
    </div>
  );
}

function KiotVietConnectScreen({
  status,
  productCount,
  backendReady,
  onPrimary,
  onBack,
  onRefresh,
  toast
}: {
  status: KiotVietStatus,
  productCount: number,
  backendReady: boolean,
  onPrimary: () => void,
  onBack: () => void,
  onRefresh: () => void,
  toast: string | null
}) {
  const connected = status.status === 'connected';
  const retailer = status.retailer || 'đọc từ backend/.env';

  return (
    <div className="min-h-screen bg-[#edf3f8] px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Bước 1/2
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight">Authorize Agentify + KiotViet</h1>
            <p className="mt-1 text-sm text-slate-500">Kết nối kho hàng, tồn kho và đơn hàng của shop.</p>
          </div>
          <button onClick={onBack} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Quay lại
          </button>
        </header>

        <section className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-3">
              <img src="/agentify-logo.png" alt="Agentify" className="h-12 w-12 rounded-xl border border-slate-200 bg-white" />
              <div className="text-2xl font-bold text-slate-700">•</div>
              <div className="h-11 w-11 rounded-full bg-emerald-600 text-lg font-bold text-white flex items-center justify-center">K</div>
              <div>
                <div className="text-sm text-slate-500">Đang gửi đến</div>
                <div className="font-semibold text-slate-900">KiotViet</div>
              </div>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Đăng nhập bằng tài khoản shop</h2>
            <p className="mt-2 text-sm text-slate-600">Tên gian hàng: <span className="font-semibold">{retailer}</span></p>
            <p className="text-sm text-slate-600">Agentify đã kiểm tra thông tin API. Chủ shop bấm kết nối để cho phép đồng bộ dữ liệu.</p>
          </div>

          <h3 className="text-sm font-semibold text-slate-900">Thông tin quyền truy cập</h3>
          <ul className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 space-y-2">
            <li>• Đọc sản phẩm, tồn kho, đơn hàng.</li>
            <li>• Tạo đơn tạm tính khi khách xác nhận mua hàng.</li>
            <li>• Tự động điền thông tin khách và địa chỉ giao.</li>
          </ul>

          <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Backend</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${backendReady ? 'bg-emerald-50 text-emerald-700' : 'bg-coral-50 text-coral-700'}`}>
                {backendReady ? 'Đang chạy' : 'Chưa kết nối'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>KiotViet</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {connected ? `Đã kết nối ${status.retailer || 'KiotViet'}` : 'Chưa kết nối'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Sản phẩm sync</span>
              <span className="text-sm font-bold text-slate-900">{productCount}</span>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <button
              onClick={onPrimary}
              className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {connected ? 'Authorize và đồng bộ KiotViet' : 'Kết nối KiotViet'}
            </button>
            <button onClick={onRefresh} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-emerald-300 hover:text-emerald-700">
              Kiểm tra lại
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-500">
            Sau khi KiotViet sẵn sàng, hệ thống sẽ chuyển sang bước GHN.
          </p>
        </section>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}

function GHNConnectScreen({
  status,
  backendReady,
  onPrimary,
  onBack,
  onRefresh,
  toast
}: {
  status: GHNStatus,
  backendReady: boolean,
  onPrimary: () => void,
  onBack: () => void,
  onRefresh: () => void,
  toast: string | null
}) {
  const connected = status.status === 'connected';

  return (
    <div className="min-h-screen bg-[#edf3f8] px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              Bước 2/2
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight">Authorize Agentify + GHN</h1>
            <p className="mt-1 text-sm text-slate-500">Kết nối giao vận để tự động gửi thông tin đơn hàng.</p>
          </div>
          <button onClick={onBack} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Quay lại
          </button>
        </header>

        <section className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-3">
              <img src="/agentify-logo.png" alt="Agentify" className="h-12 w-12 rounded-xl border border-slate-200 bg-white" />
              <div className="text-2xl font-bold text-slate-700">•</div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-600 text-lg font-bold text-white">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-slate-500">Đang gửi đến</div>
                <div className="font-semibold text-slate-900">Giao Hàng Nhanh</div>
              </div>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Xác thực tài khoản giao vận</h2>
            <p className="mt-2 text-sm text-slate-600">Môi trường: <span className="font-semibold uppercase">{status.env || 'sandbox'}</span></p>
            <p className="text-sm text-slate-600">Shop ID: <span className="font-semibold">{status.shop_id || 'chưa nhận diện'}</span></p>
          </div>

          <h3 className="text-sm font-semibold text-slate-900">Agentify sẽ dùng GHN để</h3>
          <ul className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <li>• Tạo vận đơn sau khi khách xác nhận đơn.</li>
            <li>• Gửi tên, số điện thoại, địa chỉ và danh sách hàng cho GHN.</li>
            <li>• Theo dõi trạng thái vận chuyển để trả lời khách.</li>
          </ul>

          <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Backend</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${backendReady ? 'bg-emerald-50 text-emerald-700' : 'bg-coral-50 text-coral-700'}`}>
                {backendReady ? 'Đang chạy' : 'Chưa kết nối'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>GHN</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {connected ? 'Đã cấu hình' : 'Chưa cấu hình'}
              </span>
            </div>
            <div className="text-slate-600">
              Kho gửi: <span className="font-semibold text-slate-900">{status.from_name || 'Lumi Beauty'}</span>
              {status.from_address ? <span> · {status.from_address}</span> : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <button
              onClick={onPrimary}
              className="rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700"
            >
              {connected ? 'Authorize GHN' : 'Kết nối GHN'}
            </button>
            <button onClick={onRefresh} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-sky-300 hover:text-sky-700">
              Kiểm tra lại
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-500">
            Sau bước này, chủ shop sẽ vào dashboard quản lý Agentify.
          </p>
        </section>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}




function OverviewScreen({ onNavigate, kiotStatus, ghnStatus, productCount, lastDemoResult }: { onNavigate: (screen: Screen) => void, kiotStatus: KiotVietStatus, ghnStatus: GHNStatus, productCount: number, lastDemoResult: DemoChatResponse | null }) {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Tổng quan hôm nay</h2>
        <p className="text-slate-600">Nhân viên AI đang xử lý hội thoại, đặt lịch và nhắc khách cho Lumi Clinic.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={MessageSquare} label="Hội thoại demo" value={lastDemoResult ? String(lastDemoResult.conversation_id) : '0'} />
        <StatCard icon={Zap} label="AI tự xử lý" value={lastDemoResult?.actions.find((action) => action.type === 'intent_detected')?.summary.includes('(llm)') ? 'LLM' : 'Sẵn sàng'} color="teal" />
        <StatCard icon={Calendar} label="Lịch hẹn đã tạo" value="38" color="teal" />
        <StatCard icon={Users} label="Khách đã được theo dõi lại" value="22" />
        <StatCard icon={Truck} label="Vận đơn GHN mới nhất" value={lastDemoResult?.shipment?.order_code || 'Chưa có'} color="teal" onClick={() => onNavigate('shipping')} />
        <StatCard icon={AlertCircle} label="Việc cần nhân viên duyệt" value="11" color="coral" onClick={() => onNavigate('approval')} />
      </div>

      {/* Demo Flow */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('inbox')}>
        <h3 className="text-xl font-semibold text-slate-900 mb-4">Luồng demo đang chạy</h3>
        <div className="space-y-4">
          <FlowStep number={1} title="Khách nhắn vào kênh demo" description="Đặt cho chị 2 serum vitamin C, giao tới 12 Nguyễn Trãi, SĐT 0901234567" />
          <FlowStep number={2} title="LLM hiểu ý định" description="Khách muốn đặt hàng và cung cấp đủ thông tin giao hàng" />
          <FlowStep number={3} title="AI gọi tool tìm sản phẩm" description="Tìm trong cache sản phẩm đồng bộ từ KiotViet" />
          <FlowStep number={4} title="AI kiểm tra tồn kho" description="Xác nhận số lượng có thể bán" />
          <FlowStep number={5} title="AI tạo đơn nháp" description={lastDemoResult?.order ? `Đơn #${lastDemoResult.order.id}, tổng ${Number(lastDemoResult.order.total).toLocaleString('vi-VN')}đ` : 'Chờ tin nhắn demo đầu tiên'} />
          <FlowStep number={6} title="AI gửi vận đơn sang GHN" description={lastDemoResult?.shipment ? `Mã vận đơn ${lastDemoResult.shipment.order_code}, trạng thái ${lastDemoResult.shipment.status}` : 'Tự động chạy sau khi hóa đơn được tạo và GHN đã cấu hình'} />
          <FlowStep number={7} title="AI trả lời khách" description={lastDemoResult?.reply || 'Kết quả sẽ hiện sau khi gửi tin nhắn ở Hộp thư'} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-teal-600">
          <span className="text-sm font-medium">Xem chi tiết</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Automation Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Tình trạng tự động hóa</h3>
          <div className="space-y-3">
            <AutomationItem label="Tư vấn dịch vụ" percentage={92} />
            <AutomationItem label="Đặt lịch" percentage={78} />
            <AutomationItem label="Nhắc lịch" percentage={96} />
            <AutomationItem label="Theo dõi khách chưa trả lời" percentage={64} />
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-sm text-slate-700">Câu hỏi rủi ro</span>
              <span className="text-sm text-coral-600 font-medium">Cần nhân viên duyệt</span>
            </div>
          </div>
        </div>

        {/* Connected Systems */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Hệ thống đã kết nối</h3>
          <div className="grid grid-cols-2 gap-3">
            <SystemCard name={`KiotViet (${productCount} SP)`} connected={kiotStatus.status === 'connected'} />
            <SystemCard name={`GHN ${ghnStatus.env ? `(${ghnStatus.env})` : ''}`} connected={ghnStatus.status === 'connected'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function inboxStatusLabel(status: string) {
  if (status === 'order_created') return 'Đã tạo đơn';
  if (status === 'order_pending') return 'AI đang xử lý';
  if (status === 'appointment_pending') return 'Đã đặt lịch';
  if (status === 'needs_review') return 'Cần duyệt';
  return 'AI đang xử lý';
}

function inboxStatusColor(status: string) {
  if (status === 'order_created') return 'blue';
  if (status === 'appointment_pending') return 'teal';
  if (status === 'needs_review') return 'coral';
  return 'slate';
}

function InboxScreen({ onNavigate, onOpenModal, onNotify, onDemoResult }: { onNavigate: (screen: Screen) => void, onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void, onDemoResult: (result: DemoChatResponse) => void }) {
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [aiPaused, setAiPaused] = useState(false);
  const [filter, setFilter] = useState('Tất cả');
  const [customerName, setCustomerName] = useState('Nguyễn Thảo');
  const [customerPhone, setCustomerPhone] = useState('');
  const [message, setMessage] = useState('Đặt cho chị 2 serum vitamin C, giao tới 12 Nguyễn Trãi, SĐT 0901234567');
  const [sending, setSending] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoChatResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [storedMessages, setStoredMessages] = useState<StoredMessage[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  const loadConversations = async () => {
    setLoadingInbox(true);
    try {
      const rows = await apiRequest<ConversationItem[]>('/api/conversations');
      setConversations(rows);
      setSelectedChat((current) => current ?? rows[0]?.id ?? null);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Không tải được hộp thư');
    } finally {
      setLoadingInbox(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedChat) {
      setStoredMessages([]);
      return;
    }
    apiRequest<StoredMessage[]>(`/api/conversations/${selectedChat}/messages`)
      .then(setStoredMessages)
      .catch((error) => onNotify(error instanceof Error ? error.message : 'Không tải được tin nhắn'));
  }, [selectedChat]);

  const selectedConversation = conversations.find((item) => item.id === selectedChat) || null;
  const visibleConversations = conversations.filter((item) => filter === 'Tất cả' || inboxStatusLabel(item.status) === filter);

  const sendDemoMessage = async () => {
    setSending(true);
    try {
      const result = await apiRequest<DemoChatResponse>('/api/channels/demo/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: selectedChat,
          customer_name: customerName,
          customer_phone: customerPhone || undefined,
          message
        })
      });
      setDemoResult(result);
      setSelectedChat(result.conversation_id);
      onDemoResult(result);
      onNotify(result.order ? `AI đã tạo đơn nháp #${result.order.id}` : 'AI đã xử lý tin nhắn demo');
      await loadConversations();
      const rows = await apiRequest<StoredMessage[]>(`/api/conversations/${result.conversation_id}/messages`);
      setStoredMessages(rows);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Không gửi được tin nhắn demo');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex">
      {/* Conversation List */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">Hộp thư</h3>
          <div className="flex flex-wrap gap-2">
            {['Tất cả', 'AI đang xử lý', 'Đã tạo đơn', 'Đã đặt lịch', 'Cần duyệt'].map((item) => (
              <FilterChip
                key={item}
                label={item}
                active={filter === item}
                onClick={() => {
                  setFilter(item);
                  onNotify(`Đang lọc hộp thư: ${item}`);
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loadingInbox && <div className="p-4 text-sm text-slate-500">Đang tải hội thoại...</div>}
          {!loadingInbox && visibleConversations.length === 0 && <div className="p-4 text-sm text-slate-500">Chưa có hội thoại. Mở `/user_chat` và gửi một tin nhắn để đồng bộ vào đây.</div>}
          {visibleConversations.map((conv) => {
            const label = inboxStatusLabel(conv.status);
            const color = inboxStatusColor(conv.status);
            return (
            <div
              key={conv.id}
              onClick={() => {
                setSelectedChat(conv.id);
                if (conv.status === 'needs_review') onNavigate('approval');
              }}
              className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                selectedChat === conv.id ? 'bg-slate-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-900">{conv.customer_name}</span>
                <span className="text-xs text-slate-500">{conv.channel === 'user_chat' ? 'Web chat' : conv.channel}</span>
              </div>
              <p className="text-sm text-slate-600 mb-2">{conv.customer_phone || 'Chưa có số điện thoại'}</p>
              <span className={`text-xs px-2 py-1 rounded-full ${
                color === 'teal' ? 'bg-teal-50 text-teal-700' :
                color === 'coral' ? 'bg-coral-50 text-coral-700' :
                color === 'blue' ? 'bg-blue-50 text-blue-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {label}
              </span>
            </div>
          )})}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Hội thoại với {selectedConversation?.customer_name || customerName}</h3>
          {selectedConversation?.customer_phone && <p className="mt-1 text-xs text-slate-500">{selectedConversation.customer_phone}</p>}
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {storedMessages.length > 0 ? storedMessages.map((item) => (
            <ChatMessage key={item.id} sender={item.sender === 'customer' ? 'customer' : 'ai'} text={item.content} />
          )) : (
            <ChatMessage sender="ai" text="Chưa có tin nhắn trong hội thoại này. Tin nhắn từ `/user_chat` sẽ hiện ở đây sau khi khách gửi." />
          )}
          {sending && <ChatMessage sender="ai" text="Agentify đang gọi LLM, tìm sản phẩm trong KiotViet và kiểm tra tồn kho..." />}
        </div>
        <div className="p-4 border-t border-slate-200">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <input
              type="text"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Tên khách"
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              type="text"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="Số điện thoại nếu không có trong tin nhắn"
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="mb-3 w-full px-4 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Nhập tin nhắn khách hàng..."
          />
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => {
                setAiPaused(!aiPaused);
                onNotify(aiPaused ? 'AI đã tiếp tục xử lý hội thoại' : 'AI đã tạm dừng cho hội thoại này');
              }}
              className={`px-4 py-2 text-sm border rounded-lg ${
                aiPaused ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-300 hover:bg-slate-50'
              }`}
            >
              {aiPaused ? 'Tiếp tục AI' : 'Tạm dừng AI'}
            </button>
            <button
              onClick={() => onOpenModal('edit-conversation')}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Nhân viên tiếp quản
            </button>
            <button
              disabled={sending}
              className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60"
              onClick={sendDemoMessage}
            >
              {sending ? 'Đang xử lý...' : 'Gửi cho AI xử lý'}
            </button>
          </div>
          <button onClick={() => onNavigate('calendar')} className="text-sm font-semibold text-teal-700 hover:text-teal-800">Mở màn lịch hẹn demo</button>
        </div>
      </div>

      {/* AI Actions Panel */}
      <div className="w-80 bg-slate-50 border-l border-slate-200 p-4 overflow-auto">
        <h3 className="font-semibold text-slate-900 mb-4">AI đã làm gì?</h3>
        <div className="space-y-3">
          {(demoResult?.actions || [
            { type: 'ready', status: 'success', summary: 'Sẵn sàng nhận tin nhắn và gọi backend thật' },
            { type: 'tool', status: 'success', summary: 'LLM sẽ chọn tool: tìm sản phẩm, check tồn, tạo đơn nháp' }
          ]).map((action, index) => (
            <ActionCard key={`${action.type}-${index}`} icon={action.status === 'success' ? CheckCircle2 : AlertCircle} text={action.summary} />
          ))}
        </div>
        <div className="mt-6 p-4 bg-teal-50 rounded-lg border border-teal-100">
          <h4 className="font-semibold text-teal-900 mb-2">Kết quả</h4>
          <p className="text-sm text-teal-700">
            {demoResult?.order ? `Đã tạo đơn nháp #${demoResult.order.id}, tổng ${Number(demoResult.order.total).toLocaleString('vi-VN')}đ.` : 'Chưa có đơn. Gửi tin nhắn demo để tạo kết quả thật.'}
          </p>
          {demoResult?.shipment && (
            <p className="mt-2 text-sm font-semibold text-teal-900">
              GHN: {demoResult.shipment.order_code || 'chưa có mã'} · {demoResult.shipment.status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarScreen({ onNavigate, onOpenModal, onNotify }: { onNavigate: (screen: Screen) => void, onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void }) {
  const [selectedAppointment, setSelectedAppointment] = useState<number | null>(null);
  const appointments = [
    { name: 'Nguyễn Thảo', service: 'Soi da và tư vấn mụn', day: 'Thứ Sáu', time: '14:30', status: 'AI đã đặt', color: 'teal', phone: '0901234567' },
    { name: 'Minh Anh', service: 'Tư vấn laser', day: 'Thứ Bảy', time: '10:00', status: 'Đã xác nhận', color: 'blue', phone: '0912345678' },
    { name: 'Phạm Linh', service: 'Chăm sóc phục hồi da', day: 'Thứ Tư', time: '09:30', status: 'Đã nhắc lịch', color: 'green', phone: '0923456789' },
    { name: 'Bảo Ngọc', service: 'Tư vấn peel da', day: 'Thứ Sáu', time: '16:00', status: 'Chờ xác nhận', color: 'slate', phone: '0934567890' }
  ];

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-900 mb-6">Lịch hẹn</h2>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-6">
          <div className="grid grid-cols-7 gap-4 mb-4">
            {['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'].map((day) => (
              <div key={day} className="text-center">
                <div className="text-sm font-semibold text-slate-700 mb-2">{day}</div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {appointments.map((apt, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedAppointment(idx)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedAppointment === idx ? 'ring-2 ring-teal-500' : ''
                } ${
                  apt.color === 'teal' ? 'bg-teal-50 border-teal-200 hover:bg-teal-100' :
                  apt.color === 'blue' ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' :
                  apt.color === 'green' ? 'bg-green-50 border-green-200 hover:bg-green-100' :
                  'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-900">{apt.name}</span>
                  <span className="text-sm text-slate-600">{apt.day}, {apt.time}</span>
                </div>
                <p className="text-sm text-slate-700 mb-2">{apt.service}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    apt.color === 'teal' ? 'bg-teal-100 text-teal-700' :
                    apt.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                    apt.color === 'green' ? 'bg-green-100 text-green-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {apt.status}
                  </span>
                  {selectedAppointment === idx && (
                    <div className="flex gap-2">
                      <button className="p-1.5 hover:bg-white rounded" onClick={(e) => { e.stopPropagation(); onNotify(`Đang gọi ${apt.name} qua số ${apt.phone}`); }}>
                        <Phone className="w-4 h-4 text-teal-600" />
                      </button>
                      <button className="p-1.5 hover:bg-white rounded" onClick={(e) => { e.stopPropagation(); onNavigate('inbox'); }}>
                        <MessageSquare className="w-4 h-4 text-teal-600" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Trợ lý đặt lịch</h3>
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold text-teal-600">38</div>
              <div className="text-sm text-slate-600">Lịch hẹn tạo trong tuần</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-teal-600">24</div>
              <div className="text-sm text-slate-600">Khách đã được nhắc lịch</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">6</div>
              <div className="text-sm text-slate-600">Yêu cầu đổi lịch đã xử lý</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-coral-600">9</div>
              <div className="text-sm text-slate-600">Khách có nguy cơ không đến</div>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <button
              onClick={() => onNavigate('inbox')}
              className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Xem hội thoại gốc
            </button>
            <button
              onClick={() => {
                onOpenModal('appointment-detail');
              }}
              className="w-full px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Gửi nhắc lịch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowsScreen({ workflows, setWorkflows, onOpenModal, onNotify }: { workflows: WorkflowItem[], setWorkflows: Dispatch<SetStateAction<WorkflowItem[]>>, onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void }) {
  const toggleWorkflow = (id: number) => {
    setWorkflows((current) => current.map(w =>
      w.id === id ? { ...w, status: w.status === 'active' ? 'paused' : 'active' } : w
    ));
    onNotify('Đã cập nhật trạng thái quy trình');
  };

  const removeWorkflow = (id: number) => {
    const workflow = workflows.find((w) => w.id === id);
    setWorkflows((current) => current.filter((w) => w.id !== id));
    onNotify(`Đã xóa quy trình mẫu${workflow ? `: ${workflow.name}` : ''}`);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Quy trình tự động</h2>
          <p className="text-slate-600">Quản lý các quy trình AI tự động cho Lumi Clinic</p>
        </div>
        <button
          onClick={() => onOpenModal('create-workflow')}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="w-5 h-5" />
          Tạo quy trình mới
        </button>
      </div>

      <div className="grid gap-4">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => toggleWorkflow(workflow.id)}
                  className={`p-2 rounded-lg ${
                    workflow.status === 'active' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {workflow.status === 'active' ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </button>
                <div>
                  <h3 className="font-semibold text-slate-900">{workflow.name}</h3>
                  {workflow.description && (
                    <p className="mt-1 max-w-xl text-sm text-slate-600">{workflow.description}</p>
                  )}
                  <span className={`text-sm ${
                    workflow.status === 'active' ? 'text-teal-600' : 'text-slate-500'
                  }`}>
                    {workflow.status === 'active' ? 'Đang hoạt động' : 'Đã tạm dừng'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{workflow.triggers}</div>
                  <div className="text-sm text-slate-600">Lần kích hoạt</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-teal-600">{workflow.conversions}</div>
                  <div className="text-sm text-slate-600">Thành công</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onOpenModal('create-workflow')}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <Edit className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    onClick={() => removeWorkflow(workflow.id)}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <Trash2 className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>
            {workflow.status === 'active' && (
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-teal-500 h-2 rounded-full"
                  style={{ width: `${workflow.triggers > 0 ? (workflow.conversions / workflow.triggers) * 100 : 4}%` }}
                ></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsScreen({ onOpenModal, onNotify, kiotStatus, ghnStatus, productCount, onRefresh, authToken }: { onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void, kiotStatus: KiotVietStatus, ghnStatus: GHNStatus, productCount: number, onRefresh: () => void, authToken: string | null }) {
  const integrations = [
    { name: 'KiotViet', status: kiotStatus.status === 'connected' ? 'connected' : 'disconnected', icon: '🏪', lastSync: kiotStatus.last_sync_at ? 'Vừa đồng bộ' : 'Chưa đồng bộ', products: productCount },
    { name: 'GHN', status: ghnStatus.status === 'connected' ? 'connected' : 'disconnected', icon: '🚚', lastSync: ghnStatus.status === 'connected' ? `${ghnStatus.env} · ${ghnStatus.shop_id || 'đã cấu hình'}` : 'Chưa cấu hình' },
  ];

  const syncKiotViet = async () => {
    try {
      await apiRequest('/api/integrations/kiotviet/sync-products', { method: 'POST' }, authToken);
      await onRefresh();
      onNotify('Đã đồng bộ sản phẩm KiotViet từ backend');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Không đồng bộ được KiotViet');
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Kết nối hệ thống</h2>
          <p className="text-slate-600">MVP hiện dùng KiotViet để quản lý hàng hóa và GHN để gửi vận đơn.</p>
        </div>
        <button
          onClick={() => onOpenModal('connect-system')}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="w-5 h-5" />
          Kết nối mới
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {integrations.map((integration, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{integration.icon}</div>
                <div>
                  <h3 className="font-semibold text-slate-900">{integration.name}</h3>
                  <span className={`text-sm ${
                    integration.status === 'connected' ? 'text-teal-600' : 'text-slate-500'
                  }`}>
                    {integration.status === 'connected' ? 'Đã kết nối' : 'Chưa kết nối'}
                  </span>
                </div>
              </div>
              {integration.status === 'connected' && (
                <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
              )}
            </div>

            {integration.status === 'connected' ? (
              <>
                <div className="text-sm text-slate-600 mb-4">
                  Đồng bộ: {integration.lastSync}
                  {integration.name === 'KiotViet' && (
                    <div className="mt-1 font-semibold text-slate-900">{productCount} sản phẩm trong cache</div>
                  )}
                  {integration.name === 'GHN' && (
                    <div className="mt-1 font-semibold text-slate-900">{ghnStatus.from_name || 'Kho gửi'} · {ghnStatus.from_phone || 'đã cấu hình'}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => integration.name === 'KiotViet' ? syncKiotViet() : onRefresh()}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Đồng bộ
                  </button>
                  <button
                    onClick={() => onOpenModal('integration-settings')}
                    className="flex-1 px-3 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Cài đặt
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => onOpenModal('connect-system')}
                className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Kết nối ngay
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShippingScreen({ onNotify, authToken }: { onNotify: (message: string) => void, authToken: string | null }) {
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadShipments = async () => {
    setLoading(true);
    try {
      const rows = await apiRequest<ShipmentItem[]>('/api/shipments', undefined, authToken);
      setShipments(rows);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Không tải được danh sách vận đơn GHN');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, []);

  const refreshShipment = async (shipment: ShipmentItem) => {
    try {
      const updated = await apiRequest<ShipmentItem>(`/api/shipments/${shipment.id}/refresh`, { method: 'POST' }, authToken);
      setShipments((current) => current.map((item) => item.id === updated.id ? updated : item));
      onNotify(`Đã cập nhật vận đơn ${updated.provider_order_code || updated.id} từ GHN`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Không cập nhật được vận đơn');
    }
  };

  const activeCount = shipments.filter((item) => !['delivered', 'delivered_to_client', 'finish'].includes(item.status)).length;
  const deliveredCount = shipments.length - activeCount;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Vận chuyển GHN</h2>
          <p className="text-slate-600">Theo dõi các vận đơn được Agentify tự động gửi sang GHN sandbox sau khi khách xác nhận đơn.</p>
        </div>
        <button onClick={loadShipments} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
          <RefreshCw className="h-4 w-4" />
          Tải lại
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard icon={Truck} label="Tổng vận đơn GHN" value={String(shipments.length)} color="teal" />
        <StatCard icon={Clock} label="Đang xử lý/giao" value={String(activeCount)} />
        <StatCard icon={CheckCircle2} label="Đã hoàn tất" value={String(deliveredCount)} color="teal" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          <div>Mã vận đơn</div>
          <div>Mã đơn nội bộ</div>
          <div>Trạng thái</div>
          <div>Dự kiến giao</div>
          <div></div>
        </div>
        {loading && <div className="p-5 text-sm text-slate-500">Đang tải vận đơn...</div>}
        {!loading && shipments.length === 0 && (
          <div className="p-5 text-sm text-slate-500">
            Chưa có vận đơn. Khi backend có GHN_TOKEN/GHN_SHOP_ID và khách xác nhận đơn, vận đơn sẽ xuất hiện tại đây.
          </div>
        )}
        {shipments.map((shipment) => (
          <div key={shipment.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0">
            <div className="font-bold text-slate-950">{shipment.provider_order_code || 'Chưa có mã'}</div>
            <div className="text-slate-700">{shipment.client_order_code || `Order #${shipment.order_id}`}</div>
            <div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{shipment.status}</span>
            </div>
            <div className="text-slate-600">{shipment.expected_delivery_time || 'Chưa có'}</div>
            <button onClick={() => refreshShipment(shipment)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
              Cập nhật GHN
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsScreen({ onOpenModal, onNotify }: { onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void }) {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Báo cáo</h2>
          <p className="text-slate-600">Phân tích hiệu suất nhân viên AI</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onOpenModal('report-filter')}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Filter className="w-5 h-5" />
            Bộ lọc
          </button>
          <button
            onClick={() => {
              onOpenModal('report-export');
              onNotify('Đang chuẩn bị báo cáo mẫu');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Download className="w-5 h-5" />
            Xuất báo cáo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-sm text-slate-600 mb-1">Tổng hội thoại</div>
          <div className="text-3xl font-bold text-slate-900 mb-1">1,847</div>
          <div className="flex items-center gap-1 text-sm text-teal-600">
            <ArrowUpRight className="w-4 h-4" />
            <span>+24% so với tuần trước</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-sm text-slate-600 mb-1">Tỷ lệ tự động hóa</div>
          <div className="text-3xl font-bold text-teal-600 mb-1">71%</div>
          <div className="flex items-center gap-1 text-sm text-teal-600">
            <ArrowUpRight className="w-4 h-4" />
            <span>+8% so với tuần trước</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-sm text-slate-600 mb-1">Thời gian phản hồi TB</div>
          <div className="text-3xl font-bold text-slate-900 mb-1">12s</div>
          <div className="flex items-center gap-1 text-sm text-teal-600">
            <ArrowUpRight className="w-4 h-4" />
            <span>Giảm 6s so với tuần trước</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-sm text-slate-600 mb-1">Lịch hẹn đã tạo</div>
          <div className="text-3xl font-bold text-slate-900 mb-1">247</div>
          <div className="flex items-center gap-1 text-sm text-teal-600">
            <ArrowUpRight className="w-4 h-4" />
            <span>+18% so với tuần trước</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Xu hướng hội thoại</h3>
          <div className="h-64 flex items-end gap-2">
            {[65, 72, 58, 81, 69, 88, 92].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-teal-500 rounded-t" style={{ height: `${height}%` }}></div>
                <div className="text-xs text-slate-600 mt-2">T{i + 2}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Phân loại hội thoại</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-700">Tư vấn dịch vụ</span>
                <span className="text-sm font-semibold text-slate-900">42%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-teal-500 h-2 rounded-full" style={{ width: '42%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-700">Đặt lịch hẹn</span>
                <span className="text-sm font-semibold text-slate-900">28%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '28%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-700">Hỏi giá</span>
                <span className="text-sm font-semibold text-slate-900">18%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '18%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-700">Khiếu nại</span>
                <span className="text-sm font-semibold text-slate-900">7%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-coral-500 h-2 rounded-full" style={{ width: '7%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-700">Khác</span>
                <span className="text-sm font-semibold text-slate-900">5%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-slate-500 h-2 rounded-full" style={{ width: '5%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsScreen({ onOpenModal, onNotify }: { onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void }) {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [autoBook, setAutoBook] = useState(true);
  const [autoRemind, setAutoRemind] = useState(true);

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-900 mb-6">Cài đặt</h2>

      <div className="max-w-4xl space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Cài đặt chung</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div>
                <div className="font-medium text-slate-900">Tên không gian làm việc</div>
                <div className="text-sm text-slate-600">Lumi Clinic</div>
              </div>
              <button onClick={() => onOpenModal('edit-setting')} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Chỉnh sửa</button>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div>
                <div className="font-medium text-slate-900">Múi giờ</div>
                <div className="text-sm text-slate-600">GMT+7 (Việt Nam)</div>
              </div>
              <button onClick={() => onOpenModal('edit-setting')} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Thay đổi</button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium text-slate-900">Ngôn ngữ</div>
                <div className="text-sm text-slate-600">Tiếng Việt</div>
              </div>
              <button onClick={() => onOpenModal('edit-setting')} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Thay đổi</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Cài đặt AI</h3>
          <div className="space-y-4">
            <ToggleSetting
              label="Bật nhân viên AI"
              description="Cho phép AI tự động xử lý hội thoại với khách hàng"
              value={aiEnabled}
              onChange={setAiEnabled}
            />
            <ToggleSetting
              label="Tự động đặt lịch"
              description="AI có thể tự đặt lịch hẹn mà không cần xác nhận"
              value={autoBook}
              onChange={setAutoBook}
            />
            <ToggleSetting
              label="Tự động nhắc lịch"
              description="Gửi tin nhắn nhắc lịch trước 2 tiếng"
              value={autoRemind}
              onChange={setAutoRemind}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Thành viên nhóm</h3>
          <div className="space-y-3">
            {['Mai Anh (Quản lý)', 'Bảo Trâm (Nhân viên)', 'Hoàng Linh (Nhân viên)'].map((member, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-teal-700">{member[0]}</span>
                  </div>
                  <span className="text-slate-900">{member}</span>
                </div>
                <button onClick={() => onOpenModal('member-detail')} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Quản lý</button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              onOpenModal('invite-member');
              onNotify('Đang mở form mời thành viên');
            }}
            className="mt-4 flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Plus className="w-5 h-5" />
            Mời thành viên mới
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleSetting({ label, description, value, onChange }: any) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100">
      <div>
        <div className="font-medium text-slate-900">{label}</div>
        <div className="text-sm text-slate-600">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          value ? 'bg-teal-600' : 'bg-slate-300'
        }`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
          value ? 'translate-x-6' : ''
        }`}></div>
      </button>
    </div>
  );
}

function CreateWorkflowModal({ onClose, onCreate }: { onClose: () => void, onCreate: (description: string) => void }) {
  const [description, setDescription] = useState('Khi khách hỏi về liệu trình mụn nhưng chưa đặt lịch, AI hãy tư vấn gói soi da, hỏi thời gian phù hợp, kiểm tra lịch trống và tự đặt lịch nếu khách đồng ý.');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCreate = () => {
    setIsGenerating(true);
    window.setTimeout(() => {
      onCreate(description);
      onClose();
    }, 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-2xl w-full mx-4">
        {isGenerating ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-teal-50">
              <RefreshCw className="h-10 w-10 animate-spin text-teal-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">AI đang tạo quy trình</h3>
            <p className="mx-auto mt-3 max-w-md text-slate-600">
              Agentify đang đọc mô tả, xác định điều kiện kích hoạt, hành động cần làm và guardrail phù hợp cho Lumi Clinic.
            </p>
            <div className="mx-auto mt-8 h-2 max-w-sm overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-teal-600" />
            </div>
          </div>
        ) : (
        <>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900">Tạo quy trình mới</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Mô tả quy trình bằng tiếng Việt</label>
            <textarea
              rows={7}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ví dụ: Khi khách hỏi giá peel da nhưng chưa chốt, AI hãy tư vấn gói phù hợp, hỏi lịch rảnh, kiểm tra lịch trống và nhắc lại sau 12 giờ nếu khách chưa trả lời."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            ></textarea>
            <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-800">
              Bạn chỉ cần mô tả bằng ngôn ngữ tự nhiên. Agentify sẽ tự suy ra điều kiện kích hoạt, hành động, dữ liệu cần gọi và trường hợp cần nhân viên duyệt.
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              Hủy
            </button>
            <button
              onClick={handleCreate}
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Tạo bằng AI
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function ConnectSystemModal({ onClose, onNotify }: { onClose: () => void, onNotify: (message: string) => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900">Kết nối hệ thống mới</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: 'Pancake', icon: '🥞', desc: 'Quản lý khách hàng' },
            { name: 'Sapo', icon: '🛍️', desc: 'Bán hàng và đơn hàng' },
            { name: 'Instagram', icon: '📷', desc: 'Tin nhắn Instagram' },
            { name: 'Telegram', icon: '✈️', desc: 'Tin nhắn Telegram' },
            { name: 'Thư điện tử', icon: '📧', desc: 'Gửi thư tự động' },
            { name: 'Tin nhắn SMS', icon: '💬', desc: 'Tin nhắn chăm sóc khách' }
          ].map((system, i) => (
            <button
              key={i}
              onClick={() => {
                onNotify(`Đã bắt đầu kết nối ${system.name}`);
                onClose();
              }}
              className="p-4 border-2 border-slate-200 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all text-left"
            >
              <div className="text-3xl mb-2">{system.icon}</div>
              <div className="font-semibold text-slate-900">{system.name}</div>
              <div className="text-sm text-slate-600">{system.desc}</div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-6 w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
          Đóng
        </button>
      </div>
    </div>
  );
}

function EditConversationModal({ onClose, onNotify }: { onClose: () => void, onNotify: (message: string) => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900">Nhân viên tiếp quản</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-slate-700 mb-6">
          Bạn có chắc muốn tiếp quản hội thoại này? AI sẽ tạm dừng và bạn sẽ trò chuyện trực tiếp với khách hàng.
        </p>
        <div className="space-y-3">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                Khi tiếp quản, tất cả tin nhắn mới sẽ được gửi đến bạn. Bạn có thể bật lại AI bất cứ lúc nào.
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ghi chú (tùy chọn)</label>
            <textarea
              rows={3}
              placeholder="Lý do tiếp quản hội thoại..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            ></textarea>
          </div>
        </div>
        <div className="flex gap-3 pt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
            Hủy
          </button>
          <button
            onClick={() => {
              onNotify('Nhân viên đã tiếp quản hội thoại');
              onClose();
            }}
            className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Xác nhận tiếp quản
          </button>
        </div>
      </div>
    </div>
  );
}

function ApprovalScreen({ onOpenModal, onNotify }: { onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void }) {
  const [approved, setApproved] = useState(false);
  const [selectedId, setSelectedId] = useState(1);
  const items = [
    { id: 1, name: 'Lan Phương', reason: 'Câu hỏi liên quan da nhạy cảm', priority: 'Cao', message: 'Da em đang dùng thuốc bôi bác sĩ kê, vậy em có peel da được không?', reply: 'Dạ trường hợp mình đang dùng thuốc bôi theo chỉ định bác sĩ, Lumi Clinic cần chuyên viên kiểm tra kỹ trước khi tư vấn peel da. Em sẽ chuyển thông tin cho chuyên viên để hỗ trợ chị an toàn hơn ạ.' },
    { id: 2, name: 'Thu Hà', reason: 'Khiếu nại hoàn tiền', priority: 'Cao', message: 'Em đã mua gói chăm sóc da nhưng muốn hoàn tiền vì chưa sắp xếp đi được.', reply: 'Dạ em đã ghi nhận yêu cầu hoàn tiền của chị. Bộ phận chăm sóc khách hàng sẽ kiểm tra chính sách gói dịch vụ và phản hồi lại trong hôm nay ạ.' },
    { id: 3, name: 'Ngọc Mai', reason: 'AI chưa đủ chắc chắn', priority: 'Trung bình', message: 'Em muốn làm liệu trình vừa trị mụn vừa trắng da trong 1 tuần được không?', reply: 'Dạ để tư vấn đúng tình trạng da, Lumi Clinic cần soi da trước khi đề xuất liệu trình phù hợp. Em có thể hỗ trợ chị đặt lịch soi da miễn phí ạ.' }
  ];
  const selectedItem = items.find((item) => item.id === selectedId) || items[0];

  return (
    <div className="h-full flex">
      <div className="w-80 bg-white border-r border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 mb-4">Việc cần nhân viên duyệt</h3>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setSelectedId(item.id);
                setApproved(false);
              }}
              className={`p-4 border rounded-lg hover:bg-slate-50 cursor-pointer ${selectedId === item.id ? 'border-teal-300 bg-teal-50' : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-900">{item.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  item.priority === 'Cao' ? 'bg-coral-100 text-coral-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {item.priority}
                </span>
              </div>
              <p className="text-sm text-slate-600">{item.reason}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl">
          <h3 className="text-2xl font-bold text-slate-900 mb-2">{selectedItem.name}</h3>
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h4 className="font-semibold text-slate-900 mb-3">Tin nhắn khách</h4>
            <p className="text-slate-700 mb-4 p-4 bg-slate-50 rounded-lg">
              "{selectedItem.message}"
            </p>

            <div className="p-4 bg-coral-50 border border-coral-200 rounded-lg mb-4">
              <h4 className="font-semibold text-coral-900 mb-2">Lý do cần duyệt</h4>
              <p className="text-sm text-coral-700">
                Câu hỏi có yếu tố rủi ro liên quan tình trạng da và thuốc đang sử dụng. AI không tự gửi câu trả lời khi chưa có nhân viên duyệt.
              </p>
            </div>

            <h4 className="font-semibold text-slate-900 mb-3">Câu trả lời AI đề xuất</h4>
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg mb-6">
              <p className="text-slate-700">
                "{selectedItem.reply}"
              </p>
            </div>

            {approved ? (
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span className="text-teal-700 font-medium">Đã duyệt và gửi</span>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setApproved(true);
                    onNotify('Đã duyệt và gửi câu trả lời AI đề xuất');
                  }}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Duyệt và gửi
                </button>
                <button onClick={() => onOpenModal('edit-conversation')} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                  Sửa trước khi gửi
                </button>
                <button onClick={() => onNotify('Đã giao việc này cho Mai Anh xử lý')} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                  Giao cho nhân viên
                </button>
                <button onClick={() => onNotify('Đã từ chối câu trả lời AI đề xuất')} className="px-4 py-2 border border-coral-300 text-coral-700 rounded-lg hover:bg-coral-50">
                  Từ chối
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-900 mb-3">Nguyên tắc an toàn</h4>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5" />
                <span>Không tự trả lời câu hỏi rủi ro</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5" />
                <span>Không tự cam kết hiệu quả điều trị</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5" />
                <span>Mọi hành động đều được ghi lại</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5" />
                <span>Nhân viên có thể tiếp quản bất cứ lúc nào</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color = 'slate', onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 p-6 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${
          color === 'teal' ? 'bg-teal-50' :
          color === 'coral' ? 'bg-coral-50' :
          'bg-slate-50'
        }`}>
          <Icon className={`w-5 h-5 ${
            color === 'teal' ? 'text-teal-600' :
            color === 'coral' ? 'text-coral-600' :
            'text-slate-600'
          }`} />
        </div>
      </div>
      <div className={`text-3xl font-bold mb-1 ${
        color === 'teal' ? 'text-teal-600' :
        color === 'coral' ? 'text-coral-600' :
        'text-slate-900'
      }`}>
        {value}
      </div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}

function FlowStep({ number, title, description }: any) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-semibold">
        {number}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-slate-900">{title}</div>
        {description && <div className="text-sm text-slate-600 mt-1">{description}</div>}
      </div>
    </div>
  );
}

function AutomationItem({ label, percentage }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-700">{label}</span>
        <span className="text-sm font-semibold text-teal-600">{percentage}% tự xử lý</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

function SystemCard({ name, connected }: any) {
  return (
    <div className={`p-3 rounded-lg border ${
      connected ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'
    }`}>
      <div className="font-semibold text-sm text-slate-900 mb-1">{name}</div>
      <div className={`text-xs ${connected ? 'text-teal-700' : 'text-slate-500'}`}>
        {connected ? 'Đã kết nối' : 'Chưa kết nối'}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
      active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`}>
      {label}
    </button>
  );
}

function ChatMessage({ sender, text }: any) {
  return (
    <div className={`flex ${sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-lg px-4 py-3 rounded-2xl ${
        sender === 'customer'
          ? 'bg-blue-600 text-white'
          : 'bg-slate-100 text-slate-900'
      }`}>
        <p className="whitespace-pre-line text-sm">{text}</p>
      </div>
    </div>
  );
}

function LlmProductPanel({ products, onChoose }: { products: AgentChatResponse['recommended_products'], onChoose: (product: AgentChatResponse['recommended_products'][number]) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 font-semibold text-slate-900">Sản phẩm Lumi Beauty gợi ý</div>
      <div className="grid gap-3 md:grid-cols-2">
        {products.map((product) => (
          <button key={product.id} onClick={() => onChoose(product)} className="rounded-xl border border-slate-200 p-4 text-left hover:border-teal-300 hover:bg-teal-50">
            <div className="font-semibold text-slate-950">{product.name}</div>
            <div className="mt-1 text-sm text-slate-600">{product.reason}</div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-500">Còn {product.stock}</span>
              <span className="font-bold text-teal-700">{product.price.toLocaleString('vi-VN')}đ</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecommendationPanel({ recommendations, onChoose }: { recommendations: Recommendation[], onChoose: (product: Recommendation) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 font-semibold text-slate-900">Top 5 sản phẩm đề xuất</div>
      <div className="grid gap-3 md:grid-cols-5">
        {recommendations.map((product) => (
          <button key={product.name} onClick={() => onChoose(product)} className="overflow-hidden rounded-xl border border-slate-200 text-left hover:border-teal-400 hover:shadow-sm">
            <img src={product.image} alt={product.name} className="h-28 w-full object-cover" />
            <div className="p-3">
              <div className="line-clamp-2 text-sm font-semibold text-slate-900">{product.name}</div>
              <div className="mt-1 text-xs text-slate-500">{product.skin}</div>
              <div className="mt-2 text-sm font-bold text-teal-700">{product.price.toLocaleString('vi-VN')}đ</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickReplyGroup({ title, options, onChoose }: { title: string, options: string[], onChoose: (option: string) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 text-sm font-semibold text-slate-900">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option} onClick={() => onChoose(option)} className="rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100">
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: { name: string, time: string, service: string } }) {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-xl rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Xác nhận lịch hẹn</div>
            <div className="text-xl font-bold text-slate-950">{appointment.service}</div>
          </div>
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <div><strong>Khách hàng:</strong> {appointment.name}</div>
          <div><strong>Thời gian:</strong> {appointment.time}</div>
          <div><strong>Địa điểm:</strong> Lumi Beauty, tầng 2, 12 Nguyễn Trãi</div>
          <div><strong>Chi phí:</strong> Miễn phí</div>
        </div>
        <div className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
          Chuyên viên sẽ kiểm tra da, ghi nhận phản ứng và đề xuất hướng xử lý an toàn. Chị vui lòng mang sản phẩm đã dùng tới trung tâm.
        </div>
      </div>
    </div>
  );
}

function FakeQrCode() {
  return (
    <div className="grid h-28 w-28 grid-cols-6 grid-rows-6 gap-1 rounded-lg bg-white p-2 ring-1 ring-slate-200">
      {Array.from({ length: 36 }).map((_, index) => (
        <div key={index} className={`${[0, 1, 2, 6, 12, 7, 14, 21, 28, 35, 34, 33, 27, 20, 13, 8, 10, 17, 19, 25, 30].includes(index) ? 'bg-slate-950' : 'bg-slate-100'} rounded-[2px]`} />
      ))}
    </div>
  );
}

function InvoiceCard({ order, paymentMethod, paymentConfirmed = false, eta, deliveryPreference, onPaymentChange }: { order: ChatOrder, paymentMethod?: PaymentMethod, paymentConfirmed?: boolean, eta?: string, deliveryPreference?: string | null, onPaymentChange?: (method: Exclude<PaymentMethod, null>) => void }) {
  const items = order.items || [];
  const paymentLabel = paymentConfirmed ? 'Đã thanh toán' : paymentMethod === 'cod' ? 'Thanh toán khi nhận' : paymentMethod === 'prepaid' ? 'Chờ chuyển khoản' : 'Chờ chọn thanh toán';
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-xl rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">{paymentConfirmed ? 'Hóa đơn đã thanh toán' : 'Hóa đơn tạm tính'}</div>
            <div className="mt-1 text-xl font-bold text-slate-950">Đơn #{order.id}</div>
          </div>
          <div className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{paymentLabel}</div>
        </div>
        <div className="space-y-3 border-y border-slate-200 py-4">
          {items.map((item, index) => (
            <div key={index} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-semibold text-slate-900">{item.name}</div>
                <div className="text-slate-500">Số lượng: {item.quantity}</div>
              </div>
              <div className="font-semibold text-slate-900">{Number(item.price * item.quantity).toLocaleString('vi-VN')}đ</div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-teal-600" />{order.customer_name || 'Chưa có tên người nhận'}</div>
          <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-teal-600" />{order.customer_phone || 'Chưa có số điện thoại'}</div>
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-teal-600" />{order.shipping_address || 'Chưa có địa chỉ giao hàng'}</div>
          {deliveryPreference && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-teal-600" />Khung giờ nhận hàng: {deliveryPreference}</div>}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3">
          <span className="font-semibold text-teal-950">Tổng thanh toán</span>
          <span className="text-xl font-bold text-teal-700">{Number(order.total).toLocaleString('vi-VN')}đ</span>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-900">Hình thức thanh toán</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => onPaymentChange?.('cod')}
              className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${paymentMethod === 'cod' ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-700 hover:border-teal-200 hover:bg-teal-50'}`}
            >
              Thanh toán khi nhận hàng
            </button>
            <button
              onClick={() => onPaymentChange?.('prepaid')}
              className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${paymentMethod === 'prepaid' ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-700 hover:border-teal-200 hover:bg-teal-50'}`}
            >
              Thanh toán trước bằng QR
            </button>
          </div>
          {paymentMethod === 'prepaid' && (
            <div className="mt-3 flex items-center gap-4">
              <FakeQrCode />
              <div className="text-sm text-slate-700">
                <div className="font-semibold">QR thanh toán demo</div>
                <div>Nội dung: AGENTIFY-{order.id}</div>
                <div>Số tiền: {Number(order.total).toLocaleString('vi-VN')}đ</div>
              </div>
            </div>
          )}
          {paymentConfirmed && (
            <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">
              Đã nhận thanh toán. Cảm ơn chị.
            </div>
          )}
        </div>
        {eta && <div className="mt-3 text-sm font-semibold text-slate-700">Dự kiến giao hàng: {eta}</div>}
      </div>
    </div>
  );
}

function DigitalInvoiceCard({ invoice, customerName, customerPhone, shippingAddress }: { invoice: InvoicePayload, customerName: string, customerPhone: string, shippingAddress: string }) {
  const paymentText = invoice.payment_method || 'COD';
  const qrText = `AGENTIFY-INV-${invoice.order_id}-${Math.round(Number(invoice.total))}-${invoice.currency}`;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="rounded-xl border-2 border-slate-900/15 bg-slate-50 p-3">
        <div className="text-center">
          <div className="text-[11px] text-slate-500">CÔNG TY CỔ PHẦN COSMETHIC</div>
          <div className="text-lg font-extrabold tracking-wide">HÓA ĐƠN ĐIỆN TỬ</div>
          <div className="text-xs text-slate-600">Mẫu tham khảo</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
          <div><span className="font-semibold">Mã hóa đơn:</span> {invoice.order_id}</div>
          <div><span className="font-semibold">Ngày:</span> {new Date().toLocaleDateString('vi-VN')}</div>
          <div><span className="font-semibold">Khách:</span> {customerName || 'Khách lẻ'}</div>
          <div><span className="font-semibold">SĐT:</span> {customerPhone || '—'}</div>
          <div className="col-span-2"><span className="font-semibold">Địa chỉ:</span> {shippingAddress || '—'}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-2">Sản phẩm</th>
                <th className="px-2 py-2 text-right">SL</th>
                <th className="px-2 py-2 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={`${item.name}-${index}`} className={index % 2 ? 'bg-slate-50' : ''}>
                  <td className="px-2 py-2">{item.name}</td>
                  <td className="px-2 py-2 text-right">{item.quantity}</td>
                  <td className="px-2 py-2 text-right">{Number(item.line_total).toLocaleString('vi-VN')}đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 space-y-1 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-slate-900">
        <div className="flex items-center justify-between">
          <span>Phương thức</span>
          <span>{paymentText}</span>
        </div>
        <div className="flex items-center justify-between text-lg">
          <span>Tổng thanh toán</span>
          <span>{Number(invoice.total).toLocaleString('vi-VN')} {invoice.currency}</span>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&margin=10&data=${encodeURIComponent(qrText)}`}
          alt="QR hóa đơn"
          className="h-28 w-28 rounded-lg border border-slate-200 bg-white"
        />
        <div className="min-w-0 flex-1 text-xs text-slate-700">
          <div className="font-semibold">Mã QR thanh toán</div>
          <div className="mt-1 break-all">{qrText}</div>
          <div className="mt-2 text-[11px] text-slate-500">Quét QR để thanh toán hoặc đối soát trên hệ thống.</div>
        </div>
      </div>
    </div>
  );
}

function ShipmentChatCard({ shipment }: { shipment: ShipmentSummary }) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">GHN Sandbox</div>
            <div className="text-lg font-bold text-slate-950">Thông tin vận chuyển</div>
          </div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{shipment.status}</span>
      </div>
      <div className="grid gap-2 text-sm text-slate-700">
        <div className="flex items-center justify-between gap-3">
          <span>Mã vận đơn</span>
          <span className="font-bold text-slate-950">{shipment.order_code || 'Chưa có'}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Phí vận chuyển</span>
          <span className="font-semibold">{Number(shipment.fee || 0).toLocaleString('vi-VN')}đ</span>
        </div>
        {shipment.expected_delivery_time && (
          <div className="flex items-center justify-between gap-3">
            <span>Dự kiến giao</span>
            <span className="font-semibold">{shipment.expected_delivery_time}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, text }: any) {
  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200">
      <Icon className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
      <span className="text-sm text-slate-700">{text}</span>
    </div>
  );
}

function DemoModal({ title, children, onClose, primary, onPrimary }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-xl w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-6">{children}</div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
            Đóng
          </button>
          {primary && (
            <button onClick={onPrimary} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
              {primary}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] bg-slate-900 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3">
      <CheckCircle2 className="w-5 h-5 text-teal-300" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
