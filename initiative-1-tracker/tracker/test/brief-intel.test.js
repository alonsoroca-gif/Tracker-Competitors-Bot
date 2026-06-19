#!/usr/bin/env node
/**
 * Intel publish + preflight baseline smoke tests.
 */

const {
  netNewBetween,
  contentChangedBetween,
  catchUpNetNewInDropWindow,
  countProductRowsPendingParity,
  signalKey,
  publishedUrlKeys,
  contentChangedVsPublished,
} = require('../lib/briefNetNew.js');
const { buildSignalsTableRows, classifySignal } = require('../lib/briefClassify.js');
const { buildSignalAnalysis } = require('../lib/briefSignalAnalysis.js');
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
  type: 'review_other',
  source: 'reviews_other',
  source_url: 'https://www.featuredcustomers.com/vendor/funnel-leasing',
  headline: 'FeaturedCustomers reviews',
  competitor_id: 'funnel-leasing',
  snippet: '8 excerpt(s) parsed from FeaturedCustomers.',
});
assert(pmm.classification === 'PMM', 'third-party reviews → PMM classification');

const leasehawkPricing = {
  type: 'pricing',
  source: 'pricing_page',
  source_url: 'https://leasehawk.com/',
  competitor_id: 'leasehawk',
  snippet:
    'Detected pricing values: $4. Tier language: 46% conversion for AI-handled prospects, compared to 19% tour conversion',
  entities: {
    prices: ['$4'],
    tiers: [
      '46% conversion for AI-handled prospects, compared to 19% tour conversion for non-AI handled prospects',
    ],
    keywords: ['ai', 'crm', 'voice ai', 'leasing', 'lead nurturing'],
  },
  metadata: { page_kind: 'pricing' },
};
const pricingRow = classifySignal(leasehawkPricing);
assert(pricingRow.classification === 'Pricing', 'pricing page → Pricing');
const pricingAnalysis = buildSignalAnalysis(leasehawkPricing, pricingRow);
assert(
  pricingAnalysis.includes('We found a change on the') &&
    pricingAnalysis.includes('46%') &&
    pricingAnalysis.includes('19%') &&
    /claims AI-handled prospects convert/i.test(pricingAnalysis),
  'pricing analysis — narrative with AI vs non-AI conversion in context',
);
assert(
  !pricingAnalysis.includes('Compare to Core') && !pricingAnalysis.includes('Catch-up'),
  'pricing Won\'t chase — no Core compare, no catch-up prefix',
);
assert(
  !pricingAnalysis.includes('values spotted: $4'),
  'pricing analysis drops ambiguous $4 scrape noise',
);

const jonahArticles = {
  type: 'article',
  source: 'articles_index',
  event_type: 'pricing_change',
  source_url: 'https://jonahdigital.com/articles/',
  competitor_id: 'jonah-digital',
  snippet: '7 article(s) parsed. Latest: AI Is Changing the Way Your Renters Search',
  entities: {
    article_titles: [
      'AI Is Changing the Way Your Renters Search',
      'Fee Transparency: How All-In Pricing is the Solution Ahead of the Problem',
    ],
  },
  metadata: { page_kind: 'articles_index' },
};
const articleRow = classifySignal(jonahArticles);
assert(articleRow.classification === 'PMM', 'articles index not misclassified as Pricing');
const articleAnalysis = buildSignalAnalysis(jonahArticles, articleRow);
assert(
  articleAnalysis.includes('AI Is Changing') || articleAnalysis.includes('2 article'),
  'article analysis names actual titles',
);

const table = buildSignalsTableRows([
  sample,
  { ...pmm, source_url: 'https://www.featuredcustomers.com/vendor/funnel-leasing' },
]);
assert(table.length === 2, 'buildSignalsTableRows keeps distinct URLs');

const g2Dropped = buildSignalsTableRows([
  {
    type: 'review_g2',
    source: 'g2_reviews',
    source_url: 'https://www.g2.com/products/eliseai/reviews',
    competitor_id: 'eliseai',
    importance: 9,
  },
  sample,
]);
assert(g2Dropped.length === 1, 'buildSignalsTableRows drops G2 signals');

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

// --- Dedup regression: signalKey must accept a string or an object ---
// (Bug: publishedUrlKeys passed row.source_url as a string; signalKey read
//  .source_url off the string, returned '', and silently disabled dedup so the
//  same prototype was rebuilt every cycle.)
assert(
  signalKey('https://JONAHDIGITAL.com/add-ons/ ') === 'https://jonahdigital.com/add-ons/',
  'signalKey normalizes a raw URL string',
);
assert(
  signalKey({ source_url: 'https://Eliseai.com/' }) === 'https://eliseai.com/',
  'signalKey normalizes a signal/row object',
);

const publishedRows = [
  { source_url: 'https://jonahdigital.com/add-ons/' },
  { source_url: 'https://eliseai.com/' },
];
const pubKeys = publishedUrlKeys(publishedRows);
assert(
  pubKeys.size === 2 && pubKeys.has('https://jonahdigital.com/add-ons/'),
  'publishedUrlKeys populates from rows (dedup not silently disabled)',
);

// --- Content-refresh detection must compare like-for-like, not snippet-vs-why_routing ---
const refreshUrl = 'https://jonahdigital.com/add-ons/';
const hashedTable = buildSignalsTableRows([
  { ...jonahArticles, source_url: refreshUrl, headline: 'Add-Ons | JONAH', snippet: 'SightMap embed' },
]);
assert(
  typeof hashedTable[0].content_hash === 'string' && hashedTable[0].content_hash.length > 0,
  'buildSignalsTableRows stamps a content_hash on each row',
);
const unchanged = [{ source_url: refreshUrl, headline: 'Add-Ons | JONAH', snippet: 'SightMap embed' }];
assert(
  contentChangedVsPublished(unchanged, hashedTable).length === 0,
  'unchanged page does NOT re-surface as a content refresh',
);
const bodyChanged = [{ source_url: refreshUrl, headline: 'Add-Ons | JONAH', snippet: 'SightMap embed + NEW live pin overlay' }];
assert(
  contentChangedVsPublished(bodyChanged, hashedTable).length === 1,
  'genuinely changed page DOES re-surface as a content refresh',
);

process.exit(failed ? 1 : 0);
