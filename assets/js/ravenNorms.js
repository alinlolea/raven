(() => {
  "use strict";

  const CSV_PATHS = [
    "/assets/data/raven.csv",
    "/assets/data/Raven.csv",
    "./assets/data/raven.csv",
    "./assets/data/Raven.csv"
  ];

  /** @type {RavenNormsTables | null} */
  let tables = null;

  /** @typedef {{ label: string, iqHeader: string, monthBounds: { min: number, max: number } | null }} RavenAgeGroup */
  /** @typedef {{ spmCRaw: string, spmPlusRaw: string, spmCMin: number, spmCMax: number, agePairs: { percentile: string, iq: string }[] }} RavenNormRow */
  /** @typedef {{ headerRow: string[], ageGroups: RavenAgeGroup[], rows: RavenNormRow[] }} RavenNormsTables */

  function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && c === ",") {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out;
  }

  /**
   * Parses "42", "40 - 41", "56 - 60" into inclusive numeric bounds.
   * @param {string} cell
   * @returns {{ min: number, max: number } | null}
   */
  function parseInclusiveRange(cell) {
    const s = String(cell).trim();
    if (!s) return null;
    const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return { min: n, max: n };
  }

  /**
   * Maps CSV age column labels to inclusive total-month bounds (see Raven norms header row).
   * @param {string} label
   * @returns {{ min: number, max: number } | null}
   */
  function parseAgeLabelToMonthBounds(label) {
    const s = String(label).trim().replace(/\s+/g, " ");
    if (!s) return null;

    let m = s.match(/^(\d+)\s*\+$/i);
    if (m) {
      const y = Number(m[1]);
      if (!Number.isFinite(y)) return null;
      return { min: y * 12, max: Number.POSITIVE_INFINITY };
    }

    m = s.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m && !s.includes("(")) {
      const y1 = Number(m[1]);
      const y2 = Number(m[2]);
      if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null;
      return { min: y1 * 12, max: y2 * 12 + 11 };
    }

    m = s.match(/^(\d+)\s*-\s*(\d+)\((\d+)\)$/);
    if (m) {
      const ya = Number(m[1]);
      const yb = Number(m[2]);
      const mo = Number(m[3]);
      if (!Number.isFinite(ya) || !Number.isFinite(yb) || !Number.isFinite(mo)) return null;
      return { min: ya * 12, max: yb * 12 + mo };
    }

    m = s.match(/^(\d+)\((\d+)\)\s*-\s*(\d+)\((\d+)\)$/);
    if (m) {
      const y1 = Number(m[1]);
      const mo1 = Number(m[2]);
      const y2 = Number(m[3]);
      const mo2 = Number(m[4]);
      if (!Number.isFinite(y1) || !Number.isFinite(mo1) || !Number.isFinite(y2) || !Number.isFinite(mo2)) return null;
      return { min: y1 * 12 + mo1, max: y2 * 12 + mo2 };
    }

    m = s.match(/^(\d+)\((\d+)\)\s*-\s*(\d+)$/);
    if (m) {
      const y1 = Number(m[1]);
      const mo1 = Number(m[2]);
      const y2 = Number(m[3]);
      if (!Number.isFinite(y1) || !Number.isFinite(mo1) || !Number.isFinite(y2)) return null;
      return { min: y1 * 12 + mo1, max: y2 * 12 + 11 };
    }

    return null;
  }

  function isHeaderRow(cells) {
    const a = (cells[0] || "").toLowerCase();
    const b = (cells[1] || "").toLowerCase();
    return (
      (a.includes("spm-c") || a.includes("spm c") || a.includes("scor brut")) &&
      (b.includes("spm") || b.includes("scor"))
    );
  }

  /**
   * @param {string} csvText
   * @returns {RavenNormsTables}
   */
  function parseRavenCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter((ln) => ln.length > 0);
    let headerIdx = -1;
    let headerCells = /** @type {string[]} */ ([]);

    for (let i = 0; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      if (isHeaderRow(cells)) {
        headerIdx = i;
        headerCells = cells;
        break;
      }
    }

    if (headerIdx < 0) {
      throw new Error("Raven CSV: could not find header row (SPM-C / SPM+).");
    }

    const rest = headerCells.length - 2;
    if (rest < 2 || rest % 2 !== 0) {
      throw new Error("Raven CSV: age columns must be percentile/IQ pairs after SPM+.");
    }

    /** @type {RavenAgeGroup[]} */
    const ageGroups = [];
    for (let c = 2; c < headerCells.length; c += 2) {
      const lab = headerCells[c] || "";
      const bounds = parseAgeLabelToMonthBounds(lab);
      if (!bounds) {
        console.warn("[Raven CSV] Could not parse age label:", lab);
      }
      ageGroups.push({
        label: lab,
        iqHeader: headerCells[c + 1] || "",
        monthBounds: bounds
      });
    }

    /** @type {RavenNormRow[]} */
    const rows = [];

    for (let r = headerIdx + 1; r < lines.length; r++) {
      const cells = parseCsvLine(lines[r]);
      if (cells.length < 2 || cells.every((x) => x === "")) continue;

      const spmCRaw = cells[0] || "";
      const spmPlusRaw = cells[1] || "";
      const bounds = parseInclusiveRange(spmCRaw);
      if (!bounds) continue;

      /** @type {{ percentile: string, iq: string }[]} */
      const agePairs = [];
      for (let g = 0; g < ageGroups.length; g++) {
        const pCol = 2 + g * 2;
        const iCol = 3 + g * 2;
        agePairs.push({
          percentile: cells[pCol] != null ? String(cells[pCol]) : "",
          iq: cells[iCol] != null ? String(cells[iCol]) : ""
        });
      }

      rows.push({
        spmCRaw,
        spmPlusRaw,
        spmCMin: bounds.min,
        spmCMax: bounds.max,
        agePairs
      });
    }

    return { headerRow: headerCells, ageGroups, rows };
  }

  /**
   * @param {RavenNormRow[]} rows
   * @param {number} rawScore
   * @returns {RavenNormRow | null}
   */
  function findRowForRawScore(rows, rawScore) {
    const raw = Number(rawScore);
    if (!Number.isFinite(raw)) return null;
    for (const row of rows) {
      if (raw >= row.spmCMin && raw <= row.spmCMax) return row;
    }
    return null;
  }

  /**
   * @param {number | string} spmPlus
   * @param {string} cell
   */
  function spmPlusMatchesCell(spmPlus, cell) {
    const bounds = parseInclusiveRange(cell);
    if (!bounds) return false;
    const n = typeof spmPlus === "number" ? spmPlus : Number(spmPlus);
    if (Number.isFinite(n)) {
      return n >= bounds.min && n <= bounds.max;
    }
    const s = String(spmPlus).trim().replace(/\s+/g, " ");
    return s === String(cell).trim();
  }

  /**
   * @param {RavenNormRow[]} rows
   * @param {number | string} spmPlus
   * @returns {RavenNormRow | null}
   */
  function findLastRowForSPMPlus(rows, spmPlus) {
    /** @type {RavenNormRow | null} */
    let last = null;
    for (const row of rows) {
      if (spmPlusMatchesCell(spmPlus, row.spmPlusRaw)) last = row;
    }
    return last;
  }

  /**
   * @param {RavenNormsTables} t
   * @param {number} rawScore
   * @returns {number | string | null}
   */
  function getSPMPlus(rawScore) {
    if (!tables) return null;
    const row = findRowForRawScore(tables.rows, rawScore);
    if (!row) return null;
    const cell = row.spmPlusRaw.trim();
    const single = parseInclusiveRange(cell);
    if (single && single.min === single.max) return single.min;
    return cell;
  }

  /**
   * @param {number | string} spmPlus
   * @param {number} ageIndex 0-based age group (first pair after SPM+ = 0)
   * @returns {{ percentile: string, iq: string, ageLabel: string } | null}
   */
  /**
   * @param {number} totalMonths
   * @returns {number} age column index, or -1 if no band matches
   */
  function getAgeIndexForTotalMonths(totalMonths) {
    if (!tables) return -1;
    const t = Number(totalMonths);
    if (!Number.isFinite(t)) return -1;
    for (let i = 0; i < tables.ageGroups.length; i++) {
      const b = tables.ageGroups[i].monthBounds;
      if (!b) continue;
      const max = Number.isFinite(b.max) ? b.max : Number.POSITIVE_INFINITY;
      if (t >= b.min && t <= max) return i;
    }
    return -1;
  }

  function getResult(spmPlus, ageIndex) {
    if (!tables) return null;
    const idx = Number(ageIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= tables.ageGroups.length) return null;

    const row = findLastRowForSPMPlus(tables.rows, spmPlus);
    if (!row) return null;

    const pair = row.agePairs[idx];
    if (!pair) return null;

    return {
      percentile: pair.percentile,
      iq: pair.iq,
      ageLabel: tables.ageGroups[idx].label
    };
  }

  /**
   * @param {RavenNormsTables} t
   */
  function logParsedStructure(t) {
    const sampleRows = t.rows.slice(0, 3).map((row) => ({
      spmC: row.spmCRaw,
      spmPlus: row.spmPlusRaw,
      firstAgePair: row.agePairs[0],
      lastAgePair: row.agePairs[row.agePairs.length - 1]
    }));

    const conversionTable = t.rows.map((row) => ({
      spmC: row.spmCRaw,
      spmPlus: row.spmPlusRaw
    }));

    const summary = {
      headerColumnCount: t.headerRow.length,
      ageGroupCount: t.ageGroups.length,
      ageGroupLabels: t.ageGroups.map((g) => ({ label: g.label, iqHeader: g.iqHeader })),
      dataRowCount: t.rows.length,
      conversionTable,
      sampleNormRows: sampleRows,
      lastDataRow: t.rows.length
        ? {
            spmC: t.rows[t.rows.length - 1].spmCRaw,
            spmPlus: t.rows[t.rows.length - 1].spmPlusRaw,
            pairs: t.rows[t.rows.length - 1].agePairs.length
          }
        : null
    };

    console.log("[Raven CSV] Parsed structure:", summary);
  }

  async function loadRavenCsv() {
    let lastErr = /** @type {Error | null} */ (null);
    for (const path of CSV_PATHS) {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) continue;
        const text = await res.text();
        const parsed = parseRavenCsv(text);
        tables = parsed;
        logParsedStructure(parsed);
        return parsed;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }
    console.error("[Raven CSV] Failed to load:", lastErr);
    throw lastErr || new Error("Raven CSV: fetch failed for all paths.");
  }

  const ready = loadRavenCsv().catch(() => {
    tables = null;
  });

  window.getSPMPlus = getSPMPlus;
  window.getResult = getResult;

  window.RavenNorms = {
    ready,
    getSPMPlus,
    getResult,
    getAgeIndexForTotalMonths,
    /** @returns {number} */
    getAgeGroupCount() {
      return tables ? tables.ageGroups.length : 0;
    },
    /** Exposed for tests / debugging */
    _getTables() {
      return tables;
    }
  };
})();
