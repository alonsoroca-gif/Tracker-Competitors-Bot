/**
 * Minimal test: smoke + loadConfig + collect filterLastDays.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { loadConfig } = require('../lib/loadConfig');
const { filterLastDays, isValidPublicUrl } = require('../lib/collect');
const { retentionCutoffDate } = require('../lib/storage');

let ok = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) ok++;
  else { fail++; console.error('FAIL:', msg); }
}

// Smoke: require index and run default (we don't exec child, just that collect/loadConfig exist)
assert(typeof loadConfig === 'function', 'loadConfig exists');
const config = loadConfig();
assert(Array.isArray(config.products) && config.products.length > 0, 'config has products');
assert(Array.isArray(config.competitors) && config.competitors.length > 0, 'config has competitors');

// filterLastDays
const signals = [
  { date: '2025-02-20', snippet: 'a' },
  { date: '2025-01-01', snippet: 'b' },
];
const filtered = filterLastDays(signals, 7);
assert(Array.isArray(filtered) && filtered.length <= 2, 'filterLastDays returns array');

assert(isValidPublicUrl('https://example.com/feed') === true, 'valid https URL');
assert(isValidPublicUrl('ftp://x') === false, 'reject non-http(s)');
assert(isValidPublicUrl('') === false, 'reject empty URL');

const cut = retentionCutoffDate(7);
assert(/^\d{4}-\d{2}-\d{2}$/.test(cut), 'retentionCutoffDate YYYY-MM-DD');
const today = new Date().toISOString().slice(0, 10);
assert(cut <= today, 'retentionCutoffDate not in the future');

// First-version: getSignals, buildGapReport, getWhatToChange
const { getSignals } = require('../lib/storage');
const {
  buildGapReport,
  metricOrFactExcerpt,
  clusterKeyFromSignal,
  distinctIntelPillars,
  splitByMergeSimilarity,
  signalsSimilarForMerge,
} = require('../lib/gapReport');
const { getWhatToChange } = require('../lib/whatToChange');
const { getAppInventory } = require('../lib/appInventory');
assert(typeof getSignals === 'function', 'getSignals exists');
const empty = getSignals('ProductA', '2020-01-01', '2020-01-07');
assert(Array.isArray(empty), 'getSignals returns array');
const excerpt = metricOrFactExcerpt({ snippet: 'About us page. Revenue grew 40% year over year.', evidence_snippet: '' });
assert(excerpt && excerpt.includes('40'), 'metricOrFactExcerpt prefers metric sentence');

const report = buildGapReport('ProductA', '2020-01-01', '2020-01-07');
assert(report && report.report_id && report.product_id === 'ProductA' && Array.isArray(report.gaps), 'buildGapReport returns report');
assert(report.summary && typeof report.summary.by_intel_pillar === 'object', 'gap report summary has by_intel_pillar');
assert(report.summary && typeof report.summary.by_corroboration === 'object', 'gap report summary has by_corroboration');
if (report.gaps.length) {
  assert(
    report.gaps[0].corroboration === 'watch' || report.gaps[0].corroboration === 'confirmed',
    'gap has corroboration',
  );
  assert(Array.isArray(report.gaps[0].intel_pillars), 'gap has intel_pillars array');
  assert(
    report.gaps[0].interpretation && report.gaps[0].interpretation.headline,
    'gap has strategic interpretation',
  );
}

const sigA = { competitor_id: 'acme', type: 'blog', event_type: 'content_update', snippet: 'a' };
const sigB = { competitor_id: 'acme', type: 'changelog', event_type: 'content_update', snippet: 'b' };
assert(clusterKeyFromSignal(sigA) === clusterKeyFromSignal(sigB), 'same competitor+dimension+theme share cluster key');
assert(
  clusterKeyFromSignal(sigA) !== clusterKeyFromSignal({ ...sigA, event_type: 'pricing_change' }),
  'different event_type splits cluster',
);
assert(distinctIntelPillars([{ metadata: { intel_pillar: 1 } }, { metadata: { intel_pillar: 2 } }]).join(',') === '1,2', 'distinctIntelPillars');

const blogBase = { competitor_id: 'acme-corp', type: 'blog', event_type: 'content_update' };
const blogUnrelatedA = {
  ...blogBase,
  headline: 'Q4 partner webinar registration opens',
  snippet: 'Join us for scheduled sessions across time zones.',
};
const blogUnrelatedB = {
  ...blogBase,
  headline: 'New office opening in Denver Colorado',
  snippet: 'We are hiring locally for sales roles in the mountain region.',
};
assert(splitByMergeSimilarity([blogUnrelatedA, blogUnrelatedB]).length === 2, 'unrelated same-bucket posts stay separate gaps');
const blogSameHeadline = { ...blogUnrelatedB, headline: 'Q4 partner webinar registration opens', snippet: 'Extra RSVP detail.' };
assert(splitByMergeSimilarity([blogUnrelatedA, blogSameHeadline]).length === 1, 'identical headlines merge');
const urlA = { ...blogBase, headline: 'Post', snippet: 'Body one', source_url: 'https://example.com/articles/announce-99' };
const urlB = { ...blogBase, headline: 'Other', snippet: 'Body two', source_url: 'https://example.com/articles/announce-99' };
assert(splitByMergeSimilarity([urlA, urlB]).length === 1, 'same source_url merges');
const integA = {
  ...blogBase,
  headline: 'Integration story',
  snippet: 'Connector for hubspot marketing sync',
  entities: { integrations: ['HubSpot'] },
};
const integB = {
  ...blogBase,
  headline: 'Partnership note',
  snippet: 'Deepening hubspot alignment this quarter',
  entities: { integrations: ['HubSpot'] },
};
assert(signalsSimilarForMerge(integA, integB), 'shared integration entity merges');

const { buildGapInterpretation, refineActionForHeadline, isMetricWorthy } = require('../lib/gapInterpretation');
const interp = buildGapInterpretation({
  factual_competitor_move: 'Acme Corp: Announced new tour scheduling for enterprise properties.',
  dimension: 'features',
  priority: 'high',
  corroboration: 'watch',
  intel_pillars: [1],
  cluster_signal_count: 1,
});
assert(interp.headline && interp.headline.includes('Acme Corp'), 'interpretation headline names competitor');
assert(interp.strategic_why && interp.strategic_why.length > 20, 'interpretation has strategic_why');
assert(interp.threat_tag && interp.threat_tag.includes('Medium'), 'interpretation threat_tag');

const interpMetric = buildGapInterpretation({
  factual_competitor_move: 'EliseAI: Driving the Future of Property Management with AI · industry leading',
  dimension: 'features',
  priority: 'medium',
  corroboration: 'watch',
  intel_pillars: [1],
  cluster_signal_count: 1,
  metric_excerpt: 'Pilot sites cut time-to-lease by 12% in Q2.',
  entities: {},
});
assert(
  interpMetric.headline.includes('12%') || interpMetric.headline.includes('12'),
  'headline leads with metric excerpt when present',
);

const interpEnt = buildGapInterpretation({
  factual_competitor_move: 'Rival: Driving the Future of Everything',
  dimension: 'features',
  priority: 'medium',
  corroboration: 'watch',
  intel_pillars: [1],
  cluster_signal_count: 1,
  metric_excerpt: '',
  entities: { integrations: ['Salesforce', 'RealPage'] },
});
assert(
  interpEnt.headline.includes('Salesforce') || interpEnt.headline.includes('RealPage'),
  'headline uses entity integrations when no metric',
);

const interpMulti = buildGapInterpretation({
  factual_competitor_move: 'X: foo',
  dimension: 'features',
  priority: 'medium',
  corroboration: 'watch',
  intel_pillars: [1],
  cluster_signal_count: 3,
});
assert(!/cluster|pickups|triage/i.test(interpMulti.strategic_why), 'strategic_why avoids ingestion jargon');
assert(
  /places|narrative|similar|repeated|across/i.test(interpMulti.strategic_why),
  'multi-signal why describes repetition across surfaces',
);
const interpMultiLabels = buildGapInterpretation({
  factual_competitor_move: 'Y: bar',
  dimension: 'messaging',
  priority: 'medium',
  corroboration: 'watch',
  intel_pillars: [1],
  cluster_signal_count: 2,
  source_labels: ['Blog', 'Product'],
});
assert(
  /Blog.*Product|Product.*Blog/i.test(interpMultiLabels.strategic_why),
  'strategic_why names corroboration source labels when provided',
);
const interpMultiOneLabel = buildGapInterpretation({
  factual_competitor_move: 'Y: bar',
  dimension: 'messaging',
  priority: 'medium',
  corroboration: 'watch',
  intel_pillars: [1],
  cluster_signal_count: 2,
  source_labels: ['Changelog'],
});
assert(
  /Changelog/i.test(interpMultiOneLabel.strategic_why) && !/Blog/i.test(interpMultiOneLabel.strategic_why),
  'single source label yields distinct multi-surface copy',
);
assert(
  interpMultiLabels.strategic_why !== interpMultiOneLabel.strategic_why,
  'strategic_why varies by source_labels',
);

assert(isMetricWorthy('Grew 40% year over year in multifamily.'), 'isMetricWorthy accepts numeric proof');
assert(
  refineActionForHeadline('Driving the Future of X · Salesforce connector GA').includes('Salesforce'),
  'refineActionForHeadline drops hero fluff segment',
);

const interpAllFluff = buildGapInterpretation({
  factual_competitor_move: 'Z: Driving the Future of Property Management · The Future of Leasing',
  dimension: 'features',
  priority: 'medium',
  corroboration: 'watch',
  intel_pillars: [1],
  cluster_signal_count: 1,
  metric_excerpt: 'short',
  entities: {},
});
assert(
  interpAllFluff.headline.includes('Captured') || interpAllFluff.headline.includes('Details') || interpAllFluff.headline.includes('scrape'),
  'all-boilerplate action falls back to honest headline',
);
const changes = getWhatToChange(report);
assert(Array.isArray(changes), 'getWhatToChange returns array');
if (changes[0]) {
  assert(changes[0].structured && Array.isArray(changes[0].structured.work_items), 'whatToChange has structured work_items');
}
const inv = getAppInventory('prospect-portal');
assert(inv && inv.product_id === 'prospect-portal' && Array.isArray(inv.artifacts), 'getAppInventory returns shape');

if (changes[0] && changes[0].structured) {
  assert(Array.isArray(changes[0].structured.repo_touchpoints), 'whatToChange has repo_touchpoints array');
  assert(Array.isArray(changes[0].structured.repo_grounding_terms), 'whatToChange has repo_grounding_terms array');
  assert(
    changes[0].structured.intel_fence && typeof changes[0].structured.intel_fence.version === 'number',
    'whatToChange includes intel_fence meta',
  );
  const lr = changes[0].structured.llm_readiness;
  assert(lr && lr.gateway, 'whatToChange includes llm_readiness.gateway');
  assert(lr.gateway.mode === 'off', 'llm gateway mode defaults off');
  assert(lr.gateway.outbound_implemented === false, 'LLM outbound not implemented in MVP');
  assert(lr.minimal_model_bundle && lr.minimal_model_bundle.v === 1, 'minimal_model_bundle has v:1');
  assert(
    typeof lr.bundle_json_chars === 'number' &&
      lr.bundle_json_chars > 0 &&
      lr.bundle_json_chars <= 12000,
    'bundle_json_chars positive and under cap',
  );
}

const { intelPillarFromSourceType, summarizePillarsFromSignals } = require('../lib/intelPillar');
const { pillarCoverageFromUrls } = require('../lib/weeklyIntelFlow');
assert(intelPillarFromSourceType('blog', 'blog').pillar === 1, 'blog maps to pillar 1');
assert(intelPillarFromSourceType('pricing_page', 'pricing').pillar === 2, 'pricing maps to pillar 2');
assert(intelPillarFromSourceType('g2_reviews', 'review_g2').pillar === 3, 'g2 maps to pillar 3');
const pillarSum = summarizePillarsFromSignals([
  { metadata: { intel_pillar: 1 } },
  { metadata: { intel_pillar: 2 } },
]);
assert(pillarSum.distinct_pillars === 2 && pillarSum.counts['1'] === 1, 'summarizePillarsFromSignals counts');
const cov = pillarCoverageFromUrls({
  blog: 'https://a.com/feed',
  pricing_url: 'https://a.com/pricing',
  g2_reviews_url: 'https://g2.com/p',
});
assert(cov.p1 && cov.p2 && cov.p3, 'pillarCoverageFromUrls with blog+pricing+g2');

const { sanitizeRepoSnippetText, applyFenceToTouchpoints, fenceMetaForApi } = require('../lib/intelFence');
// Use Bearer pattern only here — strings resembling sk_live_* trip GitHub push protection.
const red = sanitizeRepoSnippetText('token Bearer abcdefghijklmnopqrstuvwxyz0123456789 trailing', {});
assert(red.includes('[redacted]'), 'intelFence redacts Bearer pattern');
const fm = fenceMetaForApi();
assert(fm.repo_snippets_redacted === true && fm.llm_enrichment_enabled === false, 'fenceMetaForApi safe defaults');
assert(fm.signals_encrypted_at_rest === false, 'signals encryption off without key');

const crypto = require('crypto');
const {
  encodeSignalsFileContent,
  decodeSignalsFileContent,
} = require('../lib/signalsAtRest');
const prevKey = process.env.TRACKER_SIGNALS_ENCRYPTION_KEY;
process.env.TRACKER_SIGNALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
const sampleSignals = [{ date: '2020-01-01', product_id: 'P', competitor_id: 'c', type: 'blog', snippet: 'hello' }];
const encBody = encodeSignalsFileContent(sampleSignals);
assert(encBody.includes('_enc'), 'encodeSignalsFileContent encrypts when key set');
const back = decodeSignalsFileContent(encBody);
assert(Array.isArray(back) && back.length === 1 && back[0].snippet === 'hello', 'decodeSignalsFileContent roundtrip');
if (prevKey !== undefined) process.env.TRACKER_SIGNALS_ENCRYPTION_KEY = prevKey;
else delete process.env.TRACKER_SIGNALS_ENCRYPTION_KEY;
const tp = applyFenceToTouchpoints([
  {
    relativePath: 'x.php',
    score: 2,
    matched_terms: ['lease'],
    snippets: [{ line: 1, term: 'lease', text: "apiKey: 'verylongsecretvaluehere'" }],
  },
  { relativePath: 'y.php', score: 1, matched_terms: [], snippets: [] },
]);
assert(tp[0].snippets[0].text.includes('[redacted]'), 'applyFenceToTouchpoints sanitizes snippets');
assert(tp.length <= 10, 'applyFenceToTouchpoints caps touchpoints');

const { extractSearchTerms, scanRepo, mergeGapAndProductTerms } = require('../lib/repoInsight');
const { pickVariantByGapId, getProductVoice } = require('../lib/productContext');
const sparseGap = { competitor_move: '', headline: '', description: '', competitor_signal: '' };
const mergedSparse = mergeGapAndProductTerms(sparseGap, 'prospect-portal');
assert(mergedSparse.length > 0, 'product keyword map supplies terms when gap text is empty');

const v = getProductVoice('prospect-portal');
assert(v.display_name && v.match_focus.length >= 1, 'getProductVoice loads display_name and match_focus');
const a = pickVariantByGapId('gap-aaa', ['one', 'two', 'three']);
const b = pickVariantByGapId('gap-bbb', ['one', 'two', 'three']);
assert(['one', 'two', 'three'].includes(a) && ['one', 'two', 'three'].includes(b), 'pickVariantByGapId returns pool member');
const t1 = extractSearchTerms('Competitor launched new dashboard widgets for leasing tours');
assert(t1.includes('dashboard') || t1.includes('leasing') || t1.includes('widgets'), 'extractSearchTerms pulls domain words');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-insight-'));
fs.mkdirSync(path.join(tmp, 'src'));
fs.writeFileSync(path.join(tmp, 'src', 'Foo.php'), '<?php\n// leasing dashboard widget\n', 'utf8');
const hits = scanRepo(tmp, ['leasing', 'dashboard'], { maxDepth: 5, maxFiles: 50 });
assert(hits.length >= 1 && hits[0].relativePath.includes('Foo.php'), 'scanRepo finds file');
fs.rmSync(tmp, { recursive: true, force: true });

console.log('Tests:', ok, 'ok', fail, 'fail');
process.exit(fail ? 1 : 0);
