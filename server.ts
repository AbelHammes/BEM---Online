import express from "express";
import path from "path";
import fs from "fs";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import { jsonrepair } from "jsonrepair";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const DB_FILE = path.join(process.cwd(), "race_state_db.json");

// In-memory cache for ultra-low latency, handling more than 10000 concurrent accesses with ease
let dbCache: any = null;
let serializedDbCache: string | null = null;
let dbLastModified = Date.now();

// Helper to get default initial state (Campeonato Brasileiro de BMX 2026, Cuiabá - MT)
function getDefaultRaceState() {
  return {
    event: {
      eventName: "Campeonato Brasileiro de BMX 2026",
      eventSponsor: "Confederação Brasileira de Ciclismo (CBC)",
      eventLocation: "Cuiabá / MT - Pista de BMX Cuiabá",
      reportCreated: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      reportType: "Aguardando Sincronização do BEM",
      categories: []
    },
    schedule: [],
    notifications: [
      {
        id: "init",
        timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        title: "Sistema Inicializado",
        message: "O sistema está pronto e aguardando a sincronização de arquivos do software BEM para carregar as categorias, atletas e baterias.",
        severity: "info"
      }
    ],
    syncStatus: {
      lastSync: "Nunca sincronizado",
      status: "disconnected",
      filesSyncedCount: 0
    }
  };
}

// Helper to check if a category name represents a single-run phase (Final, Semi, Quartas, Oitavas)
function isSingleRunPhaseName(categoryName: string): boolean {
  const nameLower = categoryName.toLowerCase();
  return (
    nameLower.includes("final") ||
    nameLower.includes("semi") ||
    nameLower.includes("quarta") ||
    nameLower.includes("oitava") ||
    nameLower.includes("1/2") ||
    nameLower.includes("1/4") ||
    nameLower.includes("1/8")
  );
}

// Propagates and syncs athlete details (such as draws, points, places, times) across different subcategories/phases of the same base category
function propagateAthleteData(currentState: any) {
  if (!currentState || !currentState.event || !currentState.event.categories) {
    return currentState;
  }

  const categories = currentState.event.categories;
  
  // 1. Group categories by baseCategoryName
  const baseGroups: { [baseName: string]: any[] } = {};
  for (const cat of categories) {
    const baseName = cat.categoryName.split(" - ")[0].trim().toLowerCase();
    if (!baseGroups[baseName]) {
      baseGroups[baseName] = [];
    }
    baseGroups[baseName].push(cat);
  }

  // 2. For each base category group, accumulate all athlete properties by plate
  for (const baseName of Object.keys(baseGroups)) {
    const catsInGroup = baseGroups[baseName];
    const athleteMaster: { [plate: string]: any } = {};

    // Collect all properties ONLY from non-single-run phases
    for (const cat of catsInGroup) {
      if (isSingleRunPhaseName(cat.categoryName)) continue;
      if (!cat.athletes) continue;
      for (const ath of cat.athletes) {
        if (!ath.plate) continue;
        const plate = ath.plate.toString().trim();
        if (!athleteMaster[plate]) {
          athleteMaster[plate] = {};
        }

        const master = athleteMaster[plate];
        
        // We sync draws, places, times, reaction, etc. (only the run-specific data, not points, transfer, or group which are unique to each phase)
        const keysToSync = [
          "m1Draw", "m2Draw", "m3Draw",
          "m1Place", "m2Place", "m3Place",
          "m1Time", "m2Time", "m3Time",
          "m1Reaction", "m2Reaction", "m3Reaction"
        ];

        for (const key of keysToSync) {
          if (ath[key] !== undefined && ath[key] !== null && ath[key] !== "") {
            master[key] = ath[key];
          }
        }
      }
    }

    // 3. Propagate master properties back ONLY to non-single-run phases
    for (const cat of catsInGroup) {
      if (isSingleRunPhaseName(cat.categoryName)) continue;
      if (!cat.athletes) continue;
      cat.athletes = cat.athletes.map((ath: any) => {
        if (!ath.plate) return ath;
        const plate = ath.plate.toString().trim();
        const master = athleteMaster[plate];
        if (!master) return ath;

        const updated = { ...ath };
        for (const [key, val] of Object.entries(master)) {
          if (val !== undefined && val !== null && val !== "") {
            if (key.startsWith("m1") || key.startsWith("m2") || key.startsWith("m3")) {
              updated[key] = val;
            } else {
              // For general fields like 'place', 'points', 'transfer', 'group', only fill in if they are currently empty
              if (updated[key] === undefined || updated[key] === null || updated[key] === "") {
                updated[key] = val;
              }
            }
          }
        }
        return updated;
      });
    }
  }

  return currentState;
}

// Read database or initialize with fast in-memory caching
function readDB() {
  if (dbCache) {
    return dbCache;
  }
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      dbCache = propagateAthleteData(parsed);
      serializedDbCache = JSON.stringify(dbCache, null, 2);
      return dbCache;
    }
  } catch (err) {
    console.error("Erro lendo BD JSON, reiniciando com inicial.", err);
  }
  const defaultState = getDefaultRaceState();
  writeDB(defaultState);
  dbCache = defaultState;
  return dbCache;
}

function writeDB(data: any) {
  const propagated = propagateAthleteData(data);
  dbCache = propagated;
  dbLastModified = Date.now();
  try {
    const serialized = JSON.stringify(propagated, null, 2);
    serializedDbCache = serialized;
    fs.writeFileSync(DB_FILE, serialized, "utf-8");
  } catch (err) {
    console.error("Erro escrevendo BD JSON", err);
  }
}

// Keeps un-normalized names with original round/group details to avoid duplicate 1st/2nd places
function normalizeCategoryName(name: string): string {
  if (!name) return "";
  let norm = name.trim();
  norm = norm.replace(/([a-zA-Z0-9_]+)Moto:/g, "$1: ");
  norm = norm.replace(/\s+/g, " ");
  return norm;
}

