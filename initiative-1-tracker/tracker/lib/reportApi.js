const { loadConfig } = require('./loadConfig');
const { buildGapReport } = require('./gapReport');
const { buildResponseSchema } = require('./responseSchema');
const { getWhatToChange } = require('./whatToChange');
const { buildCursorInterpretationPackage } = require('./interpreterPayload');

/** Set once per Node process so the UI can tell if you’re still on an old server. */
const PROCESS_STARTED_AT = new Date().toISOString();

function getPeriodDays(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

/**
 * Build report data for API/frontend. Returns { product, periodStart, periodEnd, report, changes } or { error }.
 */
function getReportData(days = 7) {
  try {
    const config = loadConfig();
    const product = config.products[0];
    if (!product) return { error: 'No product in config' };
    const { periodStart, periodEnd } = getPeriodDays(days);
    const report = buildGapReport(product.id, periodStart, periodEnd);
    const compById = {};
    for (const c of config.competitors || []) {
      if (c && c.id) compById[c.id] = c;
    }
    report.gaps = (report.gaps || []).map((g) => {
      const cid = g.competitor_id;
      const cname = cid && compById[cid] ? compById[cid].name : '';
      return {
        ...g,
        cursor_interpretation: buildCursorInterpretationPackage(g, {
          product_id: product.id,
          product_name: product.name,
          period_start: periodStart,
          period_end: periodEnd,
          competitor_name: cname || undefined,
        }),
      };
    });
    const responses = buildResponseSchema(report, product.id);
    const changes = getWhatToChange(report, responses);
    return {
      product: { id: product.id, name: product.name },
      periodStart,
      periodEnd,
      report,
      changes,
      viewer: {
        process_started_at: PROCESS_STARTED_AT,
      },
    };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { getReportData, getPeriodDays };
