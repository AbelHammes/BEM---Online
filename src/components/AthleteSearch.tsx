import React, { useState, useMemo } from 'react';
import { EventData, Athlete } from '../types';
import { Search, ShieldAlert, Award, FileSpreadsheet, Users, MapPin } from 'lucide-react';

interface AthleteSearchProps {
  event: EventData;
}

// Helper to extract base category name without the phase suffix
const getBaseCategoryName = (fullName: string): string => {
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

  if (parts.length === 1) {
    return cleanFullName;
  }
  
  if (parts.length === 2) {
    if (isPhaseSuffix(parts[1])) {
      return parts[0].trim();
    } else {
      return cleanFullName;
    }
  }
  
  const lastPart = parts[parts.length - 1];
  if (isPhaseSuffix(lastPart)) {
    return parts.slice(0, -1).join(" - ").trim();
  } else {
    return cleanFullName;
  }
};

export default function AthleteSearch({ event }: AthleteSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedClub, setSelectedClub] = useState('ALL');
  const [selectedState, setSelectedState] = useState('ALL');
  const [showTransponders, setShowTransponders] = useState(true);

  // Compile unique base category names
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    if (event && event.categories) {
      event.categories.forEach(c => {
        if (c && c.categoryName) {
          categories.add(getBaseCategoryName(c.categoryName));
        }
      });
    }
    return Array.from(categories).sort();
  }, [event]);

  // Compile unique lists of Clubs and States for filtration dropdowns
  const { allClubs, allStates } = useMemo(() => {
    const clubs = new Set<string>();
    const states = new Set<string>();
    
    if (event && event.categories) {
      event.categories.forEach(cat => {
        if (cat && cat.athletes) {
          cat.athletes.forEach(ath => {
            if (ath && ath.club) clubs.add(ath.club);
            if (ath && ath.state) states.add(ath.state);
          });
        }
      });
    }

    return {
      allClubs: Array.from(clubs).sort(),
      allStates: Array.from(states).sort()
    };
  }, [event]);

  // Combined Searching/Filtering logic
  const filteredAthletes = useMemo(() => {
    const results: Array<{ athlete: Athlete; categoryName: string }> = [];
    const seenPlates = new Set<string>();

    if (!event || !event.categories) return results;

    event.categories.forEach(cat => {
      if (!cat || !cat.athletes) return;
      
      const baseCatName = getBaseCategoryName(cat.categoryName);
      // Filter by category selection first
      if (selectedCategory !== 'ALL' && baseCatName !== selectedCategory) {
        return;
      }

      cat.athletes.forEach(ath => {
        if (!ath) return;
        const plate = ath.plate ? ath.plate.toString().trim() : '';
        if (!plate) return;

        // Filter by Club
        if (selectedClub !== 'ALL' && ath.club !== selectedClub) {
          return;
        }

        // Filter by State
        if (selectedState !== 'ALL' && ath.state !== selectedState) {
          return;
        }

        // Search text criteria
        const searchLower = (searchTerm || '').toLowerCase();
        const matchesPlate = plate.toLowerCase().includes(searchLower);
        const matchesName = (ath.fullName || '').toLowerCase().includes(searchLower) || 
                            `${ath.firstName || ''} ${ath.lastName || ''}`.toLowerCase().includes(searchLower);
        const matchesClub = (ath.club || '').toLowerCase().includes(searchLower);
        const matchesUci = (ath.uciId || '').toLowerCase().includes(searchLower);
        const matchesTransponder = (ath.transponder || '').toLowerCase().includes(searchLower);

        if (!searchTerm || matchesPlate || matchesName || matchesClub || matchesUci || matchesTransponder) {
          if (!seenPlates.has(plate)) {
            seenPlates.add(plate);
            results.push({
              athlete: ath,
              categoryName: baseCatName
            });
          }
        }
      });
    });

    return results;
  }, [event, searchTerm, selectedCategory, selectedClub, selectedState]);

  if (!event || !event.categories || event.categories.length === 0) {
    return (
      <div id="athlete-search-section" className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center flex flex-col items-center justify-center">
        <Users size={40} className="text-gray-300 mb-3 animate-pulse" />
        <h3 className="text-base font-bold text-gray-800">Aguardando Importação de Atletas</h3>
        <p className="text-xs text-gray-500 max-w-md mt-1 leading-relaxed">
          Nenhum atleta foi cadastrado ou sincronizado ainda. Quando o organizador exportar ou salvar relatórios dentro do software de cronometragem BEM, a lista completa de inscritos aparecerá aqui instantaneamente.
        </p>
      </div>
    );
  }

  return (
    <div id="athlete-search-section" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5 border-b border-gray-50 pb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-emerald-600" />
            Atletas Participantes
          </h3>
          <p className="text-xs text-gray-500">
            Consulte credenciais, placas oficiais e associações dos pilotos registrados ({filteredAthletes.length} encontrados)
          </p>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-3.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por Nome, Placa ou CBC ID..."
            className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
          >
            <option value="ALL">Todas as Categorias</option>
            {uniqueCategories.map((catName) => (
              <option key={catName} value={catName}>{catName}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedClub}
            onChange={(e) => setSelectedClub(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
          >
            <option value="ALL">Todos os Clubes / Equipes</option>
            {allClubs.map((club) => (
              <option key={club} value={club}>{club}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
          >
            <option value="ALL">Todos os Estados</option>
            {allStates.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Option to show transponder */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50 border border-slate-100 rounded-lg p-3 mb-5">
        <span className="text-xxs sm:text-xs text-slate-600 font-medium">
          Deseja visualizar os números de transponder dos atletas quando informados?
        </span>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTransponders}
            onChange={(e) => setShowTransponders(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          <span className="ml-2 text-xxs sm:text-xs font-semibold text-slate-700">
            {showTransponders ? 'Mostrar Transponders' : 'Ocultar Transponders'}
          </span>
        </label>
      </div>

      {/* Grid of Athletes Responsive */}
      {filteredAthletes.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-xs text-gray-500">
          Nenhum piloto coincide com os critérios de filtragem selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAthletes.map(({ athlete, categoryName }) => (
            <div
              id={`athlete-card-${athlete.plate}`}
              key={`${categoryName}-${athlete.plate}`}
              className="p-4 rounded-xl border border-gray-100 hover:border-emerald-200 bg-gray-50/50 hover:bg-white transition-all shadow-xxs hover:shadow-xs group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                    #{athlete.plate}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 group-hover:text-emerald-700 text-xs sm:text-sm leading-tight transition-colors">
                      {athlete.firstName} {athlete.lastName}
                    </h4>
                    <span className="inline-flex items-center text-xxs font-semibold bg-emerald-50 text-emerald-800 rounded px-1.5 py-0.5 mt-0.5">
                      {categoryName}
                    </span>
                  </div>
                </div>
                {athlete.place === "1" && (
                  <span className="p-1 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Award size={16} />
                  </span>
                )}
              </div>

              <div className="space-y-1 mt-3 border-t border-gray-100 pt-2 text-xxs text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-gray-400 shrink-0" />
                  <span className="truncate"><strong>Clube:</strong> {athlete.club || 'Avulso'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                    <strong>UF:</strong> {athlete.state} / {athlete.country}
                  </span>
                  <span><strong>CBC ID:</strong> {athlete.uciId || 'Não Informado'}</span>
                </div>
                {showTransponders && athlete.transponder && (
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-100 rounded px-1.5 py-0.5 mt-1 w-max max-w-full truncate font-medium">
                    <span className="shrink-0">📟 Transponder:</span>
                    <span className="font-mono font-bold">{athlete.transponder}</span>
                  </div>
                )}
                {athlete.sponsor && (
                  <div className="mt-1 pt-1 border-t border-dotted border-gray-100 flex items-center text-emerald-700 font-medium">
                    <span className="mr-1">⚡ Patrocinador:</span>
                    <span className="truncate italic">{athlete.sponsor}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