// BEM FILE PARSERS (Supports dynamic column indexing based on report headers)
function parseBEMJson(jsonContent: any, currentState: any, filename: string) {
  const fileEventName = jsonContent.EventName || "Campeonato Brasileiro de BMX 2026";
  const fileLocation = jsonContent.EventLocation || "Cuiabá - MT";
  const fileSponsor = jsonContent.EventSponsor || "Confederação Brasileira de Ciclismo";
  const reportCreated = jsonContent.ReportCreated || new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const reportType = jsonContent.ReportType || "RELATORIO";
  const reportTypeUpper = reportType.toUpperCase();
  const isFullResults = reportTypeUpper === "FULL RESULTS" || reportTypeUpper === "RESULTADOS COMPLETOS";
  const isDrawReport = reportTypeUpper.includes("MOTO DRAWS") || 
                       reportTypeUpper.includes("SORTEIOS") || 
                       reportTypeUpper.includes("SORTEIO") || 
                       reportTypeUpper.includes("GATE") || 
                       reportTypeUpper.includes("GATES") || 
                       reportTypeUpper.includes("RAIA") || 
                       reportTypeUpper.includes("RAIAS") || 
                       reportTypeUpper.includes("LARGADA") || 
                       reportTypeUpper.includes("ORDEM") ||
                       reportTypeUpper.includes("INSCRITOS") ||
                       reportTypeUpper.includes("ENTRY") ||
                       reportTypeUpper.includes("ENTRIES") ||
                       reportTypeUpper.includes("PILOTOS");

  // Track occurrences of category names in the current JSON report to differentiate groups/motos
  const tableCountsPerCategory: { [key: string]: number } = {};

  // Check categories in report
  const catReports = jsonContent["Category Report"] || [];
  const updatedCategories = [...currentState.event.categories];

  for (const catRep of catReports) {
    const headerInfo = catRep["Category Heading"] || {};
    let categoryName = normalizeCategoryName(headerInfo.Category || "");
    if (!categoryName) continue;
    const transferText = headerInfo.Transfer || "";
    if (isFullResults) {
      categoryName = `${categoryName} - Classificação Geral`;
    } else if (transferText && transferText.trim() !== "") {
      categoryName = `${categoryName} - ${transferText.trim()}`;
    } else {
      if (!tableCountsPerCategory[categoryName]) {
        tableCountsPerCategory[categoryName] = 1;
      } else {
        tableCountsPerCategory[categoryName]++;
        categoryName = `${categoryName} - Grupo ${tableCountsPerCategory[categoryName]}`;
      }
    }

    const entriesCount = parseInt(headerInfo.Entries, 10) || 0;
    const sponsor = headerInfo.Sponsor || "";

    const headers: string[] = catRep.Headers || [];
    const displayHeaders: string[] = catRep["Display Headers"] || headers;
    const rows: string[][] = catRep.Data || [];

    // Helper to find index of a header in either local or Portuguese
    const findColIdx = (aliases: string[]) => {
      return headers.findIndex((h, idx) => {
        const hLower = h.toLowerCase();
        const dLower = (displayHeaders[idx] || "").toLowerCase();
        return aliases.some(alias => hLower.includes(alias.toLowerCase()) || dLower.includes(alias.toLowerCase()));
      });
    };

    const plateIdx = findColIdx(["plate", "placa"]);
    const fNameIdx = findColIdx(["first name", "nome"]);
    const lNameIdx = findColIdx(["last name", "familia", "sobrenome"]);
    const clubIdx = findColIdx(["club", "clube"]);
    const stateIdx = findColIdx(["state", "estado"]);
    const countryIdx = findColIdx(["country", "pais", "país"]);
    const uciIdx = findColIdx(["uci id", "id da uci"]);
    const sponsorIdx = findColIdx(["sponsor", "patrocinador"]);
    const transponderIdx = findColIdx(["transponder", "tx", "chip", "trsp"]);
    const drawIdx = findColIdx(["draw", "sorteio", "gate", "raia"]);

    // Result Columns
    const placeIdx = findColIdx(["place", "lugar"]);
    const mptsIdx = findColIdx(["m-pts", "pontos"]);
    const rankIdx = findColIdx(["rank"]);
    const transferIdx = findColIdx(["transfer", "transferir", "transferencia", "transferência"]);

    let finalColIdx = headers.findIndex(h => {
      const hl = h.trim().toLowerCase();
      return hl === "final";
    });
    if (finalColIdx === -1) {
      finalColIdx = headers.findIndex(h => h.toLowerCase().includes("final place") || h.toLowerCase() === "final");
    }

    let semiColIdx = headers.findIndex(h => {
      const hl = h.trim().toLowerCase();
      return hl === "1/2" || hl === "semi";
    });
    if (semiColIdx === -1) {
      semiColIdx = headers.findIndex(h => h.toLowerCase().includes("1/2 place") || h.toLowerCase().includes("semifinal"));
    }

    let quartasColIdx = headers.findIndex(h => {
      const hl = h.trim().toLowerCase();
      return hl === "1/4" || hl === "quartas" || hl === "quarta";
    });
    if (quartasColIdx === -1) {
      quartasColIdx = headers.findIndex(h => h.toLowerCase().includes("1/4 place") || h.toLowerCase().includes("quarter"));
    }

    // Moto columns
    const m1Idx = findColIdx(["m1 place", "m1 lugar", "m 1 Place", "m1"]);
    const m1TimeIdx = findColIdx([
      "m1 lap time", "m1 tempo de volta", "m1 tempo", "m1-tempo", "m 1 lap time", "m 1 tempo", "m 1 time", "m1 time", "m1 t.", "m1 t", "t1", "t.1", "tempo de volta", "tempo de volta 1", "tempo", "tempo 1", "lap time", "time", "t.", "t", "t m1", "tm1", "tempo m1", "m1 t. volta", "m1 t volta", "volta m1"
    ]);
    const m1ReactIdx = findColIdx([
      "m1 start reaction", "m1 iniciar reação", "m1 reação", "m1 reacao", "m 1 start reaction", "m 1 reação", "m 1 reacao", "m1 reaction", "m 1 reaction", "m1 r.", "m1 r", "r1", "r.1", "reação", "reacao", "reaction", "start reaction", "r.", "r", "r m1", "rm1", "reação m1", "reacao m1", "reacao 1", "reação 1"
    ]);

    const m2Idx = findColIdx(["m2 place", "m2 lugar", "m 2 Place", "m2"]);
    const m2TimeIdx = findColIdx([
      "m2 lap time", "m2 tempo de volta", "m2 tempo", "m2-tempo", "m 2 lap time", "m 2 tempo", "m 2 time", "m2 time", "m2 t.", "m2 t", "t2", "t.2", "tempo de volta 2", "tempo 2", "t m2", "tm2", "tempo m2", "m2 t. volta", "m2 t volta", "volta m2"
    ]);
    const m2ReactIdx = findColIdx([
      "m2 start reaction", "m2 iniciar reação", "m2 reação", "m2 reacao", "m 2 start reaction", "m 2 reação", "m 2 reacao", "m2 reaction", "m 2 reaction", "m2 r.", "m2 r", "r2", "r.2", "reacao 2", "reação 2", "r m2", "rm2", "reação m2", "reacao m2"
    ]);

    const m3Idx = findColIdx(["m3 place", "m3 lugar", "m 3 Place", "m3"]);
    const m3TimeIdx = findColIdx([
      "m3 lap time", "m3 tempo de volta", "m3 tempo", "m3-tempo", "m 3 lap time", "m 3 tempo", "m 3 time", "m3 time", "m3 t.", "m3 t", "t3", "t.3", "tempo de volta 3", "tempo 3", "t m3", "tm3", "tempo m3", "m3 t. volta", "m3 t volta", "volta m3"
    ]);
    const m3ReactIdx = findColIdx([
      "m3 start reaction", "m3 iniciar reação", "m3 reação", "m3 reacao", "m 3 start reaction", "m 3 reação", "m 3 reacao", "m3 reaction", "m 3 reaction", "m3 r.", "m3 r", "r3", "r.2", "reacao 3", "reação 3", "r m3", "rm3", "reação m3", "reacao m3"
    ]);

    // Parse Athletes
    const athletesList: any[] = [];

    const hasResultsCols = placeIdx !== -1 || mptsIdx !== -1 || m1TimeIdx !== -1 || rankIdx !== -1;
    const isLocalDrawReport = isDrawReport && !hasResultsCols;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const plate = plateIdx !== -1 ? row[plateIdx]?.trim() : "";
      if (!plate) continue;

      const fName = fNameIdx !== -1 ? row[fNameIdx]?.trim() : "";
      const lName = lNameIdx !== -1 ? row[lNameIdx]?.trim() : "";

      // Extract raw places and times
      const m1Raw = m1Idx !== -1 ? row[m1Idx]?.trim() : "";
      const m2Raw = m2Idx !== -1 ? row[m2Idx]?.trim() : "";
      const m3Raw = m3Idx !== -1 ? row[m3Idx]?.trim() : "";

      const athlete: any = {
        plate,
        firstName: fName,
        lastName: lName,
        fullName: fName && lName ? `${fName} ${lName}` : (fName || lName || `Piloto #${plate}`),
        club: clubIdx !== -1 ? row[clubIdx]?.trim() : "",
        state: stateIdx !== -1 ? row[stateIdx]?.trim() : "",
        country: countryIdx !== -1 ? row[countryIdx]?.trim() : "BRA",
        uciId: uciIdx !== -1 ? row[uciIdx]?.trim() : "",
        sponsor: sponsorIdx !== -1 ? row[sponsorIdx]?.trim() : "",
        transponder: transponderIdx !== -1 ? row[transponderIdx]?.trim() : "",
        place: isFullResults ? (rowIndex + 1).toString() : ((!isLocalDrawReport && placeIdx !== -1) ? row[placeIdx]?.trim() : ""),
        points: mptsIdx !== -1 ? parseInt(row[mptsIdx], 10) || undefined : undefined,
        sourceFile: filename
      };

      if (isFullResults) {
        athlete.fullFinal = finalColIdx !== -1 ? row[finalColIdx]?.trim() : "";
        athlete.fullSemi = semiColIdx !== -1 ? row[semiColIdx]?.trim() : "";
        athlete.fullQuartas = quartasColIdx !== -1 ? row[quartasColIdx]?.trim() : "";
      }

      const drawVal = drawIdx !== -1 ? row[drawIdx]?.trim() : "";
      if (drawVal) {
        const rtLower = reportType.toLowerCase();
        const fnLower = filename.toLowerCase();
        const tTextLower = transferText.toLowerCase();

        const isFinalPhase = tTextLower.includes("final") && !tTextLower.includes("semi") && !tTextLower.includes("quarta") && !tTextLower.includes("quarter") && !tTextLower.includes("1/4");
        const isSemiPhase = tTextLower.includes("semi") || tTextLower.includes("1/2");
        const isQuartasPhase = tTextLower.includes("quarta") || tTextLower.includes("quarter") || tTextLower.includes("1/4");

        const isFinalFile = rtLower.includes("final") && !rtLower.includes("semi") && !rtLower.includes("quarta") && !rtLower.includes("quarter") && !rtLower.includes("1/4") ||
                            fnLower.includes("final") && !fnLower.includes("semi") && !fnLower.includes("quarta") && !fnLower.includes("quarter") && !fnLower.includes("1/4");
        const isSemiFile = rtLower.includes("semi") || rtLower.includes("1/2") || fnLower.includes("semi") || fnLower.includes("1/2");
        const isQuartasFile = rtLower.includes("quarta") || rtLower.includes("quarter") || rtLower.includes("1/4") || fnLower.includes("quarta") || fnLower.includes("quarter") || fnLower.includes("1/4");

        const isFinal = isFinalPhase || isFinalFile;
        const isSemi = isSemiPhase || isSemiFile;
        const isQuartas = isQuartasPhase || isQuartasFile;

        if (isFinal) {
          athlete.finalDraw = drawVal;
        } else if (isSemi) {
          athlete.semiDraw = drawVal;
        } else if (isQuartas) {
          athlete.quartasDraw = drawVal;
        } else {
          athlete.m1Draw = drawVal;
        }
      }

      // Add Draws & Results

      if (isLocalDrawReport) {
        const cleanDrawValue = (val: string): string => {
          if (!val) return "";
          return val.replace(/^(bateria|raia|heat|lane|b\.|r\.|b:|r:)\s*/i, "").trim();
        };
        athlete.m1Draw = cleanDrawValue(m1Raw);
        athlete.m2Draw = cleanDrawValue(m2Raw);
        athlete.m3Draw = cleanDrawValue(m3Raw);
      } else {
        // Results
        athlete.m1Place = m1Raw || athlete.place;
        athlete.m1Time = m1TimeIdx !== -1 ? row[m1TimeIdx]?.trim() : "";
        athlete.m1Reaction = m1ReactIdx !== -1 ? row[m1ReactIdx]?.trim() : "";

        athlete.m2Place = m2Raw;
        athlete.m2Time = m2TimeIdx !== -1 ? row[m2TimeIdx]?.trim() : "";
        athlete.m2Reaction = m2ReactIdx !== -1 ? row[m2ReactIdx]?.trim() : "";

        athlete.m3Place = m3Raw;
        athlete.m3Time = m3TimeIdx !== -1 ? row[m3TimeIdx]?.trim() : "";
        athlete.m3Reaction = m3ReactIdx !== -1 ? row[m3ReactIdx]?.trim() : "";
      }

      if (rankIdx !== -1 && row[rankIdx]) {
        const rawRank = row[rankIdx].trim();
        if (rawRank.includes(",")) {
          const parts = rawRank.split(",");
          athlete.place = parts[0]?.trim();
          athlete.group = parts[1]?.trim();
        } else {
          athlete.place = rawRank;
        }
      }
      if (transferIdx !== -1 && row[transferIdx]) {
        athlete.transfer = row[transferIdx]?.trim();
      }
      if (mptsIdx !== -1 && row[mptsIdx]) {
        athlete.points = parseInt(row[mptsIdx], 10);
      }

      athletesList.push(athlete);
    }

    // Merge or insert this category
    const exCatIdx = updatedCategories.findIndex(c => c.categoryName.toLowerCase() === categoryName.toLowerCase());
    if (exCatIdx !== -1) {
      // Merge athlete info
      const mergedAthletes = [...updatedCategories[exCatIdx].athletes];

      for (const newAth of athletesList) {
        const athIdx = mergedAthletes.findIndex(a => a.plate === newAth.plate);
        if (athIdx !== -1) {
          // Merge properties directly, keeping existing values if new values are empty or undefined
          const existing = mergedAthletes[athIdx];
          const merged = { ...existing };
          for (const key of Object.keys(newAth)) {
            if (newAth[key] !== undefined && newAth[key] !== null && newAth[key] !== "") {
              merged[key] = newAth[key];
            }
          }
          mergedAthletes[athIdx] = merged;
        } else {
          mergedAthletes.push(newAth);
        }
      }

      updatedCategories[exCatIdx] = {
        ...updatedCategories[exCatIdx],
        entriesCount: entriesCount || mergedAthletes.length,
        transferText: transferText || updatedCategories[exCatIdx].transferText,
        sponsor: sponsor || updatedCategories[exCatIdx].sponsor,
        athletes: mergedAthletes,
        sourceFile: filename
      };
    } else {
      updatedCategories.push({
        categoryName,
        entriesCount: entriesCount || athletesList.length,
        transferText,
        sponsor,
        athletes: athletesList,
        sourceFile: filename
      });
    }
  }

  // Update overall event fields
  currentState.event = {
    eventName: "Campeonato Brasileiro de BMX 2026", // Forced/Maintained layout
    eventSponsor: "Confederação Brasileira de Ciclismo (CBC)",
    eventLocation: "Cuiabá / MT - Pista de BMX Cuiabá",
    reportCreated,
    reportType,
    categories: updatedCategories
  };

  currentState.syncStatus = {
    lastSync: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    status: "connected",
    filesSyncedCount: currentState.syncStatus.filesSyncedCount + 1
  };

  return currentState;
}

