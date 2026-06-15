#!/usr/bin/env node
/**
 * Intel publish + preflight baseline smoke tests.
 */

const {
  netNewBetween,
  contentChangedBetween,
  catchUpNetNewInDropWindow,
  countProductRowsPendingParity,
} = require('../lib/briefNetNew.js');
const { buildSignalsTableRows, classifySignal } = require('../lib/briefClassify.js');
const { checkCollectHealth } = require('../lib/collectHealth.js');
const { gatherIntelSignals } = require('../scripts/tracker-publish-intel.js');
const {
  loadDropSignals,
  lastPublishedBriefDropId,
  loadLatest,
  loadSignalsTable,
  listDropIds,
} = require('../lib/briefPaths.js');

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    process.stderr.write(`✗ ${msg}\n`);
    failed += 1;
  } else {
    process.stdout.write(`✓ ${msg}\n`);
  }
}

// Weekend catch-up scenario: empty Friday brief → Monday should surface Fri evening URLs
const fridayBriefDrop = '2026-06-12T14-25-23Z';
const mondayDrop = '2026-06-15T16-35-10Z';
try {
  const publishedKeys = new Set(); // empty table
  const drops = listDropIds();
  const catchUp = catchUpNetNewInDropWindow(
    drops,
    fridayBriefDrop,
    mondayDrop,
    (id) => loadDropSignals(id),
    publishedKeys,
  );
  assert(catchUp.length >= 1, 'Monday catch-up finds URLs missed after empty Friday brief');
} catch (e) {
  process.stderr.write(`catch-up fixture: ${e.message}\n`);
}

const sample = {
  type: 'press',
  source: 'press',
  source_url: 'https://example.com/press',
  headline: 'EliseAI announces partnership',
  competitor_id: 'eliseai',
  snippet: 'Partnership with major operator',
};
const row = classifySignal(sample);
assert(row.classification === 'News', 'press → News classification');

const pmm = classifySignal({
  type: 'review_g2',
  source: 'g2_reviews',
  source_url: 'https://g2.com/products/foo',
  headline: 'Reviews',
  competitor_id: 'funnel-leasing',
});
assert(pmm.classification === 'PMM', 'g2 → PMM classification');

const table = buildSignalsTableRows([sample, { ...pmm, source_url: 'https://g2.com/products/foo/reviews' }]);
assert(table.length === 2, 'buildSignalsTableRows keeps distinct URLs');

const health = checkCollectHealth([], [{ competitor_id: 'jonah-digital' }, { competitor_id: 'jonah-digital' }, { competitor_id: 'jonah-digital' }, { competitor_id: 'jonah-digital' }, { competitor_id: 'jonah-digital' }]);
assert(!health.ok && health.regressions[0].competitor_id === 'jonah-digital', 'collect health detects jonah regression');

try {
  const latest = loadLatest();
  const baseline = lastPublishedBriefDropId(latest);
  assert(typeof baseline === 'string' || baseline === null, 'lastPublishedBriefDropId returns string or null');
  if (baseline) {
    const intel = gatherIntelSignals(latest?.run_id || mondayDrop);
    assert(Array.isArray(intel.combined), 'gatherIntelSignals returns combined array');
  }
  if (latest?.run_id) {
    const pending = countProductRowsPendingParity(loadSignalsTable(latest.run_id));
    assert(typeof pending === 'number', 'countProductRowsPendingParity returns number');
  }
} catch (e) {
  process.stderr.write(`intel gather: ${e.message}\n`);
}

process.exit(failed ? 1 : 0);
