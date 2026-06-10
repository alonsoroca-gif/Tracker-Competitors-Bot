#!/usr/bin/env node
/**
 * First-run demo — show Billy a Product-day morningbrief with fixture data.
 *
 * Usage:
 *   node scripts/billy-first-run-demo.js
 *   node scripts/billy-first-run-demo.js --no-open
 */

const path = require('path');
const { spawnSync } = require('child_process');
const {
  loadRunManifest,
  loadSignalsTable,
  loadPrototypes,
} = require('../lib/briefPaths.js');
const { formatFeedMarkdown } = require('../lib/briefFeed.js');

const DEMO_RUN = '_sample-product-day';
const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');

function parseArgs(argv) {
  const args = { open: true };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--no-open') args.open = false;
  }
  return args;
}

function banner() {
  return `
╔══════════════════════════════════════════════════════════════╗
║  Billy first-run demo — Product signal day (fixture data)      ║
╚══════════════════════════════════════════════════════════════╝

This is what your ~8:20am tracker-feed section looks like when
there are meaningful Product signals (2 net-new, 2 prototypes).

Not today's live brief — sample data only.
`.trim();
}

function walkthrough() {
  return `
---
## Your ~8:20am checklist — Product signal days (every time)

When **product_row_count > 0**, expect this exact shape:

1. **Chat block** (tracker-feed pastes into morningbrief)
   - One summary line: net-new count · prototype count · ready time
   - **6-column table**: Competitor · Headline · Classification · Parity · Why/routing
   - Prototype bullets with PRD paths

2. **Browser auto-opens** — Tracker Brief Viewer
   - Full signals table (scroll horizontally if needed)
   - **Prototype cards** side-by-side — click to expand, download PRD PDF
   - Same run id as summary line

3. **You do not** re-run publish or open \`tracker-drops/\` manually

---

## PMM-only days (no Product signals)

Same **table** in chat + viewer, but:
- Summary says **0 prototypes**
- No prototype cards — review **Why / routing** column only

---

## This demo vs live

| | This run (\`npm run billy:demo\`) | Live morningbrief |
|--|-----------------------------------|-------------------|
| Data | Fixture \`_sample-product-day\` | Today's publish |
| Trigger | You, once at setup | tracker-feed @ ~8:20 |
| Viewer | Auto-opens now | Auto-opens via \`--open\` |

**Next live step:** morningbrief Step 0 @ ~8:00 → tracker-feed @ ~8:20.
`.trim();
}

function main() {
  const args = parseArgs(process.argv);
  const manifest = loadRunManifest(DEMO_RUN);
  const signalsTable = loadSignalsTable(DEMO_RUN);
  const prototypes = loadPrototypes(DEMO_RUN);

  if (!manifest) {
    process.stderr.write(`billy-first-run-demo: missing fixture ${DEMO_RUN}\n`);
    process.exit(2);
  }

  process.stdout.write(`${banner()}\n\n`);
  process.stdout.write(
    formatFeedMarkdown({
      manifest,
      latest: { run_id: DEMO_RUN, status: 'ready', prototype_count: manifest.prototype_count },
      signalsTable,
      prototypes,
    }) + '\n',
  );
  process.stdout.write(`\n${walkthrough()}\n`);

  if (args.open) {
    spawnSync(
      'node',
      [path.join(__dirname, 'open-brief-viewer.js'), '--run', DEMO_RUN],
      { cwd: repoRoot, stdio: 'inherit' },
    );
  }

  process.stdout.write('\nbilly-first-run-demo: done\n');
}

main();
