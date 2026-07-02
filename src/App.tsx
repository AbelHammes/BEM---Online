import React, { useState, useEffect, useMemo } from 'react';
import { RaceState, UserProfile, Athlete } from './types';
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
  LayoutDashboard,
  X
} from 'lucide-react';
import LiveResults from './components/LiveResults';
import AthleteSearch from './components/AthleteSearch';
import NotificationFeed from './components/NotificationFeed';
import PilotProfile from './components/PilotProfile';
import ManagerDashboard from './components/ManagerDashboard';
import { getMergedAthlete } from './utils';

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
  const [selectedAthlete, setSelectedAthlete] = useState<{ athlete: Athlete; categoryName: string } | null>(null);

  const handleSelectAthlete = (athlete: Athlete, categoryName: string) => {
    const merged = getMergedAthlete(athlete.plate, categoryName, cleanState?.event);
    setSelectedAthlete(merged || { athlete, categoryName });
  };

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

  const cleanState = useMemo<RaceState | null>(() => {
    if (!raceState || !raceState.event || !raceState.event.categories) return raceState;

    const cleanDuplicateNamesLocal = (firstName: string, lastName: string) => {
      let f = (firstName || "").trim();
      let l = (lastName || "").trim();
      if (!f || !l) return { firstName: f, lastName: l };

      const fLower = f.toLowerCase();
      const lLower = l.toLowerCase();

      // Case 1: Simple ending containment
      if (fLower.endsWith(lLower)) {
        const overlapIndex = fLower.length - lLower.length;
        if (overlapIndex === 0 || fLower[overlapIndex - 1] === " ") {
          l = "";
        }
      }

      // Case 2: Overlapping suffix-prefix words
      if (l !== "") {
        const fWords = f.split(/\s+/);
        const lWords = l.split(/\s+/);
        let overlapCount = 0;
        for (let i = 1; i <= Math.min(fWords.length, lWords.length); i++) {
          const fSuffix = fWords.slice(-i).map(w => w.toLowerCase()).join(" ");
          const lPrefix = lWords.slice(0, i).map(w => w.toLowerCase()).join(" ");
          if (fSuffix === lPrefix) {
            overlapCount = i;
          }
        }
        if (overlapCount > 0) {
          l = lWords.slice(overlapCount).join(" ");
        }
      }

      return { firstName: f, lastName: l };
    };

    return {
      ...raceState,
      event: {
        ...raceState.event,
        categories: raceState.event.categories.map(cat => ({
          ...cat,
          athletes: cat.athletes.map(ath => {
            const { firstName, lastName } = cleanDuplicateNamesLocal(ath.firstName, ath.lastName);
            return {
              ...ath,
              firstName,
              lastName,
              fullName: firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || ath.fullName)
            };
          })
        }))
      }
    };
  }, [raceState]);

  const notificationsCount = useMemo(() => {
    if (!cleanState) return 0;
    return cleanState.notifications.length;
  }, [cleanState]);

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
        {!cleanState ? (
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
                <LiveResults 
                  event={cleanState.event} 
                  isDashboard={activeTab === 'dashboard'} 
                  onSelectAthlete={handleSelectAthlete}
                />
              </div>

              {/* Sidebar Column or Secondary full-width columns */}
              <div className={`
                ${activeTab === 'dashboard' ? 'lg:col-span-4 block space-y-6' : ''}
                ${activeTab !== 'dashboard' && activeTab !== 'manager' && activeTab !== 'pilot' && activeTab !== 'athletes' && activeTab !== 'notifications' ? 'hidden' : 'lg:col-span-12 block space-y-6'}
              `}>
                
                {/* Athlete Search Component */}
                <div className={activeTab === 'athletes' ? 'block' : 'hidden'}>
                  <AthleteSearch 
                    event={cleanState.event} 
                    onSelectAthlete={handleSelectAthlete}
                  />
                </div>

                {/* Notifications Feed Component */}
                <div className={activeTab === 'dashboard' || activeTab === 'notifications' ? 'block' : 'hidden'}>
                  <NotificationFeed
                    notifications={cleanState.notifications}
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
                      {cleanState.schedule.map((item) => {
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
                    event={cleanState.event}
                    user={currentUser}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                    error={loginError}
                  />
                </div>

                {/* Organizer Management Module */}
                <div className={activeTab === 'manager' ? 'block' : 'hidden'}>
                  <ManagerDashboard
                    event={cleanState.event}
                    schedule={cleanState.schedule}
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

      {/* Selected Athlete High-Fidelity Stats Modal Overlay */}
      {selectedAthlete && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setSelectedAthlete(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-scale-up text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedAthlete(null)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
              title="Fechar"
            >
              <X size={18} />
            </button>

            {/* Header / Info Summary */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-mono font-bold flex items-center justify-center text-sm shadow-md">
                  #{selectedAthlete.athlete.plate}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-base">
                      {selectedAthlete.athlete.firstName} {selectedAthlete.athlete.lastName}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-semibold">
                      {selectedAthlete.categoryName}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono mt-1">
                    CBC ID: {selectedAthlete.athlete.uciId || 'Ativo no BEM'} 
                    {selectedAthlete.athlete.state && ` • UF: ${selectedAthlete.athlete.state}`}
                    {selectedAthlete.athlete.club && ` • ${selectedAthlete.athlete.club}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Grid stats */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stats 1: Registration Details */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 mb-3">
                    <Trophy size={14} className="text-amber-500" />
                    Inscrição & Classificação
                  </h4>
                  <div className="space-y-2 text-xxs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-gray-500">Posição Oficial:</span>
                      <span className="font-bold text-gray-900">
                        {selectedAthlete.athlete.place ? `${selectedAthlete.athlete.place}º Lugar` : 'Classificação em aberto'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-gray-500">Pontos Acumulados (M-PTS):</span>
                      <span className="font-bold text-emerald-700">
                        {selectedAthlete.athlete.mpts ?? selectedAthlete.athlete.points ?? 'Não calculado'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-gray-500">Clube / Equipe:</span>
                      <span className="font-semibold text-gray-800 truncate max-w-[150px]" title={selectedAthlete.athlete.club}>
                        {selectedAthlete.athlete.club || 'Avulso'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Patrocinador:</span>
                      <span className="font-medium text-purple-700 italic truncate max-w-[150px]" title={selectedAthlete.athlete.sponsor}>
                        {selectedAthlete.athlete.sponsor || 'Não listado'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats 2: Gate Lane Draws */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 mb-3">
                    <Users size={14} className="text-blue-500" />
                    Sorteios de Portão & Raias
                  </h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                      <div className="p-1.5 border rounded-lg bg-white shadow-xxs">
                        <div className="text-[9px] text-gray-400 mb-0.5">Moto 1</div>
                        <div className="font-mono font-bold text-gray-800">{selectedAthlete.athlete.m1Draw || '-'}</div>
                      </div>
                      <div className="p-1.5 border rounded-lg bg-white shadow-xxs">
                        <div className="text-[9px] text-gray-400 mb-0.5">Moto 2</div>
                        <div className="font-mono font-bold text-gray-800">{selectedAthlete.athlete.m2Draw || '-'}</div>
                      </div>
                      <div className="p-1.5 border rounded-lg bg-white shadow-xxs">
                        <div className="text-[9px] text-gray-400 mb-0.5">Moto 3</div>
                        <div className="font-mono font-bold text-gray-800">{selectedAthlete.athlete.m3Draw || '-'}</div>
                      </div>
                    </div>

                    {/* Secondary Phases Draws if present */}
                    {(selectedAthlete.athlete.quartasDraw || selectedAthlete.athlete.semiDraw || selectedAthlete.athlete.finalDraw) && (
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] pt-1.5">
                        {selectedAthlete.athlete.quartasDraw && (
                          <div className="p-1.5 border rounded-lg bg-white shadow-xxs border-emerald-100">
                            <div className="text-[9px] text-emerald-600 font-bold mb-0.5">Quartas</div>
                            <div className="font-mono font-bold text-gray-800">{selectedAthlete.athlete.quartasDraw}</div>
                          </div>
                        )}
                        {selectedAthlete.athlete.semiDraw && (
                          <div className="p-1.5 border rounded-lg bg-white shadow-xxs border-emerald-100">
                            <div className="text-[9px] text-emerald-600 font-bold mb-0.5">Semi</div>
                            <div className="font-mono font-bold text-gray-800">{selectedAthlete.athlete.semiDraw}</div>
                          </div>
                        )}
                        {selectedAthlete.athlete.finalDraw && (
                          <div className="p-1.5 border rounded-lg bg-white shadow-xxs border-amber-100">
                            <div className="text-[9px] text-amber-600 font-bold mb-0.5">Final</div>
                            <div className="font-mono font-bold text-gray-800">{selectedAthlete.athlete.finalDraw}</div>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[9px] text-gray-400 mt-1 text-center italic leading-tight">
                      *Ex: '10: 3' indica Corrida 10 na Raia 3.
                    </p>
                  </div>
                </div>
              </div>

              {/* Timing and Lap details */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 mb-3">
                  <Activity size={14} className="text-emerald-600" />
                  Histórico de Tempos de Volta & Reações
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xxs">
                  <div className="space-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-gray-500">Moto 1 Tempo / Reação:</span>
                      <span className="font-mono font-bold text-gray-900">
                        {selectedAthlete.athlete.m1Time ? `${selectedAthlete.athlete.m1Time}s` : '-'} | <span className="text-amber-600">{selectedAthlete.athlete.m1Reaction ? `${selectedAthlete.athlete.m1Reaction}s` : '-'}</span>
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-gray-500">Moto 2 Tempo / Reação:</span>
                      <span className="font-mono font-bold text-gray-900">
                        {selectedAthlete.athlete.m2Time ? `${selectedAthlete.athlete.m2Time}s` : '-'} | <span className="text-amber-600">{selectedAthlete.athlete.m2Reaction ? `${selectedAthlete.athlete.m2Reaction}s` : '-'}</span>
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Moto 3 Tempo / Reação:</span>
                      <span className="font-mono font-bold text-gray-900">
                        {selectedAthlete.athlete.m3Time ? `${selectedAthlete.athlete.m3Time}s` : '-'} | <span className="text-amber-600">{selectedAthlete.athlete.m3Reaction ? `${selectedAthlete.athlete.m3Reaction}s` : '-'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-gray-500">Quartas de Final (Tempo):</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {selectedAthlete.athlete.fullQuartas || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-gray-500">Semifinal (Tempo):</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {selectedAthlete.athlete.fullSemi || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Grande Final (Tempo):</span>
                      <span className="font-mono font-black text-amber-700">
                        {selectedAthlete.athlete.fullFinal || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evolution text */}
                {selectedAthlete.athlete.m1Time && selectedAthlete.athlete.m2Time && (
                  <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200 text-center text-emerald-600 flex items-center justify-center gap-1 text-[10px]">
                    <Activity size={12} className="shrink-0 animate-pulse" />
                    <span>
                      Evolução de Performance: M1 para M2 mudou em{' '}
                      <strong className="font-bold">
                        {(((parseFloat(selectedAthlete.athlete.m1Time) - parseFloat(selectedAthlete.athlete.m2Time)) / parseFloat(selectedAthlete.athlete.m1Time)) * 100).toFixed(1)}%
                      </strong>{' '}
                      {parseFloat(selectedAthlete.athlete.m1Time) > parseFloat(selectedAthlete.athlete.m2Time) ? 'mais rápido' : 'mais lento'}.
                    </span>
                  </div>
                )}
              </div>

              {/* Progress Bar Graph */}
              {selectedAthlete.athlete.m1Time && (
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="font-bold text-gray-800 text-xs mb-3 flex items-center gap-1.5">
                    <Activity size={14} className="text-emerald-600" />
                    Gráfico Comparativo de Desempenho (Tempos de Volta)
                  </h4>
                  <div className="space-y-2.5">
                    {/* Moto 1 */}
                    {selectedAthlete.athlete.m1Time && (
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>Tempo Moto 1</span>
                          <span className="font-bold text-gray-900">{selectedAthlete.athlete.m1Time}s</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: '82%' }}></div>
                        </div>
                      </div>
                    )}
                    {/* Moto 2 */}
                    {selectedAthlete.athlete.m2Time && (
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>Tempo Moto 2</span>
                          <span className="font-bold text-gray-900">{selectedAthlete.athlete.m2Time}s</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: '88%' }}></div>
                        </div>
                      </div>
                    )}
                    {/* Moto 3 */}
                    {selectedAthlete.athlete.m3Time && (
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>Tempo Moto 3</span>
                          <span className="font-bold text-gray-900">{selectedAthlete.athlete.m3Time}s</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-700 rounded-full" style={{ width: '85%' }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedAthlete(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer transition-colors text-xxs"
              >
                Fechar Painel do Piloto
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