// Clean HTML Parser using regular expressions with support for stacked cell data (<BR>)
function stripHtmlTags(html: string): string {
  if (!html) return "";
  let text = html.replace(/<[^>]*>/g, "");
  // Replace HTML entities like &nbsp; or &#160; with standard spaces
  text = text.replace(/&nbsp;/gi, " ").replace(/&#160;/g, " ").replace(/&amp;/gi, "&");
  return text.trim().replace(/\s+/g, " ");
}

function parseMotoCellHtml(html: string) {
  if (!html) return { place: "", time: "", reaction: "" };
  const parts = html.split(/<br\s*\/?>|[\r\n]+/i).map(p => stripHtmlTags(p).trim()).filter(p => p !== "");
  
  let place = "";
  let time = "";
  let reaction = "";

  if (parts.length === 1) {
    place = parts[0];
  } else if (parts.length === 2) {
    place = parts[0];
    time = parts[1];
  } else if (parts.length >= 3) {
    place = parts[0];
    time = parts[1];
    reaction = parts[2];
  }

  return { place, time, reaction };
}

function parseBEMHtml(htmlContent: string, currentState: any, filename: string) {
  const htmlUpper = htmlContent.toUpperCase();
  const isFullResults = htmlUpper.includes("RESULTADOS COMPLETOS") || htmlUpper.includes("FULL RESULTS") || filename.toLowerCase().includes("full") || filename.toLowerCase().includes("completo");

  // Simple regex parser for captions and table rows
  const categories: any[] = [];
  const captionRegex = /<caption[^>]*>([^<]+)<\/caption>/gi;
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;

  // Track occurrences of category names in the current HTML report to differentiate groups/motos
  const tableCountsPerCategory: { [key: string]: number } = {};

  let tableMatch;
  let captionMatch;

  const eventCategories = [...currentState.event.categories];

  while ((tableMatch = tableRegex.exec(htmlContent)) !== null) {
    const tableBody = tableMatch[1];
    
    // Find caption within or just before this table, or execute captRegex
    // Seek caption
    const capMatch = /<caption[^>]*>([\s\S]*?)<\/caption>/i.exec(tableBody);
    if (!capMatch) continue;

    const rawCaption = capMatch[1].replace(/<[^>]*>/g, "").trim();
    const captionParts = /^(.*?)\s*\(([^)]+)\)\s*([\s\S]*)$/i.exec(rawCaption);
    
    let categoryName = "";
    let phaseText = "";
    if (captionParts) {
      categoryName = normalizeCategoryName(captionParts[1].trim());
      phaseText = captionParts[3].replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
      phaseText = phaseText.replace(/^[-:\s]+/, "").trim();
    } else {
      const catNameMatch = /^([^(]+)/.exec(rawCaption);
      categoryName = normalizeCategoryName(catNameMatch ? catNameMatch[1].trim() : "");
    }

    if (!categoryName) continue;

    if (isFullResults) {
      categoryName = `${categoryName} - Classificação Geral`;
    } else if (phaseText && phaseText.trim() !== "") {
      categoryName = `${categoryName} - ${phaseText.trim()}`;
    } else {
      if (!tableCountsPerCategory[categoryName]) {
        tableCountsPerCategory[categoryName] = 1;
      } else {
        tableCountsPerCategory[categoryName]++;
        categoryName = `${categoryName} - Grupo ${tableCountsPerCategory[categoryName]}`;
      }
    }
    
    // Parse Rows
    const trRegex = /<TR[^>]*>([\s\S]*?)<\/TR>/gi;
    let trMatch;
    const headers: string[] = [];
    const rows: string[][] = [];

    while ((trMatch = trRegex.exec(tableBody)) !== null) {
      const rowContent = trMatch[1];
      
      // If contains TH, parse headers
      if (rowContent.includes("<TH") || rowContent.includes("<th")) {
        const thRegex = /<TH[^>]*>([\s\S]*?)<\/TH>/gi;
        let thMatch;
        while ((thMatch = thRegex.exec(rowContent)) !== null) {
          headers.push(stripHtmlTags(thMatch[1]));
        }
      } else {
        // TD row
        const tdRegex = /<TD[^>]*>([\s\S]*?)<\/TD>/gi;
        let tdMatch;
        const rowCells: string[] = [];
        while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
          rowCells.push(tdMatch[1].trim());
        }
        if (rowCells.length > 0) {
          rows.push(rowCells);
        }
      }
    }

    if (rows.length === 0) continue;

    // Use header columns to map variables
    const findHtmlColIdx = (aliases: string[]) => {
      // First, try exact or very close match
      let idx = headers.findIndex(h => {
        const hl = h.trim().toLowerCase();
        return aliases.some(alias => hl === alias.toLowerCase());
      });
      if (idx !== -1) return idx;

      // Second, try partial match
      return headers.findIndex(h => {
        const hl = h.toLowerCase();
        return aliases.some(alias => hl.includes(alias.toLowerCase()));
      });
    };

    const plateIdx = findHtmlColIdx(["placa", "plate"]);
    const nameIdx = findHtmlColIdx(["nome", "name", "piloto", "atleta"]);
    const stateIdx = findHtmlColIdx(["estado", "state", "uf"]);
    const clubIdx = findHtmlColIdx(["clube", "club", "equipe", "team"]);
    const uciIdx = findHtmlColIdx(["uci", "id da uci", "uciid", "id uci"]);
    const transponderIdx = findHtmlColIdx(["transponder", "tx", "chip", "trsp"]);
    const htmlDrawIdx = findHtmlColIdx(["sorteio", "draw", "raia", "gate"]);
    
    const placeIdx = findHtmlColIdx(["lugar", "place", "pos", "classificação", "classificacao", "rank"]);
    const pointsIdx = findHtmlColIdx(["m-pts", "pontos", "points", "m pts", "pts"]);
    const transferIdx = findHtmlColIdx(["transfer", "transferir", "transferencia", "transferência"]);

    let finalColIdx = headers.findIndex(h => {
      const hl = h.trim().toLowerCase();
      return hl === "final";
    });
    if (finalColIdx === -1) {
      finalColIdx = headers.findIndex(h => h.toLowerCase().includes("final place") || h.toLowerCase() === "final");
    }

    let semiColIdx = headers.findIndex(h => {
      const hl = h.trim().toLowerCase();
      return hl === "1/2" || hl === "semi";
    });
    if (semiColIdx === -1) {
      semiColIdx = headers.findIndex(h => h.toLowerCase().includes("1/2 place") || h.toLowerCase().includes("semifinal"));
    }

    let quartasColIdx = headers.findIndex(h => {
      const hl = h.trim().toLowerCase();
      return hl === "1/4" || hl === "quartas" || hl === "quarta";
    });
    if (quartasColIdx === -1) {
      quartasColIdx = headers.findIndex(h => h.toLowerCase().includes("1/4 place") || h.toLowerCase().includes("quarter"));
    }
    
    const m1TimeIdx = findHtmlColIdx([
      "m1 lap time", "m1 tempo de volta", "m1 tempo", "m1-tempo", "m 1 lap time", "m 1 tempo", "m 1 time", "m1 time", "m1 t.", "m1 t", "t1", "t.1", "tempo de volta", "tempo de volta 1", "tempo", "tempo 1", "lap time", "time", "t.", "t", "t m1", "tm1", "tempo m1", "m1 t. volta", "m1 t volta", "volta m1"
    ]);
    const m1ReactIdx = findHtmlColIdx([
      "m1 start reaction", "m1 iniciar reação", "m1 reação", "m1 reacao", "m 1 start reaction", "m 1 reação", "m 1 reacao", "m1 reaction", "m 1 reaction", "m1 r.", "m1 r", "r1", "r.1", "reação", "reacao", "reaction", "start reaction", "r.", "r", "r m1", "rm1", "reação m1", "reacao m1", "reacao 1", "reação 1"
    ]);
    let m1Idx = findHtmlColIdx(["m 1 place", "m1 lugar", "m 1", "m1"]);
    if (m1Idx === m1TimeIdx || m1Idx === m1ReactIdx) {
      m1Idx = headers.findIndex(h => {
        const hl = h.toLowerCase();
        return (hl.includes("m1") || hl.includes("m 1")) &&
               !hl.includes("time") && !hl.includes("tempo") &&
               !hl.includes("reaction") && !hl.includes("reaç") && !hl.includes("reac");
      });
    }

    const m2TimeIdx = findHtmlColIdx([
      "m2 lap time", "m2 tempo de volta", "m2 tempo", "m2-tempo", "m 2 lap time", "m 2 tempo", "m 2 time", "m2 time", "m2 t.", "m2 t", "t2", "t.2", "tempo de volta 2", "tempo 2", "t m2", "tm2", "tempo m2", "m2 t. volta", "m2 t volta", "volta m2"
    ]);
    const m2ReactIdx = findHtmlColIdx([
      "m2 start reaction", "m2 iniciar reação", "m2 reação", "m2 reacao", "m 2 start reaction", "m 2 reação", "m 2 reacao", "m2 reaction", "m 2 reaction", "m2 r.", "m2 r", "r2", "r.2", "reacao 2", "reação 2", "r m2", "rm2", "reação m2", "reacao m2"
    ]);
    let m2Idx = findHtmlColIdx(["m 2 place", "m2 lugar", "m 2", "m2"]);
    if (m2Idx === m2TimeIdx || m2Idx === m2ReactIdx) {
      m2Idx = headers.findIndex(h => {
        const hl = h.toLowerCase();
        return (hl.includes("m2") || hl.includes("m 2")) &&
               !hl.includes("time") && !hl.includes("tempo") &&
               !hl.includes("reaction") && !hl.includes("reaç") && !hl.includes("reac");
      });
    }

    const m3TimeIdx = findHtmlColIdx([
      "m3 lap time", "m3 tempo de volta", "m3 tempo", "m3-tempo", "m 3 lap time", "m 3 tempo", "m 3 time", "m3 time", "m3 t.", "m3 t", "t3", "t.3", "tempo de volta 3", "tempo 3", "t m3", "tm3", "tempo m3", "m3 t. volta", "m3 t volta", "volta m3"
    ]);
    const m3ReactIdx = findHtmlColIdx([
      "m3 start reaction", "m3 iniciar reação", "m3 reação", "m3 reacao", "m 3 start reaction", "m 3 reação", "m 3 reacao", "m3 reaction", "m 3 reaction", "m3 r.", "m3 r", "r3", "r.2", "reacao 3", "reação 3", "r m3", "rm3", "reação m3", "reacao m3"
    ]);
    let m3Idx = findHtmlColIdx(["m 3 place", "m3 lugar", "m 3", "m3"]);
    if (m3Idx === m3TimeIdx || m3Idx === m3ReactIdx) {
      m3Idx = headers.findIndex(h => {
        const hl = h.toLowerCase();
        return (hl.includes("m3") || hl.includes("m 3")) &&
               !hl.includes("time") && !hl.includes("tempo") &&
               !hl.includes("reaction") && !hl.includes("reaç") && !hl.includes("reac");
      });
    }

    const athletesList: any[] = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const r = rows[rowIndex];
      const plate = plateIdx !== -1 ? stripHtmlTags(r[plateIdx]) : "";
      if (!plate) continue;

      const fCompName = nameIdx !== -1 ? stripHtmlTags(r[nameIdx]) : "";
      
      // Handle "LastName, FirstName" or similar
      let firstName = fCompName;
      let lastName = "";
      if (fCompName.includes(",")) {
        const parts = fCompName.split(",");
        lastName = parts[0]?.trim();
        firstName = parts[1]?.trim();
      } else if (fCompName.includes(" ")) {
        const parts = fCompName.split(" ");
        firstName = parts[0]?.trim();
        lastName = parts.slice(1).join(" ")?.trim();
      }

      let rawPlace = placeIdx !== -1 ? stripHtmlTags(r[placeIdx]) : "";
      let group = "";
      if (rawPlace && rawPlace.includes(",")) {
        const parts = rawPlace.split(",");
        rawPlace = parts[0]?.trim();
        group = parts[1]?.trim();
      }

      const htmlUpper = htmlContent.toUpperCase();
      const hasResultsCols = placeIdx !== -1 || pointsIdx !== -1 || m1TimeIdx !== -1;
      const isDraw = !hasResultsCols && (
                     htmlUpper.includes("BATERIA) SORTEIOS") || 
                     htmlUpper.includes("SORTEIO") || 
                     htmlUpper.includes("DRAWS") || 
                     htmlUpper.includes("SORTEIOS") ||
                     htmlUpper.includes("GATE") ||
                     htmlUpper.includes("GATES") ||
                     htmlUpper.includes("RAIA") ||
                     htmlUpper.includes("RAIAS") ||
                     htmlUpper.includes("MOTO DRAW") ||
                     htmlUpper.includes("MOTO DRAWS") ||
                     htmlUpper.includes("LARGADA") ||
                     htmlUpper.includes("ORDEM DE LARGADA") ||
                     htmlUpper.includes("INSCRITOS") ||
                     htmlUpper.includes("ENTRY") ||
                     htmlUpper.includes("ENTRIES") ||
                     htmlUpper.includes("PILOTOS")
      );

      const athlete: any = {
        plate,
        firstName,
        lastName,
        fullName: fCompName,
        club: clubIdx !== -1 ? stripHtmlTags(r[clubIdx]) : "Independente",
        state: stateIdx !== -1 ? stripHtmlTags(r[stateIdx]) : "RS",
        country: "BRA",
        uciId: uciIdx !== -1 ? stripHtmlTags(r[uciIdx]) : "",
        transponder: transponderIdx !== -1 ? stripHtmlTags(r[transponderIdx]) : "",
        place: isFullResults ? (rowIndex + 1).toString() : (isDraw ? "" : rawPlace),
        group: group,
        points: pointsIdx !== -1 ? parseInt(stripHtmlTags(r[pointsIdx]), 10) || undefined : undefined,
        transfer: transferIdx !== -1 ? stripHtmlTags(r[transferIdx]) : "",
        sourceFile: filename
      };

      if (isFullResults) {
        athlete.fullFinal = finalColIdx !== -1 ? stripHtmlTags(r[finalColIdx]) : "";
        athlete.fullSemi = semiColIdx !== -1 ? stripHtmlTags(r[semiColIdx]) : "";
        athlete.fullQuartas = quartasColIdx !== -1 ? stripHtmlTags(r[quartasColIdx]) : "";
      }

      const drawVal = htmlDrawIdx !== -1 && r[htmlDrawIdx] ? stripHtmlTags(r[htmlDrawIdx]).trim() : "";
      if (drawVal) {
        const fnLower = filename.toLowerCase();
        const pTextLower = phaseText.toLowerCase();

        const isFinalPhase = pTextLower.includes("final") && !pTextLower.includes("semi") && !pTextLower.includes("quarta") && !pTextLower.includes("quarter") && !pTextLower.includes("1/4");
        const isSemiPhase = pTextLower.includes("semi") || pTextLower.includes("1/2");
        const isQuartasPhase = pTextLower.includes("quarta") || pTextLower.includes("quarter") || pTextLower.includes("1/4");

        const isFinalFile = fnLower.includes("final") && !fnLower.includes("semi") && !fnLower.includes("quarta") && !fnLower.includes("quarter") && !fnLower.includes("1/4");
        const isSemiFile = fnLower.includes("semi") || fnLower.includes("1/2");
        const isQuartasFile = fnLower.includes("quarta") || fnLower.includes("quarter") || fnLower.includes("1/4");

        const isFinal = isFinalPhase || isFinalFile;
        const isSemi = isSemiPhase || isSemiFile;
        const isQuartas = isQuartasPhase || isQuartasFile;

        if (isFinal) {
          athlete.finalDraw = drawVal;
        } else if (isSemi) {
          athlete.semiDraw = drawVal;
        } else if (isQuartas) {
          athlete.quartasDraw = drawVal;
        } else {
          athlete.m1Draw = drawVal;
        }
      }

      if (isDraw) {
        const cleanDrawValue = (val: string): string => {
          if (!val) return "";
          return val.replace(/^(bateria|raia|heat|lane|b\.|r\.|b:|r:)\s*/i, "").trim();
        };

        if (m1Idx !== -1) {
          const rawCell = r[m1Idx] || "";
          if (/<br/i.test(rawCell)) {
            const parsed = parseMotoCellHtml(rawCell);
            const heat = cleanDrawValue(parsed.place);
            const lane = cleanDrawValue(parsed.time);
            athlete.m1Draw = lane ? `${heat} : ${lane}` : heat;
          } else {
            athlete.m1Draw = cleanDrawValue(stripHtmlTags(rawCell));
          }
        }
        if (m2Idx !== -1) {
          const rawCell = r[m2Idx] || "";
          if (/<br/i.test(rawCell)) {
            const parsed = parseMotoCellHtml(rawCell);
            const heat = cleanDrawValue(parsed.place);
            const lane = cleanDrawValue(parsed.time);
            athlete.m2Draw = lane ? `${heat} : ${lane}` : heat;
          } else {
            athlete.m2Draw = cleanDrawValue(stripHtmlTags(rawCell));
          }
        }
        if (m3Idx !== -1) {
          const rawCell = r[m3Idx] || "";
          if (/<br/i.test(rawCell)) {
            const parsed = parseMotoCellHtml(rawCell);
            const heat = cleanDrawValue(parsed.place);
            const lane = cleanDrawValue(parsed.time);
            athlete.m3Draw = lane ? `${heat} : ${lane}` : heat;
          } else {
            athlete.m3Draw = cleanDrawValue(stripHtmlTags(rawCell));
          }
        }
      } else {
        // Moto 1
        if (m1Idx !== -1) {
          const rawCell = r[m1Idx] || "";
          if (/<br/i.test(rawCell)) {
            const parsed = parseMotoCellHtml(rawCell);
            athlete.m1Place = parsed.place;
            athlete.m1Time = parsed.time;
            athlete.m1Reaction = parsed.reaction;
          } else {
            athlete.m1Place = stripHtmlTags(rawCell);
            athlete.m1Time = m1TimeIdx !== -1 ? stripHtmlTags(r[m1TimeIdx]) : "";
            athlete.m1Reaction = m1ReactIdx !== -1 ? stripHtmlTags(r[m1ReactIdx]) : "";
          }
        } else if (placeIdx !== -1) {
          // Fallback for single-run stages (final, semi, quarters, etc.)
          athlete.m1Place = athlete.place;
          athlete.m1Time = m1TimeIdx !== -1 ? stripHtmlTags(r[m1TimeIdx]) : "";
          athlete.m1Reaction = m1ReactIdx !== -1 ? stripHtmlTags(r[m1ReactIdx]) : "";
        }
 
        // Moto 2
        if (m2Idx !== -1) {
          const rawCell = r[m2Idx] || "";
          if (/<br/i.test(rawCell)) {
            const parsed = parseMotoCellHtml(rawCell);
            athlete.m2Place = parsed.place;
            athlete.m2Time = parsed.time;
            athlete.m2Reaction = parsed.reaction;
          } else {
            athlete.m2Place = stripHtmlTags(rawCell);
            athlete.m2Time = m2TimeIdx !== -1 ? stripHtmlTags(r[m2TimeIdx]) : "";
            athlete.m2Reaction = m2ReactIdx !== -1 ? stripHtmlTags(r[m2ReactIdx]) : "";
          }
        }
 
        // Moto 3
        if (m3Idx !== -1) {
          const rawCell = r[m3Idx] || "";
          if (/<br/i.test(rawCell)) {
            const parsed = parseMotoCellHtml(rawCell);
            athlete.m3Place = parsed.place;
            athlete.m3Time = parsed.time;
            athlete.m3Reaction = parsed.reaction;
          } else {
            athlete.m3Place = stripHtmlTags(rawCell);
            athlete.m3Time = m3TimeIdx !== -1 ? stripHtmlTags(r[m3TimeIdx]) : "";
            athlete.m3Reaction = m3ReactIdx !== -1 ? stripHtmlTags(r[m3ReactIdx]) : "";
          }
        }
      }

      athletesList.push(athlete);
    }

    // Merge in current categories
    const exCatIdx = eventCategories.findIndex(c => c.categoryName.toLowerCase() === categoryName.toLowerCase());
    if (exCatIdx !== -1) {
      const mergedAthletes = [...eventCategories[exCatIdx].athletes];
      for (const newAth of athletesList) {
        const athIdx = mergedAthletes.findIndex(a => a.plate === newAth.plate);
        if (athIdx !== -1) {
          // Merge properties directly, keeping existing values if new values are empty or undefined
          const existing = mergedAthletes[athIdx];
          const merged = { ...existing };
          for (const key of Object.keys(newAth)) {
            if (newAth[key] !== undefined && newAth[key] !== null && newAth[key] !== "") {
              merged[key] = newAth[key];
            }
          }
          mergedAthletes[athIdx] = merged;
        } else {
          mergedAthletes.push(newAth);
        }
      }
      eventCategories[exCatIdx] = {
        ...eventCategories[exCatIdx],
        athletes: mergedAthletes,
        sourceFile: filename
      };
    } else {
      eventCategories.push({
        categoryName,
        entriesCount: athletesList.length,
        transferText: "Importação HTML",
        athletes: athletesList,
        sourceFile: filename
      });
    }
  }

  currentState.event.categories = eventCategories;
  currentState.syncStatus = {
    lastSync: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    status: "connected",
    filesSyncedCount: currentState.syncStatus.filesSyncedCount + 1
  };

  return currentState;
}

