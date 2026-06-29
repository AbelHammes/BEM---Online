import React, { useState, useMemo } from 'react';
import { EventData, CategoryData, Athlete } from '../types';
import { 
  Trophy, 
  Award, 
  Search, 
  User, 
  MapPin, 
  Activity, 
  ShieldCheck, 
  ChevronRight, 
  LayoutGrid, 
  List, 
  Printer, 
  Zap, 
  Sparkles, 
  HelpCircle,
  Flag,
  CheckCircle2,
  Bookmark,
  Users,
  Layers
} from 'lucide-react';

interface LiveResultsProps {
  event: EventData;
  isDashboard?: boolean;
}

// Check if a time string is actual results/timed
const isValidTime = (t?: string) => {
  if (!t) return false;
  const clean = t.trim();
  return (
    clean !== "" &&
    clean !== "0" &&
    clean !== "0.000" &&
    clean !== "0,000" &&
    clean !== "0.00" &&
    clean !== "0,00" &&
    clean !== "-"
  );
};

// Helper to parse lane draws (e.g., "172: 4" -> Bateria 172, Raia 4)
const parseDrawText = (draw?: string) => {
  if (!draw) return null;
  const parts = draw.trim().split(/\s*[:/\-]\s*/);
  if (parts.length === 2) {
    return {
      heat: parts[0].trim(),
      lane: parts[1].trim()
    };
  }
  return { heat: draw.trim(), lane: "" };
};

// Helper to decode transfer codes (e.g. Q5, S19, F16) into friendly Portuguese texts
const friendlyTransferText = (code?: string) => {
  if (!code) return "";
  const upper = code.trim().toUpperCase();
  if (upper.startsWith('Q')) {
    return `Classificado para 1/4 de Final (${upper})`;
  }
  if (upper.startsWith('S')) {
    return `Classificado para Semifinal (${upper})`;
  }
  if (upper.startsWith('F')) {
    return `Classificado para a Grande Final 🏆 (${upper})`;
  }
  return `Avança de Fase (${upper})`;
};

// Helper to determine if a subcategory represents the final/overall results of the race
const isFinalResultsSub = (subName: string): boolean => {
  const nameLower = subName.toLowerCase();
  
  if (
    nameLower.includes('geral') ||
    nameLower.includes('classifica') ||
    nameLower.includes('overall') ||
    nameLower.includes('standing')
  ) {
    return true;
  }
  
  if (nameLower.includes('final') || nameLower.includes('finais')) {
    const isQualifying = 
      nameLower.includes('transfer') ||
      nameLower.includes('transf') ||
      nameLower.includes('sem resultados') ||
      nameLower.includes('para final') ||
      nameLower.includes('fase') ||
      nameLower.includes('bateria') ||
      nameLower.includes('moto') ||
      nameLower.includes('grupo') ||
      nameLower.includes('sorteio');
      
    return !isQualifying;
  }
  
  return false;
};

// Helper to serialize subcategory athletes to check for duplicate content
const getSubFingerprint = (sub: any): string => {
  const athletes = sub.data?.athletes || [];
  const fingerprintParts = athletes.map((ath: any) => {
    return `${ath.plate}:${ath.place || ''}:${ath.points || ''}:${ath.m1Place || ''}:${ath.m2Place || ''}:${ath.m3Place || ''}:${ath.m1Time || ''}:${ath.m2Time || ''}:${ath.m3Time || ''}`;
  });
  return fingerprintParts.sort().join('|');
};

