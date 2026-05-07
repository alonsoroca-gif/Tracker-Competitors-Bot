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
assert(interp.manager_takeaway && interp.manager_takeaway.length > 10, 'interpretation has manager_takeaway');
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
// Phase 2: new source types
assert(intelPillarFromSourceType('insights', 'insights').pillar === 1, 'insights maps to pillar 1');
assert(intelPillarFromSourceType('podcast', 'podcast').pillar === 1, 'podcast maps to pillar 1');
assert(intelPillarFromSourceType('media', 'media').pillar === 3, 'media maps to pillar 3');
assert(intelPillarFromSourceType('reviews_other', 'review_other').pillar === 3, 'review_other maps to pillar 3');
// Phase B-2: HTML lane source types
assert(
  intelPillarFromSourceType('case_studies', 'case_study').pillar === 1,
  'case_studies/case_study maps to pillar 1 (owned)'
);
assert(
  intelPillarFromSourceType('articles_index', 'article').pillar === 1,
  'articles_index/article maps to pillar 1 (owned)'
);
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
// Phase 2: new URL keys count toward correct pillars
const covInsights = pillarCoverageFromUrls({ insights_url: 'https://x.com/insights/feed/' });
assert(covInsights.p1 === true, 'insights_url counts toward P1');
const covPodcast = pillarCoverageFromUrls({ podcast_url: 'https://x.com/podcast/feed/' });
assert(covPodcast.p1 === true, 'podcast_url counts toward P1');
const covMedia = pillarCoverageFromUrls({ media_url: 'https://x.com/media/feed/' });
assert(covMedia.p3 === true, 'media_url counts toward P3');
const covReviews = pillarCoverageFromUrls({ reviews_url: 'https://featuredcustomers.com/x' });
assert(covReviews.p3 === true, 'reviews_url counts toward P3');
const covG2Array = pillarCoverageFromUrls({ g2_reviews_urls: ['https://g2.com/a', 'https://g2.com/b'] });
assert(covG2Array.p3 === true, 'g2_reviews_urls array counts toward P3');
// Phase B-2: HTML lanes count toward P1
const covCaseStudies = pillarCoverageFromUrls({ case_studies_url: 'https://x.com/customer-stories/' });
assert(covCaseStudies.p1 === true, 'case_studies_url counts toward P1');
const covCaseStudiesArr = pillarCoverageFromUrls({
  case_studies_urls: ['https://x.com/a', 'https://x.com/b'],
});
assert(covCaseStudiesArr.p1 === true, 'case_studies_urls array counts toward P1');
const covArticles = pillarCoverageFromUrls({ articles_url: 'https://x.com/articles/' });
assert(covArticles.p1 === true, 'articles_url counts toward P1');
const covArticlesArr = pillarCoverageFromUrls({ articles_urls: ['https://x.com/a'] });
assert(covArticlesArr.p1 === true, 'articles_urls array counts toward P1');

// Phase 2: getSourceUrls schema upgrades — array form for g2_reviews_url
const { getSourceUrls } = require('../lib/collect');
const funnelUrls = getSourceUrls('funnel-leasing');
assert(
  Array.isArray(funnelUrls.g2_reviews_urls) && funnelUrls.g2_reviews_urls.length === 2,
  'funnel-leasing g2_reviews_urls is array of 2'
);
assert(
  funnelUrls.g2_reviews_urls.includes('https://www.g2.com/products/fenix-ai/reviews'),
  'funnel-leasing g2_reviews_urls includes Fenix AI'
);
assert(
  typeof funnelUrls.g2_reviews_url === 'string' && funnelUrls.g2_reviews_url.length > 0,
  'funnel-leasing g2_reviews_url legacy string still populated for back-compat'
);
assert(funnelUrls.insights_url && funnelUrls.insights_url.includes('insights'), 'funnel-leasing insights_url set');
assert(funnelUrls.media_url && funnelUrls.media_url.includes('media'), 'funnel-leasing media_url set');
assert(funnelUrls.podcast_url && funnelUrls.podcast_url.includes('podcast'), 'funnel-leasing podcast_url set');
assert(funnelUrls.reviews_url && funnelUrls.reviews_url.includes('featuredcustomers'), 'funnel-leasing reviews_url set');

