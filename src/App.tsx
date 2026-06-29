import React, { useState, useEffect, useMemo } from 'react';
import { RaceState, UserProfile } from './types';
import { 
  Trophy, 
  Users, 
  Bell, 
  User, 
  ShieldAlert, 
  FileText, 
  MapPin, 
  Calendar, 
  HelpCircle, 
  Activity, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle,
  LayoutDashboard
} from 'lucide-react';
import LiveResults from './components/LiveResults';
import AthleteSearch from './components/AthleteSearch';
import NotificationFeed from './components/NotificationFeed';
import PilotProfile from './components/PilotProfile';
import ManagerDashboard from './components/ManagerDashboard';

export default function App() {
  // Check if URL contains ?admin=true to reveal the Organizador (CBC) tab
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('admin') === 'true';
    }
    return false;
  });

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'results' | 'athletes' | 'notifications' | 'pilot' | 'manager'>('results');
  
  // App state
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loginError, setLoginError] = useState<string>('');

  // Auto-load state from local database if online, or local cache if offline
  const fetchRaceState = async () => {
    if (isOfflineMode) {
      // Offline: Read static local cached state if available
      const cached = localStorage.getItem('cached_race_state');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Set cached, flagging offline sync status
          setRaceState({
            ...parsed,
            syncStatus: {
              ...parsed.syncStatus,
              status: 'offline'
            }
          });
        } catch (e) {
          console.error("Erro lendo cache", e);
        }
      }
      return;
    }

    try {
      const res = await fetch('/api/race-state');
      if (res.ok) {
        const data = await res.json();
        setRaceState(data);
        // Persist to offline localStorage Cache for emergencies
        localStorage.setItem('cached_race_state', JSON.stringify(data));
      }
    } catch (err) {
      console.warn("Sem conexão com o servidor, ativando cache offline automaticamente.", err);
      // Fallback automatically
      const cached = localStorage.getItem('cached_race_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        setRaceState({
          ...parsed,
          syncStatus: { ...parsed.syncStatus, status: 'offline' }
        });
        setIsOfflineMode(true);
      }
    }
  };

  // Real-time Background Polling for instant updates (every 5 seconds)
  useEffect(() => {
    fetchRaceState();
    
    const interval = setInterval(() => {
      // Don't poll if the tab is hidden to save server performance
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      fetchRaceState();
    }, 5000);

    // Refresh immediately when tab becomes visible again
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchRaceState();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [isOfflineMode]);

  // Handle Client Offline Toggle Simulation
  const handleToggleOffline = () => {
    const nextOffline = !isOfflineMode;
    setIsOfflineMode(nextOffline);
    if (nextOffline && raceState) {
      // Force offline status
      setRaceState(prev => prev ? {
        ...prev,
        syncStatus: { ...prev.syncStatus, status: 'offline' }
      } : null);
    } else {
      // Re-fetch online Immediately
      fetchRaceState();
    }
  };

  // Secure Unified Login Handler (Pilot / Organizer)
  const handleLogin = async (credentials: any) => {
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.profile);
      } else {
        const errData = await res.json();
        setLoginError(errData.error || 'Credenciais incorretas.');
      }
    } catch (e: any) {
      setLoginError('Não foi possível conectar ao servidor de login.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginError('');
  };

  // BEM File Upload (JSON or HTML) Handler from Admin Center
  const handleUploadBEM = async (content: any, type: string, filename?: string) => {
    if (isOfflineMode) {
      // Simulation in offline mode (saves in LocalStorage directly)
      alert("Simulando processamento offline local! Para persistir no banco de dados definitivo, reconete o sistema online.");
      return;
    }

    try {
      const res = await fetch('/api/upload-bem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: filename || `manual_upload.${type}`,
          content: content,
          type: type
        })
      });
      if (res.ok) {
        await fetchRaceState();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Falha no processamento.');
      }
    } catch (e: any) {
      alert(`Erro no upload: ${e.message}`);
      throw e;
    }
  };

  // Update schedule status (Admins only)
  const handleUpdateScheduleStatus = async (id: string, status: any) => {
    try {
      const res = await fetch('/api/schedule/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      if (res.ok) {
        await fetchRaceState();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Direct Alerts Creator (Admins only)
  const handleAddNotification = async (title: string, message: string, severity: 'info' | 'warning' | 'alert') => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, severity })
      });
      if (res.ok) {
        await fetchRaceState();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Reset database back to default
  const handleResetDatabase = async () => {
    if (!confirm('Você tem certeza que deseja restaurar o banco de dados original de Cuiabá 2026? Isso substituirá todas as importações recentes.')) {
      return;
    }
    try {
      const res = await fetch('/api/reset-data', { method: 'POST' });
      if (res.ok) {
        await fetchRaceState();
        alert('Banco de dados restaurado com sucesso para o padrão de Cuiabá!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const notificationsCount = useMemo(() => {
    if (!raceState) return 0;
    return raceState.notifications.length;
  }, [raceState]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Visual Header representing Campeonato Brasileiro de BMX 2026 */}
      <header className="bg-slate-950 text-white relative border-b border-emerald-500 shadow-sm overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-full h-1 flex">
          <div className="w-1/3 bg-emerald-600"></div>
          <div className="w-1/3 bg-yellow-400"></div>
          <div className="w-1/3 bg-blue-600"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-700/80 rounded-xl border border-emerald-500/30 flex items-center justify-center text-white shrink-0 shadow-sm relative group overflow-hidden">
              <Trophy className="text-yellow-400" size={20} />
              <div className="absolute inset-0 bg-yellow-400/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight">CAMPEONATO BRASILEIRO DE BMX 2026</h1>
                <span className="text-[10px] bg-yellow-400 text-slate-950 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  Etapa Única Nacional
                </span>
              </div>
              <p className="text-xxs sm:text-xs text-gray-300 flex flex-wrap items-center gap-1.5 mt-0.5 sm:mt-1">
                <MapPin size={12} className="text-emerald-400 shrink-0" />
                <span>Pista de BMX Cuiabá, Cuiabá - MT</span>
                <span className="text-gray-500">|</span>
                <Calendar size={12} className="text-yellow-400 shrink-0" />
                <span>04 e 05 de Julho de 2026</span>
              </p>
            </div>
          </div>

          {/* Active status indicator */}
          {raceState && (
            <div className="flex items-center gap-2 text-xxs font-semibold bg-slate-900 border border-slate-800 p-2 rounded-lg">
              <span className="text-gray-400">Sincronizador BEM:</span>
              <div className="flex items-center gap-1.5 bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                <span>Portão online em Cuiabá</span>
              </div>
              {raceState.syncStatus.lastSync && (
                <div className="hidden md:block text-gray-500 font-mono text-[9px]">
                  Sincronia: {raceState.syncStatus.lastSync}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Navigation tabs bar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-xs shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-1.5 sm:gap-2 py-3 w-full">
            
            <button
              id="nav-tab-results"
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xxs sm:text-xs font-bold rounded-xl cursor-pointer transition-all duration-150 grow sm:grow-0 justify-center sm:justify-start ${
                activeTab === 'results'
                  ? 'bg-gradient-to-r from-emerald-800 to-emerald-700 text-white shadow-sm border-b-2 border-b-yellow-400 ring-1 ring-emerald-600/20'
                  : 'text-slate-600 bg-slate-50 hover:bg-slate-100/80 hover:text-slate-900 border border-slate-200/50'
              }`}
            >
              <Trophy size={14} className={activeTab === 'results' ? 'text-yellow-400' : 'text-slate-500'} />
              Classificação & Motos
            </button>

            <button
              id="nav-tab-athletes"
              onClick={() => setActiveTab('athletes')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xxs sm:text-xs font-bold rounded-xl cursor-pointer transition-all duration-150 grow sm:grow-0 justify-center sm:justify-start ${
                activeTab === 'athletes'
                  ? 'bg-gradient-to-r from-emerald-800 to-emerald-700 text-white shadow-sm border-b-2 border-b-yellow-400 ring-1 ring-emerald-600/20'
                  : 'text-slate-600 bg-slate-50 hover:bg-slate-100/80 hover:text-slate-900 border border-slate-200/50'
              }`}
            >
              <Users size={14} className={activeTab === 'athletes' ? 'text-yellow-400' : 'text-slate-500'} />
              Atletas & Inscrições
            </button>

            <button
              id="nav-tab-notifications"
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xxs sm:text-xs font-bold rounded-xl cursor-pointer transition-all duration-150 grow sm:grow-0 justify-center sm:justify-start ${
                activeTab === 'notifications'
                  ? 'bg-gradient-to-r from-emerald-800 to-emerald-700 text-white shadow-sm border-b-2 border-b-yellow-400 ring-1 ring-emerald-600/20'
                  : 'text-slate-600 bg-slate-50 hover:bg-slate-100/80 hover:text-slate-900 border border-slate-200/50'
              }`}
            >
              <Bell size={14} className={activeTab === 'notifications' ? 'text-yellow-400' : 'text-slate-500'} />
              Cronograma & Avisos
              {notificationsCount > 0 && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-red-500"></span>
              )}
            </button>

            <button
              id="nav-tab-pilot"
              onClick={() => setActiveTab('pilot')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xxs sm:text-xs font-bold rounded-xl cursor-pointer transition-all duration-150 grow sm:grow-0 justify-center sm:justify-start ${
                activeTab === 'pilot'
                  ? 'bg-gradient-to-r from-emerald-800 to-emerald-700 text-white shadow-sm border-b-2 border-b-yellow-400 ring-1 ring-emerald-600/20'
                  : 'text-slate-600 bg-slate-50 hover:bg-slate-100/80 hover:text-slate-900 border border-slate-200/50'
              }`}
            >
              <User size={14} className={activeTab === 'pilot' ? 'text-yellow-400' : 'text-slate-500'} />
              Painel do Piloto
              {currentUser?.role === 'pilot' && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
              )}
            </button>

            {(isAdminMode || currentUser?.role === 'admin') && (
              <button
                id="nav-tab-manager"
                onClick={() => setActiveTab('manager')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xxs sm:text-xs font-bold rounded-xl cursor-pointer transition-all duration-150 grow sm:grow-0 justify-center sm:justify-start ${
                  activeTab === 'manager'
                    ? 'bg-gradient-to-r from-emerald-800 to-emerald-700 text-white shadow-sm border-b-2 border-b-yellow-400 ring-1 ring-emerald-600/20'
                    : 'text-slate-600 bg-slate-50 hover:bg-slate-100/80 hover:text-slate-900 border border-slate-200/50'
                }`}
              >
                <ShieldAlert size={14} className={activeTab === 'manager' ? 'text-yellow-400' : 'text-slate-500'} />
                Organizador (CBC)
                {currentUser?.role === 'admin' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                )}
              </button>
            )}
            
          </div>
        </div>
      </nav>

      {/* Main Context container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto">
        {!raceState ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <RefreshCw className="animate-spin text-emerald-600 mb-3" size={32} />
            <h4 className="font-bold text-gray-800 text-sm">Carregando Resultados Oficiais de Cuiabá...</h4>
            <p className="text-xxs text-gray-400 max-w-xs mt-1">
              Conectando-se ao synchronizer central na sala de computação do BEM. Por favor, aguarde.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Unified same-screen grid layout (Dashboard / Visão Geral) or focused layouts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Main Column: LiveResults */}
              <div className={`
                ${activeTab === 'dashboard' ? 'lg:col-span-8 block' : ''}
                ${activeTab === 'results' ? 'lg:col-span-12 block' : ''}
                ${(activeTab !== 'dashboard' && activeTab !== 'results') ? 'hidden' : ''}
              `}>
                <LiveResults event={raceState.event} isDashboard={activeTab === 'dashboard'} />
              </div>

              {/* Sidebar Column or Secondary full-width columns */}
              <div className={`
                ${activeTab === 'dashboard' ? 'lg:col-span-4 block space-y-6' : ''}
                ${activeTab !== 'dashboard' && activeTab !== 'manager' && activeTab !== 'pilot' && activeTab !== 'athletes' && activeTab !== 'notifications' ? 'hidden' : 'lg:col-span-12 block space-y-6'}
              `}>
                
                {/* Athlete Search Component */}
                <div className={activeTab === 'athletes' ? 'block' : 'hidden'}>
                  <AthleteSearch event={raceState.event} />
                </div>

                {/* Notifications Feed Component */}
                <div className={activeTab === 'dashboard' || activeTab === 'notifications' ? 'block' : 'hidden'}>
                  <NotificationFeed
                    notifications={raceState.notifications}
                    isOffline={isOfflineMode}
                    onToggleOffline={handleToggleOffline}
                    onRefresh={fetchRaceState}
                    onAddNotification={(currentUser?.role === 'admin' || isAdminMode) ? handleAddNotification : undefined}
                    isAdmin={currentUser?.role === 'admin' || isAdminMode}
                  />
                </div>

                {/* Timeline / Official Schedule milestones */}
                <div className={activeTab === 'dashboard' || activeTab === 'notifications' ? 'block' : 'hidden'}>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h4 className="font-bold text-gray-900 text-xs mb-3 flex items-center gap-1">
                      <Calendar size={15} className="text-emerald-600" />
                      Cronograma Oficial do Campeonato
                    </h4>
                    <div className="space-y-4 relative pl-3 border-l border-gray-100 py-1 text-xxs">
                      {raceState.schedule.map((item) => {
                        const isCompleted = item.status === 'completed';
                        const isOngoing = item.status === 'ongoing';
                        const isDelayed = item.status === 'delayed';

                        return (
                          <div key={item.id} className="relative group">
                            {/* Circle state pointer */}
                            <div className={`absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full border bg-white ${
                              isCompleted 
                                ? 'border-emerald-600 bg-emerald-500' 
                                : isOngoing 
                                  ? 'border-blue-600 bg-blue-500 shadow-sm scale-110' 
                                  : isDelayed
                                    ? 'border-amber-500 bg-amber-500 animate-pulse'
                                    : 'border-gray-200'
                            }`}></div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-gray-400 text-[10px]">{item.time}</span>
                                <span className={`inline-flex px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                                  isCompleted
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : isOngoing
                                      ? 'bg-blue-50 text-blue-800'
                                      : isDelayed
                                        ? 'bg-amber-100 text-amber-800 font-bold'
                                        : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {isCompleted ? 'Concluído' : isOngoing ? 'Em Curso' : isDelayed ? 'Atraso' : 'Agendado'}
                                </span>
                              </div>
                              <h5 className="font-bold text-gray-900 mt-1 leading-tight">{item.title}</h5>
                              <p className="text-gray-500 mt-0.5">{item.details}</p>
                              <span className="text-emerald-700 font-medium">Bateria: {item.category}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Pilot Profile Module */}
                <div className={activeTab === 'dashboard' || activeTab === 'pilot' ? 'block' : 'hidden'}>
                  <PilotProfile
                    event={raceState.event}
                    user={currentUser}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                    error={loginError}
                  />
                </div>

                {/* Organizer Management Module */}
                <div className={activeTab === 'manager' ? 'block' : 'hidden'}>
                  <ManagerDashboard
                    event={raceState.event}
                    schedule={raceState.schedule}
                    user={currentUser}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                    onUploadBEM={handleUploadBEM}
                    onUpdateScheduleStatus={handleUpdateScheduleStatus}
                    onResetDatabase={handleResetDatabase}
                    onAddNotification={handleAddNotification}
                    error={loginError}
                  />
                </div>

              </div>
            </div>

          </div>
        )}
      </main>

      {/* Humble Footer */}
      <footer className="bg-slate-900 py-6 text-center text-xxs text-gray-400 border-t border-slate-800 shrink-0">
        <div className="max-w-7xl mx-auto px-4 font-sans space-y-3">
          <p className="text-gray-500">© 2026 Confederação Brasileira de Ciclismo | Campeonato Brasileiro de BMX Cuiabá-MT</p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 text-[10px] text-gray-300">
            <span className="font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/30">
              Desenvolvido por Abel Hammes
            </span>
            <span className="hidden md:inline text-gray-600">•</span>
            <span className="text-gray-400">Tecnologia de Cronometragem: Lyndon Downing (BEM)</span>
            <span className="hidden md:inline text-gray-600">•</span>
            <span className="text-emerald-500 font-semibold bg-emerald-950/40 px-1.5 py-0.5 rounded">
              Sincronizador C:\SISTEMA_BEM\Resultados Ativo
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
