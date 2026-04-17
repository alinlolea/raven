(() => {
  "use strict";

  const ANSWER_MIN = 1;
  const ANSWER_MAX = 8;

  // Age bounds are test-specific (CPM has tighter norms coverage).
  const AGE_BOUNDS = {
    spm: { minMonths: 6 * 12, maxMonths: 80 * 12 + 11, yearMin: 6, yearMax: 80 },
    cpm: { minMonths: 3 * 12 + 9, maxMonths: 12 * 12 + 8, yearMin: 3, yearMax: 12 }
  };

  function getAgeBoundsForCurrentTest() {
    return isCpmLike() ? AGE_BOUNDS.cpm : AGE_BOUNDS.spm;
  }

  // Answer keys for UI validation (green/red feedback).
  // Arrays are column-based, 12 rows each.
  const CPM_C_KEY = {
    cols: ["A", "AB", "B"],
    answersByCol: {
      A: [4, 5, 1, 2, 6, 3, 6, 2, 1, 3, 4, 5],
      AB: [4, 5, 1, 6, 2, 1, 3, 4, 6, 3, 5, 2],
      B: [2, 6, 1, 2, 1, 3, 5, 6, 4, 3, 4, 5]
    }
  };

  const CPM_P_KEY = {
    cols: ["A", "AB", "B"],
    answersByCol: {
      A: [4, 5, 1, 2, 6, 5, 1, 3, 4, 2, 3, 6],
      AB: [4, 5, 1, 6, 2, 5, 4, 3, 2, 3, 1, 6],
      B: [4, 1, 3, 6, 5, 4, 1, 3, 2, 5, 2, 6]
    }
  };

  const SPM_P_KEY = {
    cols: ["A", "B", "C", "D", "E"],
    answersByCol: {
      A: [4, 5, 1, 2, 6, 5, 1, 3, 4, 2, 3, 6],
      B: [4, 1, 3, 6, 5, 4, 1, 3, 2, 5, 2, 6],
      C: [7, 8, 4, 2, 8, 3, 7, 2, 5, 1, 6, 1],
      D: [7, 8, 5, 3, 4, 2, 3, 1, 4, 6, 6, 5],
      E: [5, 8, 6, 1, 2, 7, 4, 3, 6, 5, 1, 2]
    }
  };

  const SPM_PLUS_KEY = {
    cols: ["A", "B", "C", "D", "E"],
    answersByCol: {
      A: [4, 5, 1, 2, 6, 5, 1, 3, 4, 2, 3, 6],
      B: [4, 1, 3, 6, 5, 4, 1, 3, 2, 5, 2, 6],
      C: [5, 4, 7, 8, 1, 7, 6, 1, 6, 8, 2, 6],
      D: [2, 1, 1, 2, 5, 8, 7, 6, 3, 4, 2, 5],
      E: [7, 6, 4, 3, 4, 8, 3, 1, 5, 2, 5, 3]
    }
  };

  /** @type {"pending"|"ok"|"failed"} */
  let ravenNormsStatus = "pending";
  /** @type {"pending"|"ok"|"failed"} */
  let ravenCNormsStatus = "pending";
  /** @type {"pending"|"ok"|"failed"} */
  let discrepanteStatus = "pending";

  function getSpmCorrectFlatFor(testType) {
    // Flat arrays are column-major: A1..A12, B1..B12, ... (matches CSV expectations).
    if (testType === "standard" || testType === "spm-c") {
      return Array.isArray(STANDARD_CORRECT_FLAT) ? STANDARD_CORRECT_FLAT : null;
    }
    if (testType === "spm-p") {
      const cols = ["A", "B", "C", "D", "E"];
      const out = [];
      for (const c of cols) {
        const arr = SPM_P_KEY.answersByCol[c];
        if (!Array.isArray(arr) || arr.length !== 12) return null;
        out.push(...arr);
      }
      return out;
    }
    if (testType === "spm-plus") {
      const cols = ["A", "B", "C", "D", "E"];
      const out = [];
      for (const c of cols) {
        const arr = SPM_PLUS_KEY.answersByCol[c];
        if (!Array.isArray(arr) || arr.length !== 12) return null;
        out.push(...arr);
      }
      return out;
    }
    return null;
  }

  function getCpmCorrectFlatFor(testType) {
    const cols = ["A", "AB", "B"];
    const key = testType === "cpm-c" ? CPM_C_KEY : testType === "cpm-p" ? CPM_P_KEY : null;
    if (!key) return null;
    const out = [];
    for (const c of cols) {
      const arr = key.answersByCol[c];
      if (!Array.isArray(arr) || arr.length !== 12) return null;
      out.push(...arr);
    }
    return out;
  }

  function getCorrectFlatFor(testType) {
    if (testType === "cpm-c" || testType === "cpm-p") return getCpmCorrectFlatFor(testType);
    return getSpmCorrectFlatFor(testType);
  }

  const TEST_DEFINITIONS = {
    // Existing internal type "standard" remains the only one wired to scoring/norms for now.
    // UI labels/types expanded; non-standard types are UI-only until logic is added.
    standard: { label: "SPM - C", items: 60, grid: { cols: 5, rows: 12 }, kind: "spm" },
    "spm-c": { label: "SPM - C", items: 60, grid: { cols: 5, rows: 12 }, kind: "spm" },
    "spm-p": { label: "SPM - P", items: 60, grid: { cols: 5, rows: 12 }, kind: "spm" },
    "spm-plus": { label: "SPM +", items: 60, grid: { cols: 5, rows: 12 }, kind: "spm" },
    "cpm-c": { label: "CPM - C", items: 36, grid: { cols: 3, rows: 12 }, kind: "cpm" },
    "cpm-p": { label: "CPM - P", items: 36, grid: { cols: 3, rows: 12 }, kind: "cpm" }
  };

  const state = {
    testType: "standard",
    answers: [],
    answerInputs: [],
    answerBoxes: [],
    bulkTextEl: null
  };

  const dom = {
    testTypeGroup: document.getElementById("testTypeGroup"),
    clientName: document.getElementById("clientName"),
    birthDate: document.getElementById("birthDate"),
    ageYears: document.getElementById("ageYears"),
    ageMonths: document.getElementById("ageMonths"),
    ageGroupLine: document.getElementById("ageGroupLine"),
    ageWarnLine: document.getElementById("ageWarnLine"),
    answersHint: document.getElementById("answersHint"),
    answersArea: document.getElementById("answersArea"),
    rawScore: document.getElementById("raw-score"),
    interpretationLine1: document.getElementById("interpretation-line1"),
    interpretationLine2: document.getElementById("interpretation-line2"),
    interpretationLine3: document.getElementById("interpretation-line3"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    shareBtn: document.getElementById("shareBtn"),
    toast: document.getElementById("toast"),
    offlineStatus: document.getElementById("offlineStatus"),
    resultSection: document.getElementById("resultSection")
  };

  function setInterpretationUI(line1, line2, line3Html) {
    if (dom.interpretationLine1) dom.interpretationLine1.textContent = line1;
    if (dom.interpretationLine2) {
      const t = line2 && String(line2).trim();
      if (t) {
        dom.interpretationLine2.textContent = t;
        dom.interpretationLine2.hidden = false;
      } else {
        dom.interpretationLine2.textContent = "";
        dom.interpretationLine2.hidden = true;
      }
    }

    if (dom.interpretationLine3) {
      const t = line3Html && String(line3Html).trim();
      if (t) {
        dom.interpretationLine3.innerHTML = t;
        dom.interpretationLine3.hidden = false;
      } else {
        dom.interpretationLine3.innerHTML = "";
        dom.interpretationLine3.hidden = true;
      }
    }
  }

  function getInterpretationPlainText() {
    const a = dom.interpretationLine1 ? dom.interpretationLine1.textContent.trim() : "";
    const b =
      dom.interpretationLine2 && !dom.interpretationLine2.hidden
        ? dom.interpretationLine2.textContent.trim()
        : "";
    const c =
      dom.interpretationLine3 && !dom.interpretationLine3.hidden
        ? dom.interpretationLine3.textContent.trim()
        : "";
    return [a, b, c].filter(Boolean).join("\n");
  }

  /**
   * @param {string|null|undefined} percentileStr
   * @returns {number|null}
   */
  function parsePercentileToNumber(percentileStr) {
    const t = String(percentileStr ?? "").trim();
    if (!t) return null;
    const rangeMatch = t.match(/(\d+(?:\.\d+)?)\s*%\s*[-–]\s*(\d+(?:\.\d+)?)\s*%/);
    if (rangeMatch) return (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2;
    const lt = t.match(/^<\s*(\d+(?:\.\d+)?)/);
    if (lt) {
      const cap = Number(lt[1]);
      return Math.max(0, cap - 0.5);
    }
    const gt = t.match(/^>\s*(\d+(?:\.\d+)?)/);
    if (gt) {
      const floor = Number(gt[1]);
      return floor + 0.01;
    }
    const single = t.match(/(\d+(?:\.\d+)?)\s*%?/);
    if (single) return Number(single[1]);
    return null;
  }

  /**
   * @param {number|null} p
   * @returns {string}
   */
  function getNivelLineFromPercentileNumber(p) {
    if (p === null || !Number.isFinite(p)) return "";
    if (p > 94) return "Nivel I [Intelect de nivel superior]";
    if (p >= 90) return "Nivel II+ [Capacitate intelectuală peste medie]";
    if (p >= 75) return "Nivel II [Capacitate intelectuală peste medie]";
    if (p >= 50) return "Nivel III+ [Intelect de nivel mediu]";
    if (p >= 25) return "Nivel III- [Intelect de nivel mediu]";
    if (p >= 11) return "Nivel IV [Capacitate intelectuală sub-medie]";
    if (p >= 6) return "Nivel IV- [Capacitate intelectuală sub-medie]";
    return "Nivel V [Deficiență intelectuală]";
  }

  function buildInterpretationLines(result) {
    const line1 = `Percentilă: ${result.percentile} | IQ: ${result.iq}`;
    const pNum = parsePercentileToNumber(result.percentile);
    const line2 = getNivelLineFromPercentileNumber(pNum);
    return { line1, line2 };
  }

  function getLowestSpmResultForAgeIndex(ageIndex) {
    const t =
      window.RavenNorms && typeof window.RavenNorms._getTables === "function"
        ? window.RavenNorms._getTables()
        : null;
    const idx = Number(ageIndex);
    if (!t || !Array.isArray(t.rows) || !t.rows.length) return null;
    if (!Number.isFinite(idx) || idx < 0) return null;
    for (const row of t.rows) {
      const pair = row?.agePairs?.[idx];
      if (!pair) continue;
      const p = String(pair.percentile ?? "").trim();
      const iq = String(pair.iq ?? "").trim();
      if (!p && !iq) continue;
      return { percentile: pair.percentile, iq: pair.iq, ageLabel: t.ageGroups?.[idx]?.label };
    }
    return null;
  }

  function getLowestCpmResultForAgeIndex(ageIndex) {
    const t =
      window.RavenCNorms && typeof window.RavenCNorms._getTables === "function"
        ? window.RavenCNorms._getTables()
        : null;
    const idx = Number(ageIndex);
    if (!t || !Array.isArray(t.rows) || !t.rows.length) return null;
    if (!Number.isFinite(idx) || idx < 0) return null;
    for (const row of t.rows) {
      const pair = row?.agePairs?.[idx];
      if (!pair) continue;
      const p = String(pair.percentile ?? "").trim();
      const iq = String(pair.iq ?? "").trim();
      if (!p && !iq) continue;
      return { percentile: pair.percentile, iq: pair.iq, ageLabel: t.ageGroups?.[idx]?.label };
    }
    return null;
  }

  const BIRTH_EMPTY = "_";

  /** @param {string} value */
  function getDigitsFromBirthField(value) {
    return String(value ?? "").replace(/\D/g, "").slice(0, 8);
  }

  /** @param {string} digitStr up to 8 digits */
  function formatBirthTemplate(digitStr) {
    const d = getDigitsFromBirthField(digitStr);
    const c = (i) => (i < d.length ? d[i] : BIRTH_EMPTY);
    return `${c(0)}${c(1)}/${c(2)}${c(3)}/${c(4)}${c(5)}${c(6)}${c(7)}`;
  }

  /** Caret index (0–10) after entering `k` digits. */
  function caretPositionAfterDigits(k) {
    if (k <= 0) return 0;
    const pos = [1, 3, 4, 6, 7, 8, 9, 10];
    return pos[k - 1];
  }

  /** @param {string} digitsRaw */
  function applyBirthDateFieldFromDigits(digitsRaw) {
    if (!dom.birthDate) return;
    const digits = getDigitsFromBirthField(digitsRaw);
    dom.birthDate.value = formatBirthTemplate(digits);
    const pos = caretPositionAfterDigits(digits.length);
    requestAnimationFrame(() => {
      try {
        dom.birthDate.setSelectionRange(pos, pos);
      } catch {
        // Ignore selection errors.
      }
    });
  }

  function isValidCalendarDate(dd, mm, yyyy) {
    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return false;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
    if (yyyy < 1900 || yyyy > 2100) return false;
    const d = new Date(yyyy, mm - 1, dd);
    return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
  }

  function ageYearsMonthsFromDob(dob, today) {
    let years = today.getFullYear() - dob.getFullYear();
    let months = today.getMonth() - dob.getMonth();
    if (today.getDate() < dob.getDate()) months--;
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years < 0 || (years === 0 && months < 0)) return null;
    return { years: Math.max(0, years), months: Math.max(0, months) };
  }

  function clearDerivedAge() {
    dom.ageYears.value = "";
    dom.ageMonths.value = "";
  }

  function syncAgeFromBirthDate() {
    if (!dom.birthDate) return;
    const digits = getDigitsFromBirthField(dom.birthDate.value);
    if (digits.length < 8) {
      clearDerivedAge();
      updateAgeUI();
      return;
    }

    const dd = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    const yyyy = Number(digits.slice(4, 8));

    if (!isValidCalendarDate(dd, mm, yyyy)) {
      dom.ageWarnLine.hidden = false;
      dom.ageWarnLine.textContent = "Dată invalidă.";
      clearDerivedAge();
      updateAgeUI();
      return;
    }

    const dob = new Date(yyyy, mm - 1, dd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dob.setHours(0, 0, 0, 0);

    if (dob > today) {
      dom.ageWarnLine.hidden = false;
      dom.ageWarnLine.textContent = "Data nașterii nu poate fi în viitor.";
      clearDerivedAge();
      updateAgeUI();
      return;
    }

    const ym = ageYearsMonthsFromDob(dob, today);
    if (!ym) {
      dom.ageWarnLine.hidden = false;
      dom.ageWarnLine.textContent = "Dată invalidă.";
      clearDerivedAge();
      updateAgeUI();
      return;
    }

    const b = getAgeBoundsForCurrentTest();
    const totalMonths = getTotalMonths(ym.years, ym.months);
    if (totalMonths < b.minMonths || totalMonths > b.maxMonths) {
      dom.ageWarnLine.hidden = false;
      dom.ageWarnLine.textContent = `Vârsta din dată trebuie să fie între ${formatMonths(b.minMonths)} și ${formatMonths(b.maxMonths)}.`;
      clearDerivedAge();
      updateAgeUI();
      return;
    }

    dom.ageYears.value = String(ym.years);
    dom.ageMonths.value = String(ym.months);
    dom.ageWarnLine.hidden = true;
    dom.ageWarnLine.textContent = "";
    updateAgeUI();
  }

  function appendBirthDigit(ch) {
    if (!dom.birthDate || !/^[0-9]$/.test(ch)) return;
    let d = getDigitsFromBirthField(dom.birthDate.value);
    if (d.length >= 8) return;
    d += ch;
    applyBirthDateFieldFromDigits(d);
    syncAgeFromBirthDate();
    updateResults();
  }

  function trimBirthLastDigit() {
    if (!dom.birthDate) return;
    const d = getDigitsFromBirthField(dom.birthDate.value).slice(0, -1);
    applyBirthDateFieldFromDigits(d);
    syncAgeFromBirthDate();
    updateResults();
  }

  /** @param {KeyboardEvent} e */
  function keyEventToDigit(e) {
    const k = e.key;
    if (/^[0-9]$/.test(k)) return k;
    if (e.code && /^Digit[0-9]$/.test(e.code)) return e.code.slice(5);
    if (e.code && /^Numpad[0-9]$/.test(e.code)) return e.code.slice(6);
    return null;
  }

  /** Prefer this path: browser never inserts into `_` — we replace slots with digits only. */
  function onBirthDateBeforeInput(e) {
    if (!dom.birthDate) return;
    const it = e.inputType;
    if (it === "insertFromPaste") return;
    if (it === "insertText" && e.data && /^[0-9]$/.test(e.data)) {
      e.preventDefault();
      appendBirthDigit(e.data);
      return;
    }
    if (it === "deleteContentBackward" || it === "deleteContentForward") {
      e.preventDefault();
      trimBirthLastDigit();
    }
  }

  /** Fallback when `beforeinput` is not available. */
  function onBirthDateKeydownFallback(e) {
    if (!dom.birthDate) return;
    const digit = keyEventToDigit(e);
    if (digit) {
      e.preventDefault();
      appendBirthDigit(digit);
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      trimBirthLastDigit();
    }
  }

  function onBirthDateInput() {
    if (!dom.birthDate) return;
    const digits = getDigitsFromBirthField(dom.birthDate.value);
    applyBirthDateFieldFromDigits(digits);
    syncAgeFromBirthDate();
    updateResults();
  }

  function onBirthDatePaste(e) {
    e.preventDefault();
    const clip = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    const merged = (getDigitsFromBirthField(dom.birthDate.value) + clip.replace(/\D/g, "")).slice(0, 8);
    applyBirthDateFieldFromDigits(merged);
    syncAgeFromBirthDate();
    updateResults();
  }

  function onBirthDateFocus() {
    if (!dom.birthDate) return;
    const v = dom.birthDate.value;
    if (v === "" || v.trim() === "") {
      applyBirthDateFieldFromDigits("");
    }
  }

  /** Sets `__/__/____` from current digits; repeat after paint to override browser autofill/clearing. */
  function ensureBirthDateMaskVisible() {
    if (!dom.birthDate) return;
    const sync = () => {
      if (!dom.birthDate) return;
      applyBirthDateFieldFromDigits(getDigitsFromBirthField(dom.birthDate.value));
    };
    sync();
    requestAnimationFrame(sync);
    setTimeout(sync, 100);
  }

  function showToast(message) {
    dom.toast.textContent = message;
    // Let screen readers announce changes.
    dom.toast.setAttribute("data-toast-updated", String(Date.now()));
  }

  function getTotalMonths(years, months) {
    return years * 12 + months;
  }

  function getAgeGroup(totalMonths) {
    return ageRanges.find((range) => totalMonths >= range.min && totalMonths <= range.max);
  }

  function clampAgeYears(n) {
    const { yearMin, yearMax } = getAgeBoundsForCurrentTest();
    if (!Number.isFinite(n)) return yearMin;
    let v = Math.round(n);
    if (v < yearMin) v = yearMin;
    if (v > yearMax) v = yearMax;
    return v;
  }

  function clampAgeMonths(n) {
    if (!Number.isFinite(n)) return 0;
    let v = Math.round(n);
    if (v < 0) v = 0;
    if (v > 11) v = 11;
    return v;
  }

  function updateAgeUI() {
    // Keep placeholders aligned with current test limits.
    const b = getAgeBoundsForCurrentTest();
    dom.ageYears.placeholder = `${b.yearMin}–${b.yearMax}`;

    dom.ageGroupLine.textContent = "";
    dom.ageWarnLine.hidden = true;
    dom.ageWarnLine.textContent = "";
    dom.ageYears.classList.remove("is-invalid");
    dom.ageMonths.classList.remove("is-invalid");

    const yVal = dom.ageYears.value.trim();
    const mVal = dom.ageMonths.value;

    if (yVal === "") {
      if (mVal !== "") {
        dom.ageWarnLine.hidden = false;
        dom.ageWarnLine.textContent = "Introduceți și numărul de ani.";
        dom.ageMonths.classList.add("is-invalid");
      }
      return;
    }

    const yearsNum = Number(yVal);
    if (!Number.isFinite(yearsNum)) return;

    const years = yearsNum;
    const months = mVal === "" ? 0 : clampAgeMonths(Number(mVal));
    if (mVal !== "") dom.ageMonths.value = String(months);

    const total = getTotalMonths(years, months);
    if (total < b.minMonths || total > b.maxMonths) {
      dom.ageWarnLine.hidden = false;
      dom.ageWarnLine.textContent = `Vârsta trebuie să fie între ${formatMonths(b.minMonths)} și ${formatMonths(b.maxMonths)}.`;
      dom.ageYears.classList.add("is-invalid");
      return;
    }

    // Show age-band info when available.
    // Note: `ageRanges` is SPM-only (starts at 5y in data.js), so for CPM we use RavenCNorms instead.
    if (isCpmLike()) {
      const idx =
        window.RavenCNorms && typeof window.RavenCNorms.getAgeIndexForTotalMonths === "function"
          ? window.RavenCNorms.getAgeIndexForTotalMonths(total)
          : -1;
      if (idx >= 0) {
        const t =
          window.RavenCNorms && typeof window.RavenCNorms._getTables === "function"
            ? window.RavenCNorms._getTables()
            : null;
        const label = t?.ageGroups?.[idx]?.label;
        if (label) dom.ageGroupLine.textContent = `Grupă de vârstă: ${label}`;
      }
      // Do not show the SPM-specific "norms unavailable" warning for CPM-valid ages.
      return;
    }

    const group = getAgeGroup(total);
    if (group) dom.ageGroupLine.textContent = `Grupă de vârstă: ${group.label}`;
    else {
      dom.ageWarnLine.hidden = false;
      dom.ageWarnLine.textContent = "Vârsta nu se încadrează în intervalul normelor disponibile.";
    }
  }

  function formatMonths(totalMonths) {
    const t = Number(totalMonths);
    const y = Math.floor(t / 12);
    const m = t % 12;
    return `${y} ani ${m} luni`;
  }

  function formatBirthDateForExport() {
    if (!dom.birthDate) return "(not provided)";
    const digits = getDigitsFromBirthField(dom.birthDate.value);
    if (digits.length === 0) return "(not provided)";
    if (digits.length === 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    return formatBirthTemplate(digits);
  }

  function formatAgeForExport() {
    const yVal = dom.ageYears.value.trim();
    if (yVal === "") return "(not provided)";
    const years = clampAgeYears(Number(yVal));
    const mVal = dom.ageMonths.value;
    const months = mVal === "" ? 0 : clampAgeMonths(Number(mVal));
    return `${years} ani ${months} luni`;
  }

  function setActiveButton(groupEl, datasetKey, value) {
    const buttons = Array.from(groupEl.querySelectorAll("button[data-" + datasetKey + "]"));
    for (const btn of buttons) {
      const active = btn.getAttribute("data-" + datasetKey) === value;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function getItemCount() {
    const def = TEST_DEFINITIONS[state.testType];
    return def ? def.items : 0;
  }

  function getGridDef() {
    const def = TEST_DEFINITIONS[state.testType];
    return def?.grid || { cols: 2, rows: 0 };
  }

  function isSpmLike() {
    return TEST_DEFINITIONS[state.testType]?.kind === "spm";
  }

  function isCpmLike() {
    return TEST_DEFINITIONS[state.testType]?.kind === "cpm";
  }

  function makeEmptyAnswers() {
    return new Array(getItemCount()).fill("");
  }

  function resetAnswersPreservingMode() {
    state.answers = makeEmptyAnswers();
    state.answerInputs = [];
    state.answerBoxes = [];
    state.bulkTextEl = null;
  }

  function setAnswersHint() {
    const total = getItemCount();
    dom.answersHint.textContent = `Enter values ${ANSWER_MIN}–${ANSWER_MAX} (${total} items).`;
  }

  function parseBulk(text) {
    const found = String(text)
      .match(/\d+/g)
      ?.map((t) => Number(t))
      .filter((n) => Number.isFinite(n) && n >= ANSWER_MIN && n <= ANSWER_MAX) || [];
    return found;
  }

  function allFilled() {
    return state.answers.length > 0 && state.answers.every((v) => v !== "" && v !== null && v !== undefined);
  }

  /**
   * Counts correct answers. userAnswers are in grid DOM order (A1,B1,…,E1,A2,…);
   * correctAnswersFlat is STANDARD_CORRECT_FLAT (A1–A12, B1–B12, …).
   */
  function calculateRawScore(userAnswers, correctAnswersFlat) {
    const len = Math.min(userAnswers.length, correctAnswersFlat.length);
    const { cols, rows } = getGridDef();
    let score = 0;
    for (let domIdx = 0; domIdx < len; domIdx++) {
      const row = Math.floor(domIdx / cols);
      const col = domIdx % cols;
      const flatIdx = col * rows + row;
      const u = userAnswers[domIdx];
      if (u === "" || u === null || u === undefined) continue;
      if (Number(u) === correctAnswersFlat[flatIdx]) score++;
    }
    return score;
  }

  function getUserTotalMonthsOrNull() {
    const yVal = dom.ageYears.value.trim();
    if (yVal === "") return null;
    const n = Number(yVal);
    if (!Number.isFinite(n)) return null;
    const b = getAgeBoundsForCurrentTest();
    if (n < b.yearMin || n > b.yearMax) return null;
    const years = n;
    const mVal = dom.ageMonths.value;
    const months = mVal === "" ? 0 : clampAgeMonths(Number(mVal));
    const total = getTotalMonths(years, months);
    if (total < b.minMonths || total > b.maxMonths) return null;
    return total;
  }

  /**
   * @returns {{ rawScore: number|null, spmPlus: *, ageIndex: number|null, result: *, blockReason: string|null }}
   */
  function updateResults() {
    const dash = "-";
    let rawScore = null;
    let spmPlus = null;
    let ageIndex = null;
    let result = null;
    /** @type {string | null} */
    let blockReason = null;

    try {
      const isSpmBacked = state.testType === "standard" || state.testType === "spm-p" || state.testType === "spm-plus";
      const isCpmBacked = state.testType === "cpm-c" || state.testType === "cpm-p";

      if (!isSpmBacked && !isCpmBacked) {
        blockReason = "not_supported_test";
        dom.rawScore.textContent = dash;
        setInterpretationUI(dash, "");
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      const correctFlat = getCorrectFlatFor(state.testType);
      if (!correctFlat || correctFlat.length === 0 || !state.answers.length) {
        blockReason = "no_answer_data";
        dom.rawScore.textContent = dash;
        setInterpretationUI(dash, "");
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      rawScore = calculateRawScore(state.answers, correctFlat);
      dom.rawScore.textContent = String(rawScore);

      const totalMonths = getUserTotalMonthsOrNull();
      const readyForNorms = totalMonths !== null && rawScore >= 0;

      if (!readyForNorms) {
        blockReason = rawScore < 1 ? "need_at_least_one_correct" : "need_valid_birth_date_or_age";
        setInterpretationUI(dash, "");
        spmPlus = null;
        ageIndex = null;
        result = null;
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      if (isCpmBacked) {
        if (!window.RavenCNorms || typeof window.RavenCNorms.getAgeIndexForTotalMonths !== "function") {
          blockReason = ravenCNormsStatus === "pending" ? "cpm_norms_pending" : "cpm_norms_missing";
          setInterpretationUI(ravenCNormsStatus === "pending" ? "Se încarcă normele…" : dash, "");
          return { rawScore, spmPlus, ageIndex, result, blockReason };
        }

        ageIndex = window.RavenCNorms.getAgeIndexForTotalMonths(totalMonths);
        if (ageIndex < 0) {
          blockReason = "age_outside_csv_bands";
          setInterpretationUI("Vârsta nu se încadrează în normele CSV.", "");
          result = null;
          return { rawScore, spmPlus, ageIndex, result, blockReason };
        }

        // Baseline output even for raw score 0.
        if (rawScore === 0) {
          const low = getLowestCpmResultForAgeIndex(ageIndex);
          if (low) {
            blockReason = null;
            result = low;
            const { line1, line2 } = buildInterpretationLines(low);
            setInterpretationUI(line1, line2, "");
            return { rawScore, spmPlus, ageIndex, result, blockReason };
          }
        }

        if (typeof window.RavenCNorms.getResult !== "function") {
          blockReason = "cpm_getResult_missing";
          setInterpretationUI(dash, "");
          result = null;
          return { rawScore, spmPlus, ageIndex, result, blockReason };
        }

      result = window.RavenCNorms.getResult(rawScore, ageIndex);
        if (!result) {
        if (ravenCNormsStatus === "pending") {
          setInterpretationUI("Se încarcă normele…", "", "");
          blockReason = "cpm_getResult_pending";
          return { rawScore, spmPlus, ageIndex, result, blockReason };
        }

        const low = getLowestCpmResultForAgeIndex(ageIndex);
        if (!low) {
          setInterpretationUI(dash, "", "");
          blockReason = "cpm_getResult_null";
          return { rawScore, spmPlus, ageIndex, result, blockReason };
        }

        blockReason = null;
        {
          const { line1, line2 } = buildInterpretationLines(low);
          setInterpretationUI(line1, line2, "");
        }
        return { rawScore, spmPlus, ageIndex, result, blockReason };
        }

        blockReason = null;
        {
          const { line1, line2 } = buildInterpretationLines(result);
          setInterpretationUI(line1, line2);
        }
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      // For SPM-C / SPM-P: rawScore corresponds to CSV column A, convert to SPM+ (column B) via getSPMPlus().
      // For SPM+: rawScore is already CSV column B; skip conversion.
      if (state.testType === "spm-plus") {
        spmPlus = rawScore;
      } else {
        if (typeof window.getSPMPlus !== "function") {
          blockReason = "getSPMPlus_missing";
          setInterpretationUI(dash, "");
          spmPlus = null;
          ageIndex = null;
          result = null;
          return { rawScore, spmPlus, ageIndex, result, blockReason };
        }

        spmPlus = window.getSPMPlus(rawScore);
        if (spmPlus === null || spmPlus === undefined) {
          if (ravenNormsStatus === "pending") {
            blockReason = "norms_pending_or_raw_out_of_table";
            setInterpretationUI("Se încarcă normele…", "", "");
          } else if (ravenNormsStatus === "failed") {
            blockReason = "norms_csv_failed";
            setInterpretationUI("Norme indisponibile (CSV).", "", "");
          } else {
            // Low raw scores (e.g. 0) may not map to an SPM+ conversion row.
            // Show the lowest available CSV output for the selected age band.
            const norms = window.RavenNorms;
            const idx =
              norms && typeof norms.getAgeIndexForTotalMonths === "function"
                ? norms.getAgeIndexForTotalMonths(totalMonths)
                : -1;
            if (idx >= 0) {
              const low = getLowestSpmResultForAgeIndex(idx);
              if (low) {
                blockReason = null;
                ageIndex = idx;
                result = low;
                const { line1, line2 } = buildInterpretationLines(low);
                const disc = isDiscrepanteSupported() ? buildDiscrepanteHtml(rawScore) : "";
                setInterpretationUI(line1, line2, disc);
                return { rawScore, spmPlus, ageIndex, result, blockReason };
              }
            }

            blockReason = "getSPMPlus_null";
            setInterpretationUI(dash, "", "");
          }
          ageIndex = null;
          result = null;
          return { rawScore, spmPlus, ageIndex, result, blockReason };
        }
      }

      const norms = window.RavenNorms;
      ageIndex =
        norms && typeof norms.getAgeIndexForTotalMonths === "function"
          ? norms.getAgeIndexForTotalMonths(totalMonths)
          : -1;

      if (ageIndex < 0) {
        blockReason = "age_outside_csv_bands";
        setInterpretationUI("Vârsta nu se încadrează în normele CSV.", "");
        result = null;
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      // Baseline output even for raw score 0 (SPM-C / SPM-P / SPM+).
      if (rawScore === 0) {
        const low = getLowestSpmResultForAgeIndex(ageIndex);
        if (low) {
          blockReason = null;
          result = low;
          const { line1, line2 } = buildInterpretationLines(low);
          const disc = isDiscrepanteSupported() ? buildDiscrepanteHtml(rawScore) : "";
          setInterpretationUI(line1, line2, disc);
          return { rawScore, spmPlus, ageIndex, result, blockReason };
        }
      }

      if (typeof window.getResult !== "function") {
        blockReason = "getResult_missing";
        setInterpretationUI(dash, "");
        result = null;
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      result = window.getResult(spmPlus, ageIndex);
      if (!result) {
        if (ravenNormsStatus === "pending") {
          blockReason = "norms_pending";
          setInterpretationUI("Se încarcă normele…", "", "");
          return { rawScore, spmPlus, ageIndex, result, blockReason };
        }

        const low = getLowestSpmResultForAgeIndex(ageIndex);
        if (!low) {
          blockReason = "getResult_null";
          setInterpretationUI(dash, "", "");
          return { rawScore, spmPlus, ageIndex, result, blockReason };
        }

        blockReason = null;
        {
          const { line1, line2 } = buildInterpretationLines(low);
          const disc = isDiscrepanteSupported() ? buildDiscrepanteHtml(rawScore) : "";
          setInterpretationUI(line1, line2, disc);
        }
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      blockReason = null;
      {
        const { line1, line2 } = buildInterpretationLines(result);
        const disc = isDiscrepanteSupported() ? buildDiscrepanteHtml(rawScore) : "";
        setInterpretationUI(line1, line2, disc);
      }
      return { rawScore, spmPlus, ageIndex, result, blockReason };
    } catch (e) {
      console.error("[Raven] updateResults:", e);
      blockReason = "exception";
      dom.rawScore.textContent = dash;
      setInterpretationUI(dash, "");
      return { rawScore, spmPlus, ageIndex, result, blockReason };
    }
  }

  function focusInputAt(index) {
    const el = state.answerInputs[index];
    if (!el) return;
    el.focus();
    // Select so users can quickly overwrite.
    try {
      el.setSelectionRange(el.value.length, el.value.length);
    } catch {
      // Ignore selection errors.
    }
  }

  function getExpectedAnswerForCurrentTest(domIndex) {
    const { cols, rows } = getGridDef();
    if (!cols || !rows) return null;

    const row = Math.floor(domIndex / cols);
    const col = domIndex % cols;
    if (row < 0 || row >= rows) return null;

    // SPM - C (existing internal "standard") uses STANDARD_CORRECT_FLAT (col-major A1..A12, B1..).
    if (state.testType === "standard" || state.testType === "spm-c") {
      if (!Array.isArray(STANDARD_CORRECT_FLAT)) return null;
      const flatIdx = col * rows + row;
      return STANDARD_CORRECT_FLAT[flatIdx] ?? null;
    }

    const colKey =
      isSpmLike() ? ["A", "B", "C", "D", "E"][col] :
      isCpmLike() ? ["A", "AB", "B"][col] :
      null;
    if (!colKey) return null;

    const key =
      state.testType === "cpm-c" ? CPM_C_KEY :
      state.testType === "cpm-p" ? CPM_P_KEY :
      state.testType === "spm-p" ? SPM_P_KEY :
      state.testType === "spm-plus" ? SPM_PLUS_KEY :
      null;

    if (!key) return null;
    const colArr = key.answersByCol[colKey];
    if (!Array.isArray(colArr)) return null;
    return colArr[row] ?? null;
  }

  function updateAnswerValidation(index) {
    const box = state.answerBoxes[index];
    if (!box) return;
    box.classList.remove("correct", "incorrect");
    if (state.answers[index] === "") return;
    const expected = getExpectedAnswerForCurrentTest(index);
    if (expected === null || expected === undefined) return;
    const v = state.answers[index];
    if (Number(v) === Number(expected)) box.classList.add("correct");
    else box.classList.add("incorrect");
  }

  function updateIndividualInputUI(index) {
    const box = state.answerBoxes[index];
    if (!box) return;
    const filled = state.answers[index] !== "";
    box.classList.toggle("is-filled", filled);
    updateAnswerValidation(index);
  }

  function isDiscrepanteSupported() {
    return state.testType === "standard" || state.testType === "spm-p" || state.testType === "spm-plus";
  }

  function getSpmScaleLetters() {
    return ["A", "B", "C", "D", "E"];
  }

  function getSpmUserScaleCorrectCounts() {
    const { cols, rows } = getGridDef();
    const letters = getSpmScaleLetters();
    /** @type {{A:number,B:number,C:number,D:number,E:number}} */
    const out = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    if (cols !== 5 || rows !== 12) return out;

    for (let domIdx = 0; domIdx < state.answers.length; domIdx++) {
      const v = state.answers[domIdx];
      if (v === "" || v === null || v === undefined) continue;
      const expected = getExpectedAnswerForCurrentTest(domIdx);
      if (expected === null || expected === undefined) continue;
      if (Number(v) !== Number(expected)) continue;
      const col = domIdx % cols;
      const L = letters[col];
      if (L) out[L] += 1;
    }
    return out;
  }

  function buildDiscrepanteHtml(totalRawScore) {
    if (!window.Discrepante || typeof window.Discrepante.getExpected !== "function") {
      return "Discrepante: A[0], B[0], C[0], D[0], E[0]";
    }

    const total = Number(totalRawScore);
    // If the CSV has no row for low totals (e.g. <10), use the first defined baseline (10)
    // so the UI starts with meaningful negative discrepancies and updates as answers are entered.
    const expected =
      window.Discrepante.getExpected(total) ||
      window.Discrepante.getExpected(10);
    if (!expected) {
      return "Discrepante: A[0], B[0], C[0], D[0], E[0]";
    }

    const actual = getSpmUserScaleCorrectCounts();
    const parts = getSpmScaleLetters().map((L) => {
      const delta = (actual[L] ?? 0) - (expected[L] ?? 0);
      const cls = Math.abs(delta) <= 2 ? "discOk" : "discBad";
      const sign = delta > 0 ? `+${delta}` : String(delta);
      return `${L}[<span class="${cls}">${sign}</span>]`;
    });
    return `Discrepante: ${parts.join(", ")}`;
  }

  function clampAnswerValue(raw) {
    if (raw === "" || raw === null || raw === undefined) return "";
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    if (n < ANSWER_MIN) return ANSWER_MIN;
    if (n > ANSWER_MAX) return ANSWER_MAX;
    return n;
  }

  function getGridLayoutPartsFromIndex(index) {
    // DOM order is row-major: col moves fastest.
    const { cols, rows } = getGridDef();
    const rowIdx = Math.floor(index / cols);
    const colIdx = index % cols;
    return { rowIdx, colIdx, cols, rows };
  }

  function getNextColumnMajorIndex(index) {
    const { rowIdx, colIdx, cols, rows } = getGridLayoutPartsFromIndex(index);
    if (!rows || !cols) return null;

    // Column-major traversal: A1..A12, then next column, etc.
    if (rowIdx < rows - 1) return (rowIdx + 1) * cols + colIdx;
    if (colIdx < cols - 1) return 0 * cols + (colIdx + 1);
    return null;
  }

  function getPrevColumnMajorIndex(index) {
    const { rowIdx, colIdx, cols, rows } = getGridLayoutPartsFromIndex(index);
    if (!rows || !cols) return null;
    if (rowIdx > 0) return (rowIdx - 1) * cols + colIdx;
    if (colIdx > 0) return (rows - 1) * cols + (colIdx - 1);
    return null;
  }

  function renderIndividualAnswers() {
    const total = getItemCount();
    dom.answersArea.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "answersGrid";
    if (isSpmLike()) grid.classList.add("is-standard");
    if (isCpmLike()) grid.classList.add("is-cpm");
    dom.answersArea.appendChild(grid);

    state.answerInputs = [];
    state.answerBoxes = [];

    for (let i = 0; i < total; i++) {
      const cellName = getCellNameForIndex(i);
      const cell = document.createElement("div");
      cell.className = "answerCell";

      const box = document.createElement("div");
      box.className = "answerBox";

      const input = document.createElement("input");
      input.type = "number";
      input.inputMode = "numeric";
      input.min = String(ANSWER_MIN);
      input.max = String(ANSWER_MAX);
      input.step = "1";
      input.placeholder = cellName || "—";
      input.className = "answerInput";
      input.id = cellName ? `answer-${cellName}` : `answer-${i}`;
      input.setAttribute(
        "aria-label",
        cellName ? `Answer ${cellName}` : `Answer ${i + 1} of ${total}`
      );

      // Controlled behavior through state.answers
      input.value = state.answers[i] === "" ? "" : String(state.answers[i]);
      if (state.answers[i] !== "") box.classList.add("is-filled");

      input.addEventListener("input", () => {
        const next = clampAnswerValue(input.value);
        if (next === "") {
          state.answers[i] = "";
          input.value = "";
        } else {
          state.answers[i] = next;
          input.value = String(next);
        }

        updateIndividualInputUI(i);

        // Auto-focus next on entry.
        if (state.answers[i] !== "") {
          const nextIdx = getNextColumnMajorIndex(i);
          if (nextIdx !== null) focusInputAt(nextIdx);
        }

        updateResults();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key !== "Backspace") return;
        if (String(input.value) !== "") return;
        if (i === 0) return;

        // Backspace on empty -> go back (and clear previous so the user can re-type).
        e.preventDefault();
        const prevIdx = getPrevColumnMajorIndex(i);
        if (prevIdx === null) return;

        state.answers[prevIdx] = "";
        const prev = state.answerInputs[prevIdx];
        if (prev) prev.value = "";
        updateIndividualInputUI(prevIdx);
        focusInputAt(prevIdx);
        updateResults();
      });

      box.appendChild(input);
      cell.appendChild(box);
      grid.appendChild(cell);
      state.answerInputs.push(input);
      state.answerBoxes.push(box);
    }

    setTimeout(() => focusInputAt(0), 0);
  }

  function getCellNameForIndex(index) {
    const { cols } = getGridDef();

    if (isSpmLike()) {
      const letters = ["A", "B", "C", "D", "E"];
      const row = Math.floor(index / cols) + 1;
      const col = index % cols;
      const letter = letters[col] || "A";
      return `${letter}${row}`;
    }

    if (isCpmLike()) {
      // CPM: 3 columns x 12 rows with labels A, AB, B.
      const letters = ["A", "AB", "B"];
      const row = Math.floor(index / cols) + 1;
      const col = index % cols;
      const letter = letters[col] || "A";
      return `${letter}${row}`;
    }

    return null;
  }

  function renderAnswers() {
    resetAnswersPreservingMode();
    setAnswersHint();

    renderIndividualAnswers();

    // Reset result display on mode changes.
    updateResults();
  }

  async function exportPdf() {
    try {
      showToast("Generating PDF…");
      const pdfLib = /** @type {any} */ (window).PDFLib;
      if (!pdfLib) {
        showToast("PDF generator not available. Reload the app and try again.");
        return;
      }

      const title = "Raport de evaluare Raven";
      const testLabel = TEST_DEFINITIONS[state.testType].label;
      const name = dom.clientName.value.trim() || "-";
      const dob = formatBirthDateForExport();
      const age = formatAgeForExport();
      const rawScore = dom.rawScore.textContent || "-";
      const interpretation = getInterpretationPlainText() || "-";

      const { PDFDocument, StandardFonts, rgb } = pdfLib;
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait in points
      const { width, height } = page.getSize();

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const margin = 48;
      let y = height - margin;

      function drawText(text, x, size, isBold = false) {
        page.drawText(toPdfSafeText(text), {
          x,
          y,
          size,
          font: isBold ? fontBold : font,
          color: rgb(0.12, 0.16, 0.2)
        });
      }

      function drawKeyValue(label, value) {
        const labelX = margin;
        const valueX = margin + 160;
        drawText(label, labelX, 11, true);
        drawText(value, valueX, 11, false);
        y -= 18;
      }

      // Title
      drawText(title, margin, 16, true);
      y -= 26;

      drawKeyValue("Name", name);
      drawKeyValue("DOB", `${dob}  [${age}]`);
      drawKeyValue("Test Type", testLabel);
      y -= 8;

      // Answers section title
      drawText("Answers", margin, 12, true);
      y -= 16;

      // Answers table
      const { cols, rows } = getGridDef();
      const colLabels = isCpmLike() ? ["A", "AB", "B"] : ["A", "B", "C", "D", "E"];
      const tableCols = Math.min(cols, colLabels.length);
      const tableRows = rows || 0;

      const tableWidth = width - margin * 2;
      const rowHeaderW = 32;
      const cellW = (tableWidth - rowHeaderW) / Math.max(1, tableCols);
      const headerH = 18;
      const cellH = 18;

      const lineColor = rgb(0.25, 0.37, 0.30);
      const fillHeader = rgb(0.94, 0.95, 0.92);

      // Header background
      page.drawRectangle({ x: margin, y: y - headerH, width: tableWidth, height: headerH, color: fillHeader });

      // Header labels
      page.drawText("", { x: margin + 8, y: y - 13, size: 10, font: fontBold, color: rgb(0.12, 0.16, 0.2) });
      for (let c = 0; c < tableCols; c++) {
        const cx = margin + rowHeaderW + c * cellW;
        page.drawText(colLabels[c], {
          x: cx + cellW / 2 - (colLabels[c].length * 3),
          y: y - 13,
          size: 10,
          font: fontBold,
          color: rgb(0.12, 0.16, 0.2)
        });
      }

      // Grid lines + cells
      const tableTopY = y;
      const tableH = headerH + tableRows * cellH;

      // Outer border
      page.drawRectangle({ x: margin, y: tableTopY - tableH, width: tableWidth, height: tableH, borderColor: lineColor, borderWidth: 1 });

      // Vertical lines
      page.drawLine({ start: { x: margin + rowHeaderW, y: tableTopY }, end: { x: margin + rowHeaderW, y: tableTopY - tableH }, color: lineColor, thickness: 1 });
      for (let c = 1; c < tableCols; c++) {
        const x = margin + rowHeaderW + c * cellW;
        page.drawLine({ start: { x, y: tableTopY }, end: { x, y: tableTopY - tableH }, color: lineColor, thickness: 0.5 });
      }

      // Horizontal lines
      page.drawLine({ start: { x: margin, y: tableTopY - headerH }, end: { x: margin + tableWidth, y: tableTopY - headerH }, color: lineColor, thickness: 1 });
      for (let r = 1; r <= tableRows; r++) {
        const yy = tableTopY - headerH - r * cellH;
        page.drawLine({ start: { x: margin, y: yy }, end: { x: margin + tableWidth, y: yy }, color: lineColor, thickness: 0.5 });
      }

      // Row headers + values
      for (let r = 0; r < tableRows; r++) {
        const yy = tableTopY - headerH - r * cellH - 13;
        page.drawText(String(r + 1), { x: margin + 10, y: yy, size: 10, font: fontBold, color: rgb(0.12, 0.16, 0.2) });
        for (let c = 0; c < tableCols; c++) {
          const domIdx = r * cols + c;
          const v = state.answers?.[domIdx];
          if (v === "" || v == null) continue;
          const cx = margin + rowHeaderW + c * cellW;
          page.drawText(String(v), {
            x: cx + cellW / 2 - 3,
            y: yy,
            size: 10,
            font,
            color: rgb(0.12, 0.16, 0.2)
          });
        }
      }

      y = tableTopY - tableH - 22;

      drawKeyValue("Raw Score", rawScore);
      drawKeyValue("Interpretation", interpretation);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });

      const safeName = toPdfSafeText(name || "report").replace(/[\\\\/:*?\"<>|]+/g, "_").slice(0, 60);
      const filename = `Raven_Report_${safeName}.pdf`;

      // Prefer native share with file (WhatsApp-compatible on many Android browsers).
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ title, files: [file] });
          showToast("PDF ready.");
          return;
        } catch {
          // fall through to download
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("PDF downloaded.");
    } catch (e) {
      console.error("[PDF] export failed:", e);
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`PDF export failed: ${msg}`);
    }
  }

  function toPdfSafeText(value) {
    // pdf-lib StandardFonts (WinAnsi) can't encode Romanian diacritics.
    // We strip diacritics and keep a plain ASCII representation.
    const s = String(value ?? "");
    const noMarks =
      typeof s.normalize === "function"
        ? s
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
        : s;

    // Extra safety: remove any remaining non-ASCII characters.
    return noMarks.replace(/[^\x00-\x7F]/g, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function share() {
    const testLabel = TEST_DEFINITIONS[state.testType].label;

    const interp = getInterpretationPlainText();
    const summary = [
      `Digital Raven`,
      `Test: ${testLabel}`,
      dom.clientName.value.trim() ? `Client: ${dom.clientName.value.trim()}` : null,
      getDigitsFromBirthField(dom.birthDate?.value || "").length > 0
        ? `Data nașterii: ${formatBirthDateForExport()}`
        : null,
      dom.ageYears.value ? `Vârstă: ${formatAgeForExport()}` : null,
      `Raw score: ${dom.rawScore.textContent}`,
      interp && interp !== "-" ? `Interpretare:\n${interp}` : null
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      title: "Digital Raven",
      text: summary
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
        showToast("Shared successfully.");
        return;
      }

      // Fallback: copy to clipboard.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
        showToast("Share text copied to clipboard.");
        return;
      }

      showToast("Sharing not supported in this browser.");
    } catch {
      showToast("Sharing cancelled.");
    }
  }

  function syncSelectionsAndRender() {
    setActiveButton(dom.testTypeGroup, "test-type", state.testType);
    renderAnswers();
  }

  function attachEvents() {
    dom.testTypeGroup.addEventListener("click", (e) => {
      const target = e.target.closest("button[data-test-type]");
      if (!target) return;
      const next = target.getAttribute("data-test-type");
      if (!next) return;
      state.testType = next;
      syncAgeFromBirthDate();
      syncSelectionsAndRender();
    });

    dom.clientName.addEventListener("input", () => {
      updateResults();
    });
    if (dom.birthDate) {
      const supportsBeforeInput =
        typeof InputEvent !== "undefined" && typeof InputEvent.prototype !== "undefined" && "inputType" in InputEvent.prototype;
      if (supportsBeforeInput) {
        dom.birthDate.addEventListener("beforeinput", onBirthDateBeforeInput);
      } else {
        dom.birthDate.addEventListener("keydown", onBirthDateKeydownFallback);
      }
      dom.birthDate.addEventListener("input", onBirthDateInput);
      dom.birthDate.addEventListener("paste", onBirthDatePaste);
      dom.birthDate.addEventListener("focus", onBirthDateFocus);
    }

    dom.exportPdfBtn.addEventListener("click", exportPdf);
    dom.shareBtn.addEventListener("click", share);

    window.addEventListener("ravenNormsLoaded", (ev) => {
      const d = ev && /** @type {CustomEvent} */ (ev).detail;
      if (d && d.ok) ravenNormsStatus = "ok";
      else ravenNormsStatus = "failed";
      updateResults();
    });

    window.addEventListener("ravenCNormsLoaded", (ev) => {
      const d = ev && /** @type {CustomEvent} */ (ev).detail;
      if (d && d.ok) ravenCNormsStatus = "ok";
      else ravenCNormsStatus = "failed";
      updateResults();
    });

    window.addEventListener("discrepanteLoaded", (ev) => {
      const d = ev && /** @type {CustomEvent} */ (ev).detail;
      if (d && d.ok) discrepanteStatus = "ok";
      else discrepanteStatus = "failed";
      updateResults();
    });
  }

  function initOfflineIndicator() {
    function update() {
      const online = navigator.onLine;
      dom.offlineStatus.textContent = online ? "Online" : "Offline ready";
      dom.offlineStatus.style.opacity = online ? "0.7" : "0.92";
    }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((reg) => {
        // Ask the browser to check for an updated SW on load.
        try { reg.update(); } catch {}

        // If a new SW is waiting, activate it immediately.
        if (reg.waiting) {
          try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {}
        }

        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              // New version installed; activate then reload once.
              try { sw.postMessage({ type: "SKIP_WAITING" }); } catch {}
            }
          });
        });

        let reloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloaded) return;
          reloaded = true;
          window.location.reload();
        });
      })
      .catch(() => {
        // If registration fails, the UI still works as a web app.
      });
  }

  function init() {
    attachEvents();
    initOfflineIndicator();
    registerServiceWorker();
    setAnswersHint();
    ensureBirthDateMaskVisible();
    syncAgeFromBirthDate();
    syncSelectionsAndRender();
    void Promise.resolve(window.RavenNorms && window.RavenNorms.ready)
      .then(() => {
        if (ravenNormsStatus === "pending" && window.RavenNorms && window.RavenNorms._getTables && window.RavenNorms._getTables()) {
          ravenNormsStatus = "ok";
        }
        updateResults();
      })
      .catch(() => {
        ravenNormsStatus = "failed";
        updateResults();
      });
  }

  init();
})();

