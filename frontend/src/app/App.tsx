import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { LayoutDashboard, Mail, Calendar, AlertCircle, Workflow, Link2, BarChart3, Settings, Bell, ChevronRight, CheckCircle2, Clock, Zap, TrendingUp, Users, MessageSquare, Play, Pause, Edit, Trash2, Plus, X, Facebook as FacebookIcon, Check, RefreshCw, Download, Filter, Search, ArrowUpRight, Phone, MapPin } from 'lucide-react';

type Screen = 'overview' | 'inbox' | 'calendar' | 'approval' | 'workflows' | 'integrations' | 'reports' | 'settings';
type AppMode = 'landing' | 'connect-zalo' | 'loading-zalo' | 'connect-kiotviet' | 'loading-kiotviet' | 'connect-calendar' | 'loading-calendar' | 'dashboard';
type Modal = 'create-workflow' | 'connect-system' | 'edit-conversation' | 'appointment-detail' | 'report-filter' | 'report-export' | 'edit-setting' | 'member-detail' | 'invite-member' | 'integration-settings' | null;
type WorkflowItem = { id: number, name: string, status: 'active' | 'paused', triggers: number, conversions: number, description?: string };
type KiotVietStatus = { status: string, retailer?: string | null, last_sync_at?: string | null };
type ProductItem = { id: number, name: string, code?: string | null, base_price: string, stock: number };
type ChatAction = { type: string, status: string, summary: string };
type ChatOrder = { id: number, kiotviet_order_code?: string | null, status: string, total: string, customer_name?: string | null, customer_phone?: string | null, shipping_address?: string | null, items?: { name: string, quantity: number, price: number }[] };
type DemoChatResponse = { conversation_id: number, reply: string, actions: ChatAction[], order: ChatOrder | null };
type AgentChatResponse = { conversation_id: number | null, intent: string, reply: string, recommended_products: { id: number, name: string, price: number, stock: number, reason: string }[], quick_replies: string[], actions: string[] };
type UserChatMessage = { sender: 'customer' | 'ai', text: string };
type ConversationItem = { id: number, customer_name: string, customer_phone?: string | null, channel: string, status: string, created_at: string };
type StoredMessage = { id: number, sender: string, content: string, created_at: string };
type PaymentMethod = 'cod' | 'prepaid' | null;
type Recommendation = { name: string, price: number, fit: string, skin: string, image: string };
type PendingProduct = { name: string, price?: number, stock?: number };

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
  const [productCount, setProductCount] = useState(0);
  const [lastDemoResult, setLastDemoResult] = useState<DemoChatResponse | null>(null);
  const [backendReady, setBackendReady] = useState(false);

  const refreshBackendState = async () => {
    try {
      await apiRequest<{ status: string }>('/health');
      setBackendReady(true);
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

  if (pathname === '/user_chat') {
    return <UserChatScreen />;
  }

  const notify = (message: string) => {
    setToast(message);
  };

  const selectChannel = (channel: string) => {
    setChannelFilter(channel);
    notify(`Đang lọc dữ liệu theo kênh: ${channel}`);
  };

  const startDemo = () => {
    setToast(null);
    setAppMode('connect-zalo');
  };

  const completeConnection = (loadingMode: AppMode, nextMode: AppMode) => {
    setToast(null);
    setAppMode(loadingMode);
    window.setTimeout(() => {
      setAppMode(nextMode);
    }, 3000);
  };

  const completeKiotVietConnection = async (payload?: { retailer: string, client_id: string, client_secret: string }) => {
    setToast(null);
    setAppMode('loading-kiotviet');
    try {
      if (payload?.client_secret) {
        await apiRequest('/api/integrations/kiotviet/connect', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      const status = await apiRequest<KiotVietStatus>('/api/integrations/kiotviet/status');
      if (status.status !== 'connected') {
        throw new Error('Backend chưa có kết nối KiotViet. Vui lòng nhập Client Secret để kết nối.');
      }
      await apiRequest('/api/integrations/kiotviet/sync-products', { method: 'POST' });
      await refreshBackendState();
      window.setTimeout(() => setAppMode('connect-calendar'), 3000);
    } catch (error) {
      setAppMode('connect-kiotviet');
      notify(error instanceof Error ? error.message : 'Không kết nối được KiotViet');
    }
  };

  const enterDashboard = () => {
    setToast(null);
    setActiveScreen('overview');
    setAppMode('dashboard');
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
          onNotify={notify}
        />
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  if (appMode === 'connect-zalo') {
    return (
      <OnboardingScreen
        step={1}
        totalSteps={3}
        title="Kết nối Zalo OA"
        subtitle="Agentify cần đọc tin nhắn từ Zalo OA để hiểu khách hàng và tự xử lý hội thoại."
        systemName="Zalo OA"
        systemDescription="Nhận tin nhắn, đồng bộ thông tin khách hàng và gửi xác nhận qua Zalo."
        permissions={['Đọc hội thoại khách hàng', 'Gửi tin nhắn xác nhận và nhắc lịch', 'Đồng bộ tên và số điện thoại khách hàng']}
        primaryLabel="Kết nối Zalo OA"
        onPrimary={() => completeConnection('loading-zalo', 'connect-kiotviet')}
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

  if (appMode === 'connect-calendar') {
    return (
      <OnboardingScreen
        step={3}
        totalSteps={3}
        title="Kết nối Lịch Google"
        subtitle="Bước này là tuỳ chọn. Kết nối lịch giúp AI kiểm tra khung giờ trống và tự tạo lịch hẹn."
        systemName="Lịch Google"
        systemDescription="Kiểm tra lịch trống, tạo lịch hẹn và đặt nhắc lịch trước giờ khách đến."
        permissions={['Xem khung giờ trống', 'Tạo lịch hẹn mới', 'Đặt nhắc lịch cho khách và nhân viên']}
        primaryLabel="Kết nối Lịch Google"
        secondaryLabel="Bỏ qua bước này"
        onPrimary={() => completeConnection('loading-calendar', 'dashboard')}
        onSecondary={enterDashboard}
        onBack={() => setAppMode('connect-kiotviet')}
      />
    );
  }

  if (appMode === 'loading-calendar') {
    return <ConnectionLoadingScreen title="Đang kết nối Lịch Google" description="Agentify đang đồng bộ lịch hẹn và cấu hình nhắc lịch tự động." />;
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

function UserChatScreen() {
  const [customerName, setCustomerName] = useState(() => window.localStorage.getItem('agentify_user_chat_customer_name') || '');
  const [customerPhone, setCustomerPhone] = useState(() => window.localStorage.getItem('agentify_user_chat_customer_phone') || '');
  const [profileReady, setProfileReady] = useState(() => Boolean(window.localStorage.getItem('agentify_user_chat_customer_name') && window.localStorage.getItem('agentify_user_chat_customer_phone')));
  const [address, setAddress] = useState('12 Nguyễn Trãi, Hà Nội');
  const [message, setMessage] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(() => {
    const saved = window.localStorage.getItem('agentify_user_chat_conversation_id');
    return saved ? Number(saved) : null;
  });
  const [messages, setMessages] = useState<UserChatMessage[]>([
    { sender: 'ai', text: 'Chào chị, Lumi Beauty có thể hỗ trợ chị tư vấn sản phẩm, đặt hàng hoặc chăm sóc sau mua ạ.' }
  ]);
  const [actions, setActions] = useState<ChatAction[]>([]);
  const [llmRecommendations, setLlmRecommendations] = useState<AgentChatResponse['recommended_products']>([]);
  const [llmQuickReplies, setLlmQuickReplies] = useState<string[]>([]);
  const [order, setOrder] = useState<ChatOrder | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Recommendation | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [pendingPurchaseIntent, setPendingPurchaseIntent] = useState<string | null>(null);
  const [pendingProduct, setPendingProduct] = useState<PendingProduct | null>(null);
  const [pendingOrderMessage, setPendingOrderMessage] = useState<string | null>(null);
  const [deliveryPreference, setDeliveryPreference] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<{ name: string, time: string, service: string } | null>(null);
  const [irritationVerified, setIrritationVerified] = useState(false);
  const [showIrritationInfoRequest, setShowIrritationInfoRequest] = useState(false);
  const [showSunscreens, setShowSunscreens] = useState(false);
  const [showBudgetChoices, setShowBudgetChoices] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    let rows = await apiRequest<ProductItem[]>('/api/kiotviet/products');
    if (rows.length === 0) {
      await apiRequest('/api/demo/seed-cosmetics', { method: 'POST' });
      rows = await apiRequest<ProductItem[]>('/api/kiotviet/products');
    }
    setProducts(rows.filter((product) => !product.name.toLowerCase().includes('bánh')).slice(0, 28));
  };

  useEffect(() => {
    loadProducts().catch(() => setError('Chưa kết nối được backend. Hãy chạy docker compose trước.'));
  }, []);

  const appendAi = (text: string) => setMessages((current) => [...current, { sender: 'ai', text }]);
  const appendCustomer = (text: string) => setMessages((current) => [...current, { sender: 'customer', text }]);
  const buildOrderIntent = (product: PendingProduct | null, fallback: string | null) => {
    if (product?.name) return `Đặt cho chị 1 ${product.name}`;
    return fallback || '';
  };
  const rememberConversation = (id: number | null | undefined) => {
    if (!id) return;
    setConversationId(id);
    window.localStorage.setItem('agentify_user_chat_conversation_id', String(id));
  };

  const saveCustomerProfile = () => {
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (!name || !phone) {
      setError('Chị vui lòng nhập tên và số điện thoại để Lumi hỗ trợ đúng đơn hàng.');
      return;
    }
    const oldPhone = window.localStorage.getItem('agentify_user_chat_customer_phone');
    window.localStorage.setItem('agentify_user_chat_customer_name', name);
    window.localStorage.setItem('agentify_user_chat_customer_phone', phone);
    setCustomerName(name);
    setCustomerPhone(phone);
    if (oldPhone && oldPhone !== phone) {
      window.localStorage.removeItem('agentify_user_chat_conversation_id');
      setConversationId(null);
      setMessages([{ sender: 'ai', text: `Chào chị ${name}, Lumi Beauty có thể hỗ trợ chị tư vấn sản phẩm, đặt hàng hoặc chăm sóc sau mua ạ.` }]);
    } else if (messages.length === 1) {
      setMessages([{ sender: 'ai', text: `Chào chị ${name}, Lumi Beauty có thể hỗ trợ chị tư vấn sản phẩm, đặt hàng hoặc chăm sóc sau mua ạ.` }]);
    }
    setError(null);
    setProfileReady(true);
  };

  const startSunscreenScenario = () => {
    const text = 'Chị cần tư vấn kem chống nắng';
    appendCustomer(text);
    setShowSunscreens(true);
    setShowBudgetChoices(false);
    setAppointment(null);
    setIrritationVerified(false);
    setShowIrritationInfoRequest(false);
    setOrder(null);
    setActions([
      { type: 'intent_detected', status: 'success', summary: 'Nhận diện ý định: tư vấn kem chống nắng' },
      { type: 'product_recommendation', status: 'success', summary: 'Đã lọc top 5 sản phẩm chống nắng phù hợp từ KiotViet' }
    ]);
    appendAi(`Dạ chị ${customerName}, em gửi chị 5 kem chống nắng đang bán tốt tại spa. Trước khi chốt sản phẩm, chị cho em biết da mình thuộc nhóm nào để em tư vấn đúng hơn: da dầu, da mụn, da khô hay da nhạy cảm ạ?`);
  };

  const chooseSkinType = (skinType: string) => {
    appendCustomer(`Da chị là ${skinType}`);
    setShowBudgetChoices(true);
    appendAi(`Dạ chị ${customerName}, với ${skinType}, em sẽ ưu tiên sản phẩm ít gây bí da, không làm nặng mặt và phù hợp dùng hằng ngày. Chị muốn chọn theo mức giá nào ạ?`);
  };

  const chooseBudget = (label: string, product: Recommendation) => {
    setSelectedProduct(product);
    setShowBudgetChoices(false);
    appendCustomer(`Chị chọn mức ${label}`);
    appendAi(`Em đề xuất tốt nhất cho chị ${customerName} là ${product.name}. Giá ${product.price.toLocaleString('vi-VN')}đ. Sản phẩm này phù hợp vì ${product.fit.toLowerCase()}. Nếu chị đồng ý, chị xác nhận giúp em họ tên, số điện thoại và địa chỉ giao hàng nhé.`);
  };

  const confirmCustomerInfo = () => {
    if (!selectedProduct) return;
    appendCustomer(`${customerName}, ${customerPhone}, ${address}`);
    appendAi(`Em xác nhận đơn của chị:\n- Sản phẩm: ${selectedProduct.name}\n- Số lượng: 1\n- Người nhận: ${customerName}\n- SĐT: ${customerPhone}\n- Địa chỉ: ${address}\nChị chọn hình thức thanh toán giúp em ạ.`);
  };

  const createOrder = async (method: Exclude<PaymentMethod, null>) => {
    if (!selectedProduct) return;
    setPaymentMethod(method);
    const methodText = method === 'cod' ? 'thanh toán khi nhận hàng' : 'thanh toán trước bằng QR';
    appendCustomer(`Chị chọn ${methodText}`);
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<DemoChatResponse>('/api/channels/demo/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: conversationId,
          customer_name: customerName,
          customer_phone: customerPhone,
          message: `Đặt cho chị 1 ${selectedProduct.name}, giao tới ${address}`
        })
      });
      rememberConversation(result.conversation_id);
      setOrder(result.order);
      setActions(result.actions);
      appendAi(method === 'prepaid'
        ? 'Dạ em đã tạo hóa đơn tạm tính và gửi QR thanh toán trong khung chat. Sau khi chị chuyển khoản, spa sẽ xác nhận và đóng gói đơn. Em cảm ơn chị.'
        : 'Dạ em đã tạo hóa đơn tạm tính. Đơn của chị sẽ được thanh toán khi nhận hàng. Em cảm ơn chị.');
      appendAi('Dự kiến đơn sẽ đến trong 2-3 ngày làm việc. Nếu cần đổi địa chỉ, chị nhắn lại cho em trước khi đơn được bàn giao vận chuyển ạ. Lumi cảm ơn chị.');
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Không tạo được đơn.';
      setError(fallback);
      appendAi(fallback);
    } finally {
      setLoading(false);
    }
  };

  const startIrritationScenario = () => {
    appendCustomer('Chị mua sữa rửa mặt bên em xong bị rát và hơi đỏ da');
    setShowSunscreens(false);
    setShowBudgetChoices(false);
    setOrder(null);
    setSelectedProduct(null);
    setAppointment(null);
    setIrritationVerified(false);
    setShowIrritationInfoRequest(true);
    setActions([
      { type: 'intent_detected', status: 'success', summary: 'Nhận diện tình huống sau mua: khách có dấu hiệu kích ứng' },
      { type: 'handoff_safety', status: 'success', summary: 'Áp dụng kịch bản an toàn: trấn an, hướng dẫn tạm ngưng và cần xác minh đơn hàng' }
    ]);
    appendAi('Dạ em rất tiếc vì chị đang bị rát và đỏ da. Chị tạm ngưng dùng sản phẩm, rửa mặt bằng nước mát, tránh tẩy da chết/treatment trong 24-48 giờ và không tự bôi thêm hoạt chất mạnh giúp em nhé. Lumi Beauty sẽ hỗ trợ chị kiểm tra da miễn phí tại trung tâm để xác định nguyên nhân và đổi hướng chăm sóc phù hợp.');
    appendAi('Để em tra lại đơn hàng và chuyển đúng hồ sơ cho chuyên viên, chị cho em xin một trong các thông tin sau nhé: mã đơn hàng, số điện thoại mua hàng, hoặc họ tên người nhận. Nếu đúng số điện thoại đang chat là số mua hàng, chị bấm “Dùng số điện thoại này”.');
  };

  const verifyIrritationCustomer = (source: string) => {
    appendCustomer(source);
    setIrritationVerified(true);
    setShowIrritationInfoRequest(false);
    setActions((current) => [
      ...current,
      { type: 'customer_lookup', status: 'success', summary: `Đã xác minh hồ sơ khách hàng: ${customerName} - ${customerPhone}` },
      { type: 'order_lookup', status: 'success', summary: 'Đã tìm thấy đơn sữa rửa mặt dịu nhẹ cho da nhạy cảm trong lịch sử mua hàng' }
    ]);
    appendAi(`Dạ em đã tìm thấy hồ sơ của chị ${customerName} với số ${customerPhone}. Đơn gần nhất là sữa rửa mặt dịu nhẹ cho da nhạy cảm. Em đã ghi nhận phản hồi kích ứng vào hồ sơ chăm sóc sau mua.`);
    appendAi('Bên em mời chị ghé trung tâm kiểm tra da miễn phí. Chị muốn ghé vào khung nào ạ? Em có thể giữ lịch chiều nay 16:30, tối nay 19:00 hoặc sáng mai 09:30.');
  };

  const bookAppointment = (time: string) => {
    if (!irritationVerified) {
      appendAi('Dạ trước khi đặt lịch, em cần xác minh thông tin mua hàng để chuyên viên có đủ hồ sơ sản phẩm chị đã dùng ạ.');
      setShowIrritationInfoRequest(true);
      return;
    }
    appendCustomer(`Chị muốn đặt lịch ${time}`);
    setAppointment({ name: customerName, time, service: 'Kiểm tra kích ứng da miễn phí' });
    setActions((current) => [...current, { type: 'appointment_create', status: 'success', summary: `Đã tạo lịch kiểm tra miễn phí: ${time}` }]);
    appendAi(`Dạ em đã giữ lịch ${time} cho chị tại Lumi Beauty. Khi đến chị mang theo sản phẩm đã dùng và hình ảnh tình trạng da nếu có. Lịch này hoàn toàn miễn phí, chuyên viên sẽ kiểm tra và tư vấn hướng xử lý an toàn cho chị ạ.`);
  };

  const askBackendAgent = async (text: string) => {
    setLoading(true);
    setError(null);
    setOrder(null);
    setShowSunscreens(false);
    setShowBudgetChoices(false);
    setShowIrritationInfoRequest(false);
    setAppointment(null);
    setLlmRecommendations([]);
    setLlmQuickReplies([]);
    try {
      const result = await apiRequest<AgentChatResponse>('/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: conversationId,
          customer_name: customerName,
          customer_phone: customerPhone,
          message: text
        })
      });
      rememberConversation(result.conversation_id);
      appendAi(result.reply);
      setLlmRecommendations(result.recommended_products);
      setLlmQuickReplies(result.quick_replies);
      if (result.recommended_products.length > 0) {
        const top = result.recommended_products[0];
        setPendingProduct({ name: top.name, price: top.price, stock: top.stock });
      }
      setActions(result.actions.map((summary, index) => ({
        type: index === 0 ? 'intent_detected' : 'llm_action',
        status: 'success',
        summary
      })));
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Hiện chưa xử lý được tin nhắn. Chị thử gửi lại giúp em nhé.';
      setError(fallback);
      appendAi(fallback);
    } finally {
      setLoading(false);
    }
  };

  const messageHasShippingInfo = (text: string) => {
    const normalized = text.toLowerCase();
    return normalized.includes('giao') || normalized.includes('địa chỉ') || normalized.includes('dia chi') || normalized.includes('nhận hàng') || normalized.includes('nhan hang');
  };

  const createDirectOrderFromMessage = async (text: string, forceCreate = false) => {
    if (!forceCreate && !messageHasShippingInfo(text)) {
      setPendingOrderMessage(text);
      setDeliveryPreference(null);
    appendAi(`Dạ chị ${customerName}, Lumi đã có tên và số điện thoại của chị rồi. Chị cho em xin địa chỉ giao hàng và khung giờ chị có thể nhận hàng ạ. Em cảm ơn chị.`);
      return;
    }
    setLoading(true);
    setError(null);
    setOrder(null);
    setLlmRecommendations([]);
    setLlmQuickReplies([]);
    try {
      const result = await apiRequest<DemoChatResponse>('/api/channels/demo/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: conversationId,
          customer_name: customerName,
          customer_phone: customerPhone,
          message: text
        })
      });
      rememberConversation(result.conversation_id);
      appendAi(result.reply);
      setOrder(result.order);
      setPaymentMethod('cod');
      setPendingOrderMessage(null);
      setActions(result.actions);
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Không tạo được đơn.';
      setError(fallback);
      appendAi(fallback);
    } finally {
      setLoading(false);
    }
  };

  const consultBeforeOrder = async (text: string) => {
    setPendingPurchaseIntent(text);
    await askBackendAgent(text.replace(/^(đặt|dat|mua|lấy|lay)\s+/i, 'Tư vấn '));
    appendAi(`Nếu chị ${customerName} muốn đặt sản phẩm này, chị nhắn "Đồng ý đặt" giúp em. Sau đó Lumi sẽ xin địa chỉ và khung giờ nhận hàng để lên đơn ạ. Em cảm ơn chị.`);
  };

  const beginPendingOrder = () => {
    const intent = buildOrderIntent(pendingProduct, pendingPurchaseIntent);
    if (!intent) {
      appendAi(`Dạ chị ${customerName}, chị muốn đặt sản phẩm nào ạ? Em cảm ơn chị.`);
      return;
    }
    createDirectOrderFromMessage(intent);
    setPendingPurchaseIntent(null);
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text) return;
    const lower = text.toLowerCase();
    setMessage('');
    appendCustomer(text);
    if (pendingOrderMessage) {
      setDeliveryPreference(text);
      createDirectOrderFromMessage(`${pendingOrderMessage}, giao tới ${text}`, true);
      return;
    }
    if ((pendingPurchaseIntent || pendingProduct) && (lower.includes('đặt mua') || lower.includes('mua ngay') || lower.includes('đồng ý') || lower.includes('dong y') || lower.includes('chốt') || lower.includes('chot') || lower.includes('ok'))) {
      beginPendingOrder();
      return;
    }
    if (lower.includes('dat lich') || lower.includes('đặt lịch')) {
      startIrritationScenario();
      return;
    }
    if (lower.includes('đặt') || lower.includes('dat') || lower.includes('mua') || lower.includes('lấy')) {
      consultBeforeOrder(text);
      return;
    }
    askBackendAgent(text);
  };

  if (!profileReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef5f1] px-4 text-slate-950">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveCustomerProfile();
          }}
          className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/80"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-white">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-950">Lumi Beauty</div>
              <div className="text-sm text-slate-500">Nhập thông tin để shop hỗ trợ đúng đơn hàng</div>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Tên của chị</span>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="Ví dụ: Nguyễn Thảo"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Số điện thoại</span>
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="Ví dụ: 0901234567"
                inputMode="tel"
              />
            </label>
          </div>
          {error && <div className="mt-4 rounded-xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700">{error}</div>}
          <button className="mt-6 w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">
            Bắt đầu trò chuyện
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="size-full bg-[#eef5f1] text-slate-950">
      <main className="mx-auto flex h-full min-h-screen w-full max-w-3xl flex-col bg-white shadow-xl shadow-slate-200/80 sm:my-6 sm:h-[calc(100vh-48px)] sm:min-h-0 sm:rounded-[28px] sm:border sm:border-slate-200">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:rounded-t-[28px] sm:px-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-white">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold text-slate-950">Lumi Beauty</div>
            <div className="flex items-center gap-2 text-xs font-medium text-teal-700">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              Thường phản hồi ngay
            </div>
          </div>
          <button
            onClick={() => setProfileReady(false)}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-700"
          >
            {customerName} · Sửa
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-auto bg-[#f8faf9] px-4 py-5 sm:px-5">
            {messages.map((item, index) => (
              <ChatMessage key={index} sender={item.sender === 'customer' ? 'customer' : 'ai'} text={item.text} />
            ))}
            {loading && <ChatMessage sender="ai" text="Em đang kiểm tra sản phẩm và tồn kho cho chị..." />}
            {llmRecommendations.length > 0 && (
              <LlmProductPanel
                products={llmRecommendations}
                onChoose={(product) => {
                  setPendingProduct({ name: product.name, price: product.price, stock: product.stock });
                  setPendingPurchaseIntent(`Đặt cho chị 1 ${product.name}`);
                  appendCustomer(product.name);
                  appendAi(`Dạ chị ${customerName}, em có sẵn sản phẩm ${product.name} đang còn hàng ạ. Sản phẩm này phù hợp với nhu cầu chị vừa mô tả. Chị có muốn đặt mua không ạ? Em cảm ơn chị.`);
                }}
              />
            )}
            {llmQuickReplies.length > 0 && (
              <QuickReplyGroup
                title="Gợi ý trả lời nhanh"
                options={llmQuickReplies}
                onChoose={(option) => {
                  setMessage('');
                  appendCustomer(option);
                  askBackendAgent(option);
                }}
              />
            )}
            {showSunscreens && <RecommendationPanel recommendations={sunscreenRecommendations} onChoose={setSelectedProduct} />}
            {showSunscreens && (
              <QuickReplyGroup
                title="Chọn tình trạng da"
                options={['Da dầu', 'Da mụn', 'Da khô', 'Da nhạy cảm']}
                onChoose={chooseSkinType}
              />
            )}
            {showBudgetChoices && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 font-semibold text-slate-900">Chọn mức giá</div>
                <div className="grid gap-2 md:grid-cols-3">
                  <button onClick={() => chooseBudget('tiết kiệm dưới 300.000đ', sunscreenRecommendations[0])} className="rounded-xl border border-slate-200 p-3 text-left hover:border-teal-300 hover:bg-teal-50">
                    <div className="font-semibold">Tiết kiệm</div>
                    <div className="text-sm text-slate-500">Dưới 300.000đ</div>
                  </button>
                  <button onClick={() => chooseBudget('cân bằng 300.000-380.000đ', sunscreenRecommendations[1])} className="rounded-xl border border-slate-200 p-3 text-left hover:border-teal-300 hover:bg-teal-50">
                    <div className="font-semibold">Cân bằng</div>
                    <div className="text-sm text-slate-500">300.000-380.000đ</div>
                  </button>
                  <button onClick={() => chooseBudget('cao cấp trên 380.000đ', sunscreenRecommendations[4])} className="rounded-xl border border-slate-200 p-3 text-left hover:border-teal-300 hover:bg-teal-50">
                    <div className="font-semibold">Cao cấp</div>
                    <div className="text-sm text-slate-500">Trên 380.000đ</div>
                  </button>
                </div>
              </div>
            )}
            {selectedProduct && !order && (
              <div className="rounded-2xl border border-teal-200 bg-white p-4">
                <div className="font-semibold text-slate-900">Xác nhận thông tin nhận hàng</div>
                <p className="mt-2 text-sm text-slate-600">{customerName} - {customerPhone} - {address}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={confirmCustomerInfo} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Gửi thông tin nhận hàng</button>
                  <button onClick={() => createOrder('cod')} className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700">Thanh toán khi nhận hàng</button>
                  <button onClick={() => createOrder('prepaid')} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">Thanh toán trước bằng QR</button>
                </div>
              </div>
            )}
            {order && (
              <InvoiceCard
                order={order}
                paymentMethod={paymentMethod}
                eta="2-3 ngày làm việc"
                deliveryPreference={deliveryPreference}
                onPaymentChange={(method) => {
                  setPaymentMethod(method);
                  appendCustomer(method === 'prepaid' ? 'Chị chọn thanh toán trước bằng QR' : 'Chị chọn thanh toán khi nhận hàng');
                  appendAi(method === 'prepaid'
                    ? 'Dạ em đã cập nhật hóa đơn sang thanh toán trước và gửi QR trong khung chat ạ. Em cảm ơn chị.'
                    : 'Dạ em đã cập nhật hóa đơn sang thanh toán khi nhận hàng ạ. Em cảm ơn chị.');
                }}
              />
            )}
            {showIrritationInfoRequest && (
              <div className="rounded-2xl border border-coral-200 bg-white p-4">
                <div className="font-semibold text-slate-900">Xác minh thông tin mua hàng</div>
                <p className="mt-2 text-sm text-slate-600">Lumi cần mã đơn, số điện thoại mua hàng hoặc họ tên người nhận để mở đúng hồ sơ trước khi đặt lịch kiểm tra.</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <button onClick={() => verifyIrritationCustomer(`Dùng số điện thoại ${customerPhone}`)} className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700">Dùng số điện thoại này</button>
                  <button onClick={() => verifyIrritationCustomer('Mã đơn: KV-MP020-1024')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Nhập mã đơn mẫu</button>
                  <button onClick={() => verifyIrritationCustomer(`Người nhận: ${customerName}`)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Dùng họ tên</button>
                </div>
              </div>
            )}
            {!appointment && irritationVerified && (
              <QuickReplyGroup
                title="Chọn lịch kiểm tra miễn phí"
                options={['Chiều nay 16:30', 'Tối nay 19:00', 'Sáng mai 09:30']}
                onChoose={bookAppointment}
              />
            )}
            {appointment && <AppointmentCard appointment={appointment} />}
            {error && <div className="max-w-[82%] rounded-2xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700">{error}</div>}
          </div>

          <footer className="border-t border-slate-200 bg-white px-4 py-4 sm:rounded-b-[28px] sm:px-5">
            <div className="mb-3 flex flex-wrap gap-2">
              {['Tư vấn kem chống nắng', 'Da chị bị kích ứng sau sữa rửa mặt', 'Đặt serum vitamin C'].map((item) => (
                <button key={item} onClick={() => setMessage(item)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700">
                  {item}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                rows={2}
                className="max-h-32 min-h-[52px] flex-1 resize-none rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="Nhập tin nhắn..."
              />
              <button onClick={sendMessage} disabled={loading} className="h-[52px] rounded-2xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:opacity-60">
                {loading ? 'Đang gửi' : 'Gửi'}
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
  onPrimary: (payload?: { retailer: string, client_id: string, client_secret: string }) => void,
  onBack: () => void,
  onRefresh: () => void,
  toast: string | null
}) {
  const [retailer, setRetailer] = useState(status.retailer || 'bietkhongnhe123');
  const [clientId, setClientId] = useState('aa4618b7-4233-4340-878c-eec4edfb0761');
  const [clientSecret, setClientSecret] = useState('');
  const connected = status.status === 'connected';

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
              Bước 2/3
            </div>
            <h1 className="max-w-xl text-4xl font-bold tracking-tight text-slate-950 lg:text-5xl">Kết nối KiotViet thật</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Agentify sẽ gọi backend để kiểm tra token, đồng bộ sản phẩm và dùng dữ liệu KiotViet trong màn chat demo.
            </p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Trạng thái backend</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${backendReady ? 'bg-teal-50 text-teal-700' : 'bg-coral-50 text-coral-700'}`}>
                  {backendReady ? 'Đang chạy' : 'Chưa kết nối'}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">KiotViet</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
                  {connected ? `Đã kết nối ${status.retailer}` : 'Chưa kết nối'}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Sản phẩm đã sync</span>
                <span className="text-sm font-bold text-slate-950">{productCount}</span>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => onPrimary(connected ? undefined : { retailer, client_id: clientId, client_secret: clientSecret })}
                className="rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700"
              >
                {connected ? 'Đồng bộ và tiếp tục' : 'Kết nối KiotViet'}
              </button>
              <button onClick={onRefresh} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-teal-300 hover:text-teal-700">
                Kiểm tra lại
              </button>
            </div>
            <div className="mt-8 h-2 max-w-md overflow-hidden rounded-full bg-white shadow-inner">
              <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: '66%' }} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-teal-900/10">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-5">
                <div className="text-sm font-semibold text-slate-500">Thông tin kết nối</div>
                <div className="mt-1 text-3xl font-bold text-slate-950">KiotViet Retail</div>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Tên gian hàng</span>
                  <input value={retailer} onChange={(event) => setRetailer(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Client ID</span>
                  <input value={clientId} onChange={(event) => setClientId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Mã bảo mật</span>
                  <input value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} type="password" placeholder={connected ? 'Đã lưu trong backend local' : 'Nhập mã bảo mật KiotViet'} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm" />
                </label>
              </div>
              <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-800">
                Nếu backend Docker đã connect KiotViet, bạn chỉ cần bấm “Đồng bộ và tiếp tục”. Mã bảo mật không được lưu trong frontend.
              </div>
            </div>
          </section>
        </main>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}

function LandingPage({ onEnterDemo, onNotify }: { onEnterDemo: () => void, onNotify: (message: string) => void }) {
  const openShopChat = () => {
    window.history.pushState(null, '', '/user_chat');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-teal-900/10 bg-[#f7faf8]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-slate-950">Agentify</div>
              <div className="text-xs font-medium text-slate-500">Nhân viên AI cho social commerce Việt Nam</div>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#van-de" className="hover:text-teal-700">Vấn đề</a>
            <a href="#giai-phap" className="hover:text-teal-700">Giải pháp</a>
            <a href="#tich-hop" className="hover:text-teal-700">Tích hợp</a>
            <a href="#thi-truong" className="hover:text-teal-700">Thị trường đầu tiên</a>
          </nav>
          <button
            onClick={openShopChat}
            className="hidden rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-teal-300 hover:text-teal-700 sm:inline-flex"
          >
            Liên hệ với shop
          </button>
          <button
            onClick={onEnterDemo}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Bắt đầu ngay
          </button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(13,148,136,0.16),transparent_34%),linear-gradient(120deg,rgba(13,148,136,0.08),transparent_44%,rgba(251,113,133,0.08))]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
            <div className="flex flex-col justify-center">
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-sm font-medium text-teal-700 shadow-sm">
                <CheckCircle2 className="h-4 w-4" />
                Kết nối Zalo, KiotViet và quy trình bán hàng trong vài phút.
              </div>
              <h1 className="max-w-4xl text-5xl font-bold leading-[1.02] tracking-tight text-slate-950 lg:text-6xl">
                Giữ nguyên hệ thống hiện tại. Thêm một nhân viên AI để tự hoàn thành công việc.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-650">
                Agentify giúp doanh nghiệp bán hàng và dịch vụ tại Việt Nam tự động xử lý hội thoại, tư vấn sản phẩm, đặt lịch, tạo đơn và follow-up trên Zalo, Facebook cùng các nền tảng sẵn có như KiotViet, Sapo, Pancake.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={onEnterDemo}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700"
                >
                  Bắt đầu ngay
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={openShopChat}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  Liên hệ với shop
                  <MessageSquare className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onNotify('Đã ghi nhận nhu cầu trao đổi pilot')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:border-teal-300 hover:text-teal-700"
                >
                  Trao đổi pilot
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
                <LandingMiniStat value="300-500" label="tin nhắn mỗi ngày" />
                <LandingMiniStat value="24/7" label="phản hồi và theo dõi" />
                <LandingMiniStat value="100%" label="tự động cho workflow đủ điều kiện" />
              </div>
            </div>

            <HeroProductMockup onEnterDemo={onEnterDemo} />
          </div>
        </section>

        <section id="van-de" className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-coral-600">Vấn đề</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-950">SME đã có phần mềm, nhưng vận hành vẫn phụ thuộc vào con người.</h2>
              <p className="mt-4 leading-7 text-slate-600">
                Pancake gom hội thoại, KiotViet và Sapo lưu dữ liệu, lịch quản lý booking. Nhưng nhân viên vẫn phải đọc chat, quyết định bước tiếp theo, check dữ liệu, nhắc khách và theo dõi lại từng lead.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <ProblemCard value="300-500" label="tin nhắn/ngày" desc="Dễ quá tải ở giờ cao điểm và sau giờ làm." />
              <ProblemCard value="30-50%" label="khách bị bỏ sót" desc="Lead nóng trôi mất vì phản hồi chậm." />
              <ProblemCard value="8-18M" label="VND/tháng" desc="Chi phí cho một nhân sự chăm sóc khách hàng." />
            </div>
          </div>
        </section>

        <section id="giai-phap" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="mb-10 max-w-3xl">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-teal-700">Giải pháp</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-950">Không chỉ trả lời. Agentify hiểu, gọi công cụ và hoàn thành workflow.</h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <SolutionStep number="01" title="Hiểu hội thoại tiếng Việt" desc="Nhận diện intent, trạng thái khách hàng và mức độ rủi ro trong từng cuộc trò chuyện." />
              <SolutionStep number="02" title="Làm việc trên stack hiện có" desc="Gọi dữ liệu từ Zalo OA, Facebook, KiotViet, Sapo, Pancake hoặc lịch hẹn." />
              <SolutionStep number="03" title="Chốt kết quả và báo lại" desc="Đặt lịch, tạo đơn, gửi xác nhận, nhắc lịch, follow-up hoặc chuyển cho nhân viên duyệt." />
            </div>
            <div className="mt-8 rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
              <div className="grid items-center gap-3 text-sm font-semibold text-slate-700 md:grid-cols-7">
                {['Khách hỏi dịch vụ', 'AI tư vấn', 'Kiểm tra lịch', 'Đặt lịch', 'Gửi xác nhận', 'Nhắc lịch', 'Chuyển ca rủi ro'].map((item, index) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs text-teal-700">{index + 1}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="tich-hop" className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-teal-700">Tích hợp</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-950">Một lớp AI trung lập, chạy bên trên công cụ doanh nghiệp đang dùng.</h2>
              <p className="mt-4 leading-7 text-slate-600">
                Agentify không yêu cầu khách hàng bỏ hệ thống cũ. Sản phẩm được thiết kế để kết nối vào các kênh và phần mềm nội địa, rồi tự thực hiện các tác vụ có ranh giới rõ ràng.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {['Zalo OA', 'Facebook', 'KiotViet', 'Sapo', 'Pancake', 'Lịch Google'].map((tool) => (
                <div key={tool} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-teal-700">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div className="font-semibold text-slate-950">{tool}</div>
                  <div className="mt-1 text-sm text-teal-700">Sẵn sàng kết nối</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="thi-truong" className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-teal-300">Thị trường đầu tiên</p>
              <h2 className="text-3xl font-bold tracking-tight">Beauty, spa, clinic là wedge phù hợp để chứng minh ROI.</h2>
              <p className="mt-4 leading-7 text-slate-300">
                Ngành này có inbound lead lớn, workflow đặt lịch rõ, giá trị mỗi booking cao và missed follow-up gây mất doanh thu trực tiếp.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <MetricPill label="Booking rate" value="Tăng tỷ lệ đặt lịch" />
              <MetricPill label="Show-up rate" value="Giảm no-show" />
              <MetricPill label="Response time" value="Phản hồi trong vài giây" />
              <MetricPill label="Lead recovery" value="Theo dõi lại khách chưa chốt" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="rounded-3xl border border-teal-200 bg-white p-8 shadow-xl shadow-teal-900/5 md:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-950">Bắt đầu bằng một workflow hẹp. Tự động hóa trọn vẹn. Mở rộng dần tới vận hành tự động.</h2>
                <p className="mt-3 text-slate-600">Kết nối kênh chat, đồng bộ KiotViet và để Agentify xử lý các hội thoại đủ điều kiện ngay trong bảng điều khiển.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={onEnterDemo} className="rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700">
                  Bắt đầu ngay
                </button>
                <button onClick={openShopChat} className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                  Liên hệ với shop
                </button>
                <button onClick={() => onNotify('Đã ghi nhận nhu cầu trao đổi pilot')} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-teal-300 hover:text-teal-700">
                  Trao đổi pilot
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
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

function InvoiceCard({ order, paymentMethod, eta, deliveryPreference, onPaymentChange }: { order: ChatOrder, paymentMethod?: PaymentMethod, eta?: string, deliveryPreference?: string | null, onPaymentChange?: (method: Exclude<PaymentMethod, null>) => void }) {
  const items = order.items || [];
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-xl rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Hóa đơn tạm tính</div>
            <div className="mt-1 text-xl font-bold text-slate-950">Đơn #{order.id}</div>
          </div>
          <div className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">Chờ xác nhận</div>
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
              className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${paymentMethod !== 'prepaid' ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-700 hover:border-teal-200 hover:bg-teal-50'}`}
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
        </div>
        {eta && <div className="mt-3 text-sm font-semibold text-slate-700">Dự kiến giao hàng: {eta}</div>}
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
