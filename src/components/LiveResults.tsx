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

// Helper to check if a subcategory represents a single-run phase (Final, Semi, Quartas, Oitavas)
const isSingleRunPhase = (subName: string): boolean => {
  if (!subName) return false;
  const nameLower = subName.toLowerCase();
  return (
    nameLower.includes('final') ||
    nameLower.includes('semi') ||
    nameLower.includes('quarta') ||
    nameLower.includes('oitava')
  );
};

// Helper to determine if a subcategory has a subsequent phase in the event
const hasNextPhase = (currentSub: any, allSubs: any[]): boolean => {
  if (!currentSub || !allSubs || allSubs.length <= 1) return false;
  
  if (isFinalResultsSub(currentSub.subName) || currentSub.subName.toLowerCase().includes('final')) {
    return false;
  }
  
  const idx = allSubs.findIndex(s => s.subName === currentSub.subName);
  if (idx === -1 || idx === allSubs.length - 1) {
    return false;
  }
  
  return true;
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
    let cleanFullName = fullName.trim().replace(/\s+/g, " ");

    // Handle Moto: or Moto: 
    cleanFullName = cleanFullName.replace(/Moto:\s*/gi, " - ");

    // Handle colons
    cleanFullName = cleanFullName.replace(/:\s*/g, " - ");

    // Clean space around hyphens
    cleanFullName = cleanFullName.replace(/\s*-\s*/g, " - ");

    const parts = cleanFullName.split(" - ");
    
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
        lower.includes('moto') ||
        lower.includes('semi') ||
        lower.includes('quarta') ||
        lower.includes('oitava')
      );
    };

    const getFormattedSubName = (sub: string): string => {
      const lower = sub.toLowerCase();
      if (lower === 'final' || lower.includes('final')) return 'Final';
      if (lower.includes('semifinal') || lower === 'semi' || lower === 'sf') return 'Semifinal';
      if (lower.includes('quarta') || lower === 'qf' || lower.includes('1/4')) return 'Quartas de Final';
      if (lower.includes('oitava') || lower === 'of' || lower.includes('1/8')) return 'Oitavas de Final';
      if (lower.includes('sorteio')) return 'Sorteio de Raias';
      if (lower.includes('geral') || lower.includes('overall') || lower.includes('classifica') || lower.includes('resultado')) return 'Classificação Geral';
      
      if (lower.includes('grupo')) {
        const match = sub.match(/\d+/);
        if (match) {
          return `Motos (Grupo ${match[0]})`;
        }
        return 'Motos';
      }
      if (lower.includes('moto')) {
        const match = sub.match(/\d+/);
        if (match) {
          return `Motos ${match[0]}`;
        }
        return 'Motos';
      }
      return sub;
    };

    if (parts.length === 1) {
      return {
        baseName: cleanFullName,
        subName: "Motos"
      };
    }
    
    if (parts.length === 2) {
      if (isPhaseSuffix(parts[1])) {
        return {
          baseName: parts[0].trim(),
          subName: getFormattedSubName(parts[1].trim())
        };
      } else {
        return {
          baseName: cleanFullName,
          subName: "Motos"
        };
      }
    }
    
    // parts.length >= 3
    const lastPart = parts[parts.length - 1];
    if (isPhaseSuffix(lastPart)) {
      return {
        baseName: parts.slice(0, -1).join(" - ").trim(),
        subName: getFormattedSubName(lastPart.trim())
      };
    } else {
      return {
        baseName: cleanFullName,
        subName: "Motos"
      };
    }
  };

  const getBaseCategoryName = (name: string, index: number = 0): string => {
    return parseCategoryAndPhase(name, index).baseName;
  };

  const getSubCategoryName = (name: string, index: number): string => {
    return parseCategoryAndPhase(name, index).subName;
  };

  const getMotosSub = (group: GroupedCategory) => {
    return group.subCategories.find(sub => 
      sub.subName.toLowerCase().includes('moto') || 
      sub.subName.toLowerCase().includes('grupo')
    );
  };

  const getQuartasSub = (group: GroupedCategory) => {
    return group.subCategories.find(sub => 
      sub.subName.toLowerCase().includes('quarta') || 
      sub.subName.toLowerCase().includes('1/4')
    );
  };

  const getSemiSub = (group: GroupedCategory) => {
    return group.subCategories.find(sub => 
      sub.subName.toLowerCase().includes('semi') || 
      sub.subName.toLowerCase().includes('1/2')
    );
  };

  const getFinalSub = (group: GroupedCategory) => {
    return group.subCategories.find(sub => 
      sub.subName.toLowerCase().includes('final') && 
      !sub.subName.toLowerCase().includes('semi') && 
      !sub.subName.toLowerCase().includes('quarta')
    );
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

  const getPointsVal = (pts: number | string | undefined | null): number => {
    if (pts === undefined || pts === null || pts === '') return 9999;
    if (typeof pts === 'number') return pts;
    const clean = pts.toString().replace(/[^0-9]/g, '');
    const parsed = parseInt(clean, 10);
    return isNaN(parsed) ? 9999 : parsed;
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

  const getPhaseOrderScore = (subName: string): number => {
    const lower = subName.toLowerCase();
    if (lower.includes('moto') || lower.includes('grupo')) return 1;
    if (lower.includes('oitava') || lower.includes('1/8')) return 2;
    if (lower.includes('quarta') || lower.includes('1/4')) return 3;
    if (lower.includes('semi') || lower.includes('1/2')) return 4;
    if (lower.includes('final')) return 5;
    if (lower.includes('geral') || lower.includes('overall') || lower.includes('classifica')) return 6;
    return 10;
  };

  const groupedCategories: GroupedCategory[] = useMemo(() => {
    return Object.keys(groupedMap).map((baseName) => {
      const list = groupedMap[baseName];
      const subCategories = list
        .map((cat, idx) => ({
          fullName: cat.categoryName,
          subName: getSubCategoryName(cat.categoryName, idx),
          data: cat,
        }))
        .filter((sub) => !sub.subName.toLowerCase().includes("sem resultados"));

      // If there is only one subcategory containing 'moto' or 'grupo', let's name it precisely 'Motos'
      const motoSubs = subCategories.filter(sub => sub.subName.toLowerCase().includes('moto') || sub.subName.toLowerCase().includes('grupo'));
      if (motoSubs.length === 1) {
        motoSubs[0].subName = 'Motos';
      }

      // Sort phases in a logical order: Motos -> Oitavas -> Quartas -> Semifinal -> Final -> Classificação Geral
      subCategories.sort((a, b) => getPhaseOrderScore(a.subName) - getPhaseOrderScore(b.subName));

      return {
        baseName,
        subCategories,
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
    const categoriesCount = groupedCategories.length;
    let athletesCount = 0;
    const clubs = new Set<string>();
    const states = new Set<string>();

    groupedCategories.forEach(g => {
      // Find a subcategory that is a Class Entries report
      const entriesSub = g.subCategories.find(sub => {
        const lowerName = sub.fullName.toLowerCase();
        const lowerSub = sub.subName.toLowerCase();
        return (
          lowerName.includes("entry") ||
          lowerName.includes("entries") ||
          lowerName.includes("inscrito") ||
          lowerName.includes("piloto") ||
          lowerSub.includes("entry") ||
          lowerSub.includes("entries") ||
          lowerSub.includes("inscrito") ||
          lowerSub.includes("piloto")
        );
      });

      if (entriesSub && entriesSub.data && entriesSub.data.athletes) {
        athletesCount += entriesSub.data.athletes.length;
        entriesSub.data.athletes.forEach(ath => {
          if (ath.club) clubs.add(ath.club);
          if (ath.state) states.add(ath.state);
        });
      } else {
        // Fallback: collect unique athletes by plate across all subcategories of this group
        const uniquePlatesInGroup = new Set<string>();
        g.subCategories.forEach(sub => {
          if (sub.data && sub.data.athletes) {
            sub.data.athletes.forEach(ath => {
              if (ath.plate) {
                uniquePlatesInGroup.add(ath.plate);
                if (ath.club) clubs.add(ath.club);
                if (ath.state) states.add(ath.state);
              }
            });
          }
        });
        athletesCount += uniquePlatesInGroup.size;
      }
    });

    return {
      categoriesCount,
      athletesCount,
      clubsCount: clubs.size,
      statesCount: states.size
    };
  }, [groupedCategories, event]);

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
                      ${resultsMode === 'overall' ? '<th style="width: 10%;">Total</th>' : ''}
                      <th style="width: 12%;">Moto 1</th>
                      <th style="width: 12%;">Moto 2</th>
                      <th style="width: 12%;">Moto 3</th>
                      ${hasTransfer ? '<th style="width: 12%;">Transferir</th>' : ''}
                    </tr>
                  </thead>
                  <tbody>
            `;

            const sortedAthletes = [...athletesByGroup[gKey]].sort((a, b) => {
              const isFinal = isFinalResultsSub(sub.subName);

              const pA = getNumericPlace(a.place);
              const pB = getNumericPlace(b.place);
              const scoreA = pA === null ? 9999 : pA;
              const scoreB = pB === null ? 9999 : pB;

              const ptsA = getPointsVal(a.points);
              const ptsB = getPointsVal(b.points);

              if (resultsMode === 'overall' || resultsMode === 'motos') {
                if (isFinal) {
                  // If it's a final results subcategory, place takes precedence
                  if (scoreA !== scoreB) return scoreA - scoreB;
                  if (ptsA !== ptsB) return ptsA - ptsB;
                } else {
                  // Otherwise, points (M-PTS) takes precedence
                  if (ptsA !== ptsB) return ptsA - ptsB;
                  if (scoreA !== scoreB) return scoreA - scoreB;
                }
              } else {
                if (scoreA !== scoreB) return scoreA - scoreB;
                if (ptsA !== ptsB) return ptsA - ptsB;
              }

              return (a.firstName + ' ' + a.lastName).localeCompare(b.firstName + ' ' + b.lastName);
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
                  <td class="text-left">${ath.club || 'Avulso'} (${ath.state || 'BRA'})</td>
                  ${resultsMode === 'overall' ? `<td class="points-cell">${ath.totalPoints ?? '-'}</td>` : ''}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-white/10 text-white/95">
            <div className="bg-white/5 backdrop-blur-xs p-2 rounded-lg border border-white/5">
              <div className="text-[10px] text-yellow-300 font-extrabold uppercase tracking-wider">Categorias</div>
              <div className="text-lg font-black font-mono mt-0.5 flex items-baseline gap-1">
                {eventStats.categoriesCount}
                <span className="text-xxs font-normal text-emerald-200">categorias</span>
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
            const activeSub = activeSubCategoryMap[group.baseName] || 'TODAS';

            const motosSub = getMotosSub(group);
            const quartasSub = getQuartasSub(group);
            const semiSub = getSemiSub(group);
            const finalSub = getFinalSub(group);

            const hasMotos = !!motosSub;
            const hasQuartas = !!quartasSub;
            const hasSemi = !!semiSub;
            const hasFinal = !!finalSub;

            const isAllMode = activeSub === 'TODAS' || activeSub === 'ALL' || resultsMode === 'overall';

            // Filter subcategories based on selection
            let subsToRender: typeof group.subCategories = [];
            if (resultsMode === 'draws' && isAllMode) {
              if (!hasQuartas && !hasSemi && !hasFinal) {
                subsToRender = motosSub ? [motosSub] : [];
              } else {
                subsToRender = group.subCategories.filter(sub => !isFinalResultsSub(sub.subName) && sub.subName !== "Classificação Geral");
              }
            } else if (resultsMode === 'motos' && isAllMode) {
              subsToRender = group.subCategories.filter(sub => sub.subName !== "Classificação Geral");
            } else if (!isAllMode) {
              if (activeSub === 'MOTOS' && motosSub) {
                subsToRender = [motosSub];
              } else if (activeSub === 'QUARTAS' && quartasSub) {
                subsToRender = [quartasSub];
              } else if (activeSub === 'SEMI' && semiSub) {
                subsToRender = [semiSub];
              } else if (activeSub === 'FINAL' && finalSub) {
                subsToRender = [finalSub];
              } else {
                const matched = group.subCategories.find(sub => sub.fullName === activeSub && sub.subName !== "Classificação Geral");
                subsToRender = matched ? [matched] : (motosSub ? [motosSub] : group.subCategories.filter(sub => sub.subName !== "Classificação Geral").slice(0, 1));
              }
            }

            // Extract all unique athletes for the unified "Todas as Fases" view
            const combinedAthletes = (() => {
              const athletesMap: Record<string, any> = {};

              // 1. Process Motos
              if (motosSub) {
                motosSub.data.athletes.forEach(ath => {
                  const plate = ath.plate;
                  if (!athletesMap[plate]) {
                    athletesMap[plate] = {
                      plate,
                      firstName: ath.firstName,
                      lastName: ath.lastName,
                      fullName: ath.fullName,
                      club: ath.club,
                      state: ath.state,
                      uciId: ath.uciId,
                      sponsor: ath.sponsor,
                    };
                  }
                  athletesMap[plate].m1Place = ath.m1Place || ath.place;
                  athletesMap[plate].m2Place = ath.m2Place;
                  athletesMap[plate].m3Place = ath.m3Place;
                  athletesMap[plate].mpts = ath.points;
                });
              }

              // 2. Process Quartas
              if (quartasSub) {
                quartasSub.data.athletes.forEach(ath => {
                  const plate = ath.plate;
                  if (!athletesMap[plate]) {
                    athletesMap[plate] = {
                      plate,
                      firstName: ath.firstName,
                      lastName: ath.lastName,
                      fullName: ath.fullName,
                      club: ath.club,
                      state: ath.state,
                      uciId: ath.uciId,
                      sponsor: ath.sponsor,
                    };
                  }
                  athletesMap[plate].quartasPlace = ath.place;
                  athletesMap[plate].quartasGroup = ath.group;
                  athletesMap[plate].quartasPoints = ath.points;
                });
              }

              // 3. Process Semi
              if (semiSub) {
                semiSub.data.athletes.forEach(ath => {
                  const plate = ath.plate;
                  if (!athletesMap[plate]) {
                    athletesMap[plate] = {
                      plate,
                      firstName: ath.firstName,
                      lastName: ath.lastName,
                      fullName: ath.fullName,
                      club: ath.club,
                      state: ath.state,
                      uciId: ath.uciId,
                      sponsor: ath.sponsor,
                    };
                  }
                  athletesMap[plate].semiPlace = ath.place;
                  athletesMap[plate].semiGroup = ath.group;
                  athletesMap[plate].semiPoints = ath.points;
                });
              }

              // 4. Process Final
              if (finalSub) {
                finalSub.data.athletes.forEach(ath => {
                  const plate = ath.plate;
                  if (!athletesMap[plate]) {
                    athletesMap[plate] = {
                      plate,
                      firstName: ath.firstName,
                      lastName: ath.lastName,
                      fullName: ath.fullName,
                      club: ath.club,
                      state: ath.state,
                      uciId: ath.uciId,
                      sponsor: ath.sponsor,
                    };
                  }
                  athletesMap[plate].finalPlace = ath.place;
                  athletesMap[plate].finalGroup = ath.group;
                  athletesMap[plate].finalPoints = ath.points;
                });
              }

              // Fallback if empty
              if (Object.keys(athletesMap).length === 0) {
                group.subCategories.forEach(sub => {
                  sub.data.athletes.forEach(ath => {
                    const plate = ath.plate;
                    if (!athletesMap[plate]) {
                      athletesMap[plate] = {
                        plate,
                        firstName: ath.firstName,
                        lastName: ath.lastName,
                        fullName: ath.fullName,
                        club: ath.club,
                        state: ath.state,
                        uciId: ath.uciId,
                        sponsor: ath.sponsor,
                        m1Place: ath.m1Place || ath.place,
                        m2Place: ath.m2Place,
                        m3Place: ath.m3Place,
                        mpts: ath.points,
                      };
                    }
                  });
                });
              }

              let list = Object.values(athletesMap);

              const overallSub = group.subCategories.find(sub => 
                sub.subName === "Classificação Geral"
              );

              if (overallSub) {
                // If we have overall sub, let's sort the list to match the exact order of overallSub.data.athletes
                const orderedPlates = overallSub.data.athletes.map(a => a.plate);
                
                // Let's copy properties from overallSub to athletesMap
                overallSub.data.athletes.forEach(ath => {
                  const plate = ath.plate;

                  const finalStr = ath.fullFinal || "";
                  const semiStr = ath.fullSemi || "";
                  const quartasStr = ath.fullQuartas || "";

                  const finalPts = getNumericPlace(finalStr) || 0;
                  const semiPts = getNumericPlace(semiStr) || 0;
                  const quartasPts = getNumericPlace(quartasStr) || 0;
                  const mPts = ath.points !== undefined && ath.points !== null ? Number(ath.points) : 0;

                  const calculatedTotalPoints = finalPts + semiPts + quartasPts + mPts;
                  
                  if (athletesMap[plate]) {
                    // Update points / mpts / totalPoints
                    athletesMap[plate].totalPoints = calculatedTotalPoints;
                    athletesMap[plate].mpts = mPts;
                    athletesMap[plate].fullFinal = finalStr;
                    athletesMap[plate].fullSemi = semiStr;
                    athletesMap[plate].fullQuartas = quartasStr;
                    if (ath.place) {
                      athletesMap[plate].finalPlace = ath.place;
                    }
                  } else {
                    // If not present in map, add it
                    athletesMap[plate] = {
                      plate,
                      firstName: ath.firstName,
                      lastName: ath.lastName,
                      fullName: ath.fullName,
                      club: ath.club,
                      state: ath.state,
                      uciId: ath.uciId,
                      sponsor: ath.sponsor,
                      totalPoints: calculatedTotalPoints,
                      mpts: mPts,
                      fullFinal: finalStr,
                      fullSemi: semiStr,
                      fullQuartas: quartasStr,
                    };
                  }
                });

                // Now construct list from athletesMap ordered by orderedPlates
                const orderedList: any[] = [];
                orderedPlates.forEach(plate => {
                  if (athletesMap[plate]) {
                    orderedList.push(athletesMap[plate]);
                  }
                });
                
                // Append any extra athletes not in overallSub (just in case)
                list.forEach(ath => {
                  if (!orderedPlates.includes(ath.plate)) {
                    orderedList.push(ath);
                  }
                });

                list = orderedList;
                
                // Let's set overallRankScore to preserve this exact order
                list.forEach((ath: any, idx: number) => {
                  ath.overallRankScore = idx + 1;
                  // Set totalPoints to mpts (or points)
                  if (ath.totalPoints === undefined || ath.totalPoints === null) {
                    ath.totalPoints = ath.mpts !== undefined && ath.mpts !== null ? Number(ath.mpts) : 0;
                  }
                });
              } else {
                // Original fallback logic
                list.forEach((ath: any) => {
                  let score = 9999;
                  const fPlace = getNumericPlace(ath.finalPlace);
                  const sPlace = getNumericPlace(ath.semiPlace);
                  const qPlace = getNumericPlace(ath.quartasPlace);
                  const mptsVal = ath.mpts !== undefined && ath.mpts !== null ? Number(ath.mpts) : 999;

                  if (fPlace !== null) {
                    score = fPlace;
                  } else if (sPlace !== null) {
                    score = 10 + sPlace;
                  } else if (qPlace !== null) {
                    score = 30 + qPlace;
                  } else {
                    score = 100 + mptsVal;
                  }
                  ath.overallRankScore = score;

                  // Sum points of all phases for total classification points
                  const qNumPlace = getNumericPlace(ath.quartasPlace);
                  const sNumPlace = getNumericPlace(ath.semiPlace);
                  const fNumPlace = getNumericPlace(ath.finalPlace);

                  const qPts = qNumPlace !== null ? qNumPlace : 0;
                  const sPts = sNumPlace !== null ? sNumPlace : 0;
                  const fPts = fNumPlace !== null ? fNumPlace : 0;

                  let mPts = 0;
                  if (ath.mpts !== undefined && ath.mpts !== null) {
                    mPts = Number(ath.mpts);
                  } else {
                    const m1Num = getNumericPlace(ath.m1Place);
                    const m2Num = getNumericPlace(ath.m2Place);
                    const m3Num = getNumericPlace(ath.m3Place);
                    mPts = (m1Num ?? 0) + (m2Num ?? 0) + (m3Num ?? 0);
                  }

                  ath.totalPoints = mPts + qPts + sPts + fPts;
                });

                list.sort((a: any, b: any) => {
                  if (a.overallRankScore !== b.overallRankScore) {
                    return a.overallRankScore - b.overallRankScore;
                  }
                  return (a.firstName + ' ' + a.lastName).localeCompare(b.firstName + ' ' + b.lastName);
                });
              }

              return list;
            })();

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
                        {combinedAthletes.length} Pilotos Inscritos
                      </span>
                    </div>
                    {group.subCategories.length > 1 && (
                      <p className="text-[10px] text-slate-500 leading-normal font-medium">
                        Esta categoria possui {group.subCategories.length} fases ou grupos de classificação carregados. Use as abas abaixo para filtrar as visualizações.
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

                {/* Subcategory Tab Selector */}
                {resultsMode !== 'entries' && resultsMode !== 'overall' && group.subCategories.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 bg-slate-50/30 border-b border-slate-100">
                    <button
                      onClick={() => setActiveSubCategoryMap(prev => ({ ...prev, [group.baseName]: 'TODAS' }))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center gap-1 border ${
                        isAllMode
                          ? 'bg-slate-900 text-white border-slate-950 shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <Layers size={12} />
                      Todas as Fases
                    </button>

                    {hasMotos && (
                      <button
                        onClick={() => setActiveSubCategoryMap(prev => ({ ...prev, [group.baseName]: 'MOTOS' }))}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center gap-1 border ${
                          activeSub === 'MOTOS'
                            ? 'bg-emerald-850 text-white border-emerald-900 shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <Users size={12} />
                        Motos
                      </button>
                    )}

                    {hasQuartas && (
                      <button
                        onClick={() => setActiveSubCategoryMap(prev => ({ ...prev, [group.baseName]: 'QUARTAS' }))}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center gap-1 border ${
                          activeSub === 'QUARTAS'
                            ? 'bg-emerald-850 text-white border-emerald-900 shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <Zap size={12} />
                        Quartas
                      </button>
                    )}

                    {hasSemi && (
                      <button
                        onClick={() => setActiveSubCategoryMap(prev => ({ ...prev, [group.baseName]: 'SEMI' }))}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center gap-1 border ${
                          activeSub === 'SEMI'
                            ? 'bg-emerald-850 text-white border-emerald-900 shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <Award size={12} />
                        Semi
                      </button>
                    )}

                    {hasFinal && (
                      <button
                        onClick={() => setActiveSubCategoryMap(prev => ({ ...prev, [group.baseName]: 'FINAL' }))}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center gap-1 border ${
                          activeSub === 'FINAL'
                            ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <Trophy size={12} className={activeSub === 'FINAL' ? 'text-white' : 'text-amber-600'} />
                        Final
                      </button>
                    )}
                  </div>
                )}
                {/* Render tables for selected subgroups */}
                <div className="divide-y divide-slate-100">
                  {resultsMode === 'entries' ? (
                    // Special view: Registered pilots only (without phases or results)
                    <div className="p-4 sm:p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200/60 p-3 sm:p-4 rounded-xl">
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 uppercase tracking-wider">
                            <Users size={14} className="text-emerald-600 shrink-0" />
                            Atletas Inscritos - {group.baseName}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-1 font-medium leading-normal">
                            Lista oficial de competidores confirmados para a categoria {group.baseName}.
                          </p>
                        </div>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0 text-center tracking-wider">
                          Confirmados
                        </span>
                      </div>

                      {viewLayout === 'table' ? (
                        <div className="overflow-x-auto scrollbar-thin rounded-xl border border-slate-150 shadow-xxs bg-white">
                          <table className="w-full text-left border-collapse text-xxs sm:text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 text-center">
                                <th className="p-2 sm:p-3 w-12 sm:w-16 text-center text-[10px] sm:text-xs">Num</th>
                                <th className="p-2 sm:p-3 w-16 sm:w-20 text-center text-[10px] sm:text-xs">Placa</th>
                                <th className="p-2 sm:p-3 text-left text-[10px] sm:text-xs">Piloto</th>
                                <th className="p-2 sm:p-3 text-left text-[10px] sm:text-xs hidden md:table-cell">Clube / Associação</th>
                                <th className="p-2 sm:p-3 text-left text-[10px] sm:text-xs">Patrocinador / Equipe</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {combinedAthletes
                                .filter(ath => {
                                  if (!searchQuery) return true;
                                  const q = searchQuery.toLowerCase();
                                  const name = `${ath.firstName || ''} ${ath.lastName || ''}`.toLowerCase();
                                  const plate = (ath.plate || '').toLowerCase();
                                  const club = (ath.club || '').toLowerCase();
                                  const sponsor = (ath.sponsor || '').toLowerCase();
                                  const state = (ath.state || '').toLowerCase();
                                  return name.includes(q) || plate.includes(q) || club.includes(q) || sponsor.includes(q) || state.includes(q);
                                })
                                .sort((a, b) => (a.firstName + ' ' + a.lastName).localeCompare(b.firstName + ' ' + b.lastName))
                                .map((ath, idx) => (
                                  <tr key={ath.plate} className="hover:bg-slate-50/50 transition-colors">
                                    {/* Row Number */}
                                    <td className="p-2 sm:p-3 text-center font-mono font-bold text-slate-400">
                                      {idx + 1}
                                    </td>

                                    {/* Plate */}
                                    <td className="p-2 sm:p-3 text-center">
                                      <span className="inline-block px-1.5 sm:px-2.5 py-0.5 rounded bg-yellow-400 border border-yellow-500 text-slate-950 font-mono font-extrabold text-[10px] sm:text-[11px] shadow-xxs">
                                        {ath.plate}
                                      </span>
                                    </td>

                                    {/* Name */}
                                    <td className="p-2 sm:p-3">
                                      <div className="font-extrabold text-slate-900 flex flex-wrap items-center gap-1">
                                        <span>{ath.firstName} {ath.lastName}</span>
                                        {ath.uciId && (
                                          <span className="hidden sm:inline text-[9px] text-slate-400 font-mono font-normal">
                                            UCI: {ath.uciId}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 md:hidden flex flex-wrap items-center gap-1 leading-tight">
                                        <span>{ath.club || 'Avulso'}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="font-bold text-slate-600">UF: {ath.state || 'BRA'}</span>
                                      </div>
                                    </td>

                                    {/* Club / Association */}
                                    <td className="p-2 sm:p-3 text-slate-600 hidden md:table-cell">
                                      <div className="font-semibold text-[11px] truncate max-w-[180px]">{ath.club || 'Avulso'}</div>
                                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                        <MapPin size={10} className="text-slate-400 shrink-0" />
                                        <span>UF: {ath.state || 'BRA'}</span>
                                      </div>
                                    </td>

                                    {/* Sponsor */}
                                    <td className="p-2 sm:p-3 text-slate-600">
                                      <div className="font-medium text-[10px] sm:text-xs text-slate-500 italic">
                                        {ath.sponsor || '-'}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {combinedAthletes
                            .filter(ath => {
                              if (!searchQuery) return true;
                              const q = searchQuery.toLowerCase();
                              const name = `${ath.firstName || ''} ${ath.lastName || ''}`.toLowerCase();
                              const plate = (ath.plate || '').toLowerCase();
                              const club = (ath.club || '').toLowerCase();
                              const sponsor = (ath.sponsor || '').toLowerCase();
                              const state = (ath.state || '').toLowerCase();
                              return name.includes(q) || plate.includes(q) || club.includes(q) || sponsor.includes(q) || state.includes(q);
                            })
                            .sort((a, b) => (a.firstName + ' ' + a.lastName).localeCompare(b.firstName + ' ' + b.lastName))
                            .map((ath, idx) => (
                              <div
                                key={ath.plate}
                                className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 transition-all shadow-xxs flex flex-col justify-between gap-3 relative overflow-hidden"
                              >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200"></div>
                                <div className="space-y-2.5 pl-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[9px] font-mono font-extrabold text-slate-400"># {idx + 1}</span>
                                    <span className="px-2.5 py-0.5 rounded bg-yellow-400 border border-yellow-500 text-slate-900 font-mono font-extrabold text-xs shadow-xxs shrink-0">
                                      #{ath.plate}
                                    </span>
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                                      {ath.firstName} {ath.lastName}
                                    </h4>
                                    <div className="flex flex-col text-[10px] text-slate-500 font-semibold mt-1">
                                      <span className="truncate">{ath.club || 'Avulso'}</span>
                                      <span className="font-mono text-slate-400 font-normal mt-0.5">UF: {ath.state || 'BRA'} | UCI: {ath.uciId || 'N/A'}</span>
                                    </div>
                                  </div>
                                </div>
                                {ath.sponsor && (
                                  <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 italic pl-1.5 bg-slate-50/50 p-2 rounded-xl">
                                    <span className="font-bold text-slate-400">Patrocínio: </span> {ath.sponsor}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (isAllMode && resultsMode === 'overall') ? (
                    // Unified Standing across all phases (Todas as Fases)
                    <div className="p-4 sm:p-5 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200/60 p-3 sm:p-4 rounded-xl">
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 uppercase tracking-wider">
                            <Layers size={14} className="text-emerald-600 shrink-0" />
                            Classificação Geral Combinada (Todas as Fases)
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-1 font-medium leading-normal">
                            Resultados consolidados de todas as fases da categoria (Motos, Quartas, Semis, Finais) ordenados pela fase mais avançada atingida pelo piloto.
                          </p>
                        </div>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0 text-center tracking-wider">
                          Consolidado
                        </span>
                      </div>

                      {viewLayout === 'table' ? (
                        <div className="overflow-x-auto scrollbar-thin rounded-xl border border-slate-100 shadow-xxs bg-white">
                          <table className="w-full text-left border-collapse text-xxs sm:text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 text-center">
                                <th className="p-2 sm:p-3 w-10 sm:w-16 text-[10px] sm:text-xs text-center">Pos</th>
                                <th className="p-2 sm:p-3 w-12 sm:w-16 text-center text-[10px] sm:text-xs">Placa</th>
                                <th className="p-2 sm:p-3 text-left text-[10px] sm:text-xs">Piloto</th>
                                <th className="p-2 sm:p-3 text-left text-[10px] sm:text-xs hidden md:table-cell">Clube / Associação</th>
                                {resultsMode !== 'overall' && <th className="p-2 sm:p-3 text-center text-[10px] sm:text-xs">Motos (M1/M2/M3)</th>}
                                <th className="p-2 sm:p-3 text-center text-[10px] sm:text-xs text-emerald-800 font-black bg-emerald-50/10">
                                  {resultsMode === 'overall' ? 'Pontos Total' : 'M-PTS'}
                                </th>
                                {resultsMode !== 'overall' && hasQuartas && <th className="p-2 sm:p-3 text-center text-[10px] sm:text-xs">Quartas</th>}
                                {resultsMode !== 'overall' && hasSemi && <th className="p-2 sm:p-3 text-center text-[10px] sm:text-xs">Semi</th>}
                                {resultsMode !== 'overall' && hasFinal && <th className="p-2 sm:p-3 text-center text-[10px] sm:text-xs text-amber-700 font-black">Final</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {combinedAthletes.map((ath, idx) => {
                                const rankInt = idx + 1;
                                const isFirst = rankInt === 1;
                                const isSecond = rankInt === 2;
                                const isThird = rankInt === 3;

                                return (
                                  <tr key={ath.plate} className="hover:bg-slate-50/50 transition-colors">
                                    {/* Rank */}
                                    <td className="p-2 sm:p-3 text-center font-bold">
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
                                      ) : (
                                        <span className="text-slate-400 font-mono font-bold">{rankInt}º</span>
                                      )}
                                    </td>

                                    {/* Plate */}
                                    <td className="p-2 sm:p-3 text-center">
                                      <span className="inline-block px-1.5 sm:px-2.5 py-0.5 rounded bg-yellow-400 border border-yellow-500 text-slate-950 font-mono font-extrabold text-[10px] sm:text-[11px] shadow-xxs">
                                        {ath.plate}
                                      </span>
                                    </td>

                                    {/* Name */}
                                    <td className="p-2 sm:p-3">
                                      <div className="font-extrabold text-slate-900 flex flex-wrap items-center gap-1">
                                        <span>{ath.firstName} {ath.lastName}</span>
                                        {ath.uciId && (
                                          <span className="hidden sm:inline text-[9px] text-slate-400 font-mono font-normal">
                                            UCI: {ath.uciId}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 md:hidden flex flex-wrap items-center gap-1 leading-tight">
                                        <span>{ath.club || 'Avulso'}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="font-bold text-slate-600">UF: {ath.state || 'BRA'}</span>
                                      </div>
                                    </td>

                                    {/* Club / Association */}
                                    <td className="p-2 sm:p-3 text-slate-600 hidden md:table-cell">
                                      <div className="font-semibold text-[11px] truncate max-w-[180px]">{ath.club || 'Avulso'}</div>
                                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                        <MapPin size={10} className="text-slate-400 shrink-0" />
                                        <span>UF: {ath.state || 'BRA'}</span>
                                      </div>
                                    </td>

                                    {/* Motos (M1/M2/M3) */}
                                    {resultsMode !== 'overall' && (
                                      <td className="p-2 sm:p-3 text-center font-semibold font-mono text-slate-700">
                                        {ath.m1Place || ath.m2Place || ath.m3Place ? (
                                          `${ath.m1Place || '-'} / ${ath.m2Place || '-'} / ${ath.m3Place || '-'}`
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    )}

                                    {/* M-PTS */}
                                    <td className="p-2 sm:p-3 text-center font-black text-emerald-700 bg-emerald-50/20 text-xs">
                                      {resultsMode === 'overall' ? (ath.totalPoints ?? '-') : (ath.mpts !== undefined && ath.mpts !== null ? ath.mpts : '-')}
                                    </td>

                                    {/* Quartas */}
                                    {resultsMode !== 'overall' && hasQuartas && (
                                      <td className="p-2 sm:p-3 text-center font-mono font-bold text-slate-700">
                                        {ath.quartasPlace ? (
                                          <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                                            {ath.quartasPlace}º
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    )}

                                    {/* Semi */}
                                    {resultsMode !== 'overall' && hasSemi && (
                                      <td className="p-2 sm:p-3 text-center font-mono font-bold text-slate-700">
                                        {ath.semiPlace ? (
                                          <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                                            {ath.semiPlace}º
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    )}

                                    {/* Final */}
                                    {resultsMode !== 'overall' && hasFinal && (
                                      <td className="p-2 sm:p-3 text-center font-mono font-bold text-slate-700">
                                        {ath.finalPlace ? (
                                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-xs font-black">
                                            {ath.finalPlace}º
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
                        // CARDS VIEW FOR UNIFIED STANDING
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {combinedAthletes.map((ath, idx) => {
                            const rankInt = idx + 1;
                            const isFirst = rankInt === 1;
                            const isSecond = rankInt === 2;
                            const isThird = rankInt === 3;

                            return (
                              <div
                                key={ath.plate}
                                className={`p-4 rounded-2xl border transition-all shadow-xxs flex flex-col justify-between gap-3 relative overflow-hidden ${
                                  isFirst ? 'bg-gradient-to-br from-yellow-50/40 via-white to-white border-yellow-300/60 ring-1 ring-yellow-400/10' :
                                  isSecond ? 'bg-gradient-to-br from-slate-50/40 via-white to-white border-slate-300/60' :
                                  isThird ? 'bg-gradient-to-br from-amber-50/40 via-white to-white border-amber-300/60' :
                                  'bg-white border-slate-100 hover:border-slate-200'
                                }`}
                              >
                                {/* Colored Side Strip */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                  isFirst ? 'bg-yellow-400' :
                                  isSecond ? 'bg-slate-300' :
                                  isThird ? 'bg-amber-600' :
                                  'bg-slate-200'
                                }`}></div>

                                <div className="space-y-2.5 pl-1.5">
                                  {/* Card Top: Rank, Plate */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      {/* Rank Badge */}
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                                        isFirst ? 'bg-yellow-100 text-yellow-800' :
                                        isSecond ? 'bg-slate-100 text-slate-800' :
                                        isThird ? 'bg-amber-100 text-amber-800' :
                                        'bg-slate-100 text-slate-600'
                                      }`}>
                                        {rankInt}º
                                      </div>

                                      {/* Plate Badge */}
                                      <span className="px-2.5 py-0.5 rounded bg-yellow-400 border border-yellow-500 text-slate-900 font-mono font-extrabold text-xs shadow-xxs shrink-0">
                                        #{ath.plate}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Pilot details */}
                                  <div>
                                    <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                                      {ath.firstName} {ath.lastName}
                                    </h4>
                                    <div className="flex flex-col text-[10px] text-slate-500 font-semibold mt-1">
                                      <span className="truncate">{ath.club || 'Avulso'}</span>
                                      <span className="font-mono text-slate-400 font-normal mt-0.5">UF: {ath.state || 'BRA'} | {ath.country || 'BRA'}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Card Bottom: Results Bubbles across ALL Phases */}
                                {resultsMode !== 'overall' ? (
                                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 pl-1.5 bg-slate-50/50 p-2 rounded-xl text-[10px]">
                                  {/* Motos Bubble */}
                                  <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center flex-1 min-w-[50px]">
                                    <div className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Motos</div>
                                    <div className="font-mono mt-0.5 font-extrabold text-slate-900 leading-none">
                                      {ath.m1Place || ath.m2Place || ath.m3Place ? (
                                        `${ath.m1Place || '-'}/${ath.m2Place || '-'}/${ath.m3Place || '-'}`
                                      ) : '-'}
                                    </div>
                                    <div className="text-[7px] text-emerald-600 font-bold mt-0.5 font-mono">{ath.mpts !== undefined && ath.mpts !== null ? `${ath.mpts} PTS` : '-'}</div>
                                  </div>

                                  {/* Quartas Bubble */}
                                  {hasQuartas && (
                                    <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center flex-1 min-w-[50px]">
                                      <div className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Quartas</div>
                                      <div className="font-mono mt-0.5 font-extrabold text-slate-900 leading-normal">
                                        {ath.quartasPlace ? `${ath.quartasPlace}º` : '-'}
                                      </div>
                                    </div>
                                  )}

                                  {/* Semi Bubble */}
                                  {hasSemi && (
                                    <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center flex-1 min-w-[50px]">
                                      <div className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Semi</div>
                                      <div className="font-mono mt-0.5 font-extrabold text-slate-900 leading-normal">
                                        {ath.semiPlace ? `${ath.semiPlace}º` : '-'}
                                      </div>
                                    </div>
                                  )}

                                  {/* Final Bubble */}
                                  {hasFinal && (
                                    <div className="bg-amber-50/50 border border-amber-200 p-1.5 rounded-lg text-center flex-1 min-w-[50px]">
                                      <div className="text-[7px] text-amber-700 font-bold uppercase tracking-wider">Final</div>
                                      <div className="font-mono mt-0.5 font-black text-amber-800 leading-normal">
                                        {ath.finalPlace ? `${ath.finalPlace}º` : '-'}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                ) : (
                                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between pl-1.5 bg-emerald-50/20 p-2 rounded-xl text-[10px]">
                                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px]">{resultsMode === 'overall' ? 'Pontos Totais' : 'Pontos Geral'}</span>
                                    <span className="font-mono font-black text-xs text-emerald-700">{resultsMode === 'overall' ? `${ath.totalPoints ?? '-'} PTS` : (ath.mpts !== undefined && ath.mpts !== null ? `${ath.mpts} PTS` : '-')}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    subsToRender.map((sub) => {
                      const cat = sub.data;
                    
                    // Filter athletes by Search query inside Results
                    let filteredAthletesInCat = cat.athletes.filter((ath) => {
                      if (!searchQuery) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        `${ath.firstName} ${ath.lastName}`.toLowerCase().includes(q) ||
                        (ath.plate || '').toLowerCase().includes(q) ||
                        (ath.club || '').toLowerCase().includes(q) ||
                        (ath.state || '').toLowerCase().includes(q)
                      );
                    });

                    // Filter out athletes who did not participate/advance to this single-run phase (Quartas, Semis, Finals)
                    const isSingleRun = isSingleRunPhase(sub.subName);
                    if (isSingleRun && (resultsMode === 'motos' || resultsMode === 'draws')) {
                      filteredAthletesInCat = filteredAthletesInCat.filter((ath) => {
                        const hasGroup = ath.group && ath.group.trim() !== "";
                        const hasPlace = ath.place && ath.place.trim() !== "";
                        const hasTransfer = ath.transfer && ath.transfer.trim() !== "";
                        const hasDraw = ath.m1Draw && ath.m1Draw.trim() !== "";
                        const hasTime = ath.m1Time && ath.m1Time.trim() !== "";
                        return !!(hasGroup || hasPlace || hasTransfer || hasDraw || hasTime);
                      });
                    }

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
                        {resultsMode === 'motos' && (
                          <div className="px-3.5 py-2.5 bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-between border border-slate-200/50">
                            <span>Fase / Subgrupo: <span className="text-emerald-700 font-extrabold">{sub.subName}</span></span>
                            <span className="text-[10px] text-slate-400 font-normal">({cat.entriesCount} pilotos)</span>
                          </div>
                        )}

                        {/* WIDGET: PILOTOS QUE AVANÇAM DE FASE (TRANSFER BOX) */}
                        {resultsMode !== 'entries' && resultsMode !== 'draws' && advancedPilots.length > 0 && (
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

                            const isFinal = isFinalResultsSub(sub.subName);

                            // Lookup full athletes history from combinedAthletes
                            const fullA = combinedAthletes.find((ca: any) => ca.plate === a.plate) || a;
                            const fullB = combinedAthletes.find((ca: any) => ca.plate === b.plate) || b;

                            if (resultsMode === 'draws' && isSingleRunPhase(sub.subName)) {
                              const subLower = sub.subName.toLowerCase();
                              if (subLower.includes('final') && !subLower.includes('semi') && !subLower.includes('quarta') && !subLower.includes('oitava')) {
                                // Final: preserve the exact order parsed from Stage Final file
                                const idxA = cat.athletes.findIndex(x => x.plate === a.plate);
                                const idxB = cat.athletes.findIndex(x => x.plate === b.plate);
                                if (idxA !== -1 && idxB !== -1) {
                                  return idxA - idxB;
                                }
                              } else if (subLower.includes('semi')) {
                                // Semi: sort by quartasPlace, then mpts
                                const qA = getNumericPlace(fullA.quartasPlace) ?? 9999;
                                const qB = getNumericPlace(fullB.quartasPlace) ?? 9999;
                                if (qA !== qB) return qA - qB;
                                
                                const mA = fullA.mpts !== undefined && fullA.mpts !== null ? Number(fullA.mpts) : 9999;
                                const mB = fullB.mpts !== undefined && fullB.mpts !== null ? Number(fullB.mpts) : 9999;
                                if (mA !== mB) return mA - mB;
                              } else if (subLower.includes('quarta')) {
                                // Quartas: sort by mpts
                                const mA = fullA.mpts !== undefined && fullA.mpts !== null ? Number(fullA.mpts) : 9999;
                                const mB = fullB.mpts !== undefined && fullB.mpts !== null ? Number(fullB.mpts) : 9999;
                                if (mA !== mB) return mA - mB;
                              }
                            }

                            const pA = getNumericPlace(a.place);
                            const pB = getNumericPlace(b.place);
                            const scoreA = pA === null ? 9999 : pA;
                            const scoreB = pB === null ? 9999 : pB;

                            const ptsA = getPointsVal(a.points);
                            const ptsB = getPointsVal(b.points);

                            if (resultsMode === 'overall' || resultsMode === 'motos') {
                              if (isFinal) {
                                // If it's a final results subcategory, place takes precedence
                                if (scoreA !== scoreB) return scoreA - scoreB;
                                if (ptsA !== ptsB) return ptsA - ptsB;
                              } else {
                                // Otherwise, points (M-PTS) takes precedence
                                if (ptsA !== ptsB) return ptsA - ptsB;
                                if (scoreA !== scoreB) return scoreA - scoreB;
                              }
                            } else {
                              if (scoreA !== scoreB) return scoreA - scoreB;
                              if (ptsA !== ptsB) return ptsA - ptsB;
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
                                        
                                        {/* Rank Header / Ordem de Largada */}
                                        {resultsMode === 'draws' ? (
                                          <th className="p-1.5 sm:p-3 w-10 sm:w-16 text-[10px] sm:text-xs text-center">Ordem</th>
                                        ) : resultsMode !== 'entries' ? (
                                          <th className="p-1.5 sm:p-3 w-10 sm:w-16 text-[10px] sm:text-xs text-center">Pos</th>
                                        ) : null}
                                        
                                        {/* Plate Header */}
                                        <th className="p-1.5 sm:p-3 w-12 sm:w-16 text-center text-[10px] sm:text-xs">Placa</th>
                                        
                                        {/* Name Header */}
                                        <th className="p-1.5 sm:p-3 text-left text-[10px] sm:text-xs">Piloto</th>
                                        
                                        {/* Club/State Header */}
                                        <th className="p-1.5 sm:p-3 text-left text-[10px] sm:text-xs hidden md:table-cell">Clube / Associação</th>
                                        
                                        {/* overall M-PTS Header */}
                                        {resultsMode === 'overall' && (
                                          <th className="p-1.5 sm:p-3 w-12 sm:w-16 text-center text-emerald-800 text-[10px] sm:text-xs">Total</th>
                                        )}
 
                                        {/* Runs Headers */}
                                        {resultsMode !== 'entries' && resultsMode !== 'overall' && (
                                          isSingleRunPhase(sub.subName) ? (
                                            resultsMode === 'draws' ? null : (
                                              <>

                                              <th className="p-1.5 sm:p-3 text-center text-[10px] sm:text-xs text-emerald-800">Tempo de Volta</th>
                                              <th className="p-1.5 sm:p-3 text-center text-[10px] sm:text-xs">Reação</th>
                                            </>
                                           )
                                          ) : (
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
                                          )
                                        )}
 
                                        {/* Transfer Header */}
                                        {resultsMode !== 'entries' && resultsMode !== 'draws' && hasTransfer && hasNextPhase(sub, group.subCategories) && (
                                          <th className="p-1.5 sm:p-3 w-24 text-center text-emerald-800 text-[10px] sm:text-xs ">Classif.</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {sortedAthletes.map((ath, idx) => {
                                        const numPlace = getNumericPlace(ath.place);
                                        // We only show placements and rankings if there actually are numeric results published for this group
                                        const rankInt = numPlace;
                                        const isFinal = isFinalResultsSub(sub.subName);
                                        const showTrophies = (resultsMode === 'overall' || (resultsMode === 'motos' && isFinal)) && hasAnyNumericPlace;
                                        const isFirst = showTrophies && rankInt === 1;
                                        const isSecond = showTrophies && rankInt === 2;
                                        const isThird = showTrophies && rankInt === 3;
                                        const isPodium = showTrophies && rankInt !== null && rankInt <= 3;
                                        const isTransferring = ath.transfer && ath.transfer.trim() !== "";

                                        return (
                                          <tr
                                            key={ath.plate}
                                            className={`hover:bg-slate-50/50 transition-colors ${
                                              isTransferring && resultsMode !== 'draws'
                                                ? 'bg-emerald-50/15 hover:bg-emerald-50/35 border-l-2 border-l-emerald-600' 
                                                : ''
                                            }`}
                                          >
                                            {/* Rank Cell */}
                                            {resultsMode === 'draws' ? (
                                              <td className="p-1.5 sm:p-3 text-center font-mono font-bold text-slate-500">
                                                {idx + 1}
                                              </td>
                                            ) : resultsMode !== 'entries' ? (
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
                                                    {(resultsMode === 'overall' || (resultsMode === 'motos' && !isFinal)) ? `${idx + 1}º` : (ath.place || '-')}
                                                  </span>
                                                )}
                                              </td>
                                            ) : null}
                                            {/* Dummy tag to close the conditional safely if needed (none needed as we closed td) */}
 
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
                                                <span>{ath.club || 'Avulso'}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="font-bold text-slate-600">UF: {ath.state || 'BRA'}</span>
                                              </div>
                                              {/* Mobile Classification Badge */}
                                              {ath.transfer && hasNextPhase(sub, group.subCategories) && (
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
                                              <div className="font-semibold text-[11px] truncate max-w-[180px]">{ath.club || 'Avulso'}</div>
                                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                                <MapPin size={10} className="text-slate-400 shrink-0" />
                                                <span>UF: {ath.state || 'BRA'}</span>
                                              </div>
                                            </td>
 
                                            {/* Overall M-PTS */}
                                            {resultsMode === 'overall' && (
                                              <td className="p-1.5 sm:p-3 text-center font-black text-emerald-700 bg-emerald-50/20 text-xs">
                                                {ath.totalPoints ?? '-'}
                                              </td>
                                            )}

                                            {/* Runs (Motos/Draws) */}
                                            {resultsMode !== 'entries' && resultsMode !== 'overall' && (
                                              isSingleRunPhase(sub.subName) ? (
                                                resultsMode === 'draws' ? null : (
                                                  <>
                                                  {/* Sorteio / Gate */}
                                                  <td className="hidden">
                                                    {ath.m1Draw ? (
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
                                                        ) : <span className="font-mono text-slate-500 font-bold text-[10px] sm:text-xs">{ath.m1Draw}</span>;
                                                      })()
                                                    ) : <span className="text-slate-300">-</span>}
                                                  </td>

                                                  {/* Tempo de Volta */}
                                                  <td className="p-1 sm:p-3 text-center border-l border-slate-50 font-mono text-[10px] sm:text-xs font-bold text-emerald-600">
                                                    {isValidTime(ath.m1Time) ? `${ath.m1Time}s` : (ath.m1Time || '-')}
                                                  </td>

                                                  {/* Reação */}
                                                  <td className="p-1 sm:p-3 text-center border-l border-slate-50 font-mono text-[10px] sm:text-xs text-slate-500">
                                                    {isValidTime(ath.m1Reaction) ? `${ath.m1Reaction}s` : (ath.m1Reaction || '-')}
                                                  </td>
                                                </>
                                               )
                                              ) : (
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
                                              )
                                            )}
 
                                            {/* Transfer Badge Cell */}
                                            {resultsMode !== 'entries' && resultsMode !== 'draws' && hasTransfer && hasNextPhase(sub, group.subCategories) && (
                                              <td className="p-1.5 sm:p-3 text-center">
                                                {ath.transfer ? (
                                                  <span 
                                                    className="inline-flex items-center gap-0.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-bold font-mono text-[9px] sm:text-[10px] shadow-xxs"
                                                    title={friendlyTransferText(ath.transfer)}
                                                  >
                                                    <ShieldCheck size={9} className="text-emerald-600 shrink-0 hidden sm:inline" />
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
                                    const isFinal = isFinalResultsSub(sub.subName);
                                    const showTrophies = (resultsMode === 'overall' || (resultsMode === 'motos' && isFinal)) && hasAnyNumericPlace;
                                    const showSpecialHighlights = resultsMode !== 'draws';
                                    const isFirst = showSpecialHighlights && showTrophies && rankInt === 1;
                                    const isSecond = showSpecialHighlights && showTrophies && rankInt === 2;
                                    const isThird = showSpecialHighlights && showTrophies && rankInt === 3;
                                    const isPodium = showSpecialHighlights && showTrophies && rankInt !== null && rankInt <= 3;
                                    const isTransferring = showSpecialHighlights && ath.transfer && ath.transfer.trim() !== "" && hasNextPhase(sub, group.subCategories);

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
                                              
                                              {/* Trophy / Order Badge */}
                                              {resultsMode === 'draws' ? (
                                                <div className="w-7 h-7 rounded-full flex flex-col items-center justify-center bg-slate-100 border border-slate-200 text-slate-600 shrink-0 font-mono font-bold text-[10px]" title="Ordem de Largada">
                                                  <span className="text-[7px] uppercase font-black tracking-tighter leading-none text-slate-400">Ord</span>
                                                  <span className="leading-tight">{idx + 1}</span>
                                                </div>
                                              ) : resultsMode !== 'entries' ? (
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                                                  isFirst ? 'bg-yellow-100 text-yellow-800' :
                                                  isSecond ? 'bg-slate-100 text-slate-800' :
                                                  isThird ? 'bg-amber-100 text-amber-800' :
                                                  'bg-slate-100 text-slate-600'
                                                }`}>
                                                  {rankInt !== null ? `${rankInt}º` : ((resultsMode === 'overall' || (resultsMode === 'motos' && !isFinal)) ? `${idx + 1}º` : (ath.place || '-'))}
                                                </div>
                                              ) : null}

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
                                              <span className="truncate">{ath.club || 'Avulso'}</span>
                                              <span className="font-mono text-slate-400 font-normal mt-0.5">UF: {ath.state || 'BRA'} | {ath.country || 'BRA'}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Card Bottom: M-PTS & Runs Details */}
                                        {!(resultsMode === 'draws' && isSingleRunPhase(sub.subName)) && (
                                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 pl-1.5 bg-slate-50/50 p-2 rounded-xl">
                                          
                                          {resultsMode === 'overall' && (
                                            <div className="shrink-0 text-center">
                                              <div className="text-[8px] text-slate-400 uppercase font-black tracking-wider">Pontos</div>
                                              <div className="text-sm font-black text-emerald-700 font-mono">{ath.totalPoints ?? '-'}</div>
                                            </div>
                                          )}

                                          {/* Run blocks display depending on current viewing tab */}
                                          <div className="flex-1 flex gap-2 justify-end text-[10px]">
                                            
                                            {resultsMode !== 'entries' && resultsMode !== 'overall' && (
                                              isSingleRunPhase(sub.subName) ? (
                                                <>
                                                  {/* Sorteio / Gate card bubble custom marker */}
                                                  <div className="hidden bg-white border border-slate-100 p-1.5 rounded-lg text-center flex-1 max-w-[80px]">
                                                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Gate</div>
                                                    {ath.m1Draw ? (
                                                      (() => {
                                                        const p = parseDrawText(ath.m1Draw);
                                                        return p ? (
                                                          <div className="font-mono mt-0.5 text-[9px] font-bold leading-tight">
                                                            <div className="text-blue-600">B:{p.heat}</div>
                                                            <div className="text-yellow-600">R:{p.lane}</div>
                                                          </div>
                                                        ) : <div className="font-mono text-slate-500 mt-0.5 font-bold text-[9px]">{ath.m1Draw}</div>;
                                                      })()
                                                    ) : <span className="text-slate-300">-</span>}
                                                  </div>

                                                  {/* Tempo card bubble */}
                                                  <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center flex-1 max-w-[80px]">
                                                    <div className="text-[8px] text-emerald-800 font-bold uppercase tracking-wider">Tempo</div>
                                                    <div className="mt-0.5 font-mono text-[9px] font-bold text-emerald-600">
                                                      {isValidTime(ath.m1Time) ? `${ath.m1Time}s` : (ath.m1Time || '-')}
                                                    </div>
                                                  </div>

                                                  {/* Reação card bubble */}
                                                  <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center flex-1 max-w-[80px]">
                                                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Reação</div>
                                                    <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                                                      {isValidTime(ath.m1Reaction) ? `${ath.m1Reaction}s` : (ath.m1Reaction || '-')}
                                                    </div>
                                                  </div>
                                                </>
                                              ) : (
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
                                              )
                                            )}

                                          </div>
                                        </div>
                                      )}
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
                  })
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
