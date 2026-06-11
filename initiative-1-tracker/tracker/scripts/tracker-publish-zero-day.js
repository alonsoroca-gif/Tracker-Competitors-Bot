#!/usr/bin/env node
/**
 * Deterministic publish for days with 0 net-new URLs (retention-only collect).
 * Writes today's brief stamp so tracker-feed passes fresh_for_today.
 *
 * Usage:
 *   node scripts/tracker-publish-zero-day.js
 *   node scripts/tracker-publish-zero-day.js --drop 2026-06-11T15-23-19Z
 *   node scripts/tracker-publish-zero-day.js --json
 */

const path = require('path');
const {
  readLatestDropId,
  runDir,
  loadDropManifest,
  loadLatest,
  writeJson,
  refreshRunsIndex,
  latestPath,
  mtCalendarDay,
} = require('../lib/briefPaths.js');

function parseArgs(argv) {
  const args = { drop: null, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--drop' && argv[i + 1]) {
      args.drop = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--json') args.json = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const dropId = args.drop || readLatestDropId();
  if (!dropId) {
    process.stderr.write('tracker-publish-zero-day: no drop id\n');
    process.exit(2);
  }

  const dropManifest = loadDropManifest(dropId);
  const now = new Date().toISOString();
  const runRoot = runDir(dropId);

  const manifest = {
    run_id: dropId,
    drop_run_id: dropId,
    published_at: now,
    source: 'tracker-publish-zero-day',
    day_type: 'no_signals',
    net_new_count: 0,
    product_row_count: 0,
    tier_now_product_count: 0,
    prototype_count: 0,
    interpretation_pointer: dropId,
    summary:
      '0 net-new competitor URLs since last brief — retention collect only. No new signals to interpret; table empty for today.',
  };

  writeJson(path.join(runRoot, 'manifest.json'), manifest);
  writeJson(path.join(runRoot, 'signals-table.json'), []);
  writeJson(path.join(runRoot, 'prototypes.json'), []);

  const latest = {
    status: 'ready',
    run_id: dropId,
    deadline_mt: '07:45',
    viewer_path: 'tracker-briefs/viewer/index.html',
    run_dir: `tracker-briefs/runs/${dropId}`,
    prototype_count: 0,
    net_new_count: 0,
    product_row_count: 0,
    source: 'tracker-publish-zero-day',
    ready_at: now,
    drop_new_signals_added: dropManifest?.new_signals_added ?? null,
  };

  writeJson(latestPath, latest);
  refreshRunsIndex();

  const payload = {
    ok: true,
    run_id: dropId,
    ready_at: now,
    today_mt: mtCalendarDay(),
    net_new_count: 0,
    signal_rows: 0,
    summary: manifest.summary,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(0);
  }

  process.stdout.write(`tracker-publish-zero-day: OK — ${dropId} (${mtCalendarDay()} MT, 0 net-new)\n`);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main };
