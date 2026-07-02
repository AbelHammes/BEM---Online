import React, { useState } from 'react';
import { EventData, Athlete, UserProfile } from '../types';
import { User, LogIn, Award, Timer, Shield, LogOut, TrendingUp, CheckCircle, Navigation } from 'lucide-react';
import { getMergedAthlete } from '../utils';

interface PilotProfileProps {
  event: EventData;
  user: UserProfile | null;
  onLogin: (credentials: { username: string; category: string; type: 'pilot' }) => Promise<void>;
  onLogout: () => void;
  error?: string;
}

export default function PilotProfile({
  event,
  user,
  onLogin,
  onLogout,
  error
}: PilotProfileProps) {
  const [username, setUsername] = useState('');
  const [category, setCategory] = useState(() => {
    return event.categories && event.categories.length > 0 ? event.categories[0].categoryName : '';
  });
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (!category && event.categories && event.categories.length > 0) {
      setCategory(event.categories[0].categoryName);
    }
  }, [event.categories, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onLogin({ username, category, type: 'pilot' });
    setIsLoading(false);
  };

  // Find pilot details if logged in
  const pilotData = React.useMemo(() => {
    if (!user || user.role !== 'pilot' || !user.pilotPlate) return null;
    
    let foundCatName = '';
    for (const cat of event.categories) {
      const p = cat.athletes.find(a => a.plate === user.pilotPlate);
      if (p) {
        foundCatName = cat.categoryName;
        break;
      }
    }
    
    if (foundCatName) {
      return getMergedAthlete(user.pilotPlate, foundCatName, event);
    }
    
    return null;
  }, [user, event]);

  if (!user) {
    return (
      <div id="pilot-login-card" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 max-w-sm mx-auto">
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
            <User size={24} />
          </div>
          <h3 className="font-bold text-gray-900 text-sm">Área Exclusiva do Piloto</h3>
          <p className="text-xxs text-gray-500 mt-1">
            Informe o número de sua placa oficial e sua categoria para acessar estatísticas de portão e tempos de volta instantaneamente. Sem necessidade de senha.
          </p>
        </div>

        {event.categories.length === 0 ? (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] rounded-lg text-center leading-relaxed font-medium">
            ⚠️ O sistema ainda não possui categorias ou atletas cadastrados. Aguardando a sincronização inicial de arquivos do software BEM para liberar o acesso ao painel.
          </div>
        ) : error && (
          <div className="mb-3 p-2 border border-red-200 bg-red-50 text-red-800 text-[10px] rounded-lg text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Nº da Placa do Piloto</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex: 303 ou 124"
              disabled={event.categories.length === 0}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all font-mono disabled:opacity-50"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Categoria do Atleta</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={event.categories.length === 0}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50"
              required
            >
              <option value="" disabled>Selecione a categoria</option>
              {event.categories.map((cat) => (
                <option key={cat.categoryName} value={cat.categoryName}>
                  {cat.categoryName} ({cat.athletes.length} {cat.athletes.length === 1 ? 'piloto' : 'pilotos'})
                </option>
              ))}
            </select>
          </div>

          <button
            id="pilot-login-submit"
            type="submit"
            disabled={isLoading || event.categories.length === 0}
            className="w-full py-2 bg-emerald-600 font-bold hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn size={15} />
            {isLoading ? 'Verificando...' : 'Entrar no Painel do Piloto'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400 text-center">
          Dica para homologação: Escolha a placa <strong className="text-gray-600">303</strong> ou <strong className="text-gray-600">124</strong> na categoria <strong className="text-gray-600">Boys 7/8</strong>.
        </div>
      </div>
    );
  }

  // Dashboard for logged-in pilot
  const p = pilotData?.athlete;
  const cName = pilotData?.categoryName;

  return (
    <div id="pilot-dashboard" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-gray-100 gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-mono font-bold flex items-center justify-center text-sm shadow-md">
            #{user.pilotPlate}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 text-sm">{user.pilotName}</h3>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-xxs font-semibold">
                {cName}
              </span>
            </div>
            <p className="text-xxs text-gray-500 font-mono mt-0.5">CBC ID: {p?.uciId || 'Ativo no BEM'}</p>
          </div>
        </div>
        
        <button
          onClick={onLogout}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-red-100 hover:bg-red-50 text-red-600 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
        >
          <LogOut size={13} />
          Sair do Painel
        </button>
      </div>

      {!p ? (
        <div className="text-center py-6 text-xs text-gray-500">
          Dados do piloto pendentes de pareamento com a última exportação do BEM.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Stats column 1 */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100/50">
            <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 mb-3">
              <Award size={15} className="text-amber-500" />
              Classificação & Sorteios
            </h4>
            <div className="space-y-2 text-xxs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Posição Oficial:</span>
                <span className="font-bold text-gray-900">{p.place ? `${p.place}º Lugar` : 'Classificação em aberto'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Pontos Acumulados (M-PTS):</span>
                <span className="font-bold text-emerald-700">{p.points ?? 'Não calculado'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Clube Registrado:</span>
                <span className="font-semibold text-gray-800 truncate max-w-[120px]">{p.club}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Patrocinadores:</span>
                <span className="font-medium text-purple-700 italic">{p.sponsor || 'Não listado'}</span>
              </div>
            </div>
          </div>

          {/* Stats column 2 - Lane Draws */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100/50">
            <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 mb-3">
              <Navigation size={15} className="text-blue-500" />
              Sorteio de Portão (Corrida: Raia)
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 border rounded-lg bg-white">
                <div className="text-xxs text-gray-400 mb-0.5">Moto 1</div>
                <div className="font-mono text-xs font-bold text-gray-900">{p.m1Draw || 'Pendente'}</div>
              </div>
              <div className="p-2 border rounded-lg bg-white">
                <div className="text-xxs text-gray-400 mb-0.5">Moto 2</div>
                <div className="font-mono text-xs font-bold text-gray-900">{p.m2Draw || 'Pendente'}</div>
              </div>
              <div className="p-2 border rounded-lg bg-white">
                <div className="text-xxs text-gray-400 mb-0.5">Moto 3</div>
                <div className="font-mono text-xs font-bold text-gray-900">{p.m3Draw || 'Pendente'}</div>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-3 text-center italic">
              *Ex: '10: 3' indica Corrida 10 na Raia 3.
            </p>
          </div>

          {/* Stats column 3 - Timing & Gate Reaction */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100/50">
            <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 mb-3">
              <Timer size={15} className="text-emerald-600" />
              Análise dos Tempos de Bateria
            </h4>
            <div className="space-y-2 text-xxs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">M1 Tempo / Reação:</span>
                <span className="font-mono font-bold text-gray-900">
                  {p.m1Time ? `${p.m1Time}s` : '0.000'} | <span className="text-amber-600">{p.m1Reaction ? `${p.m1Reaction}s` : '0.000'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">M2 Tempo / Reação:</span>
                <span className="font-mono font-bold text-gray-900">
                  {p.m2Time ? `${p.m2Time}s` : '0.000'} | <span className="text-amber-600">{p.m2Reaction ? `${p.m2Reaction}s` : '0.000'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">M3 Tempo / Reação:</span>
                <span className="font-mono font-bold text-gray-900">
                  {p.m3Time ? `${p.m3Time}s` : '0.000'} | <span className="text-amber-600">{p.m3Reaction ? `${p.m3Reaction}s` : '0.000'}</span>
                </span>
              </div>
              {p.m1Time && p.m2Time ? (
                <div className="pt-2 border-t border-dotted border-gray-200 text-center text-emerald-600 flex items-center justify-center gap-1">
                  <TrendingUp size={12} className="shrink-0" />
                  Evolução do Tempo: <span className="font-bold">{(((parseFloat(p.m1Time) - parseFloat(p.m2Time)) / parseFloat(p.m1Time)) * 100).toFixed(1)}% mais rápido em M2!</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* React performance bars graph styled completely with JSX and Tailwind and no dependencies */}
      {p && p.m1Time && p.m2Time && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <h4 className="font-bold text-gray-800 text-xs mb-3 flex items-center gap-1">
            <TrendingUp size={14} className="text-emerald-600" />
            Progresso de Desempenho (Tempo de Volta)
          </h4>
          <div className="space-y-2 text-xxs">
            {/* Bar 1 */}
            <div>
              <div className="flex justify-between text-gray-500 mb-1">
                <span>Tempo Moto 1</span>
                <span className="font-bold text-gray-900">{p.m1Time}s</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            {/* Bar 2 */}
            <div>
              <div className="flex justify-between text-gray-500 mb-1">
                <span>Tempo Moto 2</span>
                <span className="font-bold text-gray-900">{p.m2Time}s</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: '92%' }}></div>
              </div>
            </div>
            {/* Bar 3 */}
            {p.m3Time && (
              <div>
                <div className="flex justify-between text-gray-500 mb-1">
                  <span>Tempo Moto 3</span>
                  <span className="font-bold text-gray-900">{p.m3Time}s</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-700 rounded-full" style={{ width: '90%' }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
