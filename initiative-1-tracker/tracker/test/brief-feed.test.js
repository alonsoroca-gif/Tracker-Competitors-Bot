#!/usr/bin/env node
/**
 * tracker-briefs fixture + feed render smoke test.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');

function run(script, args = []) {
  return spawnSync('node', [path.join(trackerRoot, 'scripts', script), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

let failed = 0;

const readiness = run('brief-readiness-check.js', ['--json', '--allow-stale']);
if (readiness.status !== 0) {
  process.stderr.write('brief-feed.test: readiness check failed\n');
  process.stderr.write(readiness.stderr || readiness.stdout);
  failed += 1;
} else {
  const payload = JSON.parse(readiness.stdout);
  if (!payload.ok) {
    process.stderr.write(`brief-feed.test: expected ok readiness, got ${JSON.stringify(payload)}\n`);
    failed += 1;
  } else {
    process.stdout.write(`✓ readiness OK — ${payload.run_id} (${payload.signal_rows} rows)\n`);
  }
}

const feed = run('tracker-feed-render.js');
if (feed.status !== 0) {
  process.stderr.write('brief-feed.test: feed render failed\n');
  process.stderr.write(feed.stderr || feed.stdout);
  failed += 1;
} else {
  const out = feed.stdout;
  const checks = [
    ['Tracker brief', out.includes('Tracker brief')],
    ['signals table header', out.includes('| # | Competitor |')],
    ['PMM row or intel empty day', out.includes('PMM') || out.includes('No classified rows') || out.includes('competitors quiet') || out.includes('No new or changed signals')],
    ['viewer hint', out.includes('viewer/index.html')],
  ];
  for (const [name, ok] of checks) {
    if (ok) process.stdout.write(`✓ feed contains ${name}\n`);
    else {
      process.stderr.write(`✗ feed missing ${name}\n`);
      failed += 1;
    }
  }
}

const preflight = run('publish-preflight.js', ['--drop', '2026-06-02T00-10-59Z', '--json']);
if (preflight.status !== 0) {
  process.stderr.write('brief-feed.test: preflight failed\n');
  failed += 1;
} else {
  const pf = JSON.parse(preflight.stdout);
  if (typeof pf.net_new_urls !== 'number') failed += 1;
  else process.stdout.write(`✓ preflight OK — net_new_urls=${pf.net_new_urls}\n`);
}

// Suppress-unchanged policy — surface only new/changed signals + prototypes;
// hide items re-surfaced unchanged (the SightMap-every-day regression).
const { formatSummary, formatPrototypeCards, formatChatTable } = require('../lib/briefFeed.js');

function check(name, cond) {
  if (cond) process.stdout.write(`✓ ${name}\n`);
  else {
    process.stderr.write(`✗ ${name}\n`);
    failed += 1;
  }
}

// --- prototypes ---
const unchangedProto = {
  id: 'sightmap-live-pricing',
  title: 'Live-PMS Siteplan — SightMap delta',
  competitor: 'Jonah',
  preview_path: 'p.html',
  carried_over: true,
  changed: false,
  first_shipped_at: '2026-06-15T21:19:08.808Z',
};
const updatedProto = { ...unchangedProto, id: 'updated-thing', title: 'Updated Thing', changed: true };
const freshProto = { id: 'new-thing', title: 'New Thing', competitor: 'EliseAI', preview_path: 'n.html', carried_over: false, changed: true };

const unchangedSummary = formatSummary({ run_id: 'r' }, { ready_at: 'x' }, [unchangedProto]);
check('summary shows 0 new prototypes when only unchanged carry', unchangedSummary.includes('**0** new prototype(s)'));
check('summary marks unchanged prototypes hidden', unchangedSummary.includes('1 unchanged hidden'));

const unchangedCards = formatPrototypeCards([unchangedProto]);
check('unchanged-only cards say no new prototypes today', unchangedCards.includes('No new prototypes today'));
check('unchanged prototype is hidden (not a full card)', !unchangedCards.includes('  - What:') && !unchangedCards.includes('**Live-PMS'));
check('hidden note names first-shipped date', unchangedCards.includes('first shipped Jun 15'));

const mixedCards = formatPrototypeCards([freshProto, updatedProto, unchangedProto]);
check('fresh prototype rendered as full card', mixedCards.includes('**New Thing**'));
check('changed prototype rendered with (updated) tag', mixedCards.includes('**Updated Thing** (updated)'));
check('unchanged prototype not shown as card in mixed set', !mixedCards.includes('**Live-PMS Siteplan'));
check('mixed set notes 1 unchanged hidden', mixedCards.includes('1 unchanged prototype(s) hidden'));

// --- signals ---
const sigNew = { id: 1, competitor: 'EliseAI', headline: 'Brand new page', classification: 'Product', change_status: 'new' };
const sigChanged = { id: 2, competitor: 'Jonah', headline: 'Pricing moved', classification: 'Pricing', change_status: 'changed' };
const sigUnchanged = { id: 3, competitor: 'Anyone Home', headline: 'Same as always', classification: 'PMM', change_status: 'unchanged' };

const sigSummary = formatSummary({ run_id: 'r' }, { ready_at: 'x' }, [], [sigNew, sigChanged, sigUnchanged]);
check('summary counts new + changed signals, hides unchanged', sigSummary.includes('**1** new signal(s)') && sigSummary.includes('1 changed') && sigSummary.includes('1 unchanged hidden'));

const table = formatChatTable([sigNew, sigChanged, sigUnchanged]);
check('table shows new signal', table.includes('Brand new page'));
check('table flags changed signal as (updated)', table.includes('(updated) Pricing moved'));
check('table hides unchanged signal row', !table.includes('Same as always'));
check('table notes unchanged count hidden', table.includes('1 unchanged page(s) hidden'));

const allUnchangedTable = formatChatTable([sigUnchanged]);
check('all-unchanged table shows quiet message', allUnchangedTable.includes('No new or changed signals today'));

// --- classifySignalChanges (the diff that drives suppression) ---
const { classifySignalChanges } = require('../lib/briefNetNew.js');
const current = [
  { source_url: 'https://a.com/new', headline: 'A', content_hash: 'h1' },
  { source_url: 'https://b.com/p', headline: 'B2', content_hash: 'h2new' },
  { source_url: 'https://c.com/p', headline: 'C', content_hash: 'h3' },
];
const prior = [
  { source_url: 'https://b.com/p', headline: 'B1', content_hash: 'h2old' },
  { source_url: 'https://c.com/p', headline: 'C', content_hash: 'h3' },
];
const classified = classifySignalChanges(current, prior);
check('URL absent from prior is new', classified[0].change_status === 'new');
check('same URL with different content_hash is changed', classified[1].change_status === 'changed');
check('same URL with identical content_hash is unchanged', classified[2].change_status === 'unchanged');

// Legacy prior without content_hash falls back to headline comparison.
const legacyClassified = classifySignalChanges(
  [{ source_url: 'https://x.com', headline: 'Same', content_hash: 'h' }],
  [{ source_url: 'https://x.com', headline: 'Same' }],
);
check('legacy headline match → unchanged', legacyClassified[0].change_status === 'unchanged');

// History baseline: a signal byte-identical to an OLDER run is unchanged even
// when the immediately-prior run (a quiet day) did not contain it. priorRows is
// the union of all prior briefs, oldest→newest.
const historyPrior = [
  // older run had the signal...
  { source_url: 'https://resurface.com/p', headline: 'R', content_hash: 'hR' },
  // ...then a quiet run with an unrelated row (the signal is absent here)
  { source_url: 'https://quiet.com/p', headline: 'Q', content_hash: 'hQ' },
];
const historyClassified = classifySignalChanges(
  [{ source_url: 'https://resurface.com/p', headline: 'R', content_hash: 'hR' }],
  historyPrior,
);
check(
  'resurfaced signal (identical hash in older run) is unchanged, not new',
  historyClassified[0].change_status === 'unchanged',
);

// Body-aware: a new content_hash means the headline OR the body moved. Per the
// project's purpose (track what competitors change day to day) this surfaces as
// 'changed' even when the headline text is unchanged — the hash includes the
// scraped body the row does not persist.
const bodyChanged = classifySignalChanges(
  [{ source_url: 'https://n.com/reviews', headline: 'Reviews', content_hash: 'newhash' }],
  [{ source_url: 'https://n.com/reviews', headline: 'Reviews', content_hash: 'oldhash' }],
);
check('new content_hash (body moved) surfaces as changed', bodyChanged[0].change_status === 'changed');

// When both runs persist the snippet, a body change shows the actual old→new
// excerpt diff so the manager sees WHAT the competitor changed.
const diffClassified = classifySignalChanges(
  [{ source_url: 'https://n.com/p', headline: 'Same', snippet: 'now mentions AI pricing', content_hash: 'h2' }],
  [{ source_url: 'https://n.com/p', headline: 'Same', snippet: 'old plain pricing copy', content_hash: 'h1' }],
);
check(
  'changed signal with snippets shows old→new excerpt diff',
  diffClassified[0].change_detail.includes('excerpt:') &&
    diffClassified[0].change_detail.includes('old plain pricing copy') &&
    diffClassified[0].change_detail.includes('now mentions AI pricing'),
);

const viewer = path.join(repoRoot, 'tracker-briefs/viewer/index.html');
if (!fs.existsSync(viewer)) {
  process.stderr.write('brief-feed.test: viewer missing\n');
  failed += 1;
} else {
  process.stdout.write('✓ viewer/index.html exists\n');
}

process.exit(failed ? 1 : 0);