const eliseUrls = getSourceUrls('eliseai');
assert(
  Array.isArray(eliseUrls.g2_reviews_urls),
  'eliseai still has g2_reviews_urls array (back-compat from string config)'
);
assert(typeof eliseUrls.g2_reviews_url === 'string', 'eliseai legacy string field present');
// Phase B-2 — verification round backfill
assert(
  eliseUrls.g2_reviews_url.includes('eliseai'),
  'eliseai g2_reviews_url backfilled (Phase B-2 verification round)'
);
// Post-demo cleanup — broken URLs cleared after first live drop validation
assert(
  eliseUrls.pricing_url === '',
  'eliseai pricing_url cleared (was 404 in live drop)'
);
const funnelUrlsPostDemo = getSourceUrls('funnel-leasing');
assert(
  funnelUrlsPostDemo.pricing_url === '',
  'funnel-leasing pricing_url cleared (was 404 in live drop)'
);

// Phase B-2 — Anyone Home config has new HTML lanes
const anyoneHomeUrls = getSourceUrls('anyone-home');
assert(
  anyoneHomeUrls.blog === '',
  'anyone-home blog cleared (Cloudflare 403 on /feed/ — see FOLLOWUPS-TOMORROW)'
);
assert(
  anyoneHomeUrls.features_url.includes('/solutions/'),
  'anyone-home features_url upgraded from homepage to /solutions/'
);
assert(
  anyoneHomeUrls.careers_url === '',
  'anyone-home careers_url cleared (was 404)'
);
assert(
  Array.isArray(anyoneHomeUrls.case_studies_urls) && anyoneHomeUrls.case_studies_urls.length === 2,
  'anyone-home case_studies_urls is array of 2'
);
assert(
  anyoneHomeUrls.case_studies_urls.includes('https://anyonehome.com/customer-stories/'),
  'anyone-home case_studies_urls includes /customer-stories/'
);
assert(
  typeof anyoneHomeUrls.case_studies_url === 'string' && anyoneHomeUrls.case_studies_url.length > 0,
  'anyone-home case_studies_url legacy string populated for back-compat'
);
assert(Array.isArray(anyoneHomeUrls.articles_urls), 'anyone-home articles_urls is array (empty allowed)');
assert(typeof anyoneHomeUrls.articles_url === 'string', 'anyone-home articles_url legacy string present');

// Phase B-2 — Jonah Digital config: features moved to /add-ons/, articles_url adopted, case_studies_url on homepage
const jonahUrls = getSourceUrls('jonah-digital');
assert(
  jonahUrls.features_url === 'https://jonahdigital.com/add-ons/',
  'jonah-digital features_url upgraded to /add-ons/'
);
assert(
  jonahUrls.careers_url === '',
  'jonah-digital careers_url cleared (was 404)'
);
assert(
  jonahUrls.docs_url === '',
  'jonah-digital docs_url cleared (moved into articles_url)'
);
assert(
  jonahUrls.articles_url === 'https://jonahdigital.com/articles/',
  'jonah-digital articles_url points to /articles/ (Phase B-2 first real use)'
);
assert(
  Array.isArray(jonahUrls.articles_urls) && jonahUrls.articles_urls.includes('https://jonahdigital.com/articles/'),
  'jonah-digital articles_urls array contains /articles/'
);
assert(
  jonahUrls.case_studies_url === 'https://jonahdigital.com/',
  'jonah-digital case_studies_url points to homepage (8 testimonial blockquotes)'
);
assert(
  Array.isArray(jonahUrls.case_studies_urls) && jonahUrls.case_studies_urls.includes('https://jonahdigital.com/'),
  'jonah-digital case_studies_urls array contains homepage'
);
// 2026-05-07 — pricing_url cleared because the homepage is already wired as
// case_studies_url; running it through extractPageSignals just adds a duplicate
// fetch that gets deduped or returns nothing useful.
assert(
  jonahUrls.pricing_url === '',
  'jonah-digital pricing_url cleared (URL collision with case_studies_url)'
);

// Phase 2: inferDimension routes new types correctly
const { buildGapReport: _bgr } = require('../lib/gapReport');
const gapReport = require('../lib/gapReport');
// inferDimension is not exported directly; verify via TYPE_ACTION_FALLBACK presence and fallback labels through buildGapReport behavior
// Direct: re-require module exports we need
const _gr = require('../lib/gapReport');
// We don't export inferDimension publicly, but we can stub a signal and run buildGapReport to confirm new types don't crash.
// Smoke: ensure the module loaded without throwing after our edits.
assert(typeof _gr.buildGapReport === 'function', 'gapReport buildGapReport still exported after Phase 2 edits');

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

