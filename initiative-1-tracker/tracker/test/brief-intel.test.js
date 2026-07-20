#!/usr/bin/env node
/**
 * Intel publish + preflight baseline smoke tests.
 */

const {
  netNewBetween,
  contentChangedBetween,
  catchUpNetNewInDropWindow,
  countProductRowsPendingParity,
  countProductRowsIncompletePipeline,
  isProductPipelineComplete,
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

const { applyParityToRowAnalysis } = require('../lib/briefSignalAnalysis.js');
const changelogSignal = {
  competitor: 'Anyone Home',
  competitor_id: 'anyone-home',
  source: 'changelog',
  source_url: 'https://anyonehome-updates.com/21-july-2026-release/',
  headline: '21 July 2026 Release — SMS Opt-in Enhancements',
  snippet:
    'Anyone Home now requires prospects and residents to explicitly opt in before receiving SMS communications.',
  metadata: {
    page_kind: 'changelog',
    capability_heading: 'SMS Opt-in Enhancements',
    capability_area: 'Lead Manager',
    capability_key: '501b095c167a3059',
  },
};
const existingRow = {
  id: 7,
  classification: 'Product',
  classification_detail: 'capability',
  competitor: 'Anyone Home',
  competitor_id: 'anyone-home',
  headline: changelogSignal.headline,
  snippet: changelogSignal.snippet,
  source_url: changelogSignal.source_url,
  capability_heading: 'SMS Opt-in Enhancements',
  capability_key: '501b095c167a3059',
  parity: 'not_scanned',
  routing: 'Tier — Now',
  tier: 'Tier — Now',
};
const existingMerged = applyParityToRowAnalysis(existingRow, changelogSignal, {
  parity: 'Existing',
  verdict_reason: '257 matches across 61 files in 11 apps — likely already shipped',
  top_files: [
    {
      relativePath: 'Api/app/Libraries/Internal/Comms/Services/Consents/ConsentService.php',
      matched_terms: ['opt-in', 'requires'],
      score: 12,
    },
    {
      relativePath: 'Application/HR/Employees/EmployeeExitProcess/CEmployeeExitProcessManager.class.php',
      matched_terms: ['team', 'release'],
      score: 9,
    },
  ],
});
assert(
  /^Anyone Home shipped "/.test(existingMerged.why_routing) &&
    existingMerged.why_routing.includes('SMS Opt-in Enhancements') &&
    existingMerged.why_routing.includes('explicitly opt in') &&
    existingMerged.why_routing.includes("Won't chase — already shipped in Core") &&
    existingMerged.why_routing.includes('ConsentService.php') &&
    !/257 matches across/i.test(existingMerged.why_routing),
  'Existing Product leads with product shipped + Core plain English, not match-count jargon',
);
assert(existingMerged.signal_summary === existingMerged.why_routing, 'summary mirrors why_routing');

const { preferRecentSignals } = require('../lib/briefNetNew.js');
const ordered = preferRecentSignals(
  [
    {
      source_url: 'https://example.com/old',
      date: '2026-05-19T12:00:00.000Z',
      type: 'changelog',
      metadata: { feed_pinned: true },
    },
    {
      source_url: 'https://example.com/new',
      date: '2026-07-19T12:00:00.000Z',
      type: 'changelog',
    },
  ],
  { nowMs: Date.parse('2026-07-20T18:00:00.000Z') },
);
assert(
  ordered[0].source_url.includes('/new') &&
    ordered[0]._freshness === 'recent' &&
    ordered[1]._freshness === 'catchup',
  'preferRecentSignals puts this-week signals before safety-net catch-up',
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

const laneHealth = checkCollectHealth([], [], [
  {
    competitor_id: 'funnel-leasing',
    lane: 'blog',
    url: 'https://funnelleasing.com/category/llm/feed/',
    status: 'error',
    signal_count: 0,
    error: 'Non-whitespace before first tag',
  },
]);
assert(
  !laneHealth.ok &&
    laneHealth.lane_failures.length === 1 &&
    laneHealth.lane_failures[0].lane === 'blog',
  'collect health surfaces RSS lane parse failures',
);

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

const splitUrl = 'https://anyonehome-updates.com/30-june-2026-release/';
assert(
  signalKey({ source_url: splitUrl, metadata: { capability_key: 'abc123' } }) ===
    `${splitUrl}|abc123`,
  'signalKey includes capability_key for changelog splits',
);
assert(
  signalKey({ source_url: splitUrl }) === splitUrl,
  'signalKey without capability_key stays URL-only',
);

const pagePublished = publishedUrlKeys([{ source_url: splitUrl, headline: '30 June 2026 Release' }]);
const capSignal = {
  source_url: splitUrl,
  metadata: { capability_key: '4dfa6b5a9831878c' },
  headline: '30 June 2026 Release — Service Outage Expiration Date',
};
assert(
  pagePublished.has(splitUrl) &&
    !pagePublished.has(`${splitUrl}|4dfa6b5a9831878c`) &&
    !pagePublished.has(signalKey(capSignal)),
  'page-level publish does not suppress capability subrows',
);

const capTable = buildSignalsTableRows([
  capSignal,
  {
    source_url: splitUrl,
    metadata: { capability_key: 'd05dbc829dd8933f' },
    headline: '30 June 2026 Release — Access Leads from Calendar View',
    competitor_id: 'anyone-home',
    event_type: 'integration_launch',
    type: 'changelog',
  },
]);
assert(capTable.length === 2, 'buildSignalsTableRows keeps distinct capability splits on same URL');
assert(
  capTable.every((r) => r.capability_key),
  'capability splits stamp capability_key on table rows',
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

// --- Pipeline-completeness must be tier-aware (kickoff false-trigger regression) ---
// (Bug: a Gap/Partial Product row tiered Later with no prototype was counted as
//  "incomplete", so the kickoff gate forced a full republish on every run.)
assert(
  isProductPipelineComplete({ classification: 'Product', parity: 'Gap', tier: 'Later', prototype_path: null }),
  'Tier-Later Gap row with no prototype is complete (deferred, not unfinished)',
);
assert(
  isProductPipelineComplete({ classification: 'Product', parity: 'Existing', tier: "Won't chase" }),
  'Existing row is complete with no prototype',
);
assert(
  !isProductPipelineComplete({ classification: 'Product', parity: 'Partial', tier: 'Now', prototype_path: null }),
  'Tier-Now Partial row with no prototype is still incomplete',
);
assert(
  isProductPipelineComplete({ classification: 'Product', parity: 'Partial', tier: 'Now', prototype_path: 'x.html' }),
  'Tier-Now Partial row with a prototype is complete',
);
assert(
  countProductRowsIncompletePipeline([
    { classification: 'Product', parity: 'Existing', tier: "Won't chase" },
    { classification: 'Product', parity: 'Partial', tier: 'Now', prototype_path: 'p.html' },
    { classification: 'Product', parity: 'Gap', tier: 'Later', prototype_path: null },
  ]) === 0,
  'a fully-resolved Product table counts 0 incomplete rows',
);

process.exit(failed ? 1 : 0);
