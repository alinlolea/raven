(() => {
  "use strict";

  const ANSWER_MIN = 1;
  const ANSWER_MAX = 8;

  /** @type {"pending"|"ok"|"failed"} */
  let ravenNormsStatus = "pending";

  const TEST_DEFINITIONS = {
    standard: { label: "Standard", items: 60 },
    plus: { label: "Plus", items: 30 },
    color: { label: "Color", items: 24 }
  };

  const state = {
    testType: "standard",
    inputMode: "individual",
    answers: [],
    answerInputs: [],
    answerBoxes: [],
    bulkTextEl: null
  };

  const dom = {
    testTypeGroup: document.getElementById("testTypeGroup"),
    inputModeGroup: document.getElementById("inputModeGroup"),
    clientName: document.getElementById("clientName"),
    ageYears: document.getElementById("ageYears"),
    ageMonths: document.getElementById("ageMonths"),
    ageGroupLine: document.getElementById("ageGroupLine"),
    ageWarnLine: document.getElementById("ageWarnLine"),
    answersHint: document.getElementById("answersHint"),
    answersArea: document.getElementById("answersArea"),
    rawScore: document.getElementById("raw-score"),
    interpretation: document.getElementById("interpretation"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    shareBtn: document.getElementById("shareBtn"),
    toast: document.getElementById("toast"),
    offlineStatus: document.getElementById("offlineStatus"),
    resultSection: document.getElementById("resultSection"),
    calculateBtn: document.getElementById("calculateBtn"),
    calculateDebug: document.getElementById("calculate-debug")
  };

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
    if (!Number.isFinite(n)) return AGE_YEAR_MIN;
    let v = Math.round(n);
    if (v < AGE_YEAR_MIN) v = AGE_YEAR_MIN;
    if (v > AGE_YEAR_MAX) v = AGE_YEAR_MAX;
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
    dom.ageGroupLine.textContent = "";
    dom.ageWarnLine.hidden = true;
    dom.ageWarnLine.textContent = "";
    dom.ageYears.classList.remove("is-invalid");
    dom.ageMonths.classList.remove("is-invalid");

    const yVal = dom.ageYears.value;
    const mVal = dom.ageMonths.value;

    if (yVal === "") {
      if (mVal !== "") {
        dom.ageWarnLine.hidden = false;
        dom.ageWarnLine.textContent = "Introduceți și numărul de ani.";
        dom.ageMonths.classList.add("is-invalid");
      }
      return;
    }

    const years = clampAgeYears(Number(yVal));
    const months = mVal === "" ? 0 : clampAgeMonths(Number(mVal));
    if (mVal !== "") dom.ageMonths.value = String(months);

    const total = getTotalMonths(years, months);
    const group = getAgeGroup(total);
    if (group) {
      dom.ageGroupLine.textContent = `Grupă de vârstă: ${group.label}`;
    } else {
      dom.ageWarnLine.hidden = false;
      dom.ageWarnLine.textContent = "Vârsta nu se încadrează în intervalul normelor disponibile.";
    }
  }

  function onAgeYearsInput() {
    const raw = dom.ageYears.value;
    if (raw === "") {
      updateAgeUI();
      updateResults();
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      dom.ageYears.value = "";
      updateAgeUI();
      updateResults();
      return;
    }
    const clamped = clampAgeYears(n);
    dom.ageYears.value = String(clamped);
    dom.ageYears.classList.toggle("is-invalid", n !== clamped);
    updateAgeUI();
    updateResults();
  }

  function onAgeMonthsInput() {
    const raw = dom.ageMonths.value;
    if (raw === "") {
      updateAgeUI();
      updateResults();
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      dom.ageMonths.value = "";
      updateAgeUI();
      updateResults();
      return;
    }
    const clamped = clampAgeMonths(n);
    dom.ageMonths.value = String(clamped);
    dom.ageMonths.classList.toggle("is-invalid", n !== clamped);
    updateAgeUI();
    updateResults();
  }

  function formatAgeForExport() {
    const yVal = dom.ageYears.value;
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
    return TEST_DEFINITIONS[state.testType].items;
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
    dom.answersHint.textContent =
      state.inputMode === "individual"
        ? `Enter values ${ANSWER_MIN}–${ANSWER_MAX} (${total} items).`
        : `Paste values ${ANSWER_MIN}–${ANSWER_MAX} separated by spaces/newlines (${total} items max).`;
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
    let score = 0;
    for (let domIdx = 0; domIdx < len; domIdx++) {
      const row = Math.floor(domIdx / 5);
      const col = domIdx % 5;
      const flatIdx = col * 12 + row;
      const u = userAnswers[domIdx];
      if (u === "" || u === null || u === undefined) continue;
      if (Number(u) === correctAnswersFlat[flatIdx]) score++;
    }
    return score;
  }

  function getUserTotalMonthsOrNull() {
    const yVal = dom.ageYears.value;
    if (yVal === "") return null;
    const years = clampAgeYears(Number(yVal));
    const mVal = dom.ageMonths.value;
    const months = mVal === "" ? 0 : clampAgeMonths(Number(mVal));
    return getTotalMonths(years, months);
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
      if (state.testType !== "standard") {
        blockReason = "not_standard_test";
        dom.rawScore.textContent = dash;
        dom.interpretation.textContent = dash;
        console.log({ rawScore, spmPlus, ageIndex, result, blockReason });
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      if (!STANDARD_CORRECT_FLAT || STANDARD_CORRECT_FLAT.length === 0 || !state.answers.length) {
        blockReason = "no_answer_data";
        dom.rawScore.textContent = dash;
        dom.interpretation.textContent = dash;
        console.log({ rawScore, spmPlus, ageIndex, result, blockReason });
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      rawScore = calculateRawScore(state.answers, STANDARD_CORRECT_FLAT);
      dom.rawScore.textContent = String(rawScore);

      const hasAge = dom.ageYears.value.trim() !== "";
      const readyForNorms = hasAge && rawScore >= 1;

      if (!readyForNorms) {
        blockReason = !hasAge ? "need_age_years" : "need_at_least_one_correct";
        dom.interpretation.textContent = dash;
        spmPlus = null;
        ageIndex = null;
        result = null;
        console.log({ rawScore, spmPlus, ageIndex, result, blockReason });
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      if (typeof window.getSPMPlus !== "function") {
        blockReason = "getSPMPlus_missing";
        dom.interpretation.textContent = dash;
        spmPlus = null;
        ageIndex = null;
        result = null;
        console.log({ rawScore, spmPlus, ageIndex, result, blockReason });
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      spmPlus = window.getSPMPlus(rawScore);
      if (spmPlus === null || spmPlus === undefined) {
        if (ravenNormsStatus === "pending") {
          blockReason = "norms_pending_or_raw_out_of_table";
          dom.interpretation.textContent = "Se încarcă normele…";
        } else if (ravenNormsStatus === "failed") {
          blockReason = "norms_csv_failed";
          dom.interpretation.textContent = "Norme indisponibile (CSV).";
        } else {
          blockReason = "getSPMPlus_null";
          dom.interpretation.textContent = dash;
        }
        ageIndex = null;
        result = null;
        console.log({ rawScore, spmPlus, ageIndex, result, ravenNormsStatus, blockReason });
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      const totalMonths = getUserTotalMonthsOrNull();
      if (totalMonths === null) {
        blockReason = "total_months_null";
        dom.interpretation.textContent = dash;
        ageIndex = null;
        result = null;
        console.log({ rawScore, spmPlus, ageIndex, result, blockReason });
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      const norms = window.RavenNorms;
      ageIndex =
        norms && typeof norms.getAgeIndexForTotalMonths === "function"
          ? norms.getAgeIndexForTotalMonths(totalMonths)
          : -1;

      if (ageIndex < 0) {
        blockReason = "age_outside_csv_bands";
        dom.interpretation.textContent = "Vârsta nu se încadrează în normele CSV.";
        result = null;
        console.log({ rawScore, spmPlus, ageIndex, result, blockReason });
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      if (typeof window.getResult !== "function") {
        blockReason = "getResult_missing";
        dom.interpretation.textContent = dash;
        result = null;
        console.log({ rawScore, spmPlus, ageIndex, result, blockReason });
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      result = window.getResult(spmPlus, ageIndex);
      if (!result) {
        blockReason = "getResult_null";
        dom.interpretation.textContent = dash;
        console.log({ rawScore, spmPlus, ageIndex, result, blockReason });
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      blockReason = null;
      dom.interpretation.textContent = `Percentilă: ${result.percentile} | IQ: ${result.iq}`;
      console.log({ rawScore, spmPlus, ageIndex, result });
      return { rawScore, spmPlus, ageIndex, result, blockReason };
    } catch (e) {
      console.error("[Raven] updateResults:", e);
      blockReason = "exception";
      dom.rawScore.textContent = dash;
      dom.interpretation.textContent = dash;
      console.log({ rawScore, spmPlus, ageIndex, result, blockReason, error: String(e) });
      return { rawScore, spmPlus, ageIndex, result, blockReason };
    }
  }

  async function runCalculate() {
    showToast("Calculating…");
    try {
      if (window.RavenNorms && window.RavenNorms.ready) {
        await window.RavenNorms.ready;
      }
    } catch {
      // norms load failed; updateResults still reports status
    }
    if (window.RavenNorms && window.RavenNorms._getTables && window.RavenNorms._getTables()) {
      ravenNormsStatus = "ok";
    }
    const out = updateResults();
    const totalMonths = getUserTotalMonthsOrNull();
    const filledCells = state.answers.filter((v) => v !== "" && v != null).length;
    const tables = window.RavenNorms && window.RavenNorms._getTables && window.RavenNorms._getTables();
    const report = {
      time: new Date().toISOString(),
      testType: state.testType,
      normsCsvStatus: ravenNormsStatus,
      normsTablesLoaded: !!tables,
      ageYears: dom.ageYears.value || "(empty)",
      ageMonths: dom.ageMonths.value || "(empty)",
      totalMonths,
      filledAnswerCells: filledCells,
      rawScore: out && out.rawScore,
      spmPlus: out && out.spmPlus,
      ageIndex: out && out.ageIndex,
      blockReason: out && out.blockReason,
      result: out && out.result,
      interpretationUi: dom.interpretation.textContent
    };
    console.log("[Calculate] report", report);
    if (dom.calculateDebug) {
      dom.calculateDebug.hidden = false;
      dom.calculateDebug.textContent = JSON.stringify(report, null, 2);
    }
    showToast("Calculate finished — see debug panel below.");
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

  function getStandardExpectedAnswer(domIndex) {
    const row = Math.floor(domIndex / 5);
    const col = domIndex % 5;
    return STANDARD_CORRECT_FLAT[col * 12 + row];
  }

  function updateAnswerValidation(index) {
    const box = state.answerBoxes[index];
    if (!box) return;
    box.classList.remove("correct", "incorrect");
    if (state.testType !== "standard" || state.answers[index] === "") return;
    const expected = getStandardExpectedAnswer(index);
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

  function clampAnswerValue(raw) {
    if (raw === "" || raw === null || raw === undefined) return "";
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    if (n < ANSWER_MIN) return ANSWER_MIN;
    if (n > ANSWER_MAX) return ANSWER_MAX;
    return n;
  }

  function getStandardLayoutPartsFromIndex(index) {
    // For Standard: 5 columns (A-E) x 12 rows (1-12).
    // DOM order is row-major: A1,B1,C1,D1,E1,A2,... (index increases across columns).
    const cols = 5;
    const rows = 12;
    const rowIdx = Math.floor(index / cols); // 0..11
    const colIdx = index % cols; // 0..4
    return { rowIdx, colIdx, cols, rows };
  }

  function getNextStandardIndex(index) {
    const { rowIdx, colIdx, cols, rows } = getStandardLayoutPartsFromIndex(index);

    // Desired focus order: A1..A12, then B1..B12, etc.
    // That means: first move down rows within the same column letter.
    if (rowIdx < rows - 1) {
      return (rowIdx + 1) * cols + colIdx;
    }
    // At the bottom row: move to next column, reset to first row.
    if (colIdx < cols - 1) {
      return 0 * cols + (colIdx + 1);
    }
    return null; // Last cell
  }

  function getPrevStandardIndex(index) {
    const { rowIdx, colIdx, cols, rows } = getStandardLayoutPartsFromIndex(index);

    // Reverse of getNextStandardIndex.
    if (rowIdx > 0) {
      return (rowIdx - 1) * cols + colIdx;
    }
    if (colIdx > 0) {
      return (rows - 1) * cols + (colIdx - 1);
    }
    return null; // First cell
  }

  function renderIndividualAnswers() {
    const total = getItemCount();
    dom.answersArea.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "answersGrid";
    if (state.testType === "standard") grid.classList.add("is-standard");
    dom.answersArea.appendChild(grid);

    state.answerInputs = [];
    state.answerBoxes = [];

    for (let i = 0; i < total; i++) {
      const standardCellName = getStandardCellName(i);
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
      input.placeholder = state.testType === "standard" ? standardCellName : "—";
      input.className = "answerInput";
      input.id = state.testType === "standard" ? `answer-${standardCellName}` : `answer-${i}`;
      input.setAttribute(
        "aria-label",
        state.testType === "standard" ? `Answer ${standardCellName} of Standard` : `Answer ${i + 1} of ${total}`
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
          if (state.testType === "standard") {
            const nextIdx = getNextStandardIndex(i);
            if (nextIdx !== null) focusInputAt(nextIdx);
          } else if (i < total - 1) {
            focusInputAt(i + 1);
          }
        }

        updateResults();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key !== "Backspace") return;
        if (String(input.value) !== "") return;
        if (i === 0) return;

        // Backspace on empty -> go back (and clear previous so the user can re-type).
        e.preventDefault();
        if (state.testType === "standard") {
          const prevIdx = getPrevStandardIndex(i);
          if (prevIdx === null) return;

          state.answers[prevIdx] = "";
          const prev = state.answerInputs[prevIdx];
          if (prev) prev.value = "";
          updateIndividualInputUI(prevIdx);
          focusInputAt(prevIdx);
        } else {
          state.answers[i - 1] = "";
          const prev = state.answerInputs[i - 1];
          if (prev) prev.value = "";
          updateIndividualInputUI(i - 1);
          focusInputAt(i - 1);
        }
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

  function getStandardCellName(index) {
    // Standard: 60 answers laid out as 12 rows x 5 columns (A-E).
    // Labels should match the visual grid (row-major DOM order).
    // Visual order across the top row: A1, B1, C1, D1, E1.
    const rows = 12;
    const cols = 5;
    const letters = ["A", "B", "C", "D", "E"];

    const row = Math.floor(index / cols) + 1; // 1..12
    const col = index % cols; // 0..4
    const letter = letters[col] || "A";
    return `${letter}${row}`;
  }

  function renderBulkAnswers() {
    dom.answersArea.innerHTML = "";

    const textarea = document.createElement("textarea");
    textarea.className = "bulkArea";
    textarea.id = "bulkAnswers";
    textarea.placeholder = `Paste answers here (values ${ANSWER_MIN}–${ANSWER_MAX}). Example: 1 2 3 4 5 …`;
    textarea.setAttribute("aria-label", "Bulk answers input");

    textarea.addEventListener("input", () => {
      const parsed = parseBulk(textarea.value);
      const total = getItemCount();

      state.answers = new Array(total).fill("");
      for (let i = 0; i < total; i++) {
        if (i < parsed.length) state.answers[i] = parsed[i];
      }

      updateResults();
    });

    dom.answersArea.appendChild(textarea);
    state.bulkTextEl = textarea;

    setTimeout(() => textarea.focus(), 0);
  }

  function renderAnswers() {
    resetAnswersPreservingMode();
    setAnswersHint();

    if (state.inputMode === "individual") {
      renderIndividualAnswers();
    } else {
      renderBulkAnswers();
    }

    // Reset result display on mode changes.
    updateResults();
  }

  function exportPdf() {
    // Minimal export UI: open a print view; user can "Save as PDF" in the dialog.
    const testLabel = TEST_DEFINITIONS[state.testType].label;
    const filled = allFilled();
    const answersText =
      filled && state.answers.length
        ? state.answers.map((v, idx) => `${idx + 1}:${v}`).join(" ")
        : "(answers not complete)";

    const payload = {
      clientName: dom.clientName.value.trim() || "(not provided)",
      age: formatAgeForExport(),
      testType: testLabel,
      rawScore: dom.rawScore.textContent,
      interpretation: dom.interpretation.textContent,
      answersText
    };

    try {
      const w = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
      if (!w) {
        window.print();
        return;
      }

      w.document.write(`<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Digital Raven - Export</title>
            <style>
              body{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; color: #1F2933; }
              .header{ margin-bottom: 18px; }
              .card{ border: 1px solid rgba(63, 94, 77, .25); border-radius: 16px; padding: 16px; background: rgba(79, 111, 95, .06); }
              .kv{ display:grid; grid-template-columns: 160px 1fr; gap: 8px 14px; }
              .k{ font-weight: 700; opacity: .8; }
              .v{ white-space: pre-wrap; }
              .answers{ margin-top: 14px; }
              .muted{ opacity: .75; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2 style="margin:0 0 6px;">Digital Raven</h2>
              <div class="muted">Psychological test scoring export</div>
            </div>
            <div class="card">
              <div class="kv">
                <div class="k">Client</div><div class="v">${escapeHtml(payload.clientName)}</div>
                <div class="k">Vârstă</div><div class="v">${escapeHtml(payload.age)}</div>
                <div class="k">Test type</div><div class="v">${escapeHtml(payload.testType)}</div>
                <div class="k">Raw score</div><div class="v">${escapeHtml(payload.rawScore)}</div>
                <div class="k">Interpretation</div><div class="v">${escapeHtml(payload.interpretation)}</div>
              </div>
              <div class="answers">
                <div class="k" style="margin-bottom:8px;">Answers</div>
                <div class="v">${escapeHtml(payload.answersText)}</div>
              </div>
            </div>
            <script>
              setTimeout(() => { window.focus(); window.print(); }, 120);
            <\/script>
          </body>
        </html>`);

      w.document.close();
      return;
    } catch {
      window.print();
    }
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

    const summary = [
      `Digital Raven`,
      `Test: ${testLabel}`,
      dom.clientName.value.trim() ? `Client: ${dom.clientName.value.trim()}` : null,
      dom.ageYears.value ? `Vârstă: ${formatAgeForExport()}` : null,
      `Raw score: ${dom.rawScore.textContent}`
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
    setActiveButton(dom.inputModeGroup, "input-mode", state.inputMode);
    renderAnswers();
  }

  function attachEvents() {
    dom.testTypeGroup.addEventListener("click", (e) => {
      const target = e.target.closest("button[data-test-type]");
      if (!target) return;
      const next = target.getAttribute("data-test-type");
      if (!next) return;
      state.testType = next;
      syncSelectionsAndRender();
    });

    dom.inputModeGroup.addEventListener("click", (e) => {
      const target = e.target.closest("button[data-input-mode]");
      if (!target) return;
      const next = target.getAttribute("data-input-mode");
      if (!next) return;
      state.inputMode = next;
      syncSelectionsAndRender();
    });

    dom.clientName.addEventListener("input", () => {
      updateResults();
    });
    dom.ageYears.addEventListener("input", onAgeYearsInput);
    dom.ageMonths.addEventListener("input", onAgeMonthsInput);

    dom.exportPdfBtn.addEventListener("click", exportPdf);
    dom.shareBtn.addEventListener("click", share);

    if (dom.calculateBtn) {
      dom.calculateBtn.addEventListener("click", () => {
        void runCalculate();
      });
    }

    window.addEventListener("ravenNormsLoaded", (ev) => {
      const d = ev && /** @type {CustomEvent} */ (ev).detail;
      if (d && d.ok) ravenNormsStatus = "ok";
      else ravenNormsStatus = "failed";
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
      .catch(() => {
        // If registration fails, the UI still works as a web app.
      });
  }

  function init() {
    attachEvents();
    initOfflineIndicator();
    registerServiceWorker();
    setAnswersHint();
    updateAgeUI();
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

