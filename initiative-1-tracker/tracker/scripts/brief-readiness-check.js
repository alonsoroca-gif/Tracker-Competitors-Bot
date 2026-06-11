#!/usr/bin/env node
/**
 * Readiness gate — is tracker-briefs ready for tracker-feed (morningbrief ~8:20am MT)?
 *
 * Usage:
 *   node scripts/brief-readiness-check.js
 *   node scripts/brief-readiness-check.js --mark-ready   # operator: set latest.json ready
 *   node scripts/brief-readiness-check.js --json
 */

const fs = require('fs');
const {
  latestPath,
  runDir,
  loadLatest,
  loadRunManifest,
  loadSignalsTable,
  writeJson,
  refreshRunsIndex,
  mtCalendarDay,
  isBriefFreshForToday,
} = require('../lib/briefPaths.js');

function parseArgs(argv) {
  const args = { json: false, markReady: false, allowStale: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--json') args.json = true;
    if (argv[i] === '--mark-ready') args.markReady = true;
    if (argv[i] === '--allow-stale') args.allowStale = true;
  }
  return args;
}

function validateBrief(latest, { allowStale = false } = {}) {
  const issues = [];
  if (!latest) {
    issues.push('tracker-briefs/latest.json missing');
    return { ok: false, issues };
  }
  if (latest.status !== 'ready') {
    issues.push(`status is "${latest.status}" (need "ready")`);
  }
  if (!allowStale && latest.ready_at && !isBriefFreshForToday(latest.ready_at)) {
    issues.push(
      `brief is stale — ready_at ${latest.ready_at} (${mtCalendarDay(latest.ready_at)} MT); need today's publish (${mtCalendarDay()} MT)`,
    );
  }
  const runId = latest.run_id;
  if (!runId) issues.push('latest.json missing run_id');

  const manifestPath = runId ? `${runDir(runId)}/manifest.json` : null;
  const tablePath = runId ? `${runDir(runId)}/signals-table.json` : null;

  if (runId && !fs.existsSync(manifestPath)) {
    issues.push(`missing ${manifestPath}`);
  }
  if (runId && !fs.existsSync(tablePath)) {
    issues.push(`missing ${tablePath}`);
  }

  return { ok: issues.length === 0, issues, runId };
}

function main() {
  const args = parseArgs(process.argv);
  const latest = loadLatest();

  if (args.markReady) {
    if (!latest?.run_id) {
      process.stderr.write('brief-readiness-check: cannot mark ready — no run_id in latest.json\n');
      process.exit(2);
    }
    const updated = {
      ...latest,
      status: 'ready',
      ready_at: new Date().toISOString(),
    };
    writeJson(latestPath, updated);
    refreshRunsIndex();
    process.stdout.write(`brief-readiness-check: marked ready — ${latest.run_id}\n`);
    process.exit(0);
  }

  const { ok, issues, runId } = validateBrief(latest, { allowStale: args.allowStale });
  const manifest = runId ? loadRunManifest(runId) : null;
  const table = runId ? loadSignalsTable(runId) : [];
  const freshForToday = latest?.ready_at ? isBriefFreshForToday(latest.ready_at) : false;

  const payload = {
    ok,
    status: latest?.status || 'missing',
    run_id: runId || null,
    ready_at: latest?.ready_at || null,
    fresh_for_today: freshForToday,
    today_mt: mtCalendarDay(),
    ready_day_mt: latest?.ready_at ? mtCalendarDay(latest.ready_at) : null,
    net_new_count: manifest?.net_new_count ?? null,
    prototype_count: manifest?.prototype_count ?? null,
    signal_rows: table.length,
    issues,
  };

  if (args.json) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    process.exit(ok ? 0 : 2);
  }

  if (ok) {
    process.stdout.write(
      `brief-readiness-check: OK — ${runId} ready (${table.length} table rows, ${manifest?.prototype_count ?? 0} prototypes)\n`,
    );
    process.exit(0);
  }

  process.stderr.write(`brief-readiness-check: NOT READY — ${issues.join('; ')}\n`);
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = { main, validateBrief };