// REST API ROUTES
app.get("/api/race-state", (req, res) => {
  // Set Cache-Control for browser and CDN caching (e.g. Cloudflare)
  res.setHeader("Cache-Control", "public, max-age=2, stale-while-revalidate=5");
  
  const etagValue = `W/"${dbLastModified}"`;
  res.setHeader("ETag", etagValue);
  
  if (req.headers["if-none-match"] === etagValue) {
    return res.status(304).end();
  }
  
  if (!serializedDbCache) {
    readDB();
  }
  
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(serializedDbCache);
});

// Helper to remove results associated with a deleted filename
function removeFileResults(filename: string, currentState: any) {
  if (!filename) return currentState;
  const targetFile = filename.toLowerCase();

  // Filter out categories whose sourceFile matches filename
  let updatedCategories = currentState.event.categories.filter(
    (c: any) => !c.sourceFile || c.sourceFile.toLowerCase() !== targetFile
  );

  // Also filter athletes within remaining categories whose sourceFile matches filename
  updatedCategories = updatedCategories.map((c: any) => {
    const remainingAthletes = c.athletes.filter(
      (a: any) => !a.sourceFile || a.sourceFile.toLowerCase() !== targetFile
    );
    return {
      ...c,
      athletes: remainingAthletes,
      entriesCount: remainingAthletes.length
    };
  });

  // Filter out any categories that now have 0 athletes
  updatedCategories = updatedCategories.filter((c: any) => c.athletes.length > 0);

  currentState.event.categories = updatedCategories;
  
  currentState.syncStatus = {
    ...currentState.syncStatus,
    lastSync: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    filesSyncedCount: Math.max(0, currentState.syncStatus.filesSyncedCount - 1)
  };

  return currentState;
}

