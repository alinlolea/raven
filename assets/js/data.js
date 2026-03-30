const correctAnswers = {
  A: [4, 5, 1, 2, 6, 3, 6, 2, 1, 3, 4, 5],
  B: [2, 6, 1, 2, 1, 3, 5, 6, 4, 3, 4, 5],
  C: [8, 2, 3, 8, 7, 4, 5, 1, 7, 6, 1, 2],
  D: [3, 4, 3, 7, 8, 6, 5, 4, 1, 2, 5, 6],
  E: [7, 6, 8, 2, 1, 5, 1, 6, 3, 2, 4, 5]
};

const STANDARD_CORRECT_FLAT = (() => {
  const letters = ["A", "B", "C", "D", "E"];
  const out = [];
  for (const L of letters) {
    out.push(...correctAnswers[L]);
  }
  return out;
})();

/** Normative year bands; min/max are total age in months (inclusive). */
const AGE_YEAR_MIN = 5;
const AGE_YEAR_MAX = 80;

const ageRanges = (() => {
  const rows = [];
  for (let y = AGE_YEAR_MIN; y <= AGE_YEAR_MAX; y++) {
    rows.push({
      min: y * 12,
      max: y * 12 + 11,
      label: `${y} ani 0 luni – ${y} ani 11 luni`
    });
  }
  return rows;
})();
