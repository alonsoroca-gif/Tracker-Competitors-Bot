/**
 * Per-competitor row-count regression check after collect.
 * Catches silent lane failures (e.g. competitor drops from N rows to 0).
 */

function countByCompetitor(signals) {
  const m = {};
  for (const s of signals || []) {
    const id = s.competitor_id || 'unknown';
    m[id] = (m[id] || 0) + 1;
  }
  return m;
}

/**
 * @param {object[]} currentSignals
 * @param {object[]} [priorSignals]
 * @returns {{ ok: boolean, regressions: Array<{ competitor_id: string, prior: number, current: number }> }}
 */
function checkCollectHealth(currentSignals, priorSignals) {
  const prior = countByCompetitor(priorSignals);
  const current = countByCompetitor(currentSignals);
  const regressions = [];

  for (const [id, priorCount] of Object.entries(prior)) {
    const cur = current[id] || 0;
    if (priorCount >= 5 && cur === 0) {
      regressions.push({ competitor_id: id, prior: priorCount, current: cur });
    }
  }

  return { ok: regressions.length === 0, regressions };
}

module.exports = { checkCollectHealth, countByCompetitor };
