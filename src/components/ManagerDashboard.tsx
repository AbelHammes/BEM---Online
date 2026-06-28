import React, { useState } from 'react';
import { EventData, UserProfile, ScheduleEvent } from '../types';
import { BEM_MOCK_FILES } from '../data';
import { Shield, LogIn, UploadCloud, RefreshCw, FileText, CheckCircle, Clock, AlertTriangle, AlertCircle, FileCode, Play, LogOut, Code, Download, Megaphone, Copy, ExternalLink, Share2, Eye, EyeOff } from 'lucide-react';

interface ManagerDashboardProps {
  event: EventData;
  schedule: ScheduleEvent[];
  user: UserProfile | null;
  onLogin: (credentials: { username: string; password: string; type: 'manager' }) => Promise<void>;
  onLogout: () => void;
  onUploadBEM: (content: any, type: string, filename?: string) => Promise<void>;
  onUpdateScheduleStatus: (id: string, status: 'pending' | 'ongoing' | 'completed' | 'delayed') => Promise<void>;
  onResetDatabase: () => Promise<void>;
  onAddNotification?: (title: string, message: string, severity: 'info' | 'warning' | 'alert') => Promise<void>;
  error?: string;
}

export default function ManagerDashboard({
  event,
  schedule,
  user,
  onLogin,
  onLogout,
  onUploadBEM,
  onUpdateScheduleStatus,
  onResetDatabase,
  onAddNotification,
  error
}: ManagerDashboardProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; success: boolean } | null>(null);

  // New notice/announcement form states
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newSeverity, setNewSeverity] = useState<'info' | 'warning' | 'alert'>('info');
  const [isPublishingNotice, setIsPublishingNotice] = useState(false);
  const [noticeFeedback, setNoticeFeedback] = useState<{ text: string; success: boolean } | null>(null);
  const [copiedType, setCopiedType] = useState<'spectator' | 'admin' | null>(null);

  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newMessage) return;
    if (onAddNotification) {
      try {
        setIsPublishingNotice(true);
        setNoticeFeedback(null);
        await onAddNotification(newTitle, newMessage, newSeverity);
        setNewTitle('');
        setNewMessage('');
        setNewSeverity('info');
        setNoticeFeedback({ text: 'Aviso transmitido e salvo com sucesso!', success: true });
        setTimeout(() => setNoticeFeedback(null), 5000);
      } catch (err: any) {
        setNoticeFeedback({ text: `Erro ao enviar aviso: ${err.message || err}`, success: false });
      } finally {
        setIsPublishingNotice(false);
      }
    }
  };

  const copyToClipboard = (type: 'spectator' | 'admin', url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onLogin({ username, password, type: 'manager' });
    setIsLoading(false);
  };

  // Automated parser simulator from pre-saved prompt files
  const triggerSimulation = async (type: 'entries' | 'draws' | 'motoResults' | 'fullResults' | 'entriesHtml' | 'drawsHtml' | 'motoResultsHtml') => {
    try {
      setIsLoading(true);
      setUploadMessage(null);
      let payload: any = null;
      let filename = "";

      switch (type) {
        case 'entries':
          payload = BEM_MOCK_FILES.classEntriesJson;
          filename = "Categoria_Inscricoes_Boys_7-8.json";
          break;
        case 'draws':
          payload = BEM_MOCK_FILES.motoDrawsJson;
          filename = "Sorteios_Baterias.json";
          break;
        case 'motoResults':
          payload = BEM_MOCK_FILES.motoResultsJson;
          filename = "Resultados_Motos_Baterias.json";
          break;
        case 'fullResults':
          payload = BEM_MOCK_FILES.fullResultsJson;
          filename = "Resultados_Completos_Boys_7-8.json";
          break;
        case 'entriesHtml':
          payload = BEM_MOCK_FILES.classEntriesHtml;
          filename = "CLASS_ENTRIES_REPORT.html";
          break;
        case 'drawsHtml':
          payload = BEM_MOCK_FILES.motoDrawsHtml;
          filename = "MOTO_DRAWS_REPORT.html";
          break;
        case 'motoResultsHtml':
          payload = BEM_MOCK_FILES.motoResultsHtml;
          filename = "MOTO_RESULTS_REPORT.html";
          break;
      }

      await onUploadBEM(payload, 'json', filename);
      setUploadMessage({
        text: `Simulada sincronização de ${filename}. Resultados integrados com sucesso no painel online!`,
        success: true
      });
    } catch (err: any) {
      setUploadMessage({ text: `Falha na simulação: ${err.message}`, success: false });
    } finally {
      setIsLoading(false);
    }
  };

  // File Upload Handlers (HTML & JSON)
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setIsLoading(true);
        setUploadMessage(null);
        const text = e.target?.result;
        if (!text) throw new Error("Não foi possível ler o arquivo.");

        await onUploadBEM(text, file.name.endsWith('.json') ? 'json' : 'html', file.name);
        setUploadMessage({
          text: `Arquivo '${file.name}' sincronizado e processado! Resultados atualizados em tempo real no dashboard.`,
          success: true
        });
      } catch (err: any) {
        setUploadMessage({ text: `Erro: ${err.message}`, success: false });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  if (!user) {
    return (
      <div id="manager-login-card" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 max-w-sm mx-auto">
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
            <Shield size={24} />
          </div>
          <h3 className="font-bold text-gray-900 text-sm font-sans">Acesso à Organização (CBC)</h3>
          <p className="text-xxs text-gray-500 mt-1">
            Faça login como gerente de prova para sincronizar resultados, simular uploads do BEM, decretar atrasos no cronograma e emitir alertas.
          </p>
        </div>

        {error && (
          <div className="mb-3 p-2 border border-red-200 bg-red-50 text-red-800 text-[10px] rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-3 text-xs" autoComplete="off">
          {/* Elementos ocultos para desativar a sugestão/preenchimento automático do navegador */}
          <div className="absolute -top-40 -left-40 h-0 w-0 overflow-hidden opacity-0 pointer-events-none" aria-hidden="true">
            <input type="text" name="username_fake" tabIndex={-1} autoComplete="off" />
            <input type="password" name="password_fake" tabIndex={-1} autoComplete="off" />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">Usuário Operador</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex: admin"
              autoComplete="one-time-code"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">Senha de Entrada</label>
            <div className="relative">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha de acesso"
                autoComplete="new-password"
                style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' } as React.CSSProperties}
                className="w-full pl-3 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            id="manager-login-submit"
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-emerald-600 font-bold hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogIn size={15} />
            {isLoading ? 'Checando credenciais...' : 'Acessar Central de Prova'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div id="manager-dashboard" className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-950 text-sm">Central do Coordenador de Resultados</h3>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Painel Diretor</span>
          </div>
          <p className="text-xxs text-gray-500 mt-1">
            Painel principal de processamento do BEM e gerenciamento do cronograma das provas em Cuiabá - MT.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetDatabase}
            className="px-3 py-1.5 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg cursor-pointer"
            title="Sincroniza do zero o Campeonato de Cuiabá de Volta"
          >
            Reiniciar Banco de Dados
          </button>
          
          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <LogOut size={13} />
            Encerrar Painel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left half - File Uploads and Automation Deck */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Real Upload Zone */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 className="font-bold text-gray-900 text-xs mb-3 flex items-center gap-1.5">
              <UploadCloud size={16} className="text-emerald-600" />
              Sincronizar Arquivos Locais (.json / .html)
            </h4>
            <p className="text-xxs text-gray-400 mb-4 leading-relaxed">
              Arraste e solte ou procure relatórios do seu BEM em <strong>C:\SISTEMA_BEM\Resultados</strong>. O interpretador lê inscrições, classificação geral e as chaves de sorteio de portão.
            </p>

            {uploadMessage && (
              <div className={`mb-4 p-3 rounded-lg border text-xxs flex items-start gap-2 ${
                uploadMessage.success
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
                  : 'bg-red-50 border-red-100 text-red-950'
              }`}>
                {uploadMessage.success ? <CheckCircle size={15} className="text-emerald-600 mt-0.5" /> : <AlertCircle size={15} className="text-red-600 mt-0.5" />}
                <span>{uploadMessage.text}</span>
              </div>
            )}

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50/50'
                  : 'border-gray-200 hover:border-emerald-400 hover:bg-gray-50/20'
              }`}
            >
              <input
                type="file"
                id="bem-file-selector"
                onChange={handleFileChange}
                accept=".json,.html,.htm"
                className="hidden"
              />
              <label htmlFor="bem-file-selector" className="cursor-pointer">
                <UploadCloud size={30} className="text-gray-400 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block text-xs font-semibold text-gray-800">Clique para selecionar relatório do BEM</span>
                <span className="block text-xxs text-gray-400 mt-1">Carrega chaves JSON ou relatórios salvos em HTML</span>
              </label>
            </div>
          </div>

          {/* Quick Simulation Station */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 className="font-bold text-gray-900 text-xs mb-3 flex items-center gap-1.5">
              <Play size={16} className="text-amber-500 animate-pulse" />
              Central de Simulação de Arquivos de Prova (Modelos Anexos)
            </h4>
            <p className="text-xxs text-gray-400 mb-4 leading-relaxed">
              Não tem o BEM aberto no momento? Clique nos botões abaixo para simular o recebimento instantâneo dos relatórios oficiais anexados ao pedido (gerando as chaves de prova na pista de Cuiabá).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xxs font-semibold">
              <div className="p-3 border.border-gray-100 rounded-lg bg-gray-50/50 space-y-2">
                <div className="text-gray-500 uppercase font-bold text-[9px] tracking-wider mb-2">Sincronizadores de JSON</div>
                
                <button
                  onClick={() => triggerSimulation('entries')}
                  className="w-full flex items-center justify-between p-2 bg-white rounded border hover:border-emerald-300 shadow-xxs transition-all cursor-pointer group text-left"
                >
                  <span className="truncate flex items-center gap-1">
                    <FileCode size={13} className="text-orange-500" />
                    BEM: Inscrições Boys 7/8
                  </span>
                  <Play size={11} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onClick={() => triggerSimulation('draws')}
                  className="w-full flex items-center justify-between p-2 bg-white rounded border hover:border-emerald-300 shadow-xxs transition-all cursor-pointer group text-left"
                >
                  <span className="truncate flex items-center gap-1">
                    <FileCode size={13} className="text-blue-500" />
                    BEM: Chaveamento/Raias Boys 7/8
                  </span>
                  <Play size={11} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onClick={() => triggerSimulation('motoResults')}
                  className="w-full flex items-center justify-between p-2 bg-white rounded border hover:border-emerald-300 shadow-xxs transition-all cursor-pointer group text-left"
                >
                  <span className="truncate flex items-center gap-1">
                    <FileCode size={13} className="text-purple-500" />
                    BEM: Desempenho Motos 1/2/3
                  </span>
                  <Play size={11} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onClick={() => triggerSimulation('fullResults')}
                  className="w-full flex items-center justify-between p-2 bg-white rounded border hover:border-emerald-300 shadow-xxs transition-all cursor-pointer group text-left"
                >
                  <span className="truncate flex items-center gap-1">
                    <FileCode size={13} className="text-amber-500" />
                    BEM: Resultados Completos
                  </span>
                  <Play size={11} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
                </button>
              </div>

              <div className="p-3 border border-gray-100 rounded-lg bg-gray-50/50 space-y-2">
                <div className="text-gray-500 uppercase font-bold text-[9px] tracking-wider mb-2">Sincronizadores de HTML</div>
                
                <button
                  onClick={() => triggerSimulation('entriesHtml')}
                  className="w-full flex items-center justify-between p-2 bg-white rounded border hover:border-emerald-300 shadow-xxs transition-all cursor-pointer group text-left"
                >
                  <span className="truncate flex items-center gap-1">
                    <FileText size={13} className="text-gray-600" />
                    BEM HTML: Inscrições
                  </span>
                  <Play size={11} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onClick={() => triggerSimulation('drawsHtml')}
                  className="w-full flex items-center justify-between p-2 bg-white rounded border hover:border-emerald-300 shadow-xxs transition-all cursor-pointer group text-left"
                >
                  <span className="truncate flex items-center gap-1">
                    <FileText size={13} className="text-gray-600" />
                    BEM HTML: Sorteios Raias
                  </span>
                  <Play size={11} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onClick={() => triggerSimulation('motoResultsHtml')}
                  className="w-full flex items-center justify-between p-2 bg-white rounded border hover:border-emerald-300 shadow-xxs transition-all cursor-pointer group text-left"
                >
                  <span className="truncate flex items-center gap-1">
                    <FileText size={13} className="text-gray-600" />
                    BEM HTML: Informe Motos
                  </span>
                  <Play size={11} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right half - Schedule control and synchronizer client download */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Synchronizer Program Download Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 className="font-bold text-gray-900 text-xs mb-3 flex items-center gap-1.5">
              <Code size={16} className="text-blue-500" />
              Sincronizador desktop (Pasta Local)
            </h4>
            <p className="text-xxs text-gray-400 mb-4 leading-relaxed">
              Gere sincronia instantânea entre o computador do BEM e a internet. Nosso script PowerShell monitora recursivamente a pasta <strong>C:\SISTEMA_BEM\Resultados</strong> e avisa o servidor sobre relatórios criados.
            </p>

            <a
              id="download-sync-script"
              href="/api/sync-script"
              download="sync_bem.ps1"
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-xs font-bold shadow-sm"
            >
              <Download size={14} />
              Baixar Script Sincronizador (.ps1)
            </a>

            <div className="mt-4 pt-3 border-t border-gray-100 text-xxs text-gray-500 space-y-2">
              <div><strong className="text-gray-700">Como usar no Computador Oficial:</strong></div>
              <p className="text-[10px] text-gray-400 leading-normal">
                No Windows, scripts salvos da internet são bloqueados por padrão. Para habilitá-lo, você pode criar a pasta manualmente ou instruir a execução livre de políticas:
              </p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Salve o arquivo <code className="bg-gray-100 font-mono rounded px-1 text-slate-800">sync_bem.ps1</code> em seu computador (ex: na Área de Trabalho).</li>
                <li>Abra o <strong>PowerShell</strong> do Windows e execute o script ignorando a política de execução com o seguinte comando:
                  <div className="bg-slate-900 text-slate-200 p-1.5 rounded font-mono text-[9px] mt-1 select-all">
                    powershell -ExecutionPolicy Bypass -File "\caminho\para\o\arquivo\sync_bem.ps1"
                  </div>
                </li>
                <li><strong>Alternativa (Manual):</strong> Se você preferir, pode simplesmente criar a pasta manualmente usando o Explorador de Arquivos do Windows no caminho: <code className="bg-gray-100 font-mono rounded px-1 text-slate-800">C:\SISTEMA_BEM\Resultados</code>. Assim que ela existir, o script passará a ler os relatórios de lá sem problemas!</li>
              </ol>
            </div>
          </div>

          {/* Schedule controller */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 className="font-bold text-gray-900 text-xs mb-3 flex items-center gap-1.5">
              <Clock size={16} className="text-emerald-600" />
              Controle do Cronograma Técnico
            </h4>
            <p className="text-xxs text-gray-400 mb-4 leading-relaxed">
              Atualize a situação das fases da prova da CBC em Cuiabá. Mudar estados para "Atrasado" ou "Em Andamento" gerará alertas em tempo real na tela do celular de todos os participantes.
            </p>

            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 text-xxs">
              {schedule.map((item) => (
                <div key={item.id} className="p-2 border rounded-lg bg-gray-50/55 flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-800 truncate">{item.title}</div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <span>{item.time}</span> | <span>{item.category}</span>
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => onUpdateScheduleStatus(item.id, 'ongoing')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${
                        item.status === 'ongoing' ? 'bg-blue-600 text-white font-bold' : 'bg-white border text-gray-600 hover:bg-gray-100'
                      }`}
                      title="Sinalizar que está Acontecendo Agora"
                    >
                      Em Curso
                    </button>
                    <button
                      onClick={() => onUpdateScheduleStatus(item.id, 'delayed')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${
                        item.status === 'delayed' ? 'bg-amber-500 text-white font-bold' : 'bg-white border text-gray-600 hover:bg-gray-100'
                      }`}
                      title="Sinalizar Atraso Técnico"
                    >
                      Atrasado
                    </button>
                    <button
                      onClick={() => onUpdateScheduleStatus(item.id, 'completed')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${
                        item.status === 'completed' ? 'bg-emerald-600 text-white font-bold' : 'bg-white border text-gray-600 hover:bg-gray-100'
                      }`}
                      title="Sinalizar como Concluído"
                    >
                      OK
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Share Links Component */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 className="font-bold text-gray-900 text-xs mb-3 flex items-center gap-1.5">
              <Share2 size={16} className="text-blue-600" />
              Compartilhar Links do Campeonato
            </h4>
            <p className="text-xxs text-gray-400 mb-4 leading-relaxed">
              Disponibilize os links corretos para o público e para a equipe de direção técnica. O link do espectador oculta totalmente a aba de organização.
            </p>

            <div className="space-y-3">
              <div className="p-2.5 rounded-lg border border-gray-100 bg-gray-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">Público (Espectadores)</span>
                  <button
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : '';
                      const path = typeof window !== 'undefined' ? window.location.pathname : '/';
                      copyToClipboard('spectator', `${origin}${path}`);
                    }}
                    className="flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer"
                  >
                    <Copy size={11} />
                    {copiedType === 'spectator' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="text-[10px] font-mono text-gray-500 break-all select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'Carregando...'}
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-amber-100 bg-amber-50/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800">Direção (Admin / Organizador)</span>
                  <button
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : '';
                      const path = typeof window !== 'undefined' ? window.location.pathname : '/';
                      copyToClipboard('admin', `${origin}${path}?admin=true`);
                    }}
                    className="flex items-center gap-1 text-[10px] text-amber-700 hover:text-amber-950 font-medium cursor-pointer"
                  >
                    <Copy size={11} />
                    {copiedType === 'admin' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="text-[10px] font-mono text-gray-500 break-all select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?admin=true` : 'Carregando...'}
                </div>
              </div>
            </div>
          </div>

          {/* Emit Alerts/Announcements Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 className="font-bold text-gray-900 text-xs mb-3 flex items-center gap-1.5">
              <Megaphone size={16} className="text-amber-500" />
              Emitir Comunicados & Avisos (Transmissão)
            </h4>
            <p className="text-xxs text-gray-400 mb-4 leading-relaxed">
              Escreva comunicados urgentes para os pilotos, chefes de equipe e espectadores. O aviso será exibido instantaneamente para todos os usuários sintonizados.
            </p>

            {noticeFeedback && (
              <div className={`mb-3 p-2.5 rounded border text-[10px] font-medium ${
                noticeFeedback.success ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'
              }`}>
                {noticeFeedback.text}
              </div>
            )}

            <form onSubmit={handleNoticeSubmit} className="space-y-3 text-xxs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Título do Comunicado</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Correção de Horário Boys 7/8"
                  className="w-full px-2.5 py-1.5 border rounded border-gray-200 focus:ring-1 focus:ring-emerald-500 outline-none bg-gray-50/50 focus:bg-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Conteúdo da Mensagem</label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Informe os detalhes do ocorrido ou chamada de bateria..."
                  rows={2}
                  className="w-full px-2.5 py-1.5 border rounded border-gray-200 focus:ring-1 focus:ring-emerald-500 outline-none bg-gray-50/50 focus:bg-white text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-700">Severidade:</span>
                  <select
                    value={newSeverity}
                    onChange={(e: any) => setNewSeverity(e.target.value)}
                    className="px-1.5 py-1 border rounded bg-white text-[10px] font-medium border-gray-200 outline-none"
                  >
                    <option value="info">Informativo</option>
                    <option value="warning">Aviso Importante</option>
                    <option value="alert">Alerta Crítico</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isPublishingNotice}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer transition-colors text-[10px]"
                >
                  {isPublishingNotice ? 'Transmitindo...' : 'Transmitir Aviso'}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