// Helper to decode transfer codes (e.g. Q5, S19, F16) into friendly Portuguese texts
function getFriendlyTransferText(code?: string): string {
  if (!code) return "";
  const upper = code.trim().toUpperCase();
  if (upper.startsWith('Q')) {
    return `Classificado para 1/4 de Final (${upper})`;
  }
  if (upper.startsWith('S')) {
    return `Classificado para a Semifinal (${upper})`;
  }
  if (upper.startsWith('F')) {
    return `Classificado para a Grande Final 🏆 (${upper})`;
  }
  return `Avança de Fase (${upper})`;
}

// Robust JSON sanitizer to handle BOM, comments, trailing commas, missing quotes, single quotes etc.
function cleanJsonString(str: string): string {
  try {
    return jsonrepair(str);
  } catch (err) {
    console.warn("jsonrepair failed, falling back to regex cleanup:", err);
    let clean = str.trim();
    
    // Remove UTF-8 BOM
    clean = clean.replace(/^\uFEFF/, "");

    // Remove Javascript variable assignment (e.g., "var x = { ... }")
    clean = clean.replace(/^(?:var|const|let)\s+\w+\s*=\s*/i, "");
    if (clean.endsWith(";")) {
      clean = clean.slice(0, -1).trim();
    }

    // Remove block comments /* ... */
    clean = clean.replace(/\/\*[\s\S]*?\*\//g, "");

    // Remove single-line comments // ...
    clean = clean.replace(/(?:^|[^:])\/\/.*$/gm, (match) => {
      return match.charAt(0) === '/' ? '' : match.charAt(0);
    });

    // Remove trailing commas before } or ]
    clean = clean.replace(/,\s*([}\]])/g, "$1");

    // Fix unquoted keys
    clean = clean.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');

    return clean;
  }
}

