#!/usr/bin/env node
/**
 * Merge parity-results.json into signals-table.json while preserving the locked
 * "We found… → Won't chase — already shipped in Core (…)" narrative.
 *
 * Never replace why_routing / signal_summary with bare match-count jargon.
 *
 * Usage:
 *   node scripts/apply-parity-to-signals-table.js --drop <run-id>
 */
const path = require('path');
const {
  loadDropSignals,
  loadSignalsTable,
  writeJson,
  runDir,
  readJson,
} = require('../lib/briefPaths.js');
const { applyParityToRowAnalysis } = require('../lib/briefSignalAnalysis.js');
const { dedupeSignalsByUrl } = require('../lib/briefClassify.js');

function parseArgs(argv) {
  const args = { drop: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--drop' && argv[i + 1]) {
      args.drop = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function rowKey(row) {
  const url = String(row.source_url || '').trim().toLowerCase();
  const cap = String(row.capability_key || row.metadata?.capability_key || '').trim();
  return cap ? `${url}|${cap}` : url;
}

function featureKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function signalIndex(signals) {
  const map = new Map();
  for (const s of signals) {
    const k = rowKey(s);
    if (k) map.set(k, s);
    const heading = featureKey(s.metadata?.capability_heading || s.capability_heading);
    if (heading) map.set(`feat:${heading}`, s);
  }
  return map;
}

/** Join parity-input (feature name) + parity-results (id). */
function parityByFeature(root) {
  const results = readJson(path.join(root, 'parity-results.json'), []);
  const inputs = readJson(path.join(root, 'parity-input.json'), []);
  const byId = new Map(
    (Array.isArray(results) ? results : []).map((p) => [String(p.id), p]),
  );
  const byFeature = new Map();
  for (const inp of Array.isArray(inputs) ? inputs : []) {
    const parity = byId.get(String(inp.id));
    if (!parity) continue;
    const feat = featureKey(inp.proposed_feature || inp.capability_heading);
    if (feat) byFeature.set(feat, parity);
  }
  // Fallback: table id match when input missing
  for (const p of Array.isArray(results) ? results : []) {
    byFeature.set(`id:${p.id}`, p);
  }
  return byFeature;
}

function main() {
  const { drop } = parseArgs(process.argv);
  if (!drop) {
    process.stderr.write('usage: apply-parity-to-signals-table.js --drop <run-id>\n');
    process.exit(2);
  }

  const root = runDir(drop);
  const tablePath = path.join(root, 'signals-table.json');
  const rows = loadSignalsTable(drop);
  const byFeature = parityByFeature(root);
  const bySignal = signalIndex(loadDropSignals(drop));

  let updatedCount = 0;
  const updated = rows.map((row) => {
    if (row.classification !== 'Product') return row;
    const feat = featureKey(row.capability_heading);
    const parity =
      (feat && byFeature.get(feat)) ||
      byFeature.get(`id:${row.id}`) ||
      null;
    if (!parity || !parity.parity) return row;
    const signal =
      bySignal.get(rowKey(row)) ||
      (feat ? bySignal.get(`feat:${feat}`) : null) ||
      null;
    updatedCount += 1;
    return applyParityToRowAnalysis(row, signal, parity);
  });

  writeJson(tablePath, updated);
  process.stdout.write(
    `apply-parity-to-signals-table: updated ${updatedCount} Product row(s) for ${drop}\n`,
  );
}

if (require.main === module) {
  main();
}

module.exports = { main, rowKey };
