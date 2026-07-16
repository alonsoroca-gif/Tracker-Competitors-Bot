#!/usr/bin/env node
/**
 * Render Billy-facing tracker feed markdown from tracker-briefs/.
 *
 * Usage:
 *   node scripts/tracker-feed-render.js
 *   node scripts/tracker-feed-render.js --run 2026-06-02T00-10-59Z
 */

const path = require('path');
const {
  loadLatest,
  loadRunManifest,
  loadSignalsTable,
  loadPrototypes,
  annotateCarriedOver,
  upsertPrototypeRegistry,
  listBriefRunIds,
  mtCalendarDay,
  isBriefFreshForToday,
  runDir,
  writeJson,
} = require('../lib/briefPaths.js');
const { classifySignalChanges } = require('../lib/briefNetNew.js');
const { formatFeedMarkdown, formatNotReady } = require('../lib/briefFeed.js');

function parseArgs(argv) {
  const args = { run: null, open: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--run' && argv[i + 1]) {
      args.run = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--open') {
      args.open = true;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const latest = loadLatest();

  const runId = args.run || latest?.run_id;
  if (!args.run && latest?.status !== 'ready') {
    process.stdout.write(formatNotReady(latest || { status: 'missing' }) + '\n');
    process.exit(2);
  }
  if (!args.run && latest?.ready_at && !isBriefFreshForToday(latest.ready_at)) {
    process.stdout.write(
      formatNotReady(latest, {
        stale: true,
        todayMt: mtCalendarDay(),
        readyDayMt: mtCalendarDay(latest.ready_at),
      }) + '\n',
    );
    process.exit(2);
  }

  if (!runId) {
    process.stderr.write('tracker-feed-render: no run_id\n');
    process.exit(2);
  }

  const manifest = loadRunManifest(runId);
  // Baseline = every real brief published before this run (oldest→newest), not
  // just the single prior run. A quiet prior day used to make every older signal
  // look net-new again; spanning history fixes that — a signal is only "new" if
  // its URL was never shown, and only "changed" if its content_hash never matched
  // any earlier brief.
  const currentPublishedAt = (manifest && manifest.published_at) || null;
  const priorRunIds = listBriefRunIds()
    .filter((id) => id !== runId && !id.startsWith('_'))
    .filter((id) => {
      const p = (loadRunManifest(id) || {}).published_at || null;
      return !currentPublishedAt || !p || p < currentPublishedAt;
    })
    .slice(0, 60) // bound the window (newest-first) so history stays manageable
    .reverse(); // oldest→newest so the most recent prior wins as `last`
  const priorSignals = priorRunIds.flatMap((id) =>
    loadSignalsTable(id).map((r) => ({ ...r, _run_id: id })),
  );
  const signalsTable = classifySignalChanges(loadSignalsTable(runId), priorSignals);
  const prototypes = annotateCarriedOver(runId, loadPrototypes(runId));
  // Durable memory across quiet days — so regenerating the same vignette after
  // empty prototypes.json weeks does not look "new" again.
  upsertPrototypeRegistry(runId, loadPrototypes(runId), (manifest && manifest.published_at) || null);

  if (!manifest) {
    process.stderr.write(`tracker-feed-render: missing manifest for ${runId}\n`);
    process.exit(2);
  }

  // Persist the same new/changed/unchanged classification the feed uses so the
  // viewer can hide unchanged carryover instead of re-showing old rows every day.
  writeJson(path.join(runDir(runId), 'viewer-annotations.json'), {
    generated_at: new Date().toISOString(),
    prior_run_id: priorRunIds[priorRunIds.length - 1] || null,
    baseline_run_count: priorRunIds.length,
    signals: signalsTable,
    prototypes,
  });

  process.stdout.write(
    formatFeedMarkdown({
      manifest,
      latest: latest || { run_id: runId, status: 'ready' },
      signalsTable,
      prototypes,
    }) + '\n',
  );

  // Always surface a clickable viewer URL — guaranteed one-click fallback that
  // needs no permissions. Auto-open (below) writes the home-dir request file +
  // calls the Cursor CLI, both of which the agent sandbox blocks; when that
  // no-ops silently, this printed URL is how you still reach the viewer.
  const viewerPort = 8765;
  const viewerUrl =
    `http://127.0.0.1:${viewerPort}/tracker-briefs/viewer/index.html` +
    `?run=${encodeURIComponent(runId)}&_t=${Date.now()}`;
  process.stdout.write(`\nTracker Brief Viewer (click to open): ${viewerUrl}\n`);
  process.stdout.write(
    'If it did not auto-open, the local server may be down — run: ' +
      'npm run brief:open-viewer --prefix initiative-1-tracker/tracker\n',
  );

  if (args.open) {
    const { spawnSync } = require('child_process');
    spawnSync(
      'node',
      [path.join(__dirname, 'open-brief-viewer.js'), '--run', runId],
      { cwd: path.join(__dirname, '..', '..', '..'), stdio: 'inherit' },
    );
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main };