const { buildInterpreterGapPayload, buildCursorInterpretationPackage } = require('../lib/interpreterPayload');
const { pickPlaybookLine, resetPlaybookCacheForTests } = require('../lib/responsePlaybook');
const sampleGapPayload = {
  gap_id: 'gap-099',
  product_id: 'prospect-portal',
  competitor_id: 'acme',
  dimension: 'features',
  our_gap: 'Starting',
  priority: 'high',
  corroboration: 'confirmed',
  competitor_move: 'Acme shipped tours',
  competitor_signal: '[Blog]\nHello world',
  cluster_signal_count: 2,
  detected_at: '2026-01-15',
  intel_pillar_label: 'P1+P2 · Multi-pillar',
  corroboration_sources: [{ source: 'blog', label: 'Blog', source_url: 'https://example.com/a' }],
  interpretation: { headline: 'H', strategic_why: 'W', threat_tag: 'T' },
};
const igp = buildInterpreterGapPayload(sampleGapPayload, {
  product_id: 'prospect-portal',
  product_name: 'Prospect Portal',
});
assert(
  igp.schema_version === '1.0' &&
    igp.gap_id === 'gap-099' &&
    Array.isArray(igp.signals) &&
    igp.signals.length >= 1 &&
    igp.existing_rule_based &&
    igp.existing_rule_based.headline === 'H',
  'interpreter gap payload shape',
);
const cursorPkg = buildCursorInterpretationPackage(sampleGapPayload, {
  product_id: 'prospect-portal',
  period_start: '2026-01-01',
  period_end: '2026-01-07',
});
assert(
  cursorPkg.copy_block &&
    cursorPkg.user_prompt.includes('gap-099') &&
    cursorPkg.user_prompt.includes('Report period'),
  'cursor interpretation package has copy_block and period context',
);
resetPlaybookCacheForTests();
const pbLine = pickPlaybookLine({
  dimension: 'features',
  corroboration: 'confirmed',
  our_gap: 'Starting',
  priority: 'high',
});
assert(pbLine && /Multi-pillar|internal L2|timebox discovery/i.test(pbLine), 'playbook matches a gap rule');

// Post-demo architecture fix — runFullCollect should call collect() ONCE per
// competitor and fan signals out across products (was N×products before, which
// triggered Cloudflare rate-limits and silently zeroed RSS feeds).
(async () => {
  // Reload runCollectAll fresh after stubbing collect + storage to keep the
  // test hermetic (no network, no signals.json mutation).
  const collectModulePath = require.resolve('../lib/collect');
  const storageModulePath = require.resolve('../lib/storage');
  const runAllPath = require.resolve('../lib/runCollectAll');

  const originalCollect = require('../lib/collect');
  const originalStorage = require('../lib/storage');

  let collectCalls = 0;
  const collectInvocations = [];
  require.cache[collectModulePath].exports = {
    ...originalCollect,
    collect: async (competitorId, productId /*, days, session */) => {
      collectCalls += 1;
      collectInvocations.push({ competitorId, productId });
      return [
        {
          date: '2026-05-06',
          source: 'features_page',
          competitor_id: competitorId,
          product_id: productId,
          type: 'features',
          snippet: `mock signal for ${competitorId}`,
        },
      ];
    },
  };
  require.cache[storageModulePath].exports = {
    ...originalStorage,
    writeSignals: () => ({ added: 0 }),
    pruneSignalsToRetentionDays: () => ({ kept: 0, removed: 0 }),
  };

  delete require.cache[runAllPath];
  const { runFullCollect: runFCFresh } = require('../lib/runCollectAll');
  const result = await runFCFresh(7, { verbose: false });

  // Expectation: 1 collect call per competitor — not per (competitor × product).
  const cfg = loadConfig();
  const competitorCount = cfg.competitors.length;
  const productCount = cfg.products.length;

  assert(
    collectCalls === competitorCount,
    `runFullCollect calls collect() once per competitor (got ${collectCalls}, expected ${competitorCount})`
  );
  assert(
    productCount > 1 && collectCalls < productCount * competitorCount,
    `runFullCollect skips the old N×products fan-in (got ${collectCalls}, old behavior would be ${productCount * competitorCount})`
  );
  assert(
    Array.isArray(result.batchSignals) &&
      result.batchSignals.length === competitorCount * productCount,
    `signals fan out to every product (got ${result.batchSignals.length}, expected ${competitorCount * productCount})`
  );
  // Each competitor should have signals with every product_id present.
  for (const comp of cfg.competitors) {
    const productIdsForComp = new Set(
      result.batchSignals.filter((s) => s.competitor_id === comp.id).map((s) => s.product_id)
    );
    assert(
      productIdsForComp.size === productCount,
      `competitor ${comp.id} has signals tagged for all ${productCount} products (got ${productIdsForComp.size})`
    );
  }

  // Restore module cache so later requires (if any) see real modules.
  require.cache[collectModulePath].exports = originalCollect;
  require.cache[storageModulePath].exports = originalStorage;
  delete require.cache[runAllPath];

  console.log('Tests:', ok, 'ok', fail, 'fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('runFullCollect test failed:', e);
  process.exit(1);
});
