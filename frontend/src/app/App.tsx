import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { LayoutDashboard, Mail, Calendar, AlertCircle, Workflow, Link2, BarChart3, Settings, Bell, ChevronRight, CheckCircle2, Clock, Zap, Users, MessageSquare, Plus, X, Facebook as FacebookIcon, RefreshCw, Download, Filter, Search, ArrowUpRight, Phone, MapPin, ArrowLeft, Send, Smile, Image, Camera, ArrowRight, Play, Pause, Edit, Trash2 } from 'lucide-react';

type Screen = 'overview' | 'inbox' | 'calendar' | 'approval' | 'workflows' | 'integrations' | 'reports' | 'settings';
type AppMode = 'landing' | 'connect-zalo' | 'loading-zalo' | 'connect-kiotviet' | 'loading-kiotviet' | 'manage';
type Modal = 'create-workflow' | 'connect-system' | 'edit-conversation' | 'appointment-detail' | 'report-filter' | 'report-export' | 'edit-setting' | 'member-detail' | 'invite-member' | 'integration-settings' | null;
type WorkflowItem = { id: number, name: string, status: 'active' | 'paused', triggers: number, conversions: number, description?: string };
type ZaloStatus = { status: string, app_id?: string | null, oa_id?: string | null, token_expires_at?: string | null };
type KiotVietStatus = { status: string, retailer?: string | null, last_sync_at?: string | null };
type ProductItem = { id: number, name: string, code?: string | null, base_price: string, stock: number };
type ChatAction = { type: string, status: string, summary: string };
type ChatOrder = { id: number, kiotviet_order_code?: string | null, status: string, total: string, customer_name?: string | null, customer_phone?: string | null, shipping_address?: string | null, items?: { name: string, quantity: number, price: number }[] };
type InvoiceLineItem = { name: string, quantity: number, unit_price: number, line_total: number };
type InvoicePayload = { order_id: number, status: string, total: number, currency: string, customer_name?: string | null, customer_phone?: string | null, shipping_address?: string | null, items: InvoiceLineItem[], payment_method?: string | null };
type UiEvent = { type: string, status: string, title: string, detail: string };
type DemoChatResponse = {
  conversation_id: number,
  reply: string,
  actions: ChatAction[],
  order: ChatOrder | null,
  invoice: InvoicePayload | null,
  recommended_products: { id: number, name: string, price: number, stock: number, reason: string }[],
  quick_replies: string[],
  ui_events: UiEvent[],
};
type ZaloDemoConnectResponse = { status: string, oa_id: string | null, message: string };
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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
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

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });
  if (!response.ok) {
    let message = 'Không gọi được backend Agentify.';
    try {
      const body = await response.json();
      message = body?.error?.message || message;
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
  const [zaloStatus, setZaloStatus] = useState<ZaloStatus>({ status: 'disconnected' });
  const [kiotStatus, setKiotStatus] = useState<KiotVietStatus>({ status: 'disconnected' });
  const [productCount, setProductCount] = useState(0);
  const [lastDemoResult, setLastDemoResult] = useState<DemoChatResponse | null>(null);
  const [backendReady, setBackendReady] = useState(false);

  const refreshBackendState = async () => {
    try {
      await apiRequest<{ status: string }>('/health');
      setBackendReady(true);
      const zalo = await apiRequest<ZaloStatus>('/api/channels/zalo/connect/status');
      setZaloStatus(zalo);
      const status = await apiRequest<KiotVietStatus>('/api/integrations/kiotviet/status');
      setKiotStatus(status);
      const products = await apiRequest<ProductItem[]>('/api/kiotviet/products');
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zaloConnected = params.get('zalo_connected');
    const message = params.get('message');
    if (zaloConnected === '1') {
      notify('Đã kết nối Zalo OA thành công.');
      setAppMode('connect-kiotviet');
      void refreshBackendState();
    } else if (zaloConnected === '0') {
      notify(`Kết nối Zalo OA thất bại: ${message || 'Vui lòng thử lại bằng cách kết nối thủ công.'}`);
      setAppMode('connect-zalo');
    }
    if (zaloConnected) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      setPathname(cleanUrl);
    }
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

  const selectChannel = (channel: string) => {
    setChannelFilter(channel);
    notify(`Đang lọc dữ liệu theo kênh: ${channel}`);
  };

  const startDemo = () => {
    setToast(null);
    setAppMode('connect-zalo');
  };

  const completeZaloFakeAuthorization = async () => {
    setToast(null);
    setAppMode('loading-zalo');
    try {
      await delay(randomConnectDelay());
      const result = await apiRequest<ZaloDemoConnectResponse>('/api/channels/zalo/connect/demo', {
        method: 'POST',
      });
      await refreshBackendState();
      setToast(result.message || 'Đã kết nối Zalo OA.');
      setAppMode('connect-kiotviet');
    } catch (error) {
      setAppMode('connect-zalo');
      notify(error instanceof Error ? error.message : 'Không thể fake kết nối Zalo.');
    }
  };

  const completeKiotVietConnection = async () => {
    setToast(null);
    setAppMode('loading-kiotviet');
    try {
      await delay(randomConnectDelay());
      await apiRequest('/api/integrations/kiotviet/connect/env', {
        method: 'POST',
      });
      const status = await apiRequest<KiotVietStatus>('/api/integrations/kiotviet/status');
      if (status.status !== 'connected' || status.retailer !== 'bietkhongnhe123') {
        throw new Error('Không kết nối được KiotViet từ cấu hình backend.');
      }
      await apiRequest('/api/integrations/kiotviet/sync-products', { method: 'POST' });
      await refreshBackendState();
      setToast('Kết nối KiotViet thành công. Đang mở giao diện quản lý.');
      window.setTimeout(() => {
        setActiveScreen('overview');
        setAppMode('manage');
      }, 700);
    } catch (error) {
      setAppMode('connect-kiotviet');
      notify(error instanceof Error ? error.message : 'Không kết nối được KiotViet');
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
      <div className="size-full bg-[#f7faf8] text-slate-950 overflow-auto">
        <LandingPage
          onEnterDemo={startDemo}
          onEnterChat={() => navigateTo('/user_chat')}
        />
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  if (appMode === 'connect-zalo') {
    return (
      <ZaloConnectScreen
        status={zaloStatus}
        onPrimary={completeZaloFakeAuthorization}
        onBack={() => setAppMode('landing')}
      />
    );
  }

  if (appMode === 'loading-zalo') {
    return <ConnectionLoadingScreen title="Đang kết nối Zalo OA" description="Agentify đang xác thực quyền truy cập và đồng bộ hội thoại mẫu." />;
  }

  if (appMode === 'connect-kiotviet') {
    return (
      <KiotVietConnectScreen
        status={kiotStatus}
        productCount={productCount}
        backendReady={backendReady}
        onPrimary={completeKiotVietConnection}
        onBack={() => setAppMode('connect-zalo')}
        onRefresh={refreshBackendState}
        toast={toast}
      />
    );
  }

  if (appMode === 'loading-kiotviet') {
    return <ConnectionLoadingScreen title="Đang kết nối KiotViet" description="Agentify đang kiểm tra API, lấy dữ liệu dịch vụ và chuẩn bị workflow demo." />;
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
              <span className="font-semibold text-slate-900">Lumi Clinic</span>
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
              <span className="text-sm font-semibold text-teal-700">MA</span>
            </button>
          </div>
        </header>

        {/* Screen Content */}
        <main className="flex-1 overflow-auto">
          {activeScreen === 'overview' && <OverviewScreen onNavigate={setActiveScreen} kiotStatus={kiotStatus} productCount={productCount} lastDemoResult={lastDemoResult} />}
          {activeScreen === 'inbox' && <InboxScreen onNavigate={setActiveScreen} onOpenModal={setModal} onNotify={notify} onDemoResult={setLastDemoResult} />}
          {activeScreen === 'calendar' && <CalendarScreen onNavigate={setActiveScreen} onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'approval' && <ApprovalScreen onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'workflows' && <WorkflowsScreen workflows={workflows} setWorkflows={setWorkflows} onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'integrations' && <IntegrationsScreen onOpenModal={setModal} onNotify={notify} kiotStatus={kiotStatus} productCount={productCount} onRefresh={refreshBackendState} />}
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

function ZaloConnectScreen({
  status,
  onPrimary,
  onBack,
}: {
  status: ZaloStatus,
  onPrimary: () => void,
  onBack: () => void,
}) {
  const isConnected = status.status === 'connected' || status.status === 'demo';

  return (
    <div className="min-h-screen bg-[#edf3f8] px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Bước 1/2
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight">Authorize Agentify + Zalo OA</h1>
            <p className="mt-1 text-sm text-slate-500">Đăng nhập bằng tài khoản shop để tiếp tục kết nối hệ thống.</p>
          </div>
          <button onClick={onBack} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Đóng
          </button>
        </header>

        <section className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <img src="/agentify-logo.png" alt="Agentify" className="h-14 w-14 rounded-xl border border-slate-200 object-cover bg-white" />
            <div className="h-9 w-9 rounded-full bg-[#0084ff] text-white flex items-center justify-center font-bold">Z</div>
            <img
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=60"
              alt="avatar"
              className="h-14 w-14 rounded-full border border-slate-200 object-cover"
            />
            <div>
              <p className="text-sm text-slate-500">Tài khoản shop</p>
              <p className="text-sm font-semibold text-slate-900">@bikestore_demo</p>
            </div>
          </div>

          <h2 className="text-lg font-bold text-slate-900">Agentify muốn truy cập vào Zalo OA của bạn</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Tạo một kết nối an toàn giữa tài khoản shop và Agentify để đọc tin nhắn, phản hồi tự động và kích hoạt quy trình bán hàng.
          </p>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-semibold">Quyền truy cập theo yêu cầu</div>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Nhận tin nhắn từ khách trên Zalo OA</li>
              <li>• Trả lời và gửi nội dung tự động</li>
              <li>• Đồng bộ cuộc hội thoại để quản lý trong dashboard</li>
              <li>• Tạo hóa đơn điện tử sau khi khách đặt đơn</li>
            </ul>
          </div>

          <div className="mt-5 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Trạng thái</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isConnected ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                {isConnected ? 'Sẵn sàng xác nhận lại' : 'Chưa cho phép'}
              </span>
            </div>
            <div className="text-slate-600">Môi trường: shop demo</div>
          </div>

          <div className="mt-6">
            <button
              onClick={onPrimary}
              className="w-full rounded-lg bg-[#0084ff] px-4 py-3 text-sm font-bold text-white shadow hover:opacity-90"
            >
              Cho phép truy cập
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Bấm cho phép để mô phỏng luồng OAuth như app thực tế.
            </p>
          </div>
        </section>
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
      setRecommendedProducts(result.recommended_products || []);
      setQuickReplyOptions(result.quick_replies || []);
      setUiEvents(result.ui_events || []);
      if (result.invoice) {
        const deliveryEvent = (result.ui_events || []).find((event) => event.type === 'zalo_invoice_send');
        appendAi(`Dạ em đã tạo hóa đơn tạm tính #${result.invoice.order_id} trong hội thoại.`);
        appendAi(deliveryEvent?.title || `Đã gửi hóa đơn tạm tính #${result.invoice.order_id} lại cho khách qua luồng Zalo OA.`);
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
  const retailer = status.retailer || 'bietkhongnhe123';
  const clientId = 'aa4618b7-4233-4340-878c-eec4edfb0761';

  return (
    <div className="min-h-screen bg-[#edf3f8] px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Bước 2/2
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight">Authorize Agentify + KiotViet</h1>
            <p className="mt-1 text-sm text-slate-500">Đang dùng cấu hình shop demo trong backend.</p>
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
            <p className="text-sm text-slate-600">Client ID: <span className="font-semibold">{clientId}</span></p>
          </div>

          <h3 className="text-sm font-semibold text-slate-900">Thông tin quyền truy cập</h3>
          <ul className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 space-y-2">
            <li>• Đọc sản phẩm, tồn kho, đơn hàng.</li>
            <li>• Tạo đơn tạm tính cho hội thoại từ Zalo OA.</li>
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
                {connected ? `Đã kết nối ${status.retailer || 'bietkhongnhe123'}` : 'Chưa kết nối'}
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
              {connected ? 'Đồng bộ và mở quản lý' : 'Kết nối KiotViet'}
            </button>
            <button onClick={onRefresh} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-emerald-300 hover:text-emerald-700">
              Kiểm tra lại
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-500">
            Sau 2-4 giây, hệ thống sẽ chuyển sang giao diện quản lý.
          </p>
        </section>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}

function LandingPage({ onEnterDemo, onEnterChat }: { onEnterDemo: () => void, onEnterChat: () => void }) {
  return (
    <div className="min-h-screen bg-[#eef6f3] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-6 px-6 py-8">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-600 text-white">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">Agentify</div>
                <div className="text-sm text-slate-600">Chọn vai trò để bắt đầu demo</div>
              </div>
            </div>
            <div className="rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">
              Zalo OA + KiotViet
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <button
            onClick={onEnterDemo}
            className="group rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 text-white">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Chủ shop</p>
            <h1 className="mt-2 text-2xl font-bold">Giao diện shop</h1>
            <p className="mt-3 min-h-[48px] text-sm leading-6 text-slate-600">
              Vào luồng authorize Agentify với Zalo, tiếp theo là KiotViet, rồi mở trang quản lý vận hành của shop.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
              Mở flow kết nối
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </button>

          <button
            onClick={onEnterChat}
            className="group rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Khách hàng</p>
            <h1 className="mt-2 text-2xl font-bold">Giao diện chat</h1>
            <p className="mt-3 min-h-[48px] text-sm leading-6 text-slate-600">
              Mở màn chat Zalo mobile, giả lập khách nhắn cho shop để tư vấn, đặt hàng, hoàn tiền hoặc xử lý khiếu nại.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
              Chat với shop
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}

function LandingMiniStat({ value, label }: { value: string, label: string }) {
  return (
    <div className="rounded-xl border border-white bg-white/75 p-4 shadow-sm">
      <div className="text-2xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-sm leading-5 text-slate-600">{label}</div>
    </div>
  );
}

function HeroProductMockup({ onEnterDemo }: { onEnterDemo: () => void }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-teal-900/12">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-500">Trung tâm điều phối</div>
            <div className="text-xl font-bold text-slate-950">Lumi Clinic</div>
          </div>
          <div className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">AI đang hoạt động</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockMetric label="Hội thoại hôm nay" value="248" />
          <MockMetric label="AI tự xử lý" value="176" accent />
          <MockMetric label="Lịch hẹn đã tạo" value="38" accent />
          <MockMetric label="Việc cần duyệt" value="11" warning />
        </div>
        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold text-slate-950">Luồng Zalo đang xử lý</div>
            <MessageSquare className="h-4 w-4 text-teal-600" />
          </div>
          <div className="space-y-3 text-sm">
            <div className="ml-auto max-w-[82%] rounded-2xl bg-blue-600 px-3 py-2 text-white">Da em bị mụn ẩn, bên mình có soi da không ạ?</div>
            <div className="max-w-[88%] rounded-2xl bg-slate-100 px-3 py-2 text-slate-800">Dạ có ạ. Chiều thứ Sáu còn khung 14:30 và 16:00.</div>
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-teal-800">
              <div className="font-semibold">Kết quả</div>
              <div>Đã đặt lịch tư vấn mụn lúc 14:30 thứ Sáu.</div>
            </div>
          </div>
        </div>
        <button onClick={onEnterDemo} className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          Bắt đầu kết nối
        </button>
      </div>
    </div>
  );
}

function MockMetric({ label, value, accent, warning }: { label: string, value: string, accent?: boolean, warning?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className={`text-2xl font-bold ${warning ? 'text-coral-600' : accent ? 'text-teal-600' : 'text-slate-950'}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function ProblemCard({ value, label, desc }: { value: string, label: string, desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-4xl font-bold tracking-tight text-slate-950">{value}</div>
      <div className="mt-2 font-semibold text-slate-800">{label}</div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{desc}</p>
    </div>
  );
}

function SolutionStep({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-sm font-bold text-white">{number}</div>
      <h3 className="text-xl font-bold text-slate-950">{title}</h3>
      <p className="mt-3 leading-7 text-slate-600">{desc}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/7 p-5">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">{label}</div>
      <div className="mt-2 text-xl font-bold">{value}</div>
    </div>
  );
}

function OverviewScreen({ onNavigate, kiotStatus, productCount, lastDemoResult }: { onNavigate: (screen: Screen) => void, kiotStatus: KiotVietStatus, productCount: number, lastDemoResult: DemoChatResponse | null }) {
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
        <StatCard icon={Clock} label="Phản hồi trung bình" value="18s" />
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
          <FlowStep number={6} title="AI trả lời khách" description={lastDemoResult?.reply || 'Kết quả sẽ hiện sau khi gửi tin nhắn ở Hộp thư'} />
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
            <SystemCard name="Zalo OA" connected />
            <SystemCard name="Facebook" connected />
            <SystemCard name="Lịch Google" connected />
            <SystemCard name={`KiotViet (${productCount} SP)`} connected={kiotStatus.status === 'connected'} />
            <SystemCard name="Pancake" connected={false} />
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

function IntegrationsScreen({ onOpenModal, onNotify, kiotStatus, productCount, onRefresh }: { onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void, kiotStatus: KiotVietStatus, productCount: number, onRefresh: () => void }) {
  const integrations = [
    { name: 'Zalo OA', status: 'connected', icon: '💬', lastSync: '2 phút trước', messages: 248 },
    { name: 'Tin nhắn Facebook', status: 'connected', icon: '📘', lastSync: '5 phút trước', messages: 124 },
    { name: 'Lịch Google', status: 'connected', icon: '📅', lastSync: '1 phút trước', events: 38 },
    { name: 'KiotViet', status: kiotStatus.status === 'connected' ? 'connected' : 'disconnected', icon: '🏪', lastSync: kiotStatus.last_sync_at ? 'Vừa đồng bộ' : 'Chưa đồng bộ', products: productCount },
    { name: 'Pancake', status: 'disconnected', icon: '🥞', lastSync: null, contacts: 0 },
    { name: 'Sapo', status: 'disconnected', icon: '🛍️', lastSync: null, orders: 0 }
  ];

  const syncKiotViet = async () => {
    try {
      await apiRequest('/api/integrations/kiotviet/sync-products', { method: 'POST' });
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
          <p className="text-slate-600">Quản lý kết nối với các nền tảng và công cụ</p>
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
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => integration.name === 'KiotViet' ? syncKiotViet() : onNotify(`Đã đồng bộ ${integration.name}`)}
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
