import { Athlete, EventData } from "./types";

/**
 * Normalizes a category name by removing any phase/results/entries suffixes.
 * E.g., "Boys 13 - Semifinal" -> "Boys 13"
 * "Boys 13 - Categoria Inscrições" -> "Boys 13"
 */
export const normalizeCategoryName = (name: string): string => {
  if (!name) return "";
  let clean = name.trim().replace(/\s+/g, " ");
  // replace colons and Moto prefix
  clean = clean.replace(/Moto:\s*/gi, " - ");
  clean = clean.replace(/:\s*/g, " - ");
  clean = clean.replace(/\s*-\s*/g, " - ");
  
  const parts = clean.split(" - ");
  if (parts.length === 1) return clean;
  
  const isPhase = (str: string): boolean => {
    const s = str.toLowerCase();
    return (
      s.includes('grupo') ||
      s.includes('resultado') ||
      s.includes('ponto') ||
      s.includes('classifica') ||
      s.includes('geral') ||
      s.includes('final') ||
      s.includes('overall') ||
      s.includes('standing') ||
      s.includes('sorteio') ||
      s.includes('fase') ||
      s.includes('bateria') ||
      s.includes('moto') ||
      s.includes('semi') ||
      s.includes('quarta') ||
      s.includes('oitava') ||
      s.includes('inscritos') ||
      s.includes('inscrições') ||
      s.includes('entries')
    );
  };
  
  if (parts.length === 2) {
    if (isPhase(parts[1])) return parts[0].trim();
    return clean;
  }
  
  const last = parts[parts.length - 1];
  if (isPhase(last)) {
    return parts.slice(0, -1).join(" - ").trim();
  }
  return clean;
};

/**
 * Searches across all categories in the event to find all instances of an athlete
 * by their plate and matching base category name. Merges all properties into one
 * high-fidelity Athlete object.
 */
export const getMergedAthlete = (
  targetPlate: string | undefined,
  targetCategoryName: string | undefined,
  event: EventData | null | undefined
): { athlete: Athlete; categoryName: string } | null => {
  if (!event || !event.categories || !targetPlate) return null;

  const plateToFind = targetPlate.toString().trim();
  const normalizedTargetCatName = normalizeCategoryName(targetCategoryName || "");

  // Find all matches
  const matches: { athlete: Athlete; originalCategory: string }[] = [];

  event.categories.forEach((cat) => {
    if (!cat || !cat.athletes) return;
    const catBaseName = normalizeCategoryName(cat.categoryName);
    
    // Check if the base category matches
    if (normalizedTargetCatName && catBaseName !== normalizedTargetCatName) {
      return;
    }

    cat.athletes.forEach((ath) => {
      if (!ath || !ath.plate) return;
      if (ath.plate.toString().trim() === plateToFind) {
        matches.push({ athlete: ath, originalCategory: cat.categoryName });
      }
    });
  });

  if (matches.length === 0) return null;

  // Let's merge all matching athlete objects
  const merged: Athlete = {
    plate: plateToFind,
    firstName: '',
    lastName: '',
    fullName: '',
    club: '',
    state: '',
    country: '',
    uciId: '',
  };

  const keys = [
    'plate', 'firstName', 'lastName', 'fullName', 'club', 'state', 'country', 'uciId', 'sponsor', 'transponder',
    'place', 'points', 'm1Place', 'm1Time', 'm1Reaction', 'm2Place', 'm2Time', 'm2Reaction', 'm3Place', 'm3Time', 'm3Reaction',
    'm1Draw', 'm2Draw', 'm3Draw', 'finalDraw', 'semiDraw', 'quartasDraw', 'group', 'transfer', 'totalPoints', 'mpts',
    'fullFinal', 'fullSemi', 'fullQuartas', 'sourceFile'
  ] as const;

  keys.forEach((key) => {
    // Collect non-empty values from all matches
    for (const match of matches) {
      const val = match.athlete[key];
      if (val !== undefined && val !== null && val !== '') {
        if (typeof val === 'number') {
          (merged as any)[key] = val;
          break;
        } else if (typeof val === 'string' && val.trim() !== '') {
          (merged as any)[key] = val.trim();
          break;
        }
      }
    }
  });

  // To make sure name is always well-formatted if we merged name parts
  if (!merged.fullName && (merged.firstName || merged.lastName)) {
    merged.fullName = `${merged.firstName || ''} ${merged.lastName || ''}`.trim();
  }

  return {
    athlete: merged,
    categoryName: normalizedTargetCatName || matches[0].originalCategory
  };
};
