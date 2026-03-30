(() => {
  "use strict";

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
    age: document.getElementById("age"),
    answersHint: document.getElementById("answersHint"),
    answersArea: document.getElementById("answersArea"),
    rawScore: document.getElementById("rawScore"),
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
        ? `Enter values 1–6 (${total} items).`
        : `Paste values 1–6 separated by spaces/newlines (${total} items max).`;
  }

  function parseBulk(text) {
    // Capture integers and keep those between 1 and 6.
    const found = String(text)
      .match(/\d+/g)
      ?.map((t) => Number(t))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 6) || [];
    return found;
  }

  function allFilled() {
    return state.answers.length > 0 && state.answers.every((v) => v !== "" && v !== null && v !== undefined);
  }

  function renderScorePlaceholder() {
    if (!allFilled()) {
      dom.rawScore.textContent = "—";
      dom.interpretation.textContent = "Awaiting scoring logic…";
      return;
    }

    // Scoring logic intentionally not implemented yet.
    dom.rawScore.textContent = "Pending…";
    dom.interpretation.textContent =
      "Answers are ready. Scoring and interpretation will be added later.";
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

  function updateIndividualInputUI(index) {
    const box = state.answerBoxes[index];
    if (!box) return;
    const filled = state.answers[index] !== "";
    box.classList.toggle("is-filled", filled);
  }

  function clampAnswerValue(raw) {
    // Allow the input to be cleared.
    if (raw === "" || raw === null || raw === undefined) return "";
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    if (n < 1) return 1;
    if (n > 6) return 6;
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
      input.min = "1";
      input.max = "6";
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

        renderScorePlaceholder();
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
          const prevBox = state.answerBoxes[prevIdx];
          if (prev) prev.value = "";
          if (prevBox) prevBox.classList.remove("is-filled");
          focusInputAt(prevIdx);
        } else {
          state.answers[i - 1] = "";
          const prev = state.answerInputs[i - 1];
          const prevBox = state.answerBoxes[i - 1];
          if (prev) prev.value = "";
          if (prevBox) prevBox.classList.remove("is-filled");
          focusInputAt(i - 1);
        }
        renderScorePlaceholder();
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
    textarea.placeholder = "Paste answers here (values 1–6). Example: 1 2 3 4 5 …";
    textarea.setAttribute("aria-label", "Bulk answers input");

    textarea.addEventListener("input", () => {
      const parsed = parseBulk(textarea.value);
      const total = getItemCount();

      state.answers = new Array(total).fill("");
      for (let i = 0; i < total; i++) {
        if (i < parsed.length) state.answers[i] = parsed[i];
      }

      renderScorePlaceholder();
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
    renderScorePlaceholder();
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
      age: dom.age.value ? String(dom.age.value) : "(not provided)",
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
                <div class="k">Age</div><div class="v">${escapeHtml(payload.age)}</div>
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
      dom.age.value ? `Age: ${dom.age.value}` : null,
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
      // Placeholder: no scoring logic yet.
      renderScorePlaceholder();
    });
    dom.age.addEventListener("input", () => {
      // Placeholder: no scoring logic yet.
      renderScorePlaceholder();
    });

    dom.exportPdfBtn.addEventListener("click", exportPdf);
    dom.shareBtn.addEventListener("click", share);
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
    syncSelectionsAndRender();
  }

  init();
})();

