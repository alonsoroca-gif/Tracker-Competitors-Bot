#!/usr/bin/env node
/**
 * Git drop publisher — aligns with initiative-1-tracker/docs/TRACKER-FLOW-END-TO-END.md §2c–2d.
 * Runs collect, applies a relevance gate (skip if zero new signals unless TRACKER_DROP_FORCE=1),
 * writes tracker-drops/<run-id>/ at the repo root for commit by CI or locally.
 *
 * Run from tracker directory:
 *   node scripts/publish-drop.js [--days N]
 *
 * Env:
 *   TRACKER_DROP_FORCE=1 — create a drop even when newCount is 0 (debug only).
 */

const fs = require('fs');
const path = require('path');

const trackerRoot = path.join(__dirname, '..');
const initiativeRoot = path.join(trackerRoot, '..');
const repoRoot = path.join(initiativeRoot, '..');
const dropsRoot = path.join(repoRoot, 'tracker-drops');

function parseDays() {
  const idx = process.argv.indexOf('--days');
  if (idx !== -1 && process.argv[idx + 1]) {
    return Math.min(90, Math.max(1, parseInt(process.argv[idx + 1], 10) || 7));
  }
  return 7;
}

function runIdISO() {
  return new Date().toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

async function main() {
  process.chdir(trackerRoot);

  const { runFullCollect } = require('../lib/runCollectAll');
  const { writeCollectMeta } = require('../lib/collectMeta');
  const { SIGNALS_FILE } = require('../lib/storage');
  const { shutdownBrowser } = require('../lib/collect');

  const days = parseDays();
  const { newCount, pruned, intelMeta } = await runFullCollect(days, { verbose: false });

  // Close the Playwright browser if any lane spun it up. Without this the node
  // process hangs until the browser child times out (~30s).
  try {
    await shutdownBrowser();
  } catch (e) {
    console.error('shutdownBrowser failed (continuing):', e.message);
  }

  try {
    writeCollectMeta({ newCount, pruned, retentionDays: days, intelMeta });
  } catch (e) {
    console.error('collect-meta write failed:', e.message);
  }

  const force = String(process.env.TRACKER_DROP_FORCE || '').trim() === '1';
  if (newCount === 0 && !force) {
    console.log('publish-drop: SKIP (relevance gate — 0 new signals this run). Set TRACKER_DROP_FORCE=1 to write an empty drop anyway.');
    process.exit(0);
  }

  const runId = runIdISO();
  const dropDir = path.join(dropsRoot, runId);
  fs.mkdirSync(dropDir, { recursive: true });

  let signalsJson = '[]';
  if (fs.existsSync(SIGNALS_FILE)) {
    signalsJson = fs.readFileSync(SIGNALS_FILE, 'utf8');
  }

  fs.writeFileSync(path.join(dropDir, 'signals.json'), signalsJson, 'utf8');

  const summaryLines = [
    '# Tracker drop',
    '',
    `- **Run id:** \`${runId}\``,
    `- **Created (UTC):** ${new Date().toISOString()}`,
    `- **New signals added this collect:** ${newCount}`,
    `- **Retention window (days):** ${days}`,
    `- **Signals kept after prune:** ${pruned.kept} (removed as too old: ${pruned.removed})`,
    '',
    '## Next',
    '',
    '1. Pull this branch in Cursor.',
    '2. Read this file, then `signals.json` for raw rows.',
    '3. Interpret in Chat / Composer using only committed files (see TRACKER-FLOW-END-TO-END.md §4).',
    '',
  ];
  if (intelMeta && typeof intelMeta === 'object') {
    summaryLines.push('## Intel snapshot (from last run)', '', '```json', JSON.stringify(intelMeta, null, 2), '```', '');
  }
  fs.writeFileSync(path.join(dropDir, 'SUMMARY.md'), summaryLines.join('\n'), 'utf8');

  const manifest = {
    run_id: runId,
    created_at: new Date().toISOString(),
    new_signals_added: newCount,
    retention_days: days,
    signals_kept_after_prune: pruned.kept,
    signals_removed_retention: pruned.removed,
    source: 'tracker-publish-drop.js',
  };
  fs.writeFileSync(path.join(dropDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  /** Pointer for Slack script / ops — tiny file, committed with the drop. */
  fs.writeFileSync(path.join(dropsRoot, '.latest-drop-id'), `${runId}\n`, 'utf8');

  console.log(`publish-drop: wrote ${path.relative(repoRoot, dropDir)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