// Sync File Uploader (Accepts both JSON content string, JSON Object, or HTML string)
app.post("/api/upload-bem", (req, res) => {
  try {
    const { filename, content, type } = req.body;
    let currentState = readDB();

    if (!content) {
      return res.status(400).json({ error: "Nenhum conteúdo enviado." });
    }

    const fileLabel = filename || `manual_upload.${type}`;

    // 1. Capture old transfer state before parsing
    const oldTransfers: { [key: string]: string } = {}; // key: "categoryName_plate", value: transfer
    if (currentState && currentState.event && currentState.event.categories) {
      for (const cat of currentState.event.categories) {
        for (const ath of cat.athletes) {
          if (ath.transfer) {
            oldTransfers[`${cat.categoryName}_${ath.plate}`] = ath.transfer;
          }
        }
      }
    }

    let parsed = false;
    let reportParsedType = "Relatório Importado";

    // Detect if content is JSON
    if (typeof content === "object" || (typeof content === "string" && (content.trim().startsWith("{") || content.trim().startsWith("[")))) {
      let jsonObj;
      if (typeof content === "object") {
        jsonObj = content;
      } else {
        const cleanContent = cleanJsonString(content);
        try {
          jsonObj = JSON.parse(cleanContent);
        } catch (err: any) {
          console.error("Erro ao analisar JSON limpo:", err);
          return res.status(400).json({ 
            error: `Erro no servidor: JSON inválido (${err.message}). Verifique se o arquivo exportado pelo BEM possui caracteres inválidos.` 
          });
        }
      }
      currentState = parseBEMJson(jsonObj, currentState, fileLabel);
      reportParsedType = jsonObj.ReportType || "JSON BEM";
      parsed = true;
    } else if (typeof content === "string") {
      const contentTrimmed = content.trim();
      if (contentTrimmed.includes("<HTML>") || contentTrimmed.includes("<html") || contentTrimmed.includes("<!DOCTYPE")) {
        currentState = parseBEMHtml(content, currentState, fileLabel);
        reportParsedType = "HTML BEM Report";
        parsed = true;
      } else {
        // Fallback or raw parser attempt
        return res.status(400).json({ error: "Formato raw não suportado. Envie HTML ou JSON válido do BEM." });
      }
    }

    if (parsed) {
      // 2. Compare and find newly advanced/transferred athletes
      const newTransfersByCategory: { [categoryName: string]: { plate: string, fullName: string, transfer: string, state: string }[] } = {};
      
      if (currentState && currentState.event && currentState.event.categories) {
        for (const cat of currentState.event.categories) {
          for (const ath of cat.athletes) {
            if (ath.transfer && ath.transfer.trim() !== "") {
              const oldVal = oldTransfers[`${cat.categoryName}_${ath.plate}`];
              if (!oldVal || oldVal.trim() !== ath.transfer.trim()) {
                if (!newTransfersByCategory[cat.categoryName]) {
                  newTransfersByCategory[cat.categoryName] = [];
                }
                newTransfersByCategory[cat.categoryName].push({
                  plate: ath.plate,
                  fullName: ath.fullName || `${ath.firstName} ${ath.lastName}`,
                  transfer: ath.transfer,
                  state: ath.state || "BRA"
                });
              }
            }
          }
        }
      }

      // Generate notifications only for specific event reports as requested
      let generatedNotifications: any[] = [];

      const fnLower = fileLabel.toLowerCase();
      const rtLower = reportParsedType.toLowerCase();

      const isEntries = fnLower.includes("inscrito") || fnLower.includes("entry") || fnLower.includes("entries") || fnLower.includes("piloto") || rtLower.includes("entry") || rtLower.includes("entries") || rtLower.includes("inscrito");
      const isDraws = fnLower.includes("sorteio") || fnLower.includes("draw") || fnLower.includes("gate") || fnLower.includes("raia") || fnLower.includes("largada") || rtLower.includes("draw") || rtLower.includes("gate") || rtLower.includes("raia");
      
      const isMoto1 = fnLower.includes("moto1") || fnLower.includes("moto 1") || fnLower.includes("m1") || rtLower.includes("moto1") || rtLower.includes("moto 1") || rtLower.includes("m1");
      const isMoto2 = fnLower.includes("moto2") || fnLower.includes("moto 2") || fnLower.includes("m2") || rtLower.includes("moto2") || rtLower.includes("moto 2") || rtLower.includes("m2");
      const isMoto3 = fnLower.includes("moto3") || fnLower.includes("moto 3") || fnLower.includes("m3") || rtLower.includes("moto3") || rtLower.includes("moto 3") || rtLower.includes("m3");
      
      const isFinals = fnLower.includes("final") || fnLower.includes("geral") || fnLower.includes("overall") || fnLower.includes("classifica") || rtLower.includes("final") || rtLower.includes("geral") || rtLower.includes("overall") || rtLower.includes("classifica");

      // 1. Relatório de Inscritos
      if (isEntries) {
        generatedNotifications.push({
          id: Math.random().toString(),
          timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          title: `📝 Lista de Inscritos Confirmada`,
          message: `A lista oficial de inscritos (relatório de pilotos) foi importada e atualizada para todas as categorias no sistema.`,
          severity: "info" as const
        });
      }

      // 2. Sorteio de Raias
      if (isDraws) {
        generatedNotifications.push({
          id: Math.random().toString(),
          timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          title: `🚪 Sorteio de Raias (Gate) Disponível`,
          message: `O sorteio oficial de raias (posições de largada) para as baterias de todas as categorias já está disponível para consulta.`,
          severity: "info" as const
        });
      }

      // 3. Resultados Moto 1, Moto 2, Moto 3
      if (isMoto1) {
        generatedNotifications.push({
          id: Math.random().toString(),
          timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          title: `🏁 Resultados da Moto 1 Publicados`,
          message: `Os resultados oficiais da Moto 1 das baterias foram processados e atualizados em tempo real.`,
          severity: "info" as const
        });
      }
      if (isMoto2) {
        generatedNotifications.push({
          id: Math.random().toString(),
          timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          title: `🏁 Resultados da Moto 2 Publicados`,
          message: `Os resultados oficiais da Moto 2 das baterias foram processados e atualizados em tempo real.`,
          severity: "info" as const
        });
      }
      if (isMoto3) {
        generatedNotifications.push({
          id: Math.random().toString(),
          timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          title: `🏁 Resultados da Moto 3 Publicados`,
          message: `Os resultados oficiais da Moto 3 das baterias foram processados e atualizados em tempo real.`,
          severity: "info" as const
        });
      }

      // 4. Atletas que avançam de fase
      if (Object.keys(newTransfersByCategory).length > 0) {
        for (const [catName, pilots] of Object.entries(newTransfersByCategory)) {
          const pilotLines = pilots.map(p => `• Placa #${p.plate} - ${p.fullName} (${p.state}) -> ${getFriendlyTransferText(p.transfer)}`).join("\n");
          const firstTransfer = pilots[0].transfer.toUpperCase();
          let phaseTitle = "Classificados para Nova Fase";
          if (firstTransfer.startsWith('F')) {
            phaseTitle = "Finalistas Confirmados 🏆";
          } else if (firstTransfer.startsWith('S')) {
            phaseTitle = "Semifinalistas Confirmados";
          } else if (firstTransfer.startsWith('Q')) {
            phaseTitle = "Quarterfinalistas Confirmados";
          }

          generatedNotifications.push({
            id: Math.random().toString(),
            timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
            title: `${phaseTitle} - ${catName}`,
            message: `Os seguintes pilotos avançaram de fase nesta sincronização:\n${pilotLines}`,
            severity: "info" as const
          });
        }
      }

      // 5. Resultados Finais / Classificação Geral
      if (isFinals) {
        generatedNotifications.push({
          id: Math.random().toString(),
          timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          title: `🏆 Resultados Finais Consolidados`,
          message: `A classificação geral definitiva e posições finais da fase final foram calculadas e publicadas.`,
          severity: "info" as const
        });
      }

      // Only write to state and DB if we actually generated some notifications
      if (generatedNotifications.length > 0) {
        currentState.notifications = [...generatedNotifications, ...currentState.notifications].slice(0, 50);
        writeDB(currentState);
      }

      return res.json({
        success: true,
        message: `Sincronizado com sucesso! Tipo detetado: ${reportParsedType}`,
        syncStatus: currentState.syncStatus
      });
    }

    res.status(400).json({ error: "Não foi possível analisar o arquivo enviado." });
  } catch (err: any) {
    console.error("Erro processando sincronização BEM", err);
    res.status(500).json({ error: `Erro no servidor: ${err.message}` });
  }
});

