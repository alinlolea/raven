(() => {
  "use strict";

  const FACTORS = ["h", "s", "e", "hy", "k", "p", "d", "m"];
  const SLOTS_PER_ZONE = 12;
  const VECTOR_ORDER = ["S", "P", "Sch", "C"];

  const ZONES = [
    { id: "fatadaSim", plane: "fatada", polarity: "sim", title: "Fațadă — Simpatici" },
    { id: "fatadaAnti", plane: "fatada", polarity: "anti", title: "Fațadă — Antipatici" },
    { id: "culisaSim", plane: "culisa", polarity: "sim", title: "Culisa — Simpatici" },
    { id: "culisaAnti", plane: "culisa", polarity: "anti", title: "Culisa — Antipatici" }
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
    return new Array(SLOTS_PER_ZONE).fill("");
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

  function firstEmptyIndex(slots) {
    return slots.findIndex((v) => !v);
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

    // Client data
    const formSec = el("section", "section formSection");
    formSec.appendChild(sectionHeader("Date client", "Obligatoriu: nume și sex. Vârsta e opțională."));

    const grid = el("div", "szondiClientGrid");
    grid.appendChild(fieldText("szondiName", "Nume", "e.g. Maria Popescu"));
    grid.appendChild(fieldSex());
    grid.appendChild(fieldText("szondiAge", "Vârstă (ani)", "ex. 34", "numeric"));
    formSec.appendChild(grid);
    root.appendChild(formSec);

    // Answers
    const ansSec = el("section", "section");
    ansSec.appendChild(
      sectionHeader(
        "Selecții factori",
        "Apasă o literă pentru a o adăuga în următorul slot gol. Apasă un slot pentru a-l șterge."
      )
    );
    const zonesWrap = el("div", "szondiZones");
    zonesWrap.id = "szondiZones";
    for (const z of ZONES) zonesWrap.appendChild(buildZoneCard(z));
    ansSec.appendChild(zonesWrap);
    root.appendChild(ansSec);

    // Charts
    const chartSec = el("section", "section");
    chartSec.appendChild(sectionHeader("Profil grafic", "Se actualizează în timp real."));
    const charts = el("div", "szondiCharts");
    charts.appendChild(buildChartShell("fatada", "Fațadă"));
    charts.appendChild(buildChartShell("culisa", "Culisa"));
    chartSec.appendChild(charts);
    root.appendChild(chartSec);

    // Profile texts
    const profSec = el("section", "section");
    profSec.appendChild(sectionHeader("Tabloul profilului", "Interpretări din vectori, pe Fațadă și Culisa."));
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
    h.appendChild(el("div", "sectionHint", hint));
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

  function buildZoneCard(zone) {
    const card = el("div", "szondiZoneCard");
    card.dataset.zoneId = zone.id;
    card.appendChild(el("div", "szondiZoneTitle", zone.title));

    const factors = el("div", "szondiFactorRow");
    for (const f of FACTORS) {
      const btn = el("button", "szondiFactorBtn", f);
      btn.type = "button";
      btn.title = `Adaugă ${f}`;
      btn.addEventListener("click", () => addFactor(zone.id, f));
      factors.appendChild(btn);
    }
    const clear = el("button", "szondiFactorBtn szondiFactorBtn--clear", "Șterge");
    clear.type = "button";
    clear.title = "Șterge ultima selecție";
    clear.addEventListener("click", () => removeLast(zone.id));
    factors.appendChild(clear);
    card.appendChild(factors);

    const slots = el("div", "szondiSlots");
    slots.id = `szondi-slots-${zone.id}`;
    for (let i = 0; i < SLOTS_PER_ZONE; i++) {
      const slot = el("button", "szondiSlot", "·");
      slot.type = "button";
      slot.dataset.slotIndex = String(i);
      slot.addEventListener("click", () => clearSlot(zone.id, i));
      slots.appendChild(slot);
    }
    card.appendChild(slots);

    const meta = el("div", "szondiZoneMeta");
    meta.id = `szondi-meta-${zone.id}`;
    meta.textContent = "0 / 12";
    card.appendChild(meta);
    return card;
  }

  function addFactor(zoneId, factor) {
    const slots = state.zones[zoneId];
    const idx = firstEmptyIndex(slots);
    if (idx < 0) return;
    slots[idx] = factor;
    refresh();
  }

  function clearSlot(zoneId, index) {
    state.zones[zoneId][index] = "";
    refresh();
  }

  function removeLast(zoneId) {
    const slots = state.zones[zoneId];
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i]) {
        slots[i] = "";
        break;
      }
    }
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

    // Classic Szondi: +6..+1 above, then labels, then -1..-6 below
    const rows = [];
    for (let level = 6; level >= 1; level--) {
      rows.push({ kind: "pos", level });
    }
    rows.push({ kind: "label" });
    for (let level = 1; level <= 6; level++) {
      rows.push({ kind: "neg", level });
    }

    table.innerHTML = "";
    table.style.gridTemplateColumns = `28px repeat(${FACTORS.length}, minmax(0, 1fr))`;

    for (const row of rows) {
      if (row.kind === "label") {
        table.appendChild(el("div", "szondiChartAxis", "0"));
        for (const f of FACTORS) {
          const cell = el("div", "szondiChartFactor", f);
          table.appendChild(cell);
        }
        continue;
      }
      const axis = el(
        "div",
        "szondiChartAxis",
        row.kind === "pos" ? `+${row.level}` : `-${row.level}`
      );
      table.appendChild(axis);
      for (const f of FACTORS) {
        const cell = el("div", "szondiChartCell");
        const n = row.kind === "pos" ? factors[f].sim : factors[f].anti;
        if (n >= row.level) cell.textContent = "×";
        if (row.kind === "pos") cell.classList.add("is-pos");
        else cell.classList.add("is-neg");
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

  function renderSlots() {
    for (const z of ZONES) {
      const slotsEl = document.getElementById(`szondi-slots-${z.id}`);
      const meta = document.getElementById(`szondi-meta-${z.id}`);
      const slots = state.zones[z.id];
      if (!slotsEl) continue;
      const buttons = slotsEl.querySelectorAll(".szondiSlot");
      let filled = 0;
      buttons.forEach((btn, i) => {
        const v = slots[i];
        btn.textContent = v || "·";
        btn.classList.toggle("is-filled", Boolean(v));
        if (v) filled += 1;
      });
      if (meta) meta.textContent = `${filled} / ${SLOTS_PER_ZONE}`;
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
        const body = el("div", "szondiProfileBody", item.text || "Completează selecțiile pentru a genera interpretarea.");
        if (!item.text) body.classList.add("is-empty");
        card.appendChild(body);
        col.appendChild(card);
      }
      grid.appendChild(col);
    }
  }

  function refresh() {
    if (!mounted) return;
    renderSlots();
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
    // Re-bind back button after mount (app.js uses data-nav-home at attach time)
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