export default function LiveResults({ event, isDashboard = false }: LiveResultsProps) {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [resultsMode, setResultsMode] = useState<'overall' | 'motos' | 'draws' | 'entries'>('overall');
  const [viewLayout, setViewLayout] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubCategoryMap, setActiveSubCategoryMap] = useState<Record<string, string>>({});

  const parseCategoryAndPhase = (fullName: string, index: number): { baseName: string, subName: string } => {
    const parts = fullName.split(" - ");
    
    const isPhaseSuffix = (str: string): boolean => {
      const lower = str.toLowerCase();
      return (
        lower.includes('grupo') ||
        lower.includes('resultado') ||
        lower.includes('ponto') ||
        lower.includes('classifica') ||
        lower.includes('geral') ||
        lower.includes('final') ||
        lower.includes('overall') ||
        lower.includes('standing') ||
        lower.includes('sorteio') ||
        lower.includes('fase') ||
        lower.includes('bateria') ||
        lower.includes('moto')
      );
    };

    if (parts.length === 1) {
      return {
        baseName: fullName,
        subName: index === 0 ? "Grupo 1" : `Grupo ${index + 1}`
      };
    }
    
    if (parts.length === 2) {
      if (isPhaseSuffix(parts[1])) {
        return {
          baseName: parts[0].trim(),
          subName: parts[1].trim()
        };
      } else {
        return {
          baseName: fullName,
          subName: index === 0 ? "Grupo 1" : `Grupo ${index + 1}`
        };
      }
    }
    
    // parts.length >= 3
    const lastPart = parts[parts.length - 1];
    if (isPhaseSuffix(lastPart)) {
      return {
        baseName: parts.slice(0, -1).join(" - ").trim(),
        subName: lastPart.trim()
      };
    } else {
      return {
        baseName: fullName,
        subName: index === 0 ? "Grupo 1" : `Grupo ${index + 1}`
      };
    }
  };

  const getBaseCategoryName = (name: string, index: number = 0): string => {
    return parseCategoryAndPhase(name, index).baseName;
  };

  const getSubCategoryName = (name: string, index: number): string => {
    return parseCategoryAndPhase(name, index).subName;
  };

  const getNumericPlace = (placeStr: string | undefined | null): number | null => {
    if (!placeStr) return null;
    const match = placeStr.match(/\d+/);
    if (match) {
      const parsed = parseInt(match[0], 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Grouping categories by base name
  const groupedMap = useMemo(() => {
    const map: Record<string, CategoryData[]> = {};
    if (event && event.categories) {
      event.categories.forEach((cat, idx) => {
        const base = getBaseCategoryName(cat.categoryName, idx);
        if (!map[base]) {
          map[base] = [];
        }
        map[base].push(cat);
      });
    }
    return map;
  }, [event]);

  interface GroupedCategory {
    baseName: string;
    subCategories: {
      fullName: string;
      subName: string;
      data: CategoryData;
    }[];
  }

  const groupedCategories: GroupedCategory[] = useMemo(() => {
    return Object.keys(groupedMap).map((baseName) => {
      const list = groupedMap[baseName];
      return {
        baseName,
        subCategories: list
          .map((cat, idx) => ({
            fullName: cat.categoryName,
            subName: getSubCategoryName(cat.categoryName, idx),
            data: cat,
          }))
          .filter((sub) => !sub.subName.toLowerCase().includes("sem resultados")),
      };
    });
  }, [groupedMap]);

  const uniqueBaseNames = useMemo(() => Object.keys(groupedMap), [groupedMap]);

  const displayedGroupedCategories = useMemo(() => {
    return groupedCategories.filter((g) =>
      activeCategory === 'ALL' || g.baseName === activeCategory
    );
  }, [groupedCategories, activeCategory]);

  // Overall Event Statistics
  const eventStats = useMemo(() => {
    let categoriesCount = 0;
    let athletesCount = 0;
    const clubs = new Set<string>();
    const states = new Set<string>();

    if (event && event.categories) {
      categoriesCount = event.categories.length;
      event.categories.forEach(cat => {
        if (cat.athletes) {
          athletesCount += cat.athletes.length;
          cat.athletes.forEach(ath => {
            if (ath.club) clubs.add(ath.club);
            if (ath.state) states.add(ath.state);
          });
        }
      });
    }

    return {
      categoriesCount,
      athletesCount,
      clubsCount: clubs.size,
      statesCount: states.size
    };
  }, [event]);

  // Trigger print view
  const handlePrint = () => {
    const pri = (document.getElementById('ifmcontentstoprint') as HTMLIFrameElement)?.contentWindow;
    if (pri) {
      pri.document.open();
      
      let htmlString = `
        <html>
        <head>
          <title>Relatório Oficial de BMX - Campeonato Brasileiro de BMX 2026</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; padding: 30px; line-height: 1.4; }
            .header-bar { border-top: 6px solid #15803d; background-color: #0f172a; color: white; padding: 20px; border-radius: 8px; margin-bottom: 25px; }
            .header-bar h1 { margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.025em; }
            .header-bar p { margin: 5px 0 0 0; font-size: 12px; color: #cbd5e1; }
            .event-meta { font-size: 11px; color: #64748b; margin-bottom: 30px; display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
            .category-section { margin-bottom: 35px; page-break-inside: avoid; }
            .category-title { font-size: 14px; font-weight: 800; color: #166534; border-bottom: 2px solid #15803d; padding-bottom: 6px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px; text-align: center; }
            th { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; font-weight: 700; color: #1e293b; }
            td { border: 1px solid #e2e8f0; padding: 8px; }
            .text-left { text-align: left; }
            .place-badge { font-weight: bold; color: #1e293b; background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
            .points-cell { font-weight: bold; color: #15803d; background-color: #f0fdf4; }
            .transfer-badge { font-weight: bold; background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 1px 5px; border-radius: 4px; font-size: 9px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <h1>CAMPEONATO BRASILEIRO DE BMX 2026</h1>
            <p>Pista de BMX Cuiabá, Cuiabá - MT | 04 e 05 de Julho de 2026</p>
          </div>
          <div class="event-meta">
            <span>Confederação Brasileira de Ciclismo - CBC</span>
            <span>Relatório: ${
              resultsMode === 'overall' ? 'Classificação Geral da Categoria' : 
              resultsMode === 'motos' ? 'Resultados e Desempenho nas Motos' : 
              resultsMode === 'draws' ? 'Sorteio de Raias / Gate Lanes' : 'Atletas Inscritos por Categoria'
            }</span>
            <span>Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
          </div>
      `;

      displayedGroupedCategories.forEach(group => {
        group.subCategories.forEach(sub => {
          const cat = sub.data;
          
          const athletesByGroup: Record<string, Athlete[]> = {};
          let hasGroups = false;
          cat.athletes.forEach(ath => {
            const g = ath.group || 'Geral';
            if (ath.group) hasGroups = true;
            if (!athletesByGroup[g]) {
              athletesByGroup[g] = [];
            }
            athletesByGroup[g].push(ath);
          });

          const groupKeys = Object.keys(athletesByGroup).sort();
          const hasTransfer = cat.athletes.some(a => a.transfer);

          groupKeys.forEach(gKey => {
            const groupTitleSuffix = hasGroups ? ` - Bateria / Grupo ${gKey}` : '';
            htmlString += `
              <div class="category-section">
                <div class="category-title">${cat.categoryName}${groupTitleSuffix} (${athletesByGroup[gKey].length} Pilotos)</div>
                <table>
                  <thead>
                    <tr>
                      <th style="width: 8%;">Rank</th>
                      <th style="width: 10%;">Placa</th>
                      <th class="text-left" style="width: 32%;">Piloto</th>
                      <th class="text-left" style="width: 25%;">Clube / UF</th>
                      ${resultsMode === 'overall' ? '<th style="width: 10%;">M-PTS</th>' : ''}
                      <th style="width: 12%;">Moto 1</th>
                      <th style="width: 12%;">Moto 2</th>
                      <th style="width: 12%;">Moto 3</th>
                      ${hasTransfer ? '<th style="width: 12%;">Transferir</th>' : ''}
                    </tr>
                  </thead>
                  <tbody>
            `;

            const sortedAthletes = [...athletesByGroup[gKey]].sort((a, b) => {
              const pA = parseInt(a.place || '99', 10);
              const pB = parseInt(b.place || '99', 10);
              return pA - pB;
            });

            sortedAthletes.forEach(ath => {
              const m1Str = resultsMode === 'draws' 
                ? (ath.m1Draw || '-') 
                : `${ath.m1Place || '-'} ${ath.m1Time ? `(${ath.m1Time}s)` : ''}`;
              
              const m2Str = resultsMode === 'draws' 
                ? (ath.m2Draw || '-') 
                : `${ath.m2Place || '-'} ${ath.m2Time ? `(${ath.m2Time}s)` : ''}`;
              
              const m3Str = resultsMode === 'draws' 
                ? (ath.m3Draw || '-') 
                : `${ath.m3Place || '-'} ${ath.m3Time ? `(${ath.m3Time}s)` : ''}`;

              htmlString += `
                <tr>
                  <td><span class="place-badge">${ath.place || '-'}</span></td>
                  <td><strong>#${ath.plate}</strong></td>
                  <td class="text-left" style="font-weight: 600;">${ath.firstName} ${ath.lastName}</td>
                  <td class="text-left">${ath.club || 'Independente'} (${ath.state || 'BRA'})</td>
                  ${resultsMode === 'overall' ? `<td class="points-cell">${ath.points ?? '-'}</td>` : ''}
                  <td>${m1Str}</td>
                  <td>${m2Str}</td>
                  <td>${m3Str}</td>
                  ${hasTransfer ? `<td>${ath.transfer ? `<span class="transfer-badge">${ath.transfer}</span>` : '-'}</td>` : ''}
                </tr>
              `;
            });

            htmlString += `
                  </tbody>
                </table>
              </div>
            `;
          });
        });
      });

      htmlString += `
        </body>
        </html>
      `;

      pri.document.write(htmlString);
      pri.document.close();
      pri.focus();
      pri.print();
    }
  };

  return (
    <div id="live-results-section" className="space-y-6">
      <iframe id="ifmcontentstoprint" style={{ height: '0px', width: '0px', position: 'absolute' }}></iframe>

      {/* BRAZILIAN THEMED INTRO BANNER */}
      <div className="bg-gradient-to-r from-emerald-800 via-green-700 to-blue-800 text-white rounded-2xl shadow-md p-6 relative overflow-hidden border border-emerald-600/30">
        <div className="absolute right-0 bottom-0 top-0 opacity-10 flex items-center pointer-events-none pr-10">
          <Flag size={200} className="text-yellow-400 rotate-12" />
        </div>
        
        {/* Subtle yellow/blue geometric flag stripes */}
        <div className="absolute top-0 right-0 w-24 h-full flex transform skew-x-12 pointer-events-none">
          <div className="w-1/2 bg-yellow-400 opacity-20"></div>
          <div className="w-1/2 bg-blue-500 opacity-20"></div>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-yellow-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
              <Sparkles size={10} className="animate-spin" />
              TEMPO REAL CBC
            </span>
            <span className="text-xxs bg-emerald-950/50 border border-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-200">
              Cuiabá - MT • Pista de BMX Cuiabá
            </span>
          </div>

          <div className="max-w-2xl">
            <h2 className="text-xl sm:text-3xl font-black tracking-tight font-display text-white">
              SISTEMA DE CRONOMETRAGEM BMX
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-1">
              Consulte inscrições, posições no portão de largada, tempos das voltas, reações e classificação oficial unificada gerada diretamente do software de gerenciamento oficial.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-white/10 text-white/95">
            <div className="bg-white/5 backdrop-blur-xs p-2 rounded-lg border border-white/5">
              <div className="text-[10px] text-yellow-300 font-extrabold uppercase tracking-wider">Categorias</div>
              <div className="text-lg font-black font-mono mt-0.5 flex items-baseline gap-1">
                {eventStats.categoriesCount}
                <span className="text-xxs font-normal text-emerald-200">fases</span>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-xs p-2 rounded-lg border border-white/5">
              <div className="text-[10px] text-yellow-300 font-extrabold uppercase tracking-wider">Pilotos Inscritos</div>
              <div className="text-lg font-black font-mono mt-0.5 flex items-baseline gap-1">
                {eventStats.athletesCount}
                <span className="text-xxs font-normal text-emerald-200">atletas</span>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-xs p-2 rounded-lg border border-white/5">
              <div className="text-[10px] text-yellow-300 font-extrabold uppercase tracking-wider">Estados (UF)</div>
              <div className="text-lg font-black font-mono mt-0.5 flex items-baseline gap-1">
                {eventStats.statesCount}
                <span className="text-xxs font-normal text-emerald-200">regiões</span>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-xs p-2 rounded-lg border border-white/5">
              <div className="text-[10px] text-yellow-300 font-extrabold uppercase tracking-wider">Clubes Sincronizados</div>
              <div className="text-lg font-black font-mono mt-0.5 flex items-baseline gap-1">
                {eventStats.clubsCount}
                <span className="text-xxs font-normal text-emerald-200">equipes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH AND DASHBOARD FILTERS */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-4">
        <div className={`flex flex-col gap-4 justify-between ${
          isDashboard 
            ? "items-stretch" 
            : "xl:flex-row items-stretch xl:items-center"
        }`}>
          
          {/* Main Mode Swapper Buttons */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl w-fit shrink-0">
            <button
              id="results-mode-overall"
              onClick={() => { setResultsMode('overall'); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150 ${
                resultsMode === 'overall'
                  ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-900/10'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/50'
              }`}
            >
              <Trophy size={14} className={resultsMode === 'overall' ? 'text-yellow-400' : 'text-slate-500'} />
              Classificação Geral
            </button>
            
            <button
              id="results-mode-motos"
              onClick={() => { setResultsMode('motos'); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150 ${
                resultsMode === 'motos'
                  ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-900/10'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/50'
              }`}
            >
              <Activity size={14} className={resultsMode === 'motos' ? 'text-yellow-400' : 'text-slate-500'} />
              Resultados das Baterias
            </button>

            <button
              id="results-mode-draws"
              onClick={() => { setResultsMode('draws'); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150 ${
                resultsMode === 'draws'
                  ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-900/10'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/50'
              }`}
            >
              <Zap size={14} className={resultsMode === 'draws' ? 'text-yellow-400' : 'text-slate-500'} />
              Sorteio de Raias (Gate)
            </button>

            <button
              id="results-mode-entries"
              onClick={() => { setResultsMode('entries'); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150 ${
                resultsMode === 'entries'
                  ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-900/10'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/50'
              }`}
            >
              <Users size={14} className={resultsMode === 'entries' ? 'text-yellow-400' : 'text-slate-500'} />
              Pilotos Inscritos
            </button>
          </div>

          {/* Right Filters, View Layout Switcher & Print */}
          <div className={`flex flex-wrap items-center gap-3 w-full ${
            isDashboard 
              ? "justify-between" 
              : "justify-start sm:justify-end xl:w-auto"
          }`}>
            {/* Instant Filter input inside results */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar piloto, placa, equipe..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all outline-none"
              />
            </div>

            {/* Layout Switcher (Table vs Cards) */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200/60 shadow-inner">
              <button
                onClick={() => setViewLayout('table')}
                title="Visualização em Tabela"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewLayout === 'table' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List size={15} />
              </button>
              <button
                onClick={() => setViewLayout('cards')}
                title="Visualização em Cards"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewLayout === 'cards' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid size={15} />
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-150 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors border border-slate-200 shadow-xxs"
            >
              <Printer size={14} />
              Exportar PDF / Imprimir
            </button>
          </div>

        </div>

        {/* Categories Carousel */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Escolha a Categoria:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pb-1">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer shrink-0 transition-all ${
                activeCategory === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              Todas as Categorias
            </button>
            {uniqueBaseNames.map((baseName) => (
              <button
                key={baseName}
                onClick={() => setActiveCategory(baseName)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer shrink-0 transition-all ${
                  activeCategory === baseName
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                {baseName}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RENDER CATEGORY PANELS */}
      <div className="space-y-6">
        {event.categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white border border-slate-150 rounded-2xl shadow-xxs">
            <Award size={48} className="text-slate-300 mb-3 animate-pulse" />
            <h4 className="text-sm font-black text-slate-800">Aguardando Resultados do Sincronizador</h4>
            <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
              O sistema de cronometragem central não exportou resultados ainda. Salve relatórios da corrida na pasta de sincronização para ver os atletas, baterias e classificações aparecerem instantaneamente.
            </p>
          </div>
        ) : (
          displayedGroupedCategories.map((group) => {
            const activeSub = activeSubCategoryMap[group.baseName] || 'ALL';

            const isGeneralResultSub = (subName: string): boolean => {
              const nameLower = subName.toLowerCase();
              return (
                nameLower.includes('classifica') ||
                nameLower.includes('geral') ||
                nameLower.includes('overall') ||
                nameLower.includes('standing')
              );
            };

            const hasDetailedPhases = group.subCategories.some(sub => sub.fullName !== group.baseName);

            const rawGrupoSubs = group.subCategories.filter(sub => {
              if (hasDetailedPhases && sub.fullName === group.baseName) {
                return false;
              }
              return !isGeneralResultSub(sub.subName);
            });

            // Deduplicate rawGrupoSubs to avoid identical phases (e.g. "Resultados em pontos" and "Sem resultados Finais" displaying the same info)
            const deduplicatedGrupoSubs: typeof rawGrupoSubs = [];
            if (rawGrupoSubs.length > 0) {
              const fingerprintMap = new Map<string, typeof rawGrupoSubs>();
              for (const sub of rawGrupoSubs) {
                const fp = getSubFingerprint(sub);
                if (!fingerprintMap.has(fp)) {
                  fingerprintMap.set(fp, []);
                }
                fingerprintMap.get(fp)!.push(sub);
              }

              const bestSubs = new Set<typeof rawGrupoSubs[0]>();
              for (const [fp, duplicates] of fingerprintMap.entries()) {
                let best = duplicates.find(d => !d.subName.toLowerCase().includes('sem resultados'));
                if (!best) {
                  best = duplicates[0];
                }
                bestSubs.add(best);
              }

              // Maintain original relative order
              rawGrupoSubs.forEach(sub => {
                if (bestSubs.has(sub)) {
                  deduplicatedGrupoSubs.push(sub);
                }
              });
            }

            const grupoSubs = deduplicatedGrupoSubs;

            const generalSubs = group.subCategories.filter(sub => {
              if (hasDetailedPhases && sub.fullName === group.baseName) {
                return true;
              }
              return isGeneralResultSub(sub.subName);
            });

            // Filter subcategories based on selection
            const subsToRender = activeSub === 'ALL'
              ? (grupoSubs.length > 0 ? grupoSubs : group.subCategories)
              : group.subCategories.filter((sub) => sub.fullName === activeSub);

            return (
              <div
                key={group.baseName}
                id={`category-block-${group.baseName.replace(/[^a-zA-Z0-9]/g, '')}`}
                className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden border-l-4 border-l-emerald-600"
              >
                {/* Header of Base Category with Brasil Accent */}
                <div className="bg-slate-50/70 p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight font-display">
                        {group.baseName}
                      </h3>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        {group.subCategories.reduce((sum, s) => sum + s.data.entriesCount, 0)} Pilotos Inscritos
                      </span>
                    </div>
                    {group.subCategories.length > 1 && (
                      <p className="text-[10px] text-slate-500 leading-normal font-medium">
                        Esta categoria possui {grupoSubs.length} {grupoSubs.length === 1 ? 'grupo ou fase' : 'grupos ou fases'} de classificação{generalSubs.length > 0 ? ` e ${generalSubs.length} ${generalSubs.length === 1 ? 'classificação geral' : 'classificações gerais'}` : ''}. Use os botões abaixo para filtrar.
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 text-xxs">
                    <span className="text-slate-500 font-mono hidden md:inline-block">
                      {resultsMode === 'motos' && "⏱️ Tempo / ⚡ Reação"}
                    </span>
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg font-bold">
                      {group.subCategories[0]?.data.sponsor || 'Brasileiro de BMX 2026'}
                    </span>
                  </div>
                </div>

                {/* Subcategory Tab Selector if there's more than one subcategory */}
                {group.subCategories.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 bg-slate-50/30 border-b border-slate-100">
                    {/* All Phases Button */}
                    <button
                      onClick={() => setActiveSubCategoryMap(prev => ({ ...prev, [group.baseName]: 'ALL' }))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center gap-1 border ${
                        activeSub === 'ALL'
                          ? 'bg-slate-900 text-white border-slate-950 shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <Layers size={12} />
                      Ver Todas as Fases ({grupoSubs.length})
                    </button>

                    {/* Divider if we have groups */}
                    {grupoSubs.length > 0 && <span className="h-4 w-[1px] bg-slate-200 mx-1"></span>}

                    {/* Groups Buttons */}
                    {grupoSubs.map((sub) => (
                      <button
                        key={sub.fullName}
                        onClick={() => setActiveSubCategoryMap(prev => ({ ...prev, [group.baseName]: sub.fullName }))}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center gap-1 border ${
                          activeSub === sub.fullName
                            ? 'bg-emerald-850 text-white border-emerald-900 shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <Users size={12} />
                        {sub.subName}
                      </button>
                    ))}

                    {/* Divider if we have general results */}
                    {generalSubs.length > 0 && <span className="h-4 w-[1px] bg-slate-200 mx-1"></span>}

                    {/* General Results Buttons */}
                    {generalSubs.map((sub) => (
                      <button
                        key={sub.fullName}
                        onClick={() => setActiveSubCategoryMap(prev => ({ ...prev, [group.baseName]: sub.fullName }))}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center gap-1.5 border ${
                          activeSub === sub.fullName
                            ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
                        }`}
                      >
                        <Trophy size={12} className={activeSub === sub.fullName ? 'text-white' : 'text-amber-600'} />
                        Resultados Geral ({sub.subName})
                      </button>
                    ))}
                  </div>
                )}

                {/* Render tables for selected subgroups */}
                <div className="divide-y divide-slate-100">
                  {subsToRender.map((sub) => {
                    const cat = sub.data;
                    
                    // Filter athletes by Search query inside Results
                    const filteredAthletesInCat = cat.athletes.filter((ath) => {
                      if (!searchQuery) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        `${ath.firstName} ${ath.lastName}`.toLowerCase().includes(q) ||
                        (ath.plate || '').toLowerCase().includes(q) ||
                        (ath.club || '').toLowerCase().includes(q) ||
                        (ath.state || '').toLowerCase().includes(q)
                      );
                    });

                    // Group athletes by their athlete.group (if present)
                    const athletesByGroup: Record<string, Athlete[]> = {};
                    let hasGroups = false;
                    filteredAthletesInCat.forEach(ath => {
                      const g = ath.group || 'Geral';
                      if (ath.group) hasGroups = true;
                      if (!athletesByGroup[g]) {
                        athletesByGroup[g] = [];
                      }
                      athletesByGroup[g].push(ath);
                    });

                    const groupKeys = Object.keys(athletesByGroup).sort();
                    const hasTransfer = cat.athletes.some(a => a.transfer);

                    // Collect athletes who advanced (classificados) for a summary widget
                    const advancedPilots = cat.athletes.filter(a => a.transfer && a.transfer.trim() !== "");

                    return (
                      <div key={sub.fullName} className="p-4 sm:p-5 space-y-6">
                        
                        {/* Sub Category Name Badge */}
                        {group.subCategories.length > 1 && activeSub === 'ALL' && (
                          <div className="px-3.5 py-2.5 bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-between border border-slate-200/50">
                            <span>Fase / Subgrupo: <span className="text-emerald-700 font-extrabold">{sub.subName}</span></span>
                            <span className="text-[10px] text-slate-400 font-normal">({cat.entriesCount} pilotos)</span>
                          </div>
                        )}

                        {/* WIDGET: PILOTOS QUE AVANÇAM DE FASE (TRANSFER BOX) */}
                        {resultsMode !== 'entries' && advancedPilots.length > 0 && (
                          <div className="bg-gradient-to-br from-emerald-50/50 to-green-50/20 border border-emerald-100 rounded-xl p-3 sm:p-4">
                            <h5 className="text-xxs sm:text-xs font-black text-emerald-800 flex items-center gap-1.5 uppercase tracking-wider mb-2.5">
                              <CheckCircle2 size={14} className="text-emerald-600" />
                              Quadro de Classificados (Avançam de Fase)
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {advancedPilots.map((ath) => (
                                <div 
                                  key={ath.plate} 
                                  className="flex items-center gap-2 bg-white border border-emerald-200/60 rounded-lg px-2.5 py-1.5 text-xxs font-semibold shadow-xxs"
                                >
                                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono text-[9px] font-black shrink-0">
                                    #{ath.plate}
                                  </span>
                                  <span className="text-slate-800 truncate max-w-[120px]">{ath.firstName}</span>
                                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                                    {ath.transfer}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Iterate over internal groups/heats */}
                        {groupKeys.map((gKey) => {
                          const groupAthletes = athletesByGroup[gKey];
                          
                          // Check if anyone in this group has a numeric place
                          const hasAnyNumericPlace = groupAthletes.some(a => getNumericPlace(a.place) !== null);

                          // Sorting logic depending on overall or plate
                          const sortedAthletes = [...groupAthletes].sort((a, b) => {
                            if (resultsMode === 'entries') {
                              return (a.firstName + ' ' + a.lastName).localeCompare(b.firstName + ' ' + b.lastName);
                            }
                            const pA = getNumericPlace(a.place);
                            const pB = getNumericPlace(b.place);

                            // Put non-numeric places at the bottom
                            const scoreA = pA === null ? 9999 : pA;
                            const scoreB = pB === null ? 9999 : pB;

                            if (scoreA !== scoreB) {
                              return scoreA - scoreB;
                            }

                            // If places are equal (e.g. both are null / 9999), sort by points (ascending)
                            const getPointsVal = (pts: number | string | undefined): number => {
                              if (pts === undefined || pts === null || pts === '') return 9999;
                              if (typeof pts === 'number') return pts;
                              const clean = pts.toString().replace(/[^0-9]/g, '');
                              const parsed = parseInt(clean, 10);
                              return isNaN(parsed) ? 9999 : parsed;
                            };

                            const ptsA = getPointsVal(a.points);
                            const ptsB = getPointsVal(b.points);
                            if (ptsA !== ptsB) {
                              return ptsA - ptsB;
                            }

                            return (a.firstName + ' ' + a.lastName).localeCompare(b.firstName + ' ' + b.lastName);
                          });

                          if (groupAthletes.length === 0) {
                            return null;
                          }

                          return (
                            <div key={gKey} className="space-y-3">
                              
                              {/* Internal Heat Title */}
                              {hasGroups && (
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                    <Bookmark size={13} className="text-blue-600" />
                                    Grupo de Corrida: <span className="bg-blue-50 border border-blue-100 text-blue-800 px-2.5 py-0.5 rounded-md font-mono text-xs font-black">{gKey}</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">({groupAthletes.length} competidores)</span>
                                </div>
                              )}

                              {/* TABLE LAYOUT */}
                              {viewLayout === 'table' ? (
                                <div className="overflow-x-auto scrollbar-thin rounded-xl border border-slate-100 shadow-xxs">
                                  <table className="w-full text-left border-collapse text-xxs sm:text-xs">
                                    <thead>
                                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 text-center">
                                        
                                        {/* Rank Header */}
                                        {resultsMode !== 'entries' && (
                                          <th className="p-1.5 sm:p-3 w-10 sm:w-16 text-[10px] sm:text-xs text-center">Pos</th>
                                        )}
                                        
                                        {/* Plate Header */}
                                        <th className="p-1.5 sm:p-3 w-12 sm:w-16 text-center text-[10px] sm:text-xs">Placa</th>
                                        
                                        {/* Name Header */}
                                        <th className="p-1.5 sm:p-3 text-left text-[10px] sm:text-xs">Piloto</th>
                                        
                                        {/* Club/State Header */}
                                        <th className="p-1.5 sm:p-3 text-left text-[10px] sm:text-xs hidden md:table-cell">Clube / Associação</th>
                                        
                                        {/* overall M-PTS Header */}
                                        {resultsMode === 'overall' && (
                                          <th className="p-1.5 sm:p-3 w-12 sm:w-16 text-center text-emerald-800 text-[10px] sm:text-xs">M-PTS</th>
                                        )}
 
                                        {/* Runs Headers */}
                                        {resultsMode !== 'entries' && (
                                          <>
                                            <th className="p-1.5 sm:p-3 text-center text-[10px] sm:text-xs">
                                              <span className="sm:hidden">{resultsMode === 'draws' ? 'S1' : 'M1'}</span>
                                              <span className="hidden sm:inline">{resultsMode === 'draws' ? 'Sorteio M1' : 'Moto 1'}</span>
                                            </th>
                                            <th className="p-1.5 sm:p-3 text-center text-[10px] sm:text-xs">
                                              <span className="sm:hidden">{resultsMode === 'draws' ? 'S2' : 'M2'}</span>
                                              <span className="hidden sm:inline">{resultsMode === 'draws' ? 'Sorteio M2' : 'Moto 2'}</span>
                                            </th>
                                            <th className="p-1.5 sm:p-3 text-center text-[10px] sm:text-xs">
                                              <span className="sm:hidden">{resultsMode === 'draws' ? 'S3' : 'M3'}</span>
                                              <span className="hidden sm:inline">{resultsMode === 'draws' ? 'Sorteio M3' : 'Moto 3'}</span>
                                            </th>
                                          </>
                                        )}
 
                                        {/* Transfer Header */}
                                        {resultsMode !== 'entries' && hasTransfer && (
                                          <th className="p-1.5 sm:p-3 w-24 text-center text-emerald-800 text-[10px] sm:text-xs hidden md:table-cell">Classificação</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {sortedAthletes.map((ath, idx) => {
                                        const numPlace = getNumericPlace(ath.place);
                                        // We only show placements and rankings if there actually are numeric results published for this group
                                        const rankInt = numPlace;

                                        const showTrophies = resultsMode === 'overall' && hasAnyNumericPlace && isFinalResultsSub(sub.subName);
                                        const isFirst = showTrophies && rankInt === 1;
                                        const isSecond = showTrophies && rankInt === 2;
                                        const isThird = showTrophies && rankInt === 3;
                                        const isPodium = showTrophies && rankInt !== null && rankInt <= 3;
                                        const isTransferring = ath.transfer && ath.transfer.trim() !== "";

                                        return (
                                          <tr
                                            key={ath.plate}
                                            className={`hover:bg-slate-50/50 transition-colors ${
                                              isTransferring 
                                                ? 'bg-emerald-50/15 hover:bg-emerald-50/35 border-l-2 border-l-emerald-600' 
                                                : ''
                                            }`}
                                          >
                                            {/* Rank Cell */}
                                            {resultsMode !== 'entries' && (
                                              <td className="p-1.5 sm:p-3 text-center font-bold">
                                                {isFirst ? (
                                                  <div className="flex items-center justify-center gap-0.5">
                                                    <Trophy size={14} className="text-yellow-500 fill-yellow-400 shrink-0" />
                                                    <span className="text-yellow-600 font-black text-xs">1º</span>
                                                  </div>
                                                ) : isSecond ? (
                                                  <div className="flex items-center justify-center gap-0.5">
                                                    <Trophy size={14} className="text-slate-400 fill-slate-300 shrink-0" />
                                                    <span className="text-slate-600 font-black text-xs">2º</span>
                                                  </div>
                                                ) : isThird ? (
                                                  <div className="flex items-center justify-center gap-0.5">
                                                    <Trophy size={14} className="text-amber-600 fill-amber-500 shrink-0" />
                                                    <span className="text-amber-700 font-black text-xs">3º</span>
                                                  </div>
                                                ) : rankInt !== null ? (
                                                  <span className="text-slate-400 font-mono font-bold">{rankInt}º</span>
                                                ) : (
                                                  <span className="text-slate-400 font-mono font-bold">
                                                    {(resultsMode === 'overall' || resultsMode === 'motos') ? `${idx + 1}º` : (ath.place || '-')}
                                                  </span>
                                                )}
                                              </td>

                                            )}
 
                                            {/* Plate Graphic Plate representation */}
                                            <td className="p-1.5 sm:p-3 text-center">
                                              <span className="inline-block px-1.5 sm:px-2.5 py-0.5 rounded bg-yellow-400 border border-yellow-500 text-slate-950 font-mono font-extrabold text-[10px] sm:text-[11px] shadow-xxs">
                                                {ath.plate}
                                              </span>
                                            </td>
 
                                            {/* Name Cell */}
                                            <td className="p-1.5 sm:p-3">
                                              <div className="font-extrabold text-slate-900 flex flex-wrap items-center gap-1">
                                                <span>{ath.firstName} {ath.lastName}</span>
                                                {ath.uciId && (
                                                  <span className="hidden sm:inline text-[9px] text-slate-400 font-mono font-normal">
                                                    UCI: {ath.uciId}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 md:hidden flex flex-wrap items-center gap-1 leading-tight">
                                                <span>{ath.club || 'Independente'}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="font-bold text-slate-600">UF: {ath.state || 'BRA'}</span>
                                              </div>
                                              {/* Mobile Classification Badge */}
                                              {ath.transfer && (
                                                <div className="mt-1 md:hidden">
                                                  <span 
                                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold font-mono text-[9px]"
                                                    title={friendlyTransferText(ath.transfer)}
                                                  >
                                                    <ShieldCheck size={9} className="text-emerald-600 shrink-0" />
                                                    {ath.transfer}
                                                  </span>
                                                </div>
                                              )}
                                            </td>
 
                                            {/* Club/UF Cell */}
                                            <td className="p-1.5 sm:p-3 text-slate-600 hidden md:table-cell">
                                              <div className="font-semibold text-[11px] truncate max-w-[180px]">{ath.club || 'Independente'}</div>
                                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                                <MapPin size={10} className="text-slate-400 shrink-0" />
                                                <span>UF: {ath.state || 'BRA'}</span>
                                              </div>
                                            </td>
 
                                            {/* Overall M-PTS */}
                                            {resultsMode === 'overall' && (
                                              <td className="p-1.5 sm:p-3 text-center font-black text-emerald-700 bg-emerald-50/20 text-xs">
                                                {ath.points ?? '-'}
                                              </td>
                                            )}
 
                                            {/* Runs (Motos/Draws) */}
                                            {resultsMode !== 'entries' && (
                                              <>
                                                {/* Moto 1 */}
                                                <td className="p-1 sm:p-3 text-center border-l border-slate-50">
                                                  {resultsMode === 'draws' ? (
                                                    ath.m1Draw ? (
                                                      (() => {
                                                        const p = parseDrawText(ath.m1Draw);
                                                        return p ? (
                                                          <div className="text-xxs space-y-0.5">
                                                            <div className="font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded px-1 sm:px-1.5 py-0.5 inline-block">
                                                              B. {p.heat}
                                                            </div>
                                                            <div className="font-extrabold text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-1 sm:px-1.5 py-0.5 inline-block sm:ml-1">
                                                              R. {p.lane}
                                                            </div>
                                                          </div>
                                                        ) : <span className="font-mono text-slate-400 text-[9px] sm:text-[10px]">{ath.m1Draw}</span>;
                                                      })()
                                                    ) : <span className="text-slate-300">-</span>
                                                  ) : (
                                                    <div className="space-y-0.5 sm:space-y-1">
                                                      <span className={`text-[10px] sm:text-[11px] font-extrabold px-1 sm:px-1.5 py-0.5 rounded ${
                                                        ath.m1Place?.includes('1') ? 'bg-amber-100 text-amber-800 font-black' : 'text-slate-700 bg-slate-100/70'
                                                      }`}>
                                                        {ath.m1Place || '-'}
                                                      </span>
                                                      
                                                      {/* Time and Reaction on screens above sm */}
                                                      <div className="hidden sm:block space-y-0.5 mt-1">
                                                        {isValidTime(ath.m1Time) && (
                                                          <div className="text-[9px] text-emerald-600 font-mono font-semibold flex items-center justify-center gap-0.5" title="Tempo de Volta">
                                                            ⏱️ {ath.m1Time}s
                                                          </div>
                                                        )}
                                                        {isValidTime(ath.m1Reaction) && (
                                                          <div className="text-[8px] text-slate-400 font-mono" title="Reação de Portão">
                                                            ⚡ {ath.m1Reaction}s
                                                          </div>
                                                        )}
                                                      </div>

                                                      {/* Compact Time and Reaction on mobile screens */}
                                                      <div className="sm:hidden text-[8px] font-mono text-slate-500 scale-90 origin-center space-y-0.5 mt-0.5">
                                                        {isValidTime(ath.m1Time) && (
                                                          <div className="text-emerald-600 font-semibold">{ath.m1Time}s</div>
                                                        )}
                                                        {isValidTime(ath.m1Reaction) && (
                                                          <div className="text-slate-400">{ath.m1Reaction}s</div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </td>
 
                                                {/* Moto 2 */}
                                                <td className="p-1 sm:p-3 text-center border-l border-slate-50">
                                                  {resultsMode === 'draws' ? (
                                                    ath.m2Draw ? (
                                                      (() => {
                                                        const p = parseDrawText(ath.m2Draw);
                                                        return p ? (
                                                          <div className="text-xxs space-y-0.5">
                                                            <div className="font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded px-1 sm:px-1.5 py-0.5 inline-block">
                                                              B. {p.heat}
                                                            </div>
                                                            <div className="font-extrabold text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-1 sm:px-1.5 py-0.5 inline-block sm:ml-1">
                                                              R. {p.lane}
                                                            </div>
                                                          </div>
                                                        ) : <span className="font-mono text-slate-400 text-[9px] sm:text-[10px]">{ath.m2Draw}</span>;
                                                      })()
                                                    ) : <span className="text-slate-300">-</span>
                                                  ) : (
                                                    <div className="space-y-0.5 sm:space-y-1">
                                                      <span className={`text-[10px] sm:text-[11px] font-extrabold px-1 sm:px-1.5 py-0.5 rounded ${
                                                        ath.m2Place?.includes('1') ? 'bg-amber-100 text-amber-800 font-black' : 'text-slate-700 bg-slate-100/70'
                                                      }`}>
                                                        {ath.m2Place || '-'}
                                                      </span>
                                                      
                                                      {/* Time and Reaction on screens above sm */}
                                                      <div className="hidden sm:block space-y-0.5 mt-1">
                                                        {isValidTime(ath.m2Time) && (
                                                          <div className="text-[9px] text-emerald-600 font-mono font-semibold flex items-center justify-center gap-0.5" title="Tempo de Volta">
                                                            ⏱️ {ath.m2Time}s
                                                          </div>
                                                        )}
                                                        {isValidTime(ath.m2Reaction) && (
                                                          <div className="text-[8px] text-slate-400 font-mono" title="Reação de Portão">
                                                            ⚡ {ath.m2Reaction}s
                                                          </div>
                                                        )}
                                                      </div>

                                                      {/* Compact Time and Reaction on mobile screens */}
                                                      <div className="sm:hidden text-[8px] font-mono text-slate-500 scale-90 origin-center space-y-0.5 mt-0.5">
                                                        {isValidTime(ath.m2Time) && (
                                                          <div className="text-emerald-600 font-semibold">{ath.m2Time}s</div>
                                                        )}
                                                        {isValidTime(ath.m2Reaction) && (
                                                          <div className="text-slate-400">{ath.m2Reaction}s</div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </td>
 
                                                {/* Moto 3 */}
                                                <td className="p-1 sm:p-3 text-center border-l border-slate-50">
                                                  {resultsMode === 'draws' ? (
                                                    ath.m3Draw ? (
                                                      (() => {
                                                        const p = parseDrawText(ath.m3Draw);
                                                        return p ? (
                                                          <div className="text-xxs space-y-0.5">
                                                            <div className="font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded px-1 sm:px-1.5 py-0.5 inline-block">
                                                              B. {p.heat}
                                                            </div>
                                                            <div className="font-extrabold text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-1 sm:px-1.5 py-0.5 inline-block sm:ml-1">
                                                              R. {p.lane}
                                                            </div>
                                                          </div>
                                                        ) : <span className="font-mono text-slate-400 text-[9px] sm:text-[10px]">{ath.m3Draw}</span>;
                                                      })()
                                                    ) : <span className="text-slate-300">-</span>
                                                  ) : (
                                                    <div className="space-y-0.5 sm:space-y-1">
                                                      <span className={`text-[10px] sm:text-[11px] font-extrabold px-1 sm:px-1.5 py-0.5 rounded ${
                                                        ath.m3Place?.includes('1') ? 'bg-amber-100 text-amber-800 font-black' : 'text-slate-700 bg-slate-100/70'
                                                      }`}>
                                                        {ath.m3Place || '-'}
                                                      </span>
                                                      
                                                      {/* Time and Reaction on screens above sm */}
                                                      <div className="hidden sm:block space-y-0.5 mt-1">
                                                        {isValidTime(ath.m3Time) && (
                                                          <div className="text-[9px] text-emerald-600 font-mono font-semibold flex items-center justify-center gap-0.5" title="Tempo de Volta">
                                                            ⏱️ {ath.m3Time}s
                                                          </div>
                                                        )}
                                                        {isValidTime(ath.m3Reaction) && (
                                                          <div className="text-[8px] text-slate-400 font-mono" title="Reação de Portão">
                                                            ⚡ {ath.m3Reaction}s
                                                          </div>
                                                        )}
                                                      </div>

                                                      {/* Compact Time and Reaction on mobile screens */}
                                                      <div className="sm:hidden text-[8px] font-mono text-slate-500 scale-90 origin-center space-y-0.5 mt-0.5">
                                                        {isValidTime(ath.m3Time) && (
                                                          <div className="text-emerald-600 font-semibold">{ath.m3Time}s</div>
                                                        )}
                                                        {isValidTime(ath.m3Reaction) && (
                                                          <div className="text-slate-400">{ath.m3Reaction}s</div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </td>
                                              </>
                                            )}
 
                                            {/* Transfer Badge Cell */}
                                            {resultsMode !== 'entries' && hasTransfer && (
                                              <td className="p-1.5 sm:p-3 text-center hidden md:table-cell">
                                                {ath.transfer ? (
                                                  <span 
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold font-mono text-[10px] shadow-xxs"
                                                    title={friendlyTransferText(ath.transfer)}
                                                  >
                                                    <ShieldCheck size={11} className="text-emerald-600 shrink-0" />
                                                    {ath.transfer}
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-300">-</span>
                                                )}
                                              </td>
                                            )}
 
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                
                                /* CARDS VIEW LAYOUT (HIGH FIDELITY MOBILE EXPERIENCE) */
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {sortedAthletes.map((ath, idx) => {
                                    const numPlace = getNumericPlace(ath.place);
                                    const rankInt = numPlace;

                                    const showTrophies = resultsMode === 'overall' && hasAnyNumericPlace && isFinalResultsSub(sub.subName);
                                    const isFirst = showTrophies && rankInt === 1;
                                    const isSecond = showTrophies && rankInt === 2;
                                    const isThird = showTrophies && rankInt === 3;
                                    const isPodium = showTrophies && rankInt !== null && rankInt <= 3;
                                    const isTransferring = ath.transfer && ath.transfer.trim() !== "";

                                    return (
                                      <div
                                        key={ath.plate}
                                        className={`p-4 rounded-2xl border transition-all shadow-xxs flex flex-col justify-between gap-3 relative overflow-hidden ${
                                          isFirst ? 'bg-gradient-to-br from-yellow-50/40 via-white to-white border-yellow-300/60 ring-1 ring-yellow-400/10' :
                                          isSecond ? 'bg-gradient-to-br from-slate-50/40 via-white to-white border-slate-300/60' :
                                          isThird ? 'bg-gradient-to-br from-amber-50/40 via-white to-white border-amber-300/60' :
                                          isTransferring ? 'bg-gradient-to-br from-emerald-50/20 via-white to-white border-emerald-300/60' :
                                          'bg-white border-slate-100 hover:border-slate-200'
                                        }`}
                                      >
                                        {/* Colored Side Strip for Brazil flags feel */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                          isFirst ? 'bg-yellow-400' :
                                          isSecond ? 'bg-slate-300' :
                                          isThird ? 'bg-amber-600' :
                                          isTransferring ? 'bg-emerald-500' : 'bg-slate-200'
                                        }`}></div>

                                        <div className="space-y-2.5 pl-1.5">
                                          
                                          {/* Card Top: Rank Plate Name */}
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              
                                              {/* Trophy Badge */}
                                              {resultsMode !== 'entries' && (
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                                                  isFirst ? 'bg-yellow-100 text-yellow-800' :
                                                  isSecond ? 'bg-slate-100 text-slate-800' :
                                                  isThird ? 'bg-amber-100 text-amber-800' :
                                                  'bg-slate-100 text-slate-600'
                                                }`}>
                                                  {rankInt !== null ? `${rankInt}º` : ((resultsMode === 'overall' || resultsMode === 'motos') ? `${idx + 1}º` : (ath.place || '-'))}
                                                </div>
                                              )}

                                              {/* BMX Plate style Graphic */}
                                              <span className="px-2.5 py-0.5 rounded bg-yellow-400 border border-yellow-500 text-slate-900 font-mono font-extrabold text-xs shadow-xxs shrink-0">
                                                #{ath.plate}
                                              </span>
                                            </div>

                                            {/* Transfer Badge in Card top right */}
                                            {isTransferring && (
                                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 uppercase tracking-wider">
                                                <ShieldCheck size={10} />
                                                {ath.transfer}
                                              </span>
                                            )}
                                          </div>

                                          {/* Pilot Name & Affiliation info */}
                                          <div>
                                            <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                                              {ath.firstName} {ath.lastName}
                                            </h4>
                                            <div className="flex flex-col text-[10px] text-slate-500 font-semibold mt-1">
                                              <span className="truncate">{ath.club || 'Independente'}</span>
                                              <span className="font-mono text-slate-400 font-normal mt-0.5">UF: {ath.state || 'BRA'} | {ath.country || 'BRA'}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Card Bottom: M-PTS & Runs Details */}
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 pl-1.5 bg-slate-50/50 p-2 rounded-xl">
                                          
                                          {resultsMode === 'overall' && (
                                            <div className="shrink-0 text-center">
                                              <div className="text-[8px] text-slate-400 uppercase font-black tracking-wider">Pontos</div>
                                              <div className="text-sm font-black text-emerald-700 font-mono">{ath.points ?? '-'}</div>
                                            </div>
                                          )}

                                          {/* Run blocks display depending on current viewing tab */}
                                          <div className="flex-1 flex gap-2 justify-end text-[10px]">
                                            
                                            {resultsMode !== 'entries' && (
                                              <>
                                                {/* Moto 1 card bubble */}
                                                <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center flex-1 max-w-[80px]">
                                                  <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">M1</div>
                                                  {resultsMode === 'draws' ? (
                                                    ath.m1Draw ? (
                                                      (() => {
                                                        const p = parseDrawText(ath.m1Draw);
                                                        return p ? (
                                                          <div className="font-mono mt-0.5 text-[9px] font-bold leading-tight">
                                                            <div className="text-blue-600">B:{p.heat}</div>
                                                            <div className="text-yellow-600">R:{p.lane}</div>
                                                          </div>
                                                        ) : <div className="font-mono text-slate-500 mt-0.5 font-bold text-[9px]">{ath.m1Draw}</div>;
                                                      })()
                                                    ) : <span className="text-slate-300">-</span>
                                                  ) : (
                                                    <div className="mt-0.5 font-mono">
                                                      <span className="font-extrabold text-slate-900">{ath.m1Place || '-'}</span>
                                                      {isValidTime(ath.m1Time) && <span className="block text-[8px] text-emerald-600 font-semibold">{ath.m1Time}s</span>}
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Moto 2 card bubble */}
                                                <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center flex-1 max-w-[80px]">
                                                  <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">M2</div>
                                                  {resultsMode === 'draws' ? (
                                                    ath.m2Draw ? (
                                                      (() => {
                                                        const p = parseDrawText(ath.m2Draw);
                                                        return p ? (
                                                          <div className="font-mono mt-0.5 text-[9px] font-bold leading-tight">
                                                            <div className="text-blue-600">B:{p.heat}</div>
                                                            <div className="text-yellow-600">R:{p.lane}</div>
                                                          </div>
                                                        ) : <div className="font-mono text-slate-500 mt-0.5 font-bold text-[9px]">{ath.m2Draw}</div>;
                                                      })()
                                                    ) : <span className="text-slate-300">-</span>
                                                  ) : (
                                                    <div className="mt-0.5 font-mono">
                                                      <span className="font-extrabold text-slate-900">{ath.m2Place || '-'}</span>
                                                      {isValidTime(ath.m2Time) && <span className="block text-[8px] text-emerald-600 font-semibold">{ath.m2Time}s</span>}
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Moto 3 card bubble */}
                                                <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center flex-1 max-w-[80px]">
                                                  <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">M3</div>
                                                  {resultsMode === 'draws' ? (
                                                    ath.m3Draw ? (
                                                      (() => {
                                                        const p = parseDrawText(ath.m3Draw);
                                                        return p ? (
                                                          <div className="font-mono mt-0.5 text-[9px] font-bold leading-tight">
                                                            <div className="text-blue-600">B:{p.heat}</div>
                                                            <div className="text-yellow-600">R:{p.lane}</div>
                                                          </div>
                                                        ) : <div className="font-mono text-slate-500 mt-0.5 font-bold text-[9px]">{ath.m3Draw}</div>;
                                                      })()
                                                    ) : <span className="text-slate-300">-</span>
                                                  ) : (
                                                    <div className="mt-0.5 font-mono">
                                                      <span className="font-extrabold text-slate-900">{ath.m3Place || '-'}</span>
                                                      {isValidTime(ath.m3Time) && <span className="block text-[8px] text-emerald-600 font-semibold">{ath.m3Time}s</span>}
                                                    </div>
                                                  )}
                                                </div>
                                              </>
                                            )}

                                          </div>
                                        </div>

                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                            </div>
                          );
                        })}

                        {/* EMPTY SUB GROUP VIEW */}
                        {filteredAthletesInCat.length === 0 && (
                          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-semibold">
                            Nenhum piloto atende ao filtro de pesquisa neste subgrupo da categoria.
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