// Delete results associated with a deleted filename
app.post("/api/delete-bem-file", (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: "O nome do arquivo é obrigatório para remoção." });
    }

    let currentState = readDB();
    currentState = removeFileResults(filename, currentState);

    const newNotif = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      title: `Arquivo Removido`,
      message: `O arquivo de resultados [${filename}] foi removido da pasta de sincronização local, e suas categorias/resultados foram limpos do site em tempo real.`,
      severity: "warning" as const
    };

    currentState.notifications = [newNotif, ...currentState.notifications].slice(0, 50);
    writeDB(currentState);

    res.json({ success: true, message: `Resultados do arquivo [${filename}] removidos com sucesso.` });
  } catch (err: any) {
    console.error("Erro processando remoção de arquivo BEM", err);
    res.status(500).json({ error: `Erro no servidor: ${err.message}` });
  }
});

// Reset Data Endpoint
app.post("/api/reset-data", (req, res) => {
  const defaultState = getDefaultRaceState();
  writeDB(defaultState);
  res.json({ success: true, message: "Dados restaurados para o padrão do campeonato brasileiro de BMX Cuiabá 2026." });
});

// Manager Login endpoint
app.post("/api/login", (req, res) => {
  const { username, password, type } = req.body;

  if (type === "manager") {
    // Elegant hardcoded organizer login
    if (username === "admin" && password === "assoeva10bmx") {
      return res.json({
        success: true,
        profile: {
          id: "m1",
          username: "admin",
          role: "admin",
          pilotName: "Coordenador de Prova"
        }
      });
    }
    return res.status(401).json({ error: "Credenciais de gerente inválidas." });
  } else if (type === "pilot") {
    // Validate pilot exists by plate and category
    const { username, category } = req.body;
    const plate = String(username || "").trim();
    const catName = String(category || "").trim();

    if (!plate || !catName) {
      return res.status(400).json({ error: "Número da placa e categoria são obrigatórios." });
    }

    const db = readDB();
    let foundPilot: any = null;
    let categoryFound = false;

    for (const cat of db.event.categories) {
      if (cat.categoryName.toLowerCase() === catName.toLowerCase()) {
        categoryFound = true;
        const p = cat.athletes.find((a: any) => a.plate === plate);
        if (p) {
          foundPilot = p;
          break;
        }
      }
    }

    if (foundPilot) {
      return res.json({
        success: true,
        profile: {
          id: `p_${foundPilot.plate}`,
          username: foundPilot.plate,
          role: "pilot",
          pilotPlate: foundPilot.plate,
          pilotName: foundPilot.fullName
        }
      });
    }

    if (!categoryFound) {
      return res.status(401).json({ error: `A categoria "${catName}" não foi localizada no sistema.` });
    }

    return res.status(401).json({ error: `Piloto com Placa #${plate} não encontrado na categoria "${catName}". Certifique-se de escolher a placa e categoria corretas.` });
  }

  res.status(400).json({ error: "Tipo de login inválido." });
});

// Notifications Endpoint
app.post("/api/notifications", (req, res) => {
  const { title, message, severity } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: "Campos obrigatórios: title, message" });
  }

  let db = readDB();
  const newNotif = {
    id: Math.random().toString(),
    timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    title,
    message,
    severity: (severity || "info") as any
  };

  db.notifications = [newNotif, ...db.notifications];
  writeDB(db);

  res.json({ success: true, notification: newNotif });
});

