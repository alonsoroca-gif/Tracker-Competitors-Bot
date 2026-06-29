#!/usr/bin/env node
/**
 * Rebuild why_routing / signal_summary on an existing signals-table.json
 * from raw drop signals (no publish side effects).
 */
const path = require('path');
const {
  repoRoot,
  loadDropSignals,
  loadSignalsTable,
  writeJson,
  runDir,
} = require('../lib/briefPaths.js');
const { buildSignalAnalysis } = require('../lib/briefSignalAnalysis.js');
const { classifySignal, dedupeSignalsByUrl, isG2Signal } = require('../lib/briefClassify.js');

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

function signalByUrl(signals) {
  const map = new Map();
  for (const s of dedupeSignalsByUrl(signals)) {
    const key = String(s.source_url || '').trim().toLowerCase();
    if (key) map.set(key, s);
  }
  return map;
}

function main() {
  const { drop } = parseArgs(process.argv);
  if (!drop) {
    process.stderr.write('usage: reanalyze-signals-table.js --drop <run-id>\n');
    process.exit(2);
  }

  const tablePath = path.join(runDir(drop), 'signals-table.json');
  const rows = loadSignalsTable(drop);
  const byUrl = signalByUrl(loadDropSignals(drop));

  const updated = rows
    .map((row) => {
    const key = String(row.source_url || '').trim().toLowerCase();
    const raw = byUrl.get(key);
    if (!raw || isG2Signal(raw)) return null;
    const meta = classifySignal(raw);
    if (row.classification === 'Product' && row.parity && row.parity !== '—' && row.parity !== 'not_scanned') {
      meta.parity = row.parity;
      if (String(row.parity).toLowerCase() === 'existing') {
        meta.routing = "Won't chase";
        meta.tier = row.tier || "Won't chase";
      }
    }
    const analysis = buildSignalAnalysis(raw, meta);
    return {
      ...row,
      classification: meta.classification,
      classification_detail: meta.classification_detail,
      routing: meta.routing,
      tier: meta.tier,
      why_routing: analysis,
      routing_reason: meta.why_routing,
      signal_summary: analysis,
    };
  })
    .filter(Boolean)
    .map((row, idx) => ({ ...row, id: idx + 1 }));

  writeJson(tablePath, updated);
  process.stdout.write(`reanalyze-signals-table: updated ${updated.length} rows for ${drop}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
