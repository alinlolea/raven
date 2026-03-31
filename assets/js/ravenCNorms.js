(() => {
  "use strict";

  const CSV_PATHS = [
    "./assets/data/RavenC.csv",
    "./assets/data/ravenc.csv",
    "/assets/data/RavenC.csv",
    "/assets/data/ravenc.csv"
  ];

  /** @typedef {{ label: string, iqHeader: string, monthBounds: { min: number, max: number } | null }} RavenCAgeGroup */
  /** @typedef {{ rawCell: string, rawMin: number, rawMax: number, agePairs: { percentile: string, iq: string }[] }} RavenCNormRow */
  /** @typedef {{ headerRow: string[], ageGroups: RavenCAgeGroup[], rows: RavenCNormRow[] }} RavenCNormsTables */

  /** @type {RavenCNormsTables | null} */
  let tables = null;

  function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (!inQuotes && c === ",") {
        out.push(cur.trim());
        cur = "";
      } else cur += c;
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
   * Maps CSV age column labels to inclusive total-month bounds.
   * Reused logic from ravenNorms.js (supports 3(9) - 4(2), 8+, etc).
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
    // RavenC: first column is "Scor brut"
    return a.includes("scor") && a.includes("brut");
  }

  /**
   * @param {string} csvText
   * @returns {RavenCNormsTables}
   */
  function parseRavenCCsv(csvText) {
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
      throw new Error("RavenC CSV: could not find header row (Scor brut).");
    }

    const rest = headerCells.length - 1;
    if (rest < 2 || rest % 2 !== 0) {
      throw new Error("RavenC CSV: age columns must be percentile/IQ pairs after raw score.");
    }

    /** @type {RavenCAgeGroup[]} */
    const ageGroups = [];
    for (let c = 1; c < headerCells.length; c += 2) {
      const lab = headerCells[c] || "";
      const bounds = parseAgeLabelToMonthBounds(lab);
      if (!bounds) console.warn("[RavenC CSV] Could not parse age label:", lab);
      ageGroups.push({
        label: lab,
        iqHeader: headerCells[c + 1] || "",
        monthBounds: bounds
      });
    }

    /** @type {RavenCNormRow[]} */
    const rows = [];
    for (let r = headerIdx + 1; r < lines.length; r++) {
      const cells = parseCsvLine(lines[r]);
      if (cells.length < 1 || cells.every((x) => x === "")) continue;

      const rawCell = cells[0] || "";
      const bounds = parseInclusiveRange(rawCell);
      if (!bounds) continue;

      /** @type {{ percentile: string, iq: string }[]} */
      const agePairs = [];
      for (let g = 0; g < ageGroups.length; g++) {
        const pCol = 1 + g * 2;
        const iCol = 2 + g * 2;
        agePairs.push({
          percentile: cells[pCol] != null ? String(cells[pCol]) : "",
          iq: cells[iCol] != null ? String(cells[iCol]) : ""
        });
      }

      rows.push({ rawCell, rawMin: bounds.min, rawMax: bounds.max, agePairs });
    }

    return { headerRow: headerCells, ageGroups, rows };
  }

  /**
   * @param {RavenCNormRow[]} rows
   * @param {number} rawScore
   * @returns {RavenCNormRow | null}
   */
  function findRowForRawScore(rows, rawScore) {
    const raw = Number(rawScore);
    if (!Number.isFinite(raw)) return null;
    for (const row of rows) {
      if (raw >= row.rawMin && raw <= row.rawMax) return row;
    }
    return null;
  }

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

  /**
   * @param {number} rawScore
   * @param {number} ageIndex
   * @returns {{ percentile: string, iq: string, ageLabel: string } | null}
   */
  function getResult(rawScore, ageIndex) {
    if (!tables) return null;
    const idx = Number(ageIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= tables.ageGroups.length) return null;

    const row = findRowForRawScore(tables.rows, rawScore);
    if (!row) return null;

    const pair = row.agePairs[idx];
    if (!pair) return null;
    return {
      percentile: pair.percentile,
      iq: pair.iq,
      ageLabel: tables.ageGroups[idx].label
    };
  }

  async function loadRavenCCsv() {
    let lastErr = /** @type {Error | null} */ (null);
    for (const path of CSV_PATHS) {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) continue;
        const text = await res.text();
        const parsed = parseRavenCCsv(text);
        tables = parsed;
        return parsed;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }
    console.error("[RavenC CSV] Failed to load:", lastErr);
    throw lastErr || new Error("RavenC CSV: fetch failed for all paths.");
  }

  const ready = loadRavenCCsv()
    .then((parsed) => {
      queueMicrotask(() => {
        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new CustomEvent("ravenCNormsLoaded", { detail: { ok: true } }));
        }
      });
      return parsed;
    })
    .catch((err) => {
      tables = null;
      queueMicrotask(() => {
        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(
            new CustomEvent("ravenCNormsLoaded", { detail: { ok: false, error: String(err) } })
          );
        }
      });
    });

  window.RavenCNorms = {
    ready,
    getResult,
    getAgeIndexForTotalMonths,
    _getTables() {
      return tables;
    }
  };
})();

