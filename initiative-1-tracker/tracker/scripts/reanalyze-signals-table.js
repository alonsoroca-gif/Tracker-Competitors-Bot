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

function signalLookup(signals) {
  const map = new Map();
  for (const s of signals) {
    const url = String(s.source_url || '').trim().toLowerCase();
    const cap = String(s.metadata?.capability_key || s.capability_key || '').trim();
    if (url && cap) map.set(`${url}|${cap}`, s);
    const heading = String(s.metadata?.capability_heading || s.capability_heading || '')
      .toLowerCase()
      .trim();
    if (heading) map.set(`feat:${heading}`, s);
    if (url && !map.has(url)) map.set(url, s);
  }
  for (const s of dedupeSignalsByUrl(signals)) {
    const url = String(s.source_url || '').trim().toLowerCase();
    if (url && !map.has(url)) map.set(url, s);
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
  const bySignal = signalLookup(loadDropSignals(drop));

  const updated = rows
    .map((row) => {
    const url = String(row.source_url || '').trim().toLowerCase();
    const cap = String(row.capability_key || '').trim();
    const feat = String(row.capability_heading || '').toLowerCase().trim();
    const raw =
      (cap && bySignal.get(`${url}|${cap}`)) ||
      (feat && bySignal.get(`feat:${feat}`)) ||
      bySignal.get(url);
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
      classification: meta.classification || row.classification,
      classification_detail: meta.classification_detail || row.classification_detail,
      routing: meta.routing,
      tier: meta.tier || row.tier,
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
