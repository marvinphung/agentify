import { useState } from 'react';
import { LayoutDashboard, Mail, Calendar, AlertCircle, Workflow, Link2, BarChart3, Settings, Bell, ChevronRight, CheckCircle2, Clock, Zap, TrendingUp, Users, MessageSquare, Play, Pause, Edit, Trash2, Plus, X, Facebook as FacebookIcon, Check, RefreshCw, Download, Filter, Search, ArrowUpRight, Phone, MapPin } from 'lucide-react';

type Screen = 'overview' | 'inbox' | 'calendar' | 'approval' | 'workflows' | 'integrations' | 'reports' | 'settings';
type Modal = 'create-workflow' | 'connect-system' | 'edit-conversation' | 'appointment-detail' | 'report-filter' | 'report-export' | 'edit-setting' | 'member-detail' | 'invite-member' | 'integration-settings' | null;

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('overview');
  const [modal, setModal] = useState<Modal>(null);
  const [channelFilter, setChannelFilter] = useState('Tất cả');
  const [toast, setToast] = useState<string | null>(null);

  const notify = (message: string) => {
    setToast(message);
  };

  const selectChannel = (channel: string) => {
    setChannelFilter(channel);
    notify(`Đang lọc dữ liệu theo kênh: ${channel}`);
  };

  return (
    <div className="size-full flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-teal-600">Agentify</h1>
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
          {activeScreen === 'overview' && <OverviewScreen onNavigate={setActiveScreen} />}
          {activeScreen === 'inbox' && <InboxScreen onNavigate={setActiveScreen} onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'calendar' && <CalendarScreen onNavigate={setActiveScreen} onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'approval' && <ApprovalScreen onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'workflows' && <WorkflowsScreen onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'integrations' && <IntegrationsScreen onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'reports' && <ReportsScreen onOpenModal={setModal} onNotify={notify} />}
          {activeScreen === 'settings' && <SettingsScreen onOpenModal={setModal} onNotify={notify} />}
        </main>
      </div>

      {/* Modals */}
      {modal === 'create-workflow' && <CreateWorkflowModal onClose={() => setModal(null)} onNotify={notify} />}
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

function OverviewScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Tổng quan hôm nay</h2>
        <p className="text-slate-600">Nhân viên AI đang xử lý hội thoại, đặt lịch và nhắc khách cho Lumi Clinic.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={MessageSquare} label="Hội thoại hôm nay" value="248" />
        <StatCard icon={Zap} label="Hội thoại AI tự xử lý" value="176" color="teal" />
        <StatCard icon={Calendar} label="Lịch hẹn đã tạo" value="38" color="teal" />
        <StatCard icon={Users} label="Khách đã được theo dõi lại" value="22" />
        <StatCard icon={Clock} label="Phản hồi trung bình" value="18s" />
        <StatCard icon={AlertCircle} label="Việc cần nhân viên duyệt" value="11" color="coral" onClick={() => onNavigate('approval')} />
      </div>

      {/* Demo Flow */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('inbox')}>
        <h3 className="text-xl font-semibold text-slate-900 mb-4">Luồng demo đang chạy</h3>
        <div className="space-y-4">
          <FlowStep number={1} title="Khách nhắn qua Zalo" description="Da em bị mụn ẩn, bên mình có soi da không ạ?" />
          <FlowStep number={2} title="AI hiểu ý định" description="Khách muốn tư vấn mụn" />
          <FlowStep number={3} title="AI hỏi thêm" description="Khách muốn đi chiều thứ Sáu" />
          <FlowStep number={4} title="AI kiểm tra lịch" description="Còn khung 14:30 và 16:00" />
          <FlowStep number={5} title="AI đặt lịch" description="14:30 thứ Sáu" />
          <FlowStep number={6} title="AI gửi xác nhận và hẹn nhắc lại trước 2 tiếng" />
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
            <SystemCard name="KiotViet" connected />
            <SystemCard name="Pancake" connected={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxScreen({ onNavigate, onOpenModal, onNotify }: { onNavigate: (screen: Screen) => void, onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void }) {
  const [selectedChat, setSelectedChat] = useState(0);
  const [aiPaused, setAiPaused] = useState(false);
  const [filter, setFilter] = useState('Tất cả');

  const conversations = [
    { id: 0, name: 'Nguyễn Thảo', channel: 'Zalo OA', status: 'AI đang xử lý', preview: 'Hỏi về soi da và tư vấn mụn', statusColor: 'teal' },
    { id: 1, name: 'Minh Anh', channel: 'Facebook', status: 'Đã đặt lịch', preview: 'Muốn tư vấn laser', statusColor: 'blue' },
    { id: 2, name: 'Huyền Trang', channel: 'Zalo OA', status: 'Cần theo dõi lại', preview: 'Đã hỏi giá nhưng chưa xác nhận', statusColor: 'slate' },
    { id: 3, name: 'Lan Phương', channel: 'Facebook', status: 'Cần duyệt', preview: 'Có câu hỏi liên quan tình trạng da nhạy cảm', statusColor: 'coral' }
  ];

  return (
    <div className="h-full flex">
      {/* Conversation List */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">Hộp thư</h3>
          <div className="flex flex-wrap gap-2">
            {['Tất cả', 'AI đang xử lý', 'Đã đặt lịch', 'Cần duyệt', 'Cần theo dõi lại'].map((item) => (
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
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => {
                setSelectedChat(conv.id);
                if (conv.status === 'Cần duyệt') onNavigate('approval');
              }}
              className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                selectedChat === conv.id ? 'bg-slate-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-900">{conv.name}</span>
                <span className="text-xs text-slate-500">{conv.channel}</span>
              </div>
              <p className="text-sm text-slate-600 mb-2">{conv.preview}</p>
              <span className={`text-xs px-2 py-1 rounded-full ${
                conv.statusColor === 'teal' ? 'bg-teal-50 text-teal-700' :
                conv.statusColor === 'coral' ? 'bg-coral-50 text-coral-700' :
                conv.statusColor === 'blue' ? 'bg-blue-50 text-blue-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {conv.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Hội thoại với Nguyễn Thảo</h3>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <ChatMessage sender="customer" text="Da em bị mụn ẩn nhiều, bên mình có soi da và tư vấn không ạ?" />
          <ChatMessage sender="ai" text="Dạ có ạ. Lumi Clinic có dịch vụ soi da và tư vấn phác đồ cho da mụn. Chị muốn đặt lịch trong tuần này hay cuối tuần ạ?" />
          <ChatMessage sender="customer" text="Chiều thứ 6 được không em?" />
          <ChatMessage sender="ai" text="Dạ chiều thứ 6 còn khung 14:30 và 16:00. Chị muốn em giữ lịch 14:30 không ạ?" />
          <ChatMessage sender="customer" text="Ok em đặt giúp chị 14:30." />
          <ChatMessage sender="ai" text="Dạ em đã đặt lịch soi da và tư vấn mụn lúc 14:30 thứ Sáu tại Lumi Clinic. Trước lịch hẹn 2 tiếng em sẽ nhắc lại qua Zalo ạ." />
        </div>
        <div className="p-4 border-t border-slate-200">
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
              className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              onClick={() => {
                onNotify('Hội thoại đã được đánh dấu xong');
                onNavigate('calendar');
              }}
            >
              Đánh dấu xong
            </button>
          </div>
          <input
            type="text"
            placeholder="Nhập tin nhắn nếu muốn nhân viên tiếp quản..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* AI Actions Panel */}
      <div className="w-80 bg-slate-50 border-l border-slate-200 p-4 overflow-auto">
        <h3 className="font-semibold text-slate-900 mb-4">AI đã làm gì?</h3>
        <div className="space-y-3">
          <ActionCard icon={CheckCircle2} text="Đã nhận diện ý định: Đặt lịch tư vấn" />
          <ActionCard icon={TrendingUp} text="Điểm tiềm năng: 86/100" />
          <ActionCard icon={CheckCircle2} text="Dịch vụ phù hợp: Soi da và tư vấn mụn" />
          <ActionCard icon={CheckCircle2} text="Đã kiểm tra lịch trống" />
          <ActionCard icon={CheckCircle2} text="Đã tạo lịch hẹn" />
          <ActionCard icon={CheckCircle2} text="Đã gửi xác nhận" />
          <ActionCard icon={CheckCircle2} text="Đã đặt nhắc lịch trước 2 tiếng" />
          <ActionCard icon={CheckCircle2} text="Không cần nhân viên duyệt" />
        </div>
        <div className="mt-6 p-4 bg-teal-50 rounded-lg border border-teal-100">
          <h4 className="font-semibold text-teal-900 mb-2">Kết quả</h4>
          <p className="text-sm text-teal-700">Khách đã có lịch hẹn. Nhân viên không cần thao tác thủ công.</p>
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

function WorkflowsScreen({ onOpenModal, onNotify }: { onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void }) {
  const [workflows, setWorkflows] = useState([
    { id: 1, name: 'Tự động đặt lịch tư vấn', status: 'active', triggers: 248, conversions: 38 },
    { id: 2, name: 'Nhắc lịch trước 2 tiếng', status: 'active', triggers: 38, conversions: 24 },
    { id: 3, name: 'Theo dõi khách chưa phản hồi', status: 'active', triggers: 156, conversions: 22 },
    { id: 4, name: 'Chuyển câu hỏi rủi ro cho nhân viên', status: 'active', triggers: 18, conversions: 18 },
    { id: 5, name: 'Gửi khảo sát sau dịch vụ', status: 'paused', triggers: 0, conversions: 0 }
  ]);

  const toggleWorkflow = (id: number) => {
    setWorkflows(workflows.map(w =>
      w.id === id ? { ...w, status: w.status === 'active' ? 'paused' : 'active' } : w
    ));
    onNotify('Đã cập nhật trạng thái quy trình');
  };

  const removeWorkflow = (id: number) => {
    const workflow = workflows.find((w) => w.id === id);
    setWorkflows(workflows.filter((w) => w.id !== id));
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
                  style={{ width: `${(workflow.conversions / workflow.triggers) * 100}%` }}
                ></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsScreen({ onOpenModal, onNotify }: { onOpenModal: (modal: Modal) => void, onNotify: (message: string) => void }) {
  const integrations = [
    { name: 'Zalo OA', status: 'connected', icon: '💬', lastSync: '2 phút trước', messages: 248 },
    { name: 'Tin nhắn Facebook', status: 'connected', icon: '📘', lastSync: '5 phút trước', messages: 124 },
    { name: 'Lịch Google', status: 'connected', icon: '📅', lastSync: '1 phút trước', events: 38 },
    { name: 'KiotViet', status: 'connected', icon: '🏪', lastSync: '10 phút trước', products: 156 },
    { name: 'Pancake', status: 'disconnected', icon: '🥞', lastSync: null, contacts: 0 },
    { name: 'Sapo', status: 'disconnected', icon: '🛍️', lastSync: null, orders: 0 }
  ];

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
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onNotify(`Đã đồng bộ ${integration.name}`)}
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

function CreateWorkflowModal({ onClose, onNotify }: { onClose: () => void, onNotify: (message: string) => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900">Tạo quy trình mới</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tên quy trình</label>
            <input
              type="text"
              placeholder="VD: Tự động trả lời câu hỏi về giá"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Khi nào kích hoạt?</label>
            <select className="w-full px-4 py-2 border border-slate-300 rounded-lg">
              <option>Khi khách hỏi về giá</option>
              <option>Khi khách muốn đặt lịch</option>
              <option>Khi khách hỏi về dịch vụ</option>
              <option>Khi khách khiếu nại</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">AI sẽ làm gì?</label>
            <textarea
              rows={4}
              placeholder="Mô tả hành động AI sẽ thực hiện..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            ></textarea>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              Hủy
            </button>
            <button
              onClick={() => {
                onNotify('Đã tạo quy trình mẫu mới');
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Tạo quy trình
            </button>
          </div>
        </div>
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
        <p className="text-sm">{text}</p>
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
