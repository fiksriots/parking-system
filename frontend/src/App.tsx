import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
  Monitor,
  Play,
  Users,
  DollarSign,
  BarChart2,
  Lock,
  Cpu,
  ShieldAlert,
  LogOut,
  Wifi,
  WifiOff,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { MonitorDashboard } from './components/MonitorDashboard';
import { HardwareSimulator } from './components/HardwareSimulator';
import { CashierBooth } from './components/CashierBooth';
import { MemberManager } from './components/MemberManager';
import { TariffConfig } from './components/TariffConfig';
import { ReportAnalytics } from './components/ReportAnalytics';
import { UserSettings } from './components/UserSettings';
import { GateConfigurator } from './components/GateConfigurator';
import { AuditLogsList } from './components/AuditLogsList';
import { FinancialLedger } from './components/FinancialLedger';

// Establish Socket.IO Connection
const socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}`, {
  autoConnect: true,
  reconnection: true,
});

interface Gate {
  id: string;
  name: string;
  type: string;
  ipAddress: string;
  printerIp?: string;
  cctvIp?: string;
  status: string;
}

// Sidebar Menu Configuration with nested structure support
const menuItems = [
  { id: 'monitoring', label: 'Dashboard Live', icon: Monitor, permission: 'can_view_dashboard' },
  { id: 'simulator', label: 'Sensor Simulator', icon: Play, permission: 'can_simulate_gates' },
  { id: 'cashier', label: 'Loket Kasir', icon: CreditCard, permission: 'can_operate_pos' },
  
  // Member RFID Group
  { 
    id: 'members_group', 
    label: 'Member RFID', 
    icon: Users, 
    permission: 'can_manage_members',
    isHeader: true,
    subItems: [
      { id: 'members_topup', label: 'Top-up & Registrasi' },
      { id: 'members_conversion', label: 'Konversi Jenis' }
    ]
  },
  
  // Keuangan Group
  { 
    id: 'finance_group', 
    label: 'Keuangan', 
    icon: DollarSign, 
    permission: 'can_manage_tariffs',
    isHeader: true,
    subItems: [
      { id: 'ledger', label: 'Buku Kas & Ledger' },
      { id: 'tariff', label: 'Tarif & Denda' }
    ]
  },
  
  { id: 'reports', label: 'Statistik Laporan', icon: BarChart2, permission: 'can_view_reports' },
  
  // Settings Group
  { 
    id: 'settings_group', 
    label: 'Pengaturan', 
    icon: Cpu, 
    permission: 'can_manage_gates',
    isHeader: true,
    subItems: [
      { id: 'gates', label: 'Konfigurasi Gate' },
      { id: 'users', label: 'Manajemen User' }
    ]
  },
  
  { id: 'audit', label: 'Log Audit', icon: ShieldAlert, permission: 'can_view_audit' },
];

export default function App() {
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string; permissions?: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState('monitoring');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [systemMode, setSystemMode] = useState<'simulation' | 'production'>('simulation');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('park_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('park_theme', theme);
  }, [theme]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [stats, setStats] = useState({
    totalEntriesToday: 0,
    totalExitsToday: 0,
    occupancyCount: 0,
    totalRevenueToday: 0,
    paymentMethods: { cash: 0, qris: 0, member: 0 },
  });

  // Login Form States
  const [loginUsername, setLoginUsername] = useState('admin'); // default for quick demo
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginGateId, setLoginGateId] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    // Socket connection listeners
    socket.on('connect', () => {
      setSocketConnected(true);
      fetchGates();
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('gates_list', (list: Gate[]) => {
      setGates(list);
    });

    // Check localStorage login
    const savedUser = localStorage.getItem('park_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }

    fetchGates();
    fetchStats();
    fetchSystemMode();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('gates_list');
    };
  }, []);

  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    members_group: true,
    settings_group: true,
    finance_group: true,
  });

  // Auto-redirect to first permitted tab on login
  useEffect(() => {
    if (currentUser) {
      const allowed = menuItems.filter(item => {
        if (currentUser.role === 'admin') return true;
        return (currentUser.permissions || []).includes(item.permission);
      });
      if (allowed.length > 0) {
        const isAllowed = allowed.some(a => {
          if (a.id === activeTab) return true;
          if (a.subItems && a.subItems.some(sub => sub.id === activeTab)) return true;
          return false;
        });
        if (!isAllowed) {
          const first = allowed[0];
          if (first.isHeader && first.subItems && first.subItems.length > 0) {
            setActiveTab(first.subItems[0].id);
          } else {
            setActiveTab(first.id);
          }
        }
      }
    }
  }, [currentUser]);

  const fetchGates = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/gates`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setGates(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSystemMode = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/gates/settings`);
      if (res.ok) {
        const data = await res.json();
        setSystemMode(data.systemMode || 'simulation');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/reports/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          passwordHash: loginPassword,
          gateId: loginGateId,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCurrentUser(data.user);
        localStorage.setItem('park_user', JSON.stringify(data.user));
      } else {
        setLoginError(data.message || 'Login gagal.');
      }
    } catch (err) {
      console.error(err);
      setLoginError('Koneksi ke backend API terputus.');
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      try {
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentUser.username,
            gateId: (currentUser as any).gateId,
          }),
        });
      } catch (e) {
        console.error('Gagal menghapus okupansi gate pada logout:', e);
      }
    }
    setCurrentUser(null);
    localStorage.removeItem('park_user');
    setActiveTab('monitoring');
  };

  // Login Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Glowing Orb Effect */}
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-emerald-500/10 blur-[80px]"></div>
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[80px]"></div>
        <div className="absolute inset-0 grid-bg opacity-20"></div>

        <div className="w-full max-w-md glass rounded-2xl p-8 relative z-10 border border-white/10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-block p-3.5 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-3 border border-emerald-500/20">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Sistem Parkir Manless</h1>
            <p className="text-zinc-500 text-xs mt-1.5">Silakan masuk menggunakan kredensial operator/admin</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg text-center font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 font-semibold mb-1.5">Username</label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-zinc-950/80 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 font-semibold mb-1.5">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-zinc-950/80 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Exit Gate Selector (Mandatory for Kasir) */}
            <div>
              <label className="block text-xs text-zinc-400 font-semibold mb-1.5 flex justify-between items-center">
                <span>Pintu Gate Keluar</span>
                <span className="text-[10px] text-zinc-500 font-normal italic">(Wajib untuk Kasir)</span>
              </label>
              <select
                value={loginGateId}
                onChange={(e) => setLoginGateId(e.target.value)}
                className="w-full bg-zinc-950/80 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Pilih Pintu Gate Keluar --</option>
                {gates
                  .filter((g) => g.type === 'exit')
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.ipAddress})
                    </option>
                  ))}
              </select>
            </div>

            {/* Quick Demo Pre-fills */}
            <div className="bg-zinc-950/40 p-3 rounded-lg border border-white/5 space-y-1.5">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pilihan Cepat Demo:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setLoginUsername('admin');
                    setLoginPassword('admin123');
                    setLoginGateId('');
                  }}
                  className="py-1 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded text-center"
                >
                  Admin (admin123)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginUsername('spv');
                    setLoginPassword('spv123');
                    setLoginGateId('');
                  }}
                  className="py-1 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded text-center"
                >
                  SPV (spv123)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginUsername('operator');
                    setLoginPassword('operator123');
                    setLoginGateId('');
                  }}
                  className="py-1 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded text-center"
                >
                  Operator (operator123)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginUsername('kasir');
                    setLoginPassword('kasir123');
                    const firstExit = gates.find((g) => g.type === 'exit');
                    if (firstExit) {
                      setLoginGateId(firstExit.id);
                    }
                  }}
                  className="py-1 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded text-center"
                >
                  Kasir (kasir123)
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg transition"
            >
              Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }



  const allowedMenuItems = menuItems.filter(item => {
    if (systemMode === 'production' && item.id === 'simulator') {
      return false; // Hide simulator in production mode
    }
    if (currentUser?.role === 'admin') return true;
    return (currentUser?.permissions || []).includes(item.permission);
  });

  return (
    <div className="min-h-screen bg-[#090a0f] flex">
      {/* Sidebar navigation */}
      <aside className={`border-r border-white/5 bg-[#0b0c14] flex flex-col justify-between shrink-0 transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        <div>
          {/* Logo Header */}
          <div className={`p-4 border-b border-white/5 flex ${
            sidebarCollapsed ? 'flex-col items-center gap-3' : 'items-center justify-between gap-2'
          } transition-all duration-300`}>
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Cpu className="h-5 w-5" />
              </div>
              {!sidebarCollapsed && (
                <div className="animate-fadeIn shrink-0">
                  <span className="font-extrabold text-white text-xs block leading-tight tracking-tight">MANLESS PARK</span>
                  <span className="text-[9px] text-zinc-500 tracking-wider font-mono uppercase font-bold">Local LAN Client</span>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 rounded-lg transition shrink-0 ${
                sidebarCollapsed ? 'w-8 h-8 flex items-center justify-center' : ''
              }`}
              title={sidebarCollapsed ? "Perbesar Sidebar" : "Perkecil Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>



          {/* Navigation Links */}
          <nav className="px-3 space-y-1.5">
            {allowedMenuItems.map((item) => {
              const Icon = item.icon;

              if (item.isHeader) {
                const isExpanded = expandedMenus[item.id] !== false;
                const hasActiveSub = item.subItems?.some(s => s.id === activeTab);

                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedMenus(prev => ({ ...prev, [item.id]: !isExpanded }));
                        // If collapsed sidebar, toggle activeTab directly to the first sub-item on click
                        if (sidebarCollapsed && item.subItems && item.subItems.length > 0) {
                          setActiveTab(item.subItems[0].id);
                        }
                      }}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-300 ${
                        sidebarCollapsed ? 'justify-center px-0' : 'px-4 text-left'
                      } ${
                        hasActiveSub
                          ? 'bg-zinc-900 border border-white/10 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4.5 w-4.5 stroke-[2] shrink-0" />
                        {!sidebarCollapsed && <span className="animate-fadeIn truncate">{item.label}</span>}
                      </div>
                      {!sidebarCollapsed && (
                        <span className="text-[10px] text-zinc-500 font-mono pr-1 select-none">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      )}
                    </button>

                    {/* Sub-items rendering */}
                    {isExpanded && !sidebarCollapsed && item.subItems && (
                      <div className="pl-4 ml-6 border-l border-white/5 space-y-1 animate-fadeIn">
                        {item.subItems.map((sub) => {
                          const isSubActive = activeTab === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => setActiveTab(sub.id)}
                              className={`w-full py-2 px-3 rounded-lg text-[11px] transition duration-200 text-left font-medium block truncate ${
                                isSubActive
                                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/10'
                                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.01]'
                              }`}
                            >
                              • {sub.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Normal Menu Item
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center transition-all duration-300 ${
                    sidebarCollapsed ? 'justify-center px-0' : 'px-4 gap-3 text-left'
                  } ${
                    isActive
                      ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/15'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 stroke-[2] shrink-0" />
                  {!sidebarCollapsed && <span className="animate-fadeIn truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-white/5 text-[10px] text-zinc-600 font-mono text-center animate-fadeIn">
            v1.0.0-Beta &copy; 2026
          </div>
        )}
      </aside>

      {/* Main content body */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Global Toolbar Header */}
        <header className="h-16 border-b border-white/5 bg-[#0b0c14] flex justify-between items-center px-8 shrink-0">
          <h2 className="font-extrabold text-white text-xs sm:text-sm uppercase tracking-wider">
            {(() => {
              for (const item of menuItems) {
                if (item.id === activeTab) return item.label;
                if (item.subItems) {
                  const sub = item.subItems.find(s => s.id === activeTab);
                  if (sub) return `${item.label} / ${sub.label}`;
                }
              }
              return '';
            })()}
          </h2>
          <div className="flex items-center gap-4 text-xs font-semibold">
            {/* Realtime API status indicator */}
            <span
              className={`px-3 py-1 rounded-full flex items-center gap-1.5 ${
                socketConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
              }`}
            >
              {socketConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {socketConnected ? 'SERVER SOCKET: ONLINE' : 'SERVER SOCKET: OFFLINE'}
            </span>
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 rounded-lg transition"
              title={theme === 'dark' ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
            >
              {theme === 'dark' ? <Sun className="h-4.5 w-4.5 text-zinc-400" /> : <Moon className="h-4.5 w-4.5 text-zinc-400" />}
            </button>

            {/* Divider */}
            <div className="w-[1px] h-6 bg-white/10 hidden sm:block"></div>

            {/* User Profile Badge (Kasir Name & Role) */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-white font-extrabold truncate max-w-[120px]">{currentUser?.username}</div>
                <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">
                  {currentUser?.role === 'admin' ? '🔥 Administrator' : currentUser?.role?.toUpperCase()}
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                {currentUser?.username?.[0] || 'U'}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* Dynamic page contents rendering */}
        <div className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'monitoring' && (
            <MonitorDashboard
              socket={socket}
              gates={gates}
              stats={stats}
              refreshStats={fetchStats}
            />
          )}

          {activeTab === 'simulator' && (
            <HardwareSimulator socket={socket} gates={gates} />
          )}

          {activeTab === 'cashier' && (
            <CashierBooth socket={socket} gates={gates} systemMode={systemMode} currentUser={currentUser} />
          )}

          {activeTab === 'members_topup' && (
            <MemberManager initialMode="manage" />
          )}

          {activeTab === 'members_conversion' && (
            <MemberManager initialMode="conversion" />
          )}

          {activeTab === 'tariff' && <TariffConfig />}

          {activeTab === 'ledger' && <FinancialLedger />}

          {activeTab === 'reports' && <ReportAnalytics />}

          {activeTab === 'gates' && (
            <GateConfigurator
              currentUser={currentUser}
              gates={gates}
              refreshGates={fetchGates}
              systemMode={systemMode}
              setSystemMode={setSystemMode}
            />
          )}

          {activeTab === 'users' && <UserSettings currentUser={currentUser} />}

          {activeTab === 'audit' && <AuditLogsList />}
        </div>
      </main>
    </div>
  );
}
