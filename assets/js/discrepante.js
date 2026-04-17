(() => {
  "use strict";

  const CSV_PATHS = [
    "./assets/data/Discrepante.csv",
    "./assets/data/discrepante.csv",
    "/assets/data/Discrepante.csv",
    "/assets/data/discrepante.csv"
  ];

  /** @type {Map<number, {A:number,B:number,C:number,D:number,E:number}> | null} */
  let table = null;

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

  function toInt(v) {
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  /**
   * @param {string} csvText
   * @returns {Map<number, {A:number,B:number,C:number,D:number,E:number}>}
   */
  function parseDiscrepanteCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter((ln) => ln.length > 0);
    if (!lines.length) throw new Error("Discrepante CSV: empty.");

    const header = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
    const idxTotal = header.indexOf("total");
    const idxA = header.indexOf("a");
    const idxB = header.indexOf("b");
    const idxC = header.indexOf("c");
    const idxD = header.indexOf("d");
    const idxE = header.indexOf("e");
    if ([idxTotal, idxA, idxB, idxC, idxD, idxE].some((i) => i < 0)) {
      throw new Error("Discrepante CSV: expected header total,A,B,C,D,E.");
    }

    /** @type {Map<number, {A:number,B:number,C:number,D:number,E:number}>} */
    const map = new Map();

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const total = toInt(cells[idxTotal]);
      const A = toInt(cells[idxA]);
      const B = toInt(cells[idxB]);
      const C = toInt(cells[idxC]);
      const D = toInt(cells[idxD]);
      const E = toInt(cells[idxE]);
      if (total == null || A == null || B == null || C == null || D == null || E == null) continue;
      map.set(total, { A, B, C, D, E });
    }

    return map;
  }

  async function loadDiscrepanteCsv() {
    let lastErr = /** @type {Error | null} */ (null);
    for (const path of CSV_PATHS) {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) continue;
        const text = await res.text();
        const parsed = parseDiscrepanteCsv(text);
        table = parsed;
        return parsed;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }
    console.error("[Discrepante CSV] Failed to load:", lastErr);
    throw lastErr || new Error("Discrepante CSV: fetch failed for all paths.");
  }

  const ready = loadDiscrepanteCsv()
    .then((parsed) => {
      queueMicrotask(() => {
        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new CustomEvent("discrepanteLoaded", { detail: { ok: true } }));
        }
      });
      return parsed;
    })
    .catch((err) => {
      table = null;
      queueMicrotask(() => {
        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(
            new CustomEvent("discrepanteLoaded", { detail: { ok: false, error: String(err) } })
          );
        }
      });
    });

  window.Discrepante = {
    ready,
    /**
     * @param {number} total
     */
    getExpected(total) {
      if (!table) return null;
      return table.get(Number(total)) || null;
    },
    _getTable() {
      return table;
    }
  };
})();

