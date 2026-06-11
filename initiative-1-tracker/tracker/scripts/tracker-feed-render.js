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
  mtCalendarDay,
  isBriefFreshForToday,
} = require('../lib/briefPaths.js');
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
  const signalsTable = loadSignalsTable(runId);
  const prototypes = loadPrototypes(runId);

  if (!manifest) {
    process.stderr.write(`tracker-feed-render: missing manifest for ${runId}\n`);
    process.exit(2);
  }

  process.stdout.write(
    formatFeedMarkdown({
      manifest,
      latest: latest || { run_id: runId, status: 'ready' },
      signalsTable,
      prototypes,
    }) + '\n',
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
