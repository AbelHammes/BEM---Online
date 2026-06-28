import React, { useState } from 'react';
import { ScheduleNotification } from '../types';
import { Bell, Wifi, WifiOff, RefreshCw, AlertTriangle, Info, Clock } from 'lucide-react';

interface NotificationFeedProps {
  notifications: ScheduleNotification[];
  isOffline: boolean;
  onToggleOffline: () => void;
  onRefresh: () => void;
  onAddNotification?: (title: string, message: string, severity: 'info' | 'warning' | 'alert') => void;
  isAdmin: boolean;
}

export default function NotificationFeed({
  notifications,
  isOffline,
  onToggleOffline,
  onRefresh,
  onAddNotification,
  isAdmin
}: NotificationFeedProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'alert'>('info');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;
    if (onAddNotification) {
      onAddNotification(title, message, severity);
      setTitle('');
      setMessage('');
      setIsAdding(false);
    }
  };

  return (
    <div id="notification-section" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      {/* Offline Connectivity Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${isOffline ? 'bg-red-50 text-red-600' : 'bg-green-50 text-emerald-600'}`}>
            {isOffline ? <WifiOff size={20} /> : <Wifi size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-sm">Status da Conexão</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-medium ${isOffline ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {isOffline ? 'Sem Sinal / Offline' : 'Sincronizado'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {isOffline 
                ? 'Acessando dados memorizados localmente (Cache offline ativado).' 
                : 'Conectado de forma segura ao servidor da CBC.'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {isAdmin && (
            <button
              id="toggle-offline-btn"
              onClick={onToggleOffline}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                isOffline
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              }`}
            >
              {isOffline ? 'Sintonizar Online' : 'Ficar Offline (Instabilidade)'}
            </button>
          )}
          
          <button
            id="sync-manual-btn"
            onClick={onRefresh}
            disabled={isOffline}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 border border-gray-200 cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
            title="Sincronizar agora"
          >
            <RefreshCw size={15} className={isOffline ? '' : 'animate-spin-slow'} />
          </button>
        </div>
      </div>

      {/* Notifications Header */}
      <div className="flex items-center justify-between mt-5 mb-3">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-amber-500" />
          <h4 className="font-semibold text-gray-800 text-sm">Anúncios & Mudanças no Cronograma</h4>
        </div>
        {isAdmin && !isOffline && (
          <button
            id="add-announcement-btn"
            onClick={() => setIsAdding(!isAdding)}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer"
          >
            {isAdding ? 'Cancelar' : '+ Emitir Comunicado'}
          </button>
        )}
      </div>

      {/* Admin Add Notification Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Título do Alerta</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Atraso de 15 Minutos"
                className="w-full px-3 py-2 border rounded border-gray-300 focus:ring-1 focus:ring-emerald-500 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Mensagem</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explique os detalhes do alerta aqui..."
                rows={2}
                className="w-full px-3 py-2 border rounded border-gray-300 focus:ring-1 focus:ring-emerald-500 bg-white"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-gray-700 font-medium">Severidade:</label>
                <select
                  value={severity}
                  onChange={(e: any) => setSeverity(e.target.value)}
                  className="px-2 py-1 border rounded bg-white"
                >
                  <option value="info">Info (Verde)</option>
                  <option value="warning">Aviso (Amarelo)</option>
                  <option value="alert">Alerta Crítico (Vermelho)</option>
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer font-medium"
              >
                Transmitir Alerta
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Notifications Board */}
      <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
        {notifications.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs">
            Nenhuma notificação recente emitida pela direção de prova.
          </div>
        ) : (
          notifications.map((notif) => {
            const isAlert = notif.severity === 'alert';
            const isWarning = notif.severity === 'warning';
            
            return (
              <div
                id={`notif-${notif.id}`}
                key={notif.id}
                className={`p-3 rounded-lg border flex gap-3 text-xs transition-all ${
                  isAlert 
                    ? 'bg-red-50 border-red-100 text-red-900 shadow-sm' 
                    : isWarning 
                      ? 'bg-amber-50 border-amber-100 text-amber-950' 
                      : 'bg-blue-50/50 border-blue-100 text-blue-900'
                }`}
              >
                <div className="mt-0.5">
                  {isAlert ? (
                    <AlertTriangle size={15} className="text-red-500 shrink-0" />
                  ) : isWarning ? (
                    <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                  ) : (
                    <Info size={15} className="text-blue-500 shrink-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold tracking-tight">{notif.title}</span>
                    <span className="text-xxs opacity-70 flex items-center gap-1">
                      <Clock size={10} />
                      {notif.timestamp}
                    </span>
                  </div>
                  <p className="opacity-90 leading-relaxed font-sans">{notif.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
