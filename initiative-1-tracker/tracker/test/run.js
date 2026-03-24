/**
 * Minimal test: smoke + loadConfig + collect filterLastDays.
 */
const path = require('path');
const { loadConfig } = require('../lib/loadConfig');
const { filterLastDays, isValidPublicUrl } = require('../lib/collect');
const { retentionCutoffDate } = require('../lib/storage');

let ok = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) ok++;
  else { fail++; console.error('FAIL:', msg); }
}

// Smoke: require index and run default (we don't exec child, just that collect/loadConfig exist)
assert(typeof loadConfig === 'function', 'loadConfig exists');
const config = loadConfig();
assert(Array.isArray(config.products) && config.products.length > 0, 'config has products');
assert(Array.isArray(config.competitors) && config.competitors.length > 0, 'config has competitors');

// filterLastDays
const signals = [
  { date: '2025-02-20', snippet: 'a' },
  { date: '2025-01-01', snippet: 'b' },
];
const filtered = filterLastDays(signals, 7);
assert(Array.isArray(filtered) && filtered.length <= 2, 'filterLastDays returns array');

assert(isValidPublicUrl('https://example.com/feed') === true, 'valid https URL');
assert(isValidPublicUrl('ftp://x') === false, 'reject non-http(s)');
assert(isValidPublicUrl('') === false, 'reject empty URL');

const cut = retentionCutoffDate(7);
assert(/^\d{4}-\d{2}-\d{2}$/.test(cut), 'retentionCutoffDate YYYY-MM-DD');
const today = new Date().toISOString().slice(0, 10);
assert(cut <= today, 'retentionCutoffDate not in the future');

// First-version: getSignals, buildGapReport, getWhatToChange
const { getSignals } = require('../lib/storage');
const { buildGapReport } = require('../lib/gapReport');
const { getWhatToChange } = require('../lib/whatToChange');
assert(typeof getSignals === 'function', 'getSignals exists');
const empty = getSignals('ProductA', '2020-01-01', '2020-01-07');
assert(Array.isArray(empty), 'getSignals returns array');
const report = buildGapReport('ProductA', '2020-01-01', '2020-01-07');
assert(report && report.report_id && report.product_id === 'ProductA' && Array.isArray(report.gaps), 'buildGapReport returns report');
const changes = getWhatToChange(report);
assert(Array.isArray(changes), 'getWhatToChange returns array');

console.log('Tests:', ok, 'ok', fail, 'fail');
process.exit(fail ? 1 : 0);
