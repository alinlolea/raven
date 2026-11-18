(() => {
  "use strict";

  const ITEM_COUNT = 54;

  /** @type {any} */
  let normsData = null;
  /** @type {boolean} */
  let mounted = false;

  const state = {
    name: "",
    sex: "",
    age: "",
    /** @type {(number|null)[]} */
    answers: new Array(ITEM_COUNT).fill(null)
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function sectionHeader(title, hint) {
    const h = el("div", "sectionHeader");
    h.appendChild(el("div", "sectionTitle", title));
    if (hint) h.appendChild(el("div", "sectionHint", hint));
    return h;
  }

  async function loadNorms() {
    if (normsData) return normsData;
    const res = await fetch("./assets/data/tscc-norms.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Nu pot încărca tabelele TSCC.");
    normsData = await res.json();
    return normsData;
  }

  function parseAgeYears() {
    const n = Number(String(state.age || "").trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  }

  function resolveAgeBand(ageYears) {
    if (ageYears == null || !normsData) return null;
    return (
      (normsData.ageBands || []).find(
        (b) => ageYears >= b.minAge && ageYears <= b.maxAge
      ) || null
    );
  }

  function getAnswer(itemNumber) {
    const idx = itemNumber - 1;
    if (idx < 0 || idx >= ITEM_COUNT) return null;
    return state.answers[idx];
  }

  function isBlank(itemNumber) {
    const v = getAnswer(itemNumber);
    return v === null || v === undefined || v === "";
  }

  /**
   * UND / HYP: count of flagged items (Excel COUNT of 1/"" cells).
   * Clinical / SC: SUM of item response values (0–3); blanks contribute 0.
   */
  function rawForScale(scale) {
    const items = scale.items || [];
    if (scale.kind === "validity") {
      let count = 0;
      for (const n of items) {
        const a = getAnswer(n);
        if (a === null || a === undefined || a === "") continue;
        if (scale.id === "UND" && Number(a) === 0) count += 1;
        if (scale.id === "HYP" && Number(a) === 3) count += 1;
      }
      return count;
    }
    let sum = 0;
    for (const n of items) {
      const a = getAnswer(n);
      if (a === null || a === undefined || a === "") continue;
      sum += Number(a) || 0;
    }
    return sum;
  }

  function missingForScale(scale) {
    let n = 0;
    for (const item of scale.items || []) {
      if (isBlank(item)) n += 1;
    }
    return n;
  }

  function scaleValidity(scale, missing) {
    if (scale.maxMissing == null) return null;
    return missing > scale.maxMissing ? "INVALID" : "VALID";
  }

  /**
   * Excel VLOOKUP(..., TRUE): largest raw <= score; empty T cells stay null.
   */
  function lookupT(tableRows, scaleId, raw) {
    if (!tableRows || !tableRows.length || raw == null || Number.isNaN(Number(raw))) {
      return null;
    }
    const score = Number(raw);
    let best = null;
    for (const row of tableRows) {
      if (Number(row.raw) <= score) best = row;
      else break;
    }
    if (!best) return null;
    const t = best[scaleId];
    return t == null || t === "" ? null : Number(t);
  }

  function tBandClass(scale, t) {
    if (t == null || !Number.isFinite(Number(t))) return "";
    const v = Number(t);
    const bands = normsData?.tBands || {};
    if (scale.id === "UND") {
      if (v >= 70) return "is-clinical";
      if (v >= 65) return "is-warn";
      return "";
    }
    if (scale.id === "HYP") {
      if (v > 89) return "is-clinical";
      if (v >= 75) return "is-warn";
      return "";
    }
    if (scale.kind === "sexual") {
      if (v > 69) return "is-clinical";
      return "";
    }
    // clinical scales: orange 50–65, red >65 (Excel between 50–65 + greaterThan 65)
    if (v > 65) return "is-clinical";
    if (v >= 50) return "is-warn";
    return "";
  }

  function compute() {
    const ageYears = parseAgeYears();
    const band = resolveAgeBand(ageYears);
    const sex = state.sex === "M" || state.sex === "F" ? state.sex : "";
    const blankCount = state.answers.filter((a) => a === null || a === undefined || a === "").length;
    const overallValid = blankCount > (normsData?.overallMaxBlank ?? 5) ? "INVALID" : "VALID";

    const tableKey = sex && band ? `${sex}|${band.id}` : null;
    const table = tableKey ? normsData?.norms?.[tableKey] : null;

    const scales = (normsData?.scales || []).map((scale) => {
      const raw = rawForScale(scale);
      const missing = missingForScale(scale);
      const validity = scaleValidity(scale, missing);
      const t = table ? lookupT(table, scale.id, raw) : null;
      return {
        id: scale.id,
        label: scale.label,
        kind: scale.kind,
        raw,
        missing,
        validity,
        t,
        bandClass: tBandClass(scale, t)
      };
    });

    return {
      ageYears,
      band,
      sex,
      blankCount,
      overallValid,
      tableReady: Boolean(table),
      scales
    };
  }

  function mount(root) {
    if (!root || mounted) return;
    root.innerHTML = "";

    const nav = el("div", "viewNav");
    const back = el("button", "btnBack", "← Înapoi la teste");
    back.type = "button";
    back.setAttribute("data-nav-home", "");
    nav.appendChild(back);
    nav.appendChild(el("div", "viewNavTitle", "TSCC"));
    root.appendChild(nav);

    const formSec = el("section", "section formSection");
    formSec.appendChild(
      sectionHeader(
        "Date client",
        "Sexul și vârsta selectează tabelul de cote T (M/F × 8–12 / 13–17)."
      )
    );
    const grid = el("div", "tsccClientGrid");
    grid.appendChild(fieldText("tsccName", "Nume", "e.g. Maria Popescu"));
    grid.appendChild(fieldSex());
    grid.appendChild(fieldText("tsccAge", "Vârstă (ani)", "ex. 12", "numeric"));
    formSec.appendChild(grid);

    const bandLine = el("div", "tsccBandLine");
    bandLine.id = "tsccBandLine";
    formSec.appendChild(bandLine);
    root.appendChild(formSec);

    const ansSec = el("section", "section");
    ansSec.appendChild(
      sectionHeader(
        "Foaie de răspuns",
        "54 itemi, răspunsuri 0–3 (ca în cheia Excel)."
      )
    );
    const notice = el("div", "tsccNotice");
    notice.id = "tsccNotice";
    notice.hidden = true;
    notice.setAttribute("role", "status");
    ansSec.appendChild(notice);

    const list = el("div", "tsccItemList");
    list.id = "tsccItemList";
    for (let i = 1; i <= ITEM_COUNT; i++) {
      list.appendChild(buildItemRow(i));
    }
    ansSec.appendChild(list);
    root.appendChild(ansSec);

    const resSec = el("section", "section");
    resSec.appendChild(sectionHeader("Rezultate", "Scor brut, cotă T și validitate pe scale."));
    const summary = el("div", "tsccSummary");
    summary.id = "tsccSummary";
    resSec.appendChild(summary);
    const tableWrap = el("div", "tsccResultsWrap");
    tableWrap.id = "tsccResultsWrap";
    resSec.appendChild(tableWrap);
    root.appendChild(resSec);

    const interpSec = el("section", "section");
    interpSec.appendChild(sectionHeader("Interpretare (rezumat)"));
    const interp = el("div", "tsccInterp");
    interp.id = "tsccInterp";
    interpSec.appendChild(interp);
    root.appendChild(interpSec);

    bindClientFields(root);
    mounted = true;
    refresh();
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
    const row = el("div", "tsccSexRow");
    for (const s of ["M", "F"]) {
      const btn = el("button", "tsccSexBtn", s);
      btn.type = "button";
      btn.dataset.sex = s;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        state.sex = s;
        row.querySelectorAll(".tsccSexBtn").forEach((b) => {
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
    const name = root.querySelector("#tsccName");
    const age = root.querySelector("#tsccAge");
    if (name) {
      name.addEventListener("input", () => {
        state.name = name.value;
      });
    }
    if (age) {
      age.addEventListener("input", () => {
        age.value = age.value.replace(/\D/g, "").slice(0, 2);
        state.age = age.value;
        refresh();
      });
    }
  }

  function buildItemRow(itemNumber) {
    const row = el("div", "tsccItemRow");
    row.dataset.item = String(itemNumber);
    row.appendChild(el("div", "tsccItemNum", String(itemNumber)));
    const choices = el("div", "tsccChoices");
    for (let v = 0; v <= 3; v++) {
      const btn = el("button", "tsccChoiceBtn", String(v));
      btn.type = "button";
      btn.dataset.value = String(v);
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        const idx = itemNumber - 1;
        const cur = state.answers[idx];
        state.answers[idx] = cur === v ? null : v;
        refresh();
      });
      choices.appendChild(btn);
    }
    row.appendChild(choices);
    return row;
  }

  function setNotice(message, kind) {
    const box = document.getElementById("tsccNotice");
    if (!box) return;
    box.textContent = message || "";
    box.hidden = !message;
    box.classList.toggle("is-error", kind === "error");
    box.classList.toggle("is-warn", kind === "warn");
  }

  function renderAnswers() {
    document.querySelectorAll(".tsccItemRow").forEach((row) => {
      const n = Number(row.getAttribute("data-item"));
      const val = getAnswer(n);
      row.querySelectorAll(".tsccChoiceBtn").forEach((btn) => {
        const v = Number(btn.getAttribute("data-value"));
        const on = val !== null && val !== undefined && Number(val) === v;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });
  }

  function renderBand(result) {
    const line = document.getElementById("tsccBandLine");
    if (!line) return;
    if (!result.sex) {
      line.textContent = "Selectează sexul (M/F).";
      line.className = "tsccBandLine is-warn";
      return;
    }
    if (result.ageYears == null) {
      line.textContent = "Introdu vârsta în ani (8–17).";
      line.className = "tsccBandLine is-warn";
      return;
    }
    if (!result.band) {
      line.textContent = `Vârsta ${result.ageYears} ani este în afara normelor TSCC (8–17).`;
      line.className = "tsccBandLine is-error";
      return;
    }
    line.textContent = `Tabel activ: ${result.sex === "M" ? "Băieți" : "Fete"} · ${result.band.label} ani`;
    line.className = "tsccBandLine";
  }

  function renderResults(result) {
    const summary = document.getElementById("tsccSummary");
    const wrap = document.getElementById("tsccResultsWrap");
    if (!summary || !wrap) return;

    summary.innerHTML = "";
    const overall = el(
      "div",
      `tsccOverall ${result.overallValid === "INVALID" ? "is-invalid" : "is-valid"}`
    );
    overall.textContent = `Validitate globală: ${result.overallValid} · Răspunsuri lipsă: ${result.blankCount}/54 (invalid dacă >5)`;
    summary.appendChild(overall);

    if (!result.tableReady) {
      setNotice(
        "Completează Sex + Vârstă (8–17) pentru conversia în cote T.",
        "warn"
      );
    } else if (result.overallValid === "INVALID") {
      setNotice("Prea multe răspunsuri lipsă (>5) — protocol INVALID.", "error");
    } else {
      setNotice("");
    }

    wrap.innerHTML = "";
    const table = el("table", "tsccResultsTable");
    const thead = el("thead");
    const hr = el("tr");
    for (const h of ["Scală", "Scor brut", "Scor T", "Lipsă", "Validitate"]) {
      hr.appendChild(el("th", null, h));
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const s of result.scales) {
      const tr = el("tr");
      if (s.bandClass) tr.classList.add(s.bandClass);
      tr.appendChild(el("td", "tsccScaleName", s.label));
      tr.appendChild(el("td", null, String(s.raw)));
      const tCell = el("td", `tsccT ${s.bandClass || ""}`, s.t == null ? "—" : String(s.t));
      tr.appendChild(tCell);
      tr.appendChild(el("td", null, String(s.missing)));
      const vCell = el(
        "td",
        s.validity === "INVALID" ? "tsccInvalid" : s.validity === "VALID" ? "tsccValid" : "",
        s.validity == null ? "—" : s.validity
      );
      tr.appendChild(vCell);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  function renderInterp(result) {
    const box = document.getElementById("tsccInterp");
    if (!box) return;
    box.innerHTML = "";
    const texts = normsData?.interpretation || {};
    const elevated = result.scales.filter(
      (s) => s.bandClass === "is-clinical" || s.bandClass === "is-warn"
    );
    if (!elevated.length) {
      box.appendChild(
        el(
          "p",
          "tsccInterpEmpty",
          "Nicio scală în zona de atenție (warn/clinic) pe baza cotelor T curente."
        )
      );
      return;
    }
    for (const s of elevated) {
      const card = el("div", `tsccInterpCard ${s.bandClass}`);
      card.appendChild(
        el("div", "tsccInterpTitle", `${s.label} · T=${s.t == null ? "—" : s.t}`)
      );
      card.appendChild(
        el(
          "p",
          "tsccInterpBody",
          texts[s.id] ||
            texts[s.id.split("-")[0]] ||
            "Vezi foaia Interpretare din cheia Excel pentru detalii."
        )
      );
      box.appendChild(card);
    }
  }

  function refresh() {
    if (!mounted || !normsData) return;
    const result = compute();
    renderAnswers();
    renderBand(result);
    renderResults(result);
    renderInterp(result);
  }

  async function open() {
    const root = document.getElementById("view-tscc");
    if (!root) return;
    try {
      await loadNorms();
    } catch (e) {
      console.error(e);
      root.innerHTML = "";
      root.appendChild(
        el("p", "placeholderLead", "Nu pot încărca datele TSCC. Reîncarcă aplicația online.")
      );
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

  window.TsccApp = {
    open,
    refresh,
    getState: () => state,
    /** Exposed for verification against the Excel key. */
    compute
  };
})();
