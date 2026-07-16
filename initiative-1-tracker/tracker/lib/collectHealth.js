/**
 * Per-competitor row-count regression + per-lane scrape failures.
 * Catches silent lane failures (e.g. competitor drops from N rows to 0,
 * or RSS parse errors that used to return [] with no signal).
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
 * @param {object[]} [laneResults]
 * @returns {Array<{ competitor_id: string, lane: string, url: string, error: string }>}
 */
function laneFailuresFromResults(laneResults) {
  const failures = [];
  for (const row of laneResults || []) {
    if (!row || row.status !== 'error') continue;
    failures.push({
      competitor_id: row.competitor_id || 'unknown',
      lane: row.lane || 'unknown',
      url: row.url || '',
      error: row.error || 'unknown error',
    });
  }
  return failures;
}

/**
 * @param {object[]} currentSignals
 * @param {object[]} [priorSignals]
 * @param {object[]} [laneResults]
 * @param {{ ignoreCompetitorIds?: string[] }} [opts]
 * @returns {{
 *   ok: boolean,
 *   regressions: Array<{ competitor_id: string, prior: number, current: number }>,
 *   lane_failures: Array<{ competitor_id: string, lane: string, url: string, error: string }>,
 *   lane_results: object[],
 * }}
 */
function checkCollectHealth(currentSignals, priorSignals, laneResults, opts = {}) {
  const ignore = new Set(opts.ignoreCompetitorIds || []);
  const prior = countByCompetitor(priorSignals);
  const current = countByCompetitor(currentSignals);
  const regressions = [];

  for (const [id, priorCount] of Object.entries(prior)) {
    if (ignore.has(id)) continue;
    const cur = current[id] || 0;
    if (priorCount >= 5 && cur === 0) {
      regressions.push({ competitor_id: id, prior: priorCount, current: cur });
    }
  }

  const lane_failures = laneFailuresFromResults(laneResults);
  const ok = regressions.length === 0 && lane_failures.length === 0;

  return {
    ok,
    regressions,
    lane_failures,
    lane_results: Array.isArray(laneResults) ? laneResults : [],
  };
}

module.exports = {
  checkCollectHealth,
  countByCompetitor,
  laneFailuresFromResults,
};
