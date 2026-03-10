/**
 * Minimal test: smoke + loadConfig + collect filterLastDays.
 */
const path = require('path');
const { loadConfig } = require('../lib/loadConfig');
const { filterLastDays } = require('../lib/collect');

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

console.log('Tests:', ok, 'ok', fail, 'fail');
process.exit(fail ? 1 : 0);
