(() => {
  "use strict";

  const FACTORS = ["h", "s", "e", "hy", "k", "p", "d", "m"];
  /** 6 series × 2 simpatici + 2 antipatici = 24 entries per plane */
  const SERIES_ROWS = 6;
  const PAIR_SIZE = 2;
  const SLOTS_PER_POLARITY = SERIES_ROWS * PAIR_SIZE;
  const SLOTS_PER_PLANE = SLOTS_PER_POLARITY * 2;
  /** 6 series × 1 photo per factor = max 6 images of each letter in the set. */
  const MAX_PER_FACTOR = 6;
  const VECTOR_ORDER = ["S", "P", "Sch", "C"];

  const PLANES = [
    { id: "fatada", title: "Fațadă", sim: "fatadaSim", anti: "fatadaAnti" },
    { id: "culisa", title: "Culisa", sim: "culisaSim", anti: "culisaAnti" }
  ];

  /** @type {any} */
  let vectoriData = null;
  /** @type {boolean} */
  let mounted = false;

  const state = {
    name: "",
    sex: "",
    age: "",
    zones: {
      fatadaSim: emptySlots(),
      fatadaAnti: emptySlots(),
      culisaSim: emptySlots(),
      culisaAnti: emptySlots()
    }
  };

  function emptySlots() {
    return new Array(SLOTS_PER_POLARITY).fill("");
  }

  /**
   * Sign mapping identical to Excel Formule!F29 (and siblings).
   * @param {number} sim
   * @param {number} anti
   * @returns {string}
   */
  function factorSign(sim, anti) {
    const s = Number(sim) || 0;
    const a = Number(anti) || 0;
    const key = `${s}/${a}`;
    const map = {
      "0/0": "0",
      "0/1": "0",
      "1/0": "0",
      "1/1": "0",
      "1/2": "-",
      "1/3": "-",
      "0/2": "-",
      "0/3": "-",
      "2/1": "+",
      "3/1": "+",
      "2/0": "+",
      "3/0": "+",
      "2/2": "+/-",
      "3/2": "+/-",
      "2/3": "+/-",
      "3/3": "+/-",
      "0/4": "-",
      "1/4": "-",
      "2/4": "-",
      "4/0": "+",
      "4/1": "+",
      "4/2": "+",
      "0/5": "-",
      "1/5": "-",
      "5/0": "+",
      "5/1": "+",
      "0/6": "-",
      "6/0": "+"
    };
    return map[key] || "";
  }

  function countFactors(slots) {
    /** @type {Record<string, number>} */
    const counts = Object.fromEntries(FACTORS.map((f) => [f, 0]));
    for (const v of slots) {
      const t = String(v || "").trim().toLowerCase();
      if (t && Object.prototype.hasOwnProperty.call(counts, t)) counts[t] += 1;
    }
    return counts;
  }

  function computePlane(simSlots, antiSlots) {
    const sim = countFactors(simSlots);
    const anti = countFactors(antiSlots);
    /** @type {Record<string, { sim: number, anti: number, sign: string }>} */
    const factors = {};
    for (const f of FACTORS) {
      factors[f] = {
        sim: sim[f],
        anti: anti[f],
        sign: factorSign(sim[f], anti[f])
      };
    }
    return factors;
  }

  function normSign(v) {
    if (v === 0 || v === "0") return "0";
    return String(v ?? "").trim();
  }

  function lookupVectorText(vectorKey, signA, signB) {
    if (!vectoriData || !vectoriData[vectorKey]) return "";
    const a = normSign(signA);
    const b = normSign(signB);
    if (!a || !b) return "";
    const entry = vectoriData[vectorKey].entries.find(
      (e) => normSign(e.a) === a && normSign(e.b) === b
    );
    return entry ? entry.text : "";
  }

  function buildProfile(planeFactors) {
    const pairs = {
      S: ["h", "s"],
      P: ["e", "hy"],
      Sch: ["k", "p"],
      C: ["d", "m"]
    };
    /** @type {Record<string, { signs: string[], text: string, label: string }>} */
    const out = {};
    for (const key of VECTOR_ORDER) {
      const [fa, fb] = pairs[key];
      const sa = planeFactors[fa].sign;
      const sb = planeFactors[fb].sign;
      out[key] = {
        signs: [sa, sb],
        text: lookupVectorText(key, sa, sb),
        label: vectoriData?.[key]?.label || key
      };
    }
    return out;
  }

  function computeAll() {
    const fatada = computePlane(state.zones.fatadaSim, state.zones.fatadaAnti);
    const culisa = computePlane(state.zones.culisaSim, state.zones.culisaAnti);
    return {
      fatada,
      culisa,
      profileFatada: buildProfile(fatada),
      profileCulisa: buildProfile(culisa)
    };
  }

  async function loadVectori() {
    if (vectoriData) return vectoriData;
    const res = await fetch("./assets/data/szondi-vectori.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Nu pot încărca dicționarul Vectori Szondi.");
    vectoriData = await res.json();
    return vectoriData;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function getPlane(planeId) {
    return PLANES.find((p) => p.id === planeId) || null;
  }

  /** Natural fill order: each series row = 2 sim then 2 anti (left → right). */
  function planeFillOrder(plane) {
    /** @type {{ zoneId: string, index: number, polarity: "sim"|"anti", row: number, pairIndex: number }[]} */
    const order = [];
    for (let row = 0; row < SERIES_ROWS; row++) {
      for (let i = 0; i < PAIR_SIZE; i++) {
        order.push({
          zoneId: plane.sim,
          index: row * PAIR_SIZE + i,
          polarity: "sim",
          row,
          pairIndex: i
        });
      }
      for (let i = 0; i < PAIR_SIZE; i++) {
        order.push({
          zoneId: plane.anti,
          index: row * PAIR_SIZE + i,
          polarity: "anti",
          row,
          pairIndex: i
        });
      }
    }
    return order;
  }

  function nextPointer(plane) {
    return planeFillOrder(plane).find((p) => !state.zones[p.zoneId][p.index]) || null;
  }

  function countFilledOnPlane(plane) {
    return planeFillOrder(plane).filter((p) => state.zones[p.zoneId][p.index]).length;
  }

  function countFactorOnPlane(planeId, factor) {
    const plane = getPlane(planeId);
    if (!plane) return 0;
    let n = 0;
    for (const key of [plane.sim, plane.anti]) {
      for (const v of state.zones[key]) {
        if (v === factor) n += 1;
      }
    }
    return n;
  }

  function planeLabel(planeId) {
    const p = getPlane(planeId);
    return p ? p.title : planeId;
  }

  function setNotice(message, kind) {
    const box = document.getElementById("szondiNotice");
    if (!box) return;
    box.textContent = message || "";
    box.hidden = !message;
    box.classList.toggle("is-error", kind === "error");
    box.classList.toggle("is-warn", kind === "warn");
  }

  function mount(root) {
    if (!root || mounted) return;
    root.innerHTML = "";

    const nav = el("div", "viewNav");
    const back = el("button", "btnBack", "← Înapoi la teste");
    back.type = "button";
    back.setAttribute("data-nav-home", "");
    nav.appendChild(back);
    nav.appendChild(el("div", "viewNavTitle", "SZONDI"));
    root.appendChild(nav);

    const formSec = el("section", "section formSection");
    formSec.appendChild(sectionHeader("Date client"));
    const grid = el("div", "szondiClientGrid");
    grid.appendChild(fieldText("szondiName", "Nume", "e.g. Maria Popescu"));
    grid.appendChild(fieldSex());
    grid.appendChild(fieldText("szondiAge", "Vârstă (ani)", "ex. 34", "numeric"));
    formSec.appendChild(grid);
    root.appendChild(formSec);

    const ansSec = el("section", "section");
    const notice = el("div", "szondiNotice");
    notice.id = "szondiNotice";
    notice.hidden = true;
    notice.setAttribute("role", "status");
    ansSec.appendChild(notice);

    const planesWrap = el("div", "szondiPlanes");
    planesWrap.id = "szondiPlanes";
    for (const plane of PLANES) planesWrap.appendChild(buildPlaneCard(plane));
    ansSec.appendChild(planesWrap);
    root.appendChild(ansSec);

    const chartSec = el("section", "section");
    chartSec.appendChild(sectionHeader("Profil grafic"));
    const charts = el("div", "szondiCharts");
    charts.appendChild(buildChartShell("fatada", "Fațadă"));
    charts.appendChild(buildChartShell("culisa", "Culisa"));
    chartSec.appendChild(charts);
    root.appendChild(chartSec);

    const profSec = el("section", "section");
    profSec.appendChild(sectionHeader("Tabloul profilului"));
    const profGrid = el("div", "szondiProfileGrid");
    profGrid.id = "szondiProfileGrid";
    profSec.appendChild(profGrid);
    root.appendChild(profSec);

    bindClientFields(root);
    mounted = true;
    refresh();
  }

  function sectionHeader(title, hint) {
    const h = el("div", "sectionHeader");
    h.appendChild(el("div", "sectionTitle", title));
    if (hint) h.appendChild(el("div", "sectionHint", hint));
    return h;
  }

  function fieldText(id, label, placeholder, inputMode) {
    const wrap = el("div", "field");
    const lab = el("label", "label", label);
    lab.setAttribute("for", id);
    const input = el("input", "input");
    input.id = id;
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = placeholder || "";
    if (inputMode) input.inputMode = inputMode;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  function fieldSex() {
    const wrap = el("div", "field");
    wrap.appendChild(el("div", "label", "Sex"));
    const row = el("div", "szondiSexRow");
    for (const s of ["M", "F"]) {
      const btn = el("button", "szondiSexBtn", s);
      btn.type = "button";
      btn.dataset.sex = s;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        state.sex = s;
        row.querySelectorAll(".szondiSexBtn").forEach((b) => {
          const on = b.getAttribute("data-sex") === s;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        refresh();
      });
      row.appendChild(btn);
    }
    wrap.appendChild(row);
    return wrap;
  }

  function bindClientFields(root) {
    const name = root.querySelector("#szondiName");
    const age = root.querySelector("#szondiAge");
    if (name) {
      name.addEventListener("input", () => {
        state.name = name.value;
      });
    }
    if (age) {
      age.addEventListener("input", () => {
        age.value = age.value.replace(/\D/g, "").slice(0, 3);
        state.age = age.value;
      });
    }
  }

  function buildPlaneCard(plane) {
    const card = el("div", "szondiPlaneCard");
    card.dataset.planeId = plane.id;

    const head = el("div", "szondiPlaneHead");
    head.appendChild(el("div", "szondiPlaneTitle", plane.title));
    const meta = el("div", "szondiPlaneMeta");
    meta.id = `szondi-meta-${plane.id}`;
    meta.textContent = `0 / ${SLOTS_PER_PLANE}`;
    head.appendChild(meta);
    card.appendChild(head);

    const toolbar = el("div", "szondiToolbar");
    const factors = el("div", "szondiFactorBar");
    factors.id = `szondi-factors-${plane.id}`;
    for (const f of FACTORS) {
      const btn = el("button", "szondiFactorBtn", f);
      btn.type = "button";
      btn.dataset.factor = f;
      btn.addEventListener("click", () => addFactor(plane.id, f));
      factors.appendChild(btn);
    }
    toolbar.appendChild(factors);

    const undo = el("button", "szondiUndoBtn", "Șterge");
    undo.type = "button";
    undo.title = "Șterge ultima selecție din acest plan";
    undo.addEventListener("click", () => removeLast(plane.id));
    toolbar.appendChild(undo);
    card.appendChild(toolbar);

    const grid = el("div", "szondiEntryGrid");
    const colHeads = el("div", "szondiColHeads");
    colHeads.appendChild(el("div", "szondiRowLabel", ""));
    const simHead = el("div", "szondiColHead szondiColHead--sim", "Simpatici");
    const antiHead = el("div", "szondiColHead szondiColHead--anti", "Antipatici");
    colHeads.appendChild(simHead);
    colHeads.appendChild(antiHead);
    grid.appendChild(colHeads);

    for (let row = 0; row < SERIES_ROWS; row++) {
      const rowEl = el("div", "szondiEntryRow");
      rowEl.appendChild(el("div", "szondiRowLabel", String(row + 1)));

      const simPair = el("div", "szondiPair szondiPair--sim");
      for (let i = 0; i < PAIR_SIZE; i++) {
        const index = row * PAIR_SIZE + i;
        simPair.appendChild(makeSlot(plane.sim, index, plane.id, "sim", row, i));
      }
      rowEl.appendChild(simPair);

      const antiPair = el("div", "szondiPair szondiPair--anti");
      for (let i = 0; i < PAIR_SIZE; i++) {
        const index = row * PAIR_SIZE + i;
        antiPair.appendChild(makeSlot(plane.anti, index, plane.id, "anti", row, i));
      }
      rowEl.appendChild(antiPair);

      grid.appendChild(rowEl);
    }

    card.appendChild(grid);
    return card;
  }

  function makeSlot(zoneId, index, planeId, polarity, row, pairIndex) {
    const slot = el("button", "szondiSlot", "");
    slot.type = "button";
    slot.dataset.zoneId = zoneId;
    slot.dataset.slotIndex = String(index);
    slot.dataset.planeId = planeId;
    slot.dataset.polarity = polarity;
    slot.dataset.row = String(row);
    slot.dataset.pairIndex = String(pairIndex);
    slot.setAttribute("aria-label", `${polarity} serie ${row + 1}`);
    slot.addEventListener("click", () => clearSlot(zoneId, index));
    return slot;
  }

  function addFactor(planeId, factor) {
    const plane = getPlane(planeId);
    if (!plane) return;

    const pointer = nextPointer(plane);
    if (!pointer) {
      setNotice(`${plane.title} este completă (${SLOTS_PER_PLANE}/${SLOTS_PER_PLANE}). Continuă cu ${planeId === "fatada" ? "Culisa" : "profilul"}.`, "warn");
      return;
    }

    const used = countFactorOnPlane(planeId, factor);
    if (used >= MAX_PER_FACTOR) {
      setNotice(
        `Nu poți adăuga încă un „${factor}” pe ${plane.title}: maxim ${MAX_PER_FACTOR} pe grafic (simpatice + antipatice).`,
        "error"
      );
      return;
    }

    state.zones[pointer.zoneId][pointer.index] = factor;
    const remaining = MAX_PER_FACTOR - used - 1;
    if (remaining === 0) {
      setNotice(`Limita pentru „${factor}” pe ${plane.title}: ${MAX_PER_FACTOR}/${MAX_PER_FACTOR}.`, "warn");
    } else {
      setNotice("");
    }
    refresh();
  }

  function clearSlot(zoneId, index) {
    if (!state.zones[zoneId][index]) return;
    state.zones[zoneId][index] = "";
    setNotice("");
    refresh();
  }

  function removeLast(planeId) {
    const plane = getPlane(planeId);
    if (!plane) return;
    const order = planeFillOrder(plane);
    for (let i = order.length - 1; i >= 0; i--) {
      const p = order[i];
      if (state.zones[p.zoneId][p.index]) {
        state.zones[p.zoneId][p.index] = "";
        break;
      }
    }
    setNotice("");
    refresh();
  }

  function buildChartShell(planeId, title) {
    const wrap = el("div", "szondiChartCard");
    wrap.appendChild(el("div", "szondiChartTitle", title));
    const table = el("div", "szondiChart");
    table.id = `szondi-chart-${planeId}`;
    wrap.appendChild(table);
    const signs = el("div", "szondiSignRow");
    signs.id = `szondi-signs-${planeId}`;
    wrap.appendChild(signs);
    return wrap;
  }

  function renderChart(planeId, factors) {
    const table = document.getElementById(`szondi-chart-${planeId}`);
    const signsEl = document.getElementById(`szondi-signs-${planeId}`);
    if (!table || !signsEl) return;

    const rows = [];
    for (let level = 6; level >= 1; level--) rows.push({ kind: "pos", level });
    rows.push({ kind: "label" });
    for (let level = 1; level <= 6; level++) rows.push({ kind: "neg", level });

    table.innerHTML = "";
    table.style.gridTemplateColumns = `28px repeat(${FACTORS.length}, minmax(0, 1fr))`;

    for (const row of rows) {
      if (row.kind === "label") {
        table.appendChild(el("div", "szondiChartAxis", "0"));
        for (const f of FACTORS) table.appendChild(el("div", "szondiChartFactor", f));
        continue;
      }
      table.appendChild(
        el("div", "szondiChartAxis", row.kind === "pos" ? `+${row.level}` : `-${row.level}`)
      );
      for (const f of FACTORS) {
        const cell = el("div", "szondiChartCell");
        const n = row.kind === "pos" ? factors[f].sim : factors[f].anti;
        if (n >= row.level) cell.textContent = "×";
        cell.classList.add(row.kind === "pos" ? "is-pos" : "is-neg");
        if (n >= row.level) cell.classList.add("is-filled");
        table.appendChild(cell);
      }
    }

    signsEl.innerHTML = "";
    for (const f of FACTORS) {
      const chip = el("div", "szondiSignChip");
      chip.innerHTML = `<strong>${f}</strong> ${factors[f].sign || "—"} <span class="szondiSignCounts">${factors[f].sim}/${factors[f].anti}</span>`;
      signsEl.appendChild(chip);
    }
  }

  function renderEntries() {
    for (const plane of PLANES) {
      const card = document.querySelector(`.szondiPlaneCard[data-plane-id="${plane.id}"]`);
      const meta = document.getElementById(`szondi-meta-${plane.id}`);
      if (!card) continue;

      const pointer = nextPointer(plane);
      const filled = countFilledOnPlane(plane);
      if (meta) meta.textContent = `${filled} / ${SLOTS_PER_PLANE}`;

      card.querySelectorAll(".szondiSlot").forEach((btn) => {
        const zoneId = btn.getAttribute("data-zone-id");
        const index = Number(btn.getAttribute("data-slot-index"));
        const v = state.zones[zoneId][index];
        btn.textContent = v || "";
        btn.classList.toggle("is-filled", Boolean(v));
        const isPointer =
          pointer &&
          pointer.zoneId === zoneId &&
          pointer.index === index;
        btn.classList.toggle("is-pointer", Boolean(isPointer));
      });

      card.querySelectorAll(".szondiFactorBtn[data-factor]").forEach((btn) => {
        const f = btn.getAttribute("data-factor");
        const used = countFactorOnPlane(plane.id, f);
        const atLimit = used >= MAX_PER_FACTOR;
        const full = !pointer;
        btn.classList.toggle("is-limited", atLimit);
        btn.disabled = atLimit || full;
        btn.title = atLimit
          ? `${f}: limită ${used}/${MAX_PER_FACTOR} pe ${plane.title}`
          : full
            ? `${plane.title} este completă`
            : `Adaugă ${f} (${used}/${MAX_PER_FACTOR})`;
      });
    }
  }

  function renderProfile(profileFatada, profileCulisa) {
    const grid = document.getElementById("szondiProfileGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const planes = [
      { title: "Fațadă", data: profileFatada },
      { title: "Culisa", data: profileCulisa }
    ];

    for (const plane of planes) {
      const col = el("div", "szondiProfileCol");
      col.appendChild(el("div", "szondiProfilePlane", plane.title));
      for (const key of VECTOR_ORDER) {
        const item = plane.data[key];
        const card = el("div", "szondiProfileCard");
        const head = el("div", "szondiProfileHead");
        const signs = (item.signs || []).filter(Boolean).join(" / ") || "—";
        head.innerHTML = `<span>${item.label}</span><span class="szondiProfileSigns">${signs}</span>`;
        card.appendChild(head);
        const body = el(
          "div",
          "szondiProfileBody",
          item.text || "Completează selecțiile pentru a genera interpretarea."
        );
        if (!item.text) body.classList.add("is-empty");
        card.appendChild(body);
        col.appendChild(card);
      }
      grid.appendChild(col);
    }
  }

  function refresh() {
    if (!mounted) return;
    renderEntries();
    const all = computeAll();
    renderChart("fatada", all.fatada);
    renderChart("culisa", all.culisa);
    renderProfile(all.profileFatada, all.profileCulisa);
  }

  async function open() {
    const root = document.getElementById("view-szondi");
    if (!root) return;
    try {
      await loadVectori();
    } catch (e) {
      console.error(e);
      root.innerHTML = "";
      root.appendChild(el("p", "placeholderLead", "Nu pot încărca datele Szondi. Reîncarcă aplicația online."));
      return;
    }
    if (!mounted) mount(root);
    root.querySelectorAll("[data-nav-home]").forEach((btn) => {
      btn.onclick = () => {
        if (window.DigitalEvaluation && typeof window.DigitalEvaluation.showHome === "function") {
          window.DigitalEvaluation.showHome();
        }
      };
    });
    refresh();
  }

  window.SzondiApp = {
    open,
    refresh,
    getState: () => state
  };
})();