// Update schedule item status
app.post("/api/schedule/update", (req, res) => {
  const { id, status } = req.body;
  let db = readDB();
  const schedItem = db.schedule.find((s: any) => s.id === id);
  if (schedItem) {
    schedItem.status = status;
    
    // Auto-create warning notification for delay/completed
    if (status === "delayed") {
      const delayNotif = {
        id: Math.random().toString(),
        timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        title: `Atraso Declarado: ${schedItem.title}`,
        message: `A prova do cronograma '${schedItem.title}' (${schedItem.category}) foi sinalizada com ATRASO pela organização. Fiquem atentos à área técnica.`,
        severity: "alert" as const
      };
      db.notifications = [delayNotif, ...db.notifications];
    } else if (status === "ongoing") {
      const startNotif = {
        id: Math.random().toString(),
        timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        title: `Prova Iniciada: ${schedItem.title}`,
        message: `Atenção pilotos da categoria: ${schedItem.category}. A chamada para '${schedItem.title}' está em andamento.`,
        severity: "info" as const
      };
      db.notifications = [startNotif, ...db.notifications];
    }

    writeDB(db);
    return res.json({ success: true, schedule: db.schedule });
  }
  res.status(404).json({ error: "Item de cronograma não encontrado." });
});

// POWERSHELL SYNC SCRIPT GENERATION & DOWNLOAD
// Serves an executable PowerShell one-liner that downloads a loop monitoring C:\SISTEMA_BEM\Resultados
app.get("/api/sync-script", (req, res) => {
  const isLocal = req.headers.host?.includes("localhost") || req.headers.host?.includes("127.0.0.1") || req.headers.host?.includes("3000");
  const protocol = isLocal ? "http" : "https";
  const hostUrl = req.headers.host ? `${protocol}://${req.headers.host}` : "https://bmxbemonline.com.br";
  
  const psScriptContent = `# PowerShell BEM Resultados Synchronizer Script for Windows
# Campeonato Brasileiro de BMX 2026 - Cuiabá, MT

# Force TLS 1.2 for secure connection with Cloudflare/HTTPS
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$FolderToWatch = "C:\\SISTEMA_BEM\\Resultados"
$ServerUrl = "${hostUrl}/api/upload-bem"

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "    BEM BMX ONLINE - AUTOMATIC DESKTOP SYNCHRONIZER       " -ForegroundColor Yellow
Write-Host "    MODO: Sincronizacao Recursiva de Subpastas Ativa      " -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Monitorando pasta: $FolderToWatch" -ForegroundColor Cyan
Write-Host "Mandando resultados para: $ServerUrl" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green

# Create directory if it doesn't exist
if (!(Test-Path -Path $FolderToWatch)) {
    New-Item -ItemType Directory -Force -Path $FolderToWatch | Out-Null
    Write-Host "Pasta de Resultados criada automaticamente em $FolderToWatch" -ForegroundColor DarkGray
}

Write-Host "Escaneando subpastas..." -ForegroundColor DarkGray
$initialFiles = Get-ChildItem -Path $FolderToWatch -Recurse | Where-Object { !$_.PSIsContainer -and ($_.Extension -eq ".json" -or $_.Extension -eq ".html" -or $_.Extension -eq ".htm") }
Write-Host "Total de arquivos encontrados atualmente: $($initialFiles.Count)" -ForegroundColor Gray

foreach ($f in $initialFiles) {
    $rel = $f.FullName.Substring($FolderToWatch.Length)
    Write-Host "  [OK] Registrado: $rel" -ForegroundColor DarkGreen
}

Write-Host "\`nMonitor ativo! Exportacoes automaticas e relatorios em subpastas serao carregados instantaneamente." -ForegroundColor Cyan
Write-Host "Pressione CTRL+C para encerrar o sincronizador." -ForegroundColor Yellow

$tracker = @{}
$activeFiles = @{}

# Pre-populate active files with initial files
foreach ($f in $initialFiles) {
    $activeFiles[$f.FullName] = $f.Name
}

while ($true) {
    try {
        $files = Get-ChildItem -Path $FolderToWatch -Recurse | Where-Object { !$_.PSIsContainer -and ($_.Extension -eq ".json" -or $_.Extension -eq ".html" -or $_.Extension -eq ".htm") }
        
        # 1. Detect and upload new or modified files
        foreach ($file in $files) {
            $lastWrite = $file.LastWriteTime.ToString()
            $mKey = "$($file.FullName)_$($lastWrite)"
            
            if (!$tracker.ContainsKey($mKey)) {
                $relPath = $file.FullName.Substring($FolderToWatch.Length)
                Write-Host "\`n[$(Get-Date -Format 'HH:mm:ss')] Novo arquivo detetado: $relPath" -ForegroundColor Yellow
                
                # Attempt to read file with retries (in case BEM has file locked during write)
                $readSuccess = $false
                $content = ""
                for ($i = 1; $i -le 3; $i++) {
                    try {
                        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
                        $readSuccess = $true
                        break
                    } catch {
                        Start-Sleep -Milliseconds 250
                    }
                }
                
                if ($readSuccess) {
                    $body = @{
                        filename = $file.Name
                        content = $content
                        type = $file.Extension
                    } | ConvertTo-Json
                    
                    Write-Host "Enviando arquivo para o Painel Online..." -ForegroundColor DarkGray
                    $response = Invoke-RestMethod -Uri $ServerUrl -Method Post -Body $body -ContentType "application/json; charset=utf-8"
                    
                    if ($response.success -eq $true) {
                        Write-Host "Sincronizado! $($response.message)" -ForegroundColor Green
                        $activeFiles[$file.FullName] = $file.Name
                    } else {
                        Write-Host "Erro retornado do servidor: $($response.error)" -ForegroundColor Red
                    }
                    $tracker[$mKey] = $true
                } else {
                    Write-Host "Aviso: Nao foi possivel abrir o arquivo $($file.Name) para leitura (em uso pelo BEM)." -ForegroundColor DarkMagenta
                }
            }
        }

        # 2. Detect deleted files
        $currentFullPaths = $files | ForEach-Object { $_.FullName }
        $deletedPaths = @()

        foreach ($storedPath in $activeFiles.Keys) {
            if ($currentFullPaths -notcontains $storedPath) {
                $deletedPaths += $storedPath
            }
        }

        foreach ($delPath in $deletedPaths) {
            $delName = $activeFiles[$delPath]
            Write-Host "\`n[$(Get-Date -Format 'HH:mm:ss')] Arquivo removido localmente: $delName" -ForegroundColor Yellow
            
            # Notify server of deletion
            $delBody = @{
                filename = $delName
            } | ConvertTo-Json
            
            try {
                Write-Host "Notificando servidor sobre remocao..." -ForegroundColor DarkGray
                $delResponse = Invoke-RestMethod -Uri "${hostUrl}/api/delete-bem-file" -Method Post -Body $delBody -ContentType "application/json; charset=utf-8"
                if ($delResponse.success -eq $true) {
                    Write-Host "Removido do site com sucesso!" -ForegroundColor Green
                } else {
                    Write-Host "Erro ao remover do site: $($delResponse.error)" -ForegroundColor Red
                }
            } catch {
                Write-Host "Falha na conexao para remocao: $_" -ForegroundColor Red
            }
            
            $activeFiles.Remove($delPath)
            
            # Clean up from tracker
            $keysToRemove = $tracker.Keys | Where-Object { $_ -like "$delPath*" }
            foreach ($k in $keysToRemove) {
                $tracker.Remove($k)
            }
        }
    } catch {
        Write-Host "Erro no loop de sincronia: $_" -ForegroundColor Red
    }
    Start-Sleep -Seconds 3
}
`;

  res.setHeader("Content-Disposition", 'attachment; filename="sync_bem.ps1"');
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(psScriptContent);
});

// START MAIN ASYNC SERVER FUNCTION FOR VITE SERVICE IN DEV OR PROD
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Servir arquivos estáticos (CSS, JS, imagens) com cache de 1 dia (estão hasheados)
    app.use(express.static(distPath, {
      maxAge: "1d",
      index: false
    }));
    // Servir o index.html com cabeçalhos de controle de cache para evitar cache no navegador
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BEM BMX Server running dynamically on http://localhost:${PORT}`);
  });
}

startServer();
