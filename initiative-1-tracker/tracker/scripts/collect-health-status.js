#!/usr/bin/env node
/**
 * Operator-only collect health for Alonso's morningbrief (every run).
 * Billy's tracker-feed must NOT call this.
 *
 * Usage:
 *   node scripts/collect-health-status.js
 *   node scripts/collect-health-status.js --json
 */

const fs = require('fs');
const path = require('path');

const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');
const dropsRoot = path.join(repoRoot, 'tracker-drops');
const latestPtr = path.join(dropsRoot, '.latest-drop-id');

function summarizeLanes(laneResults) {
  const rows = Array.isArray(laneResults) ? laneResults : [];
  let ok = 0;
  let empty_window = 0;
  let empty = 0;
  let error = 0;
  let other = 0;
  for (const r of rows) {
    const s = r && r.status;
    if (s === 'ok') ok += 1;
    else if (s === 'empty_window') empty_window += 1;
    else if (s === 'empty') empty += 1;
    else if (s === 'error') error += 1;
    else other += 1;
  }
  return { total: rows.length, ok, empty_window, empty, error, other };
}

function loadLatestHealth() {
  if (!fs.existsSync(latestPtr)) {
    return {
      ok: true,
      available: false,
      audience: 'operator',
      note: 'No .latest-drop-id yet',
      lane_summary: summarizeLanes([]),
    };
  }
  const runId = fs.readFileSync(latestPtr, 'utf8').trim();
  const manifestPath = path.join(dropsRoot, runId, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return {
      ok: true,
      available: false,
      audience: 'operator',
      run_id: runId,
      note: 'Latest drop has no manifest.json',
      lane_summary: summarizeLanes([]),
    };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const health = manifest.collect_health || { ok: true, regressions: [], lane_failures: [] };
  const regressions = health.regressions || [];
  const lane_failures = health.lane_failures || [];
  const lane_results = health.lane_results || [];
  const lane_summary = summarizeLanes(lane_results);
  const healthy =
    health.ok !== false && regressions.length === 0 && lane_failures.length === 0;

  // "Weird" without hard errors: zero lane_results on a modern drop, or every
  // configured lane empty while competitors existed historically.
  const weird = [];
  if (healthy && lane_summary.total === 0 && manifest.created_at) {
    const created = new Date(manifest.created_at).getTime();
    // Only flag missing lane_results for drops after this feature shipped.
    if (created >= Date.parse('2026-07-16T18:00:00Z')) {
      weird.push('manifest has no lane_results — collect may predate lane reporting');
    }
  }
  if (healthy && lane_summary.total > 0 && lane_summary.ok === 0 && lane_summary.error === 0) {
    weird.push('all lanes empty_window/empty — unusual if competitors usually post weekly');
  }

  return {
    ok: healthy && weird.length === 0,
    available: true,
    audience: 'operator',
    run_id: runId,
    regressions,
    lane_failures,
    lane_summary,
    weird,
    note: !healthy
      ? 'Collect failures need attention'
      : weird.length
        ? 'Collect looks unusual — review'
        : 'Collect lanes healthy',
  };
}

function formatMarkdown(payload) {
  const audience = '_Operator-only (Alonso) — not shown to Billy._';

  if (!payload.available) {
    return [`### ✅ Collect health · n/a`, '', payload.note, '', audience].join('\n');
  }

  const s = payload.lane_summary || {};
  const stats =
    s.total > 0
      ? `Lanes: **${s.ok}** ok · **${s.empty_window}** empty-window · **${s.empty}** empty · **${s.error}** error (of ${s.total})`
      : `Lanes: _(no per-lane report on this drop yet — next CI collect will stamp lane_results)_`;

  if (payload.ok && !(payload.weird || []).length) {
    return [
      '### ✅ Collect health · OK',
      '',
      `**Drop:** \`${payload.run_id}\``,
      '',
      stats,
      '',
      audience,
    ].join('\n');
  }

  const lines = [
    payload.regressions?.length || payload.lane_failures?.length
      ? '### ⚠️ Collect health · scrape failures'
      : '### ⚠️ Collect health · needs a look',
    '',
    `**Drop:** \`${payload.run_id}\``,
    '',
    stats,
    '',
  ];
  for (const r of payload.regressions || []) {
    lines.push(`- **Regression** \`${r.competitor_id}\`: ${r.prior} → ${r.current} rows`);
  }
  for (const f of payload.lane_failures || []) {
    lines.push(`- **Lane fail** \`${f.competitor_id}\` / \`${f.lane}\`: ${f.error}`);
    if (f.url) lines.push(`  - ${f.url}`);
  }
  for (const w of payload.weird || []) {
    lines.push(`- **Weird:** ${w}`);
  }
  lines.push('', '_Fix the URL/lane or WAF issue, then wait for the next tracker-drop CI run._', '', audience);
  return lines.join('\n');
}

function main() {
  const jsonOut = process.argv.includes('--json');
  const payload = loadLatestHealth();
  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatMarkdown(payload)}\n`);
  }
  process.exit(0);
}

main();
