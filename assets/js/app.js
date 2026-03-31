(() => {
  "use strict";

  const ANSWER_MIN = 1;
  const ANSWER_MAX = 8;

  // Age range (years) supported by this UI.
  const AGE_YEAR_MIN = 6;
  const AGE_YEAR_MAX = 80;

  /** @type {"pending"|"ok"|"failed"} */
  let ravenNormsStatus = "pending";

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
    resultSection: document.getElementById("resultSection")
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

    if (yearsNum < AGE_YEAR_MIN || yearsNum > AGE_YEAR_MAX) {
      return;
    }

    const years = yearsNum;
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
    const cleaned = raw.replace(/\D/g, "");
    if (cleaned !== raw) {
      dom.ageYears.value = cleaned;
    }
    updateAgeUI();
    updateResults();
  }

  function onAgeYearsBlur() {
    const raw = dom.ageYears.value.trim();
    if (raw === "") {
      updateAgeUI();
      updateResults();
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      dom.ageYears.value = "";
    } else {
      const c = clampAgeYears(n);
      dom.ageYears.value = String(c);
      dom.ageYears.classList.toggle("is-invalid", n !== c);
    }
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
    const cleaned = raw.replace(/\D/g, "");
    if (cleaned !== raw) {
      dom.ageMonths.value = cleaned;
    }
    updateAgeUI();
    updateResults();
  }

  function onAgeMonthsBlur() {
    const raw = dom.ageMonths.value;
    if (raw === "") {
      updateAgeUI();
      updateResults();
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      dom.ageMonths.value = "";
    } else {
      const c = clampAgeMonths(n);
      dom.ageMonths.value = String(c);
      dom.ageMonths.classList.toggle("is-invalid", n !== c);
    }
    updateAgeUI();
    updateResults();
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
    const yVal = dom.ageYears.value.trim();
    if (yVal === "") return null;
    const n = Number(yVal);
    if (!Number.isFinite(n)) return null;
    if (n < AGE_YEAR_MIN || n > AGE_YEAR_MAX) return null;
    const years = n;
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
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      if (!STANDARD_CORRECT_FLAT || STANDARD_CORRECT_FLAT.length === 0 || !state.answers.length) {
        blockReason = "no_answer_data";
        dom.rawScore.textContent = dash;
        dom.interpretation.textContent = dash;
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      rawScore = calculateRawScore(state.answers, STANDARD_CORRECT_FLAT);
      dom.rawScore.textContent = String(rawScore);

      const totalMonths = getUserTotalMonthsOrNull();
      const readyForNorms = totalMonths !== null && rawScore >= 1;

      if (!readyForNorms) {
        blockReason = rawScore < 1 ? "need_at_least_one_correct" : "need_valid_age_6_80_or_months";
        dom.interpretation.textContent = dash;
        spmPlus = null;
        ageIndex = null;
        result = null;
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      if (typeof window.getSPMPlus !== "function") {
        blockReason = "getSPMPlus_missing";
        dom.interpretation.textContent = dash;
        spmPlus = null;
        ageIndex = null;
        result = null;
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
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      if (typeof window.getResult !== "function") {
        blockReason = "getResult_missing";
        dom.interpretation.textContent = dash;
        result = null;
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      result = window.getResult(spmPlus, ageIndex);
      if (!result) {
        blockReason = "getResult_null";
        dom.interpretation.textContent = dash;
        return { rawScore, spmPlus, ageIndex, result, blockReason };
      }

      blockReason = null;
      dom.interpretation.textContent = `Percentilă: ${result.percentile} | IQ: ${result.iq}`;
      return { rawScore, spmPlus, ageIndex, result, blockReason };
    } catch (e) {
      console.error("[Raven] updateResults:", e);
      blockReason = "exception";
      dom.rawScore.textContent = dash;
      dom.interpretation.textContent = dash;
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
    dom.ageYears.addEventListener("blur", onAgeYearsBlur);
    dom.ageMonths.addEventListener("input", onAgeMonthsInput);
    dom.ageMonths.addEventListener("blur", onAgeMonthsBlur);

    dom.exportPdfBtn.addEventListener("click", exportPdf);
    dom.shareBtn.addEventListener("click", share);

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

