const { loadConfig } = require('./loadConfig');
const { buildGapReport } = require('./gapReport');
const { buildResponseSchema } = require('./responseSchema');
const { getWhatToChange } = require('./whatToChange');

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
    const responses = buildResponseSchema(report);
    const changes = getWhatToChange(report, responses);
    return {
      product: { id: product.id, name: product.name },
      periodStart,
      periodEnd,
      report,
      changes,
    };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { getReportData, getPeriodDays };
