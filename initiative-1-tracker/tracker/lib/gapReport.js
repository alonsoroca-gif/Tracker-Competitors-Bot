const { getSignals } = require('./storage');
const { getOurState } = require('./ourState');
const { loadConfig } = require('./loadConfig');
const { intelPillarFromSourceType } = require('./intelPillar');
const { buildGapInterpretation } = require('./gapInterpretation');

const DIMENSIONS = ['features', 'pricing', 'messaging', 'support', 'positioning'];

const OUR_STATE_STATUSES = ['Starting', 'In process', 'Delivered'];

function normalizeOurStateStatus(val) {
  if (val === undefined || val === null) return 'Starting';
  const s = String(val).trim();
  if (!s) return 'Starting';
  const lower = s.toLowerCase();
  if (lower === 'starting') return 'Starting';
  if (lower === 'in process' || lower === 'inprogress') return 'In process';
  if (lower === 'delivered') return 'Delivered';
  return 'In process';
}

/** Sentence likely carries a metric or concrete claim (not a page title). */
const FACT_SIGNAL =
  /\d[\d,.\s]*%|\$[\d,.]+[kmb]?|\d[\d,.]+\s*(million|billion|thousand|customers?|users?|properties|units?|doors?|communities?)|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i;

const ACTION_VERB_SIGNAL =
  /\b(launch(?:es|ed|ing)?|introduc|announc(?:es|ed|ing)?|partner(?:ed|s|ship)?|acqui|integrat|roll(?:ed|out)?|ship(?:ped|s)?|releas(?:e|ed|es|ing)|priced?|tier|plan|funding|raised|series\s+[a-d]|expand(?:ed|s|ing)?|deploy)\b/i;

/**
 * Prefer evidence/snippet sentences with numbers or strong action verbs — avoids blog titles as the main line.
 */
function metricOrFactExcerpt(s) {
  const raw = [s.evidence_snippet, s.snippet].filter(Boolean).join('\n');
  if (!String(raw).trim()) return '';
  const cleaned = cleanSnippet(raw);
  const oneLine = cleaned.replace(/\s+/g, ' ').trim();
  if (!oneLine) return '';
  const sentences = oneLine.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const pool = sentences.length ? sentences : [oneLine];

  for (const sent of pool) {
    if (FACT_SIGNAL.test(sent) && sent.length >= 10 && sent.length <= 380) return sent;
  }
  for (const sent of pool) {
    if (ACTION_VERB_SIGNAL.test(sent) && sent.length >= 18 && sent.length <= 320) return sent;
  }
  return '';
}

/** Strip nav boilerplate but keep fact-like content (numbers, metrics). */
function cleanSnippet(snippet) {
  if (!snippet || typeof snippet !== 'string') return '(no detail)';
  const skip = [
    'contact us', 'login', 'request a demo', 'request demo', 'skip to main', 'sign in',
    'how we help', 'home', 'get your copy', '©', 'all rights reserved',
    'schedule a call', 'schedule demo', 'book a demo', 'learn more', 'read more',
    'get started', 'try free', 'start free trial', 'subscribe', 'newsletter',
    'cookie policy', 'privacy policy', 'terms of service', 'follow us',
  ];
  let s = snippet.replace(/\s+/g, ' ').trim();
  for (const phrase of skip) {
    const i = s.toLowerCase().indexOf(phrase);
    if (i === 0) s = s.slice(phrase.length).replace(/^[\s|\-]+/, '').trim();
    else if (i > 0) s = s.slice(0, i).trim();
  }
  const hasFacts = /\d|%|\$|million|percent|ROI|savings|growth/i.test(s);
  const maxLen = hasFacts ? 600 : 400;
  if (s.length > maxLen) s = s.slice(0, maxLen - 3) + '...';
  return s || snippet.slice(0, 300);
}

/** Interpreted “action” copy from collect.js event_type / type (concise insight line). */
const EVENT_TYPE_ACTION = {
  integration_launch: 'Announced or expanded an integration',
  feature_launch: 'Signaled a product or feature launch',
  feature_set_update: 'Highlighted multiple product capabilities',
  pricing_change: 'Surfaced concrete pricing or plan details',
  pricing_positioning: 'Emphasized pricing and packaging',
  partnership: 'Announced a partnership',
  positioning_shift: 'Shifted positioning or category story',
  content_update: 'Published new content',
  hiring_signal: 'Signaled hiring and org growth',
};

const TYPE_ACTION_FALLBACK = {
  blog: 'Published blog or content',
  press: 'Issued press or news',
  changelog: 'Shipped changelog or release notes',
  youtube: 'Posted video content',
  pricing: 'Updated pricing-related signals',
  features: 'Updated product or features messaging',
  job: 'Surfaced careers or hiring signals',
  review_g2: 'User review voices on G2',
  review_youtube: 'YouTube comment / community voices',
};

function competitorNameMap() {
  try {
    const config = loadConfig();
    const map = {};
    for (const c of config.competitors || []) {
      if (c && c.id) map[c.id] = c.name || c.id;
    }
    return map;
  } catch (_) {
    return {};
  }
}

function competitorDisplayName(signal, nameMap) {
  const id = signal.competitor_id || '';
  if (nameMap[id]) return nameMap[id];
  if (!id) return 'Competitor';
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function sourceHumanLabel(signal) {
  const src = String(signal.source || '').toLowerCase();
  const labels = {
    features_page: 'Features page',
    pricing_page: 'Pricing',
    careers: 'Careers',
    blog: 'Blog feed',
    press: 'Press feed',
    changelog: 'Changelog',
    youtube: 'YouTube',
    youtube_comments: 'YouTube comments',
    youtube_search: 'YouTube (search)',
    g2_reviews: 'G2 reviews',
    docs: 'Documentation',
  };
  if (labels[src]) return labels[src];
  if (signal.source) return String(signal.source).replace(/_/g, ' ');
  return 'Web';
}

/** L1 competitive move — short table cell; full text is in Details (competitor_signal). */
const MAX_ACTION_LEN = 200;

function clip(str, max) {
  const t = String(str || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Fix glued words from scrape (e.g. IntelligenceFor → Intelligence For). */
function prettifyChunk(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1 $2');
}

/**
 * Join items inside one label with commas — keeps “Competitor · action · source” readable
 * (middle dots only between major segments: Capabilities vs Positioning, etc.).
 */
function joinCommaChunks(items, { maxItems = 3, maxEach = 44 } = {}) {
  if (!Array.isArray(items) || !items.length) return '';
  return items
    .filter(Boolean)
    .slice(0, maxItems)
    .map((x) => clip(prettifyChunk(x), maxEach))
    .join(', ');
}

function entitiesObject(s) {
  return s.entities && typeof s.entities === 'object' && !Array.isArray(s.entities) ? s.entities : {};
}

/**
 * Collect’s analytical one-liners when they match our templates (full line, table-capped).
 */
function actionFromAnalyticalSnippet(s) {
  const sn = String(s.snippet || '').replace(/\s+/g, ' ').trim();
  if (!sn) return '';
  if (
    /^Detected /i.test(sn) ||
    /^Noted:/i.test(sn) ||
    /pricing values:/i.test(sn) ||
    /feature\/solution themes:/i.test(sn) ||
    /hiring focus:/i.test(sn) ||
    /Tier language:/i.test(sn) ||
    /Packaging keywords:/i.test(sn)
  ) {
    return clip(sn, MAX_ACTION_LEN);
  }
  return '';
}

/**
 * Middle segment priority:
 * 1) Typed entities (pricing → features → careers → feeds)
 * 2) Analytical snippet templates
 * 3) Generic event_type / type phrases
 */
function specificActionPhrase(s) {
  const ent = entitiesObject(s);
  const type = String(s.type || '').toLowerCase();
  const src = String(s.source || '').toLowerCase();
  const et = String(s.event_type || '').trim();

  const reviewQuotes = Array.isArray(ent.review_quotes) ? ent.review_quotes.filter(Boolean) : [];
  if (
    reviewQuotes.length &&
    (type === 'review_g2' || type === 'review_youtube' || src === 'g2_reviews' || src === 'youtube_comments')
  ) {
    return clip(`User voices: ${joinCommaChunks(reviewQuotes, { maxItems: 2, maxEach: 44 })}`, MAX_ACTION_LEN);
  }

  const discoveryQs = Array.isArray(ent.discovery_queries) ? ent.discovery_queries.filter(Boolean) : [];
  if (src === 'youtube_search' && discoveryQs.length) {
    return clip(`YouTube search: ${joinCommaChunks(discoveryQs, { maxItems: 2, maxEach: 40 })}`, MAX_ACTION_LEN);
  }

  // 1a) Pricing — prices, then tiers, then packaging keywords
  if (type === 'pricing' || src === 'pricing_page' || et.startsWith('pricing')) {
    const prices = Array.isArray(ent.prices) ? ent.prices.filter(Boolean) : [];
    const tiers = Array.isArray(ent.tiers) ? ent.tiers.filter(Boolean) : [];
    const kws = Array.isArray(ent.keywords) ? ent.keywords.filter(Boolean) : [];
    const parts = [];
    if (prices.length) parts.push(`Prices: ${prices.slice(0, 6).join(', ')}`);
    if (tiers.length) parts.push(`Plans/tiers: ${joinCommaChunks(tiers, { maxItems: 3, maxEach: 42 })}`);
    if (kws.length) parts.push(`Packaging: ${kws.slice(0, 8).join(', ')}`);
    if (parts.length) return clip(parts.join(' · '), MAX_ACTION_LEN);
  }

  // 1b) Features page — prefer one fact-dense sentence over long hero taglines / capability lists (full lists → Details)
  if (type === 'features' || src === 'features_page') {
    const factFirst = metricOrFactExcerpt(s);
    if (factFirst && factFirst.length >= 22) return clip(factFirst, MAX_ACTION_LEN);

    const feats = Array.isArray(ent.features) ? ent.features.filter(Boolean) : [];
    const pos = Array.isArray(ent.positioning_keywords) ? ent.positioning_keywords.filter(Boolean) : [];
    const kws = Array.isArray(ent.keywords) ? ent.keywords.filter(Boolean) : [];

    if (feats.length) {
      const one = joinCommaChunks(feats, { maxItems: 1, maxEach: 88 });
      const extra =
        pos.length && one.length < 72 ? ` · ${joinCommaChunks(pos, { maxItems: 2, maxEach: 40 })}` : '';
      return clip(`${one}${extra}`, MAX_ACTION_LEN);
    }
    if (kws.length) {
      return clip(joinCommaChunks(kws, { maxItems: 4, maxEach: 36 }), MAX_ACTION_LEN);
    }
    if (pos.length) return clip(joinCommaChunks(pos, { maxItems: 3, maxEach: 48 }), MAX_ACTION_LEN);
  }

  // 1c) Careers — roles + focus groups
  if (type === 'job' || src === 'careers') {
    const roles = Array.isArray(ent.roles) ? ent.roles.filter(Boolean) : [];
    const groups = Array.isArray(ent.role_groups) ? ent.role_groups.filter(Boolean) : [];
    if (roles.length) {
      let line = `Hiring: ${joinCommaChunks(roles, { maxItems: 2, maxEach: 40 })}`;
      if (groups.length) line = `${line} · Focus: ${groups.join(', ')}`;
      return clip(line, MAX_ACTION_LEN);
    }
    if (groups.length) return clip(`Focus: ${groups.join(', ')}`, MAX_ACTION_LEN);
  }

  // 1d) Feeds / other — integrations and AI terms when extractNamedEntities filled them
  const integ = Array.isArray(ent.integrations) ? ent.integrations.filter(Boolean) : [];
  const aiTerms = Array.isArray(ent.ai_terms) ? ent.ai_terms.filter(Boolean) : [];
  if (integ.length || aiTerms.length) {
    const parts = [];
    if (integ.length) parts.push(`Mentions: ${integ.slice(0, 6).join(', ')}`);
    if (aiTerms.length) parts.push(aiTerms.slice(0, 4).join(', '));
    return clip(parts.join(' · '), MAX_ACTION_LEN);
  }

  // 2) Analytical snippet templates (fact-shaped lines from collect)
  const fromSnippet = actionFromAnalyticalSnippet(s);
  if (fromSnippet) return fromSnippet;

  // 3) Metric / action sentences from body text (no page titles as primary)
  const factLine = metricOrFactExcerpt(s);
  if (factLine) return clip(factLine, MAX_ACTION_LEN);

  // 4) Typed event summary — vague but honest when extraction failed
  if (et && EVENT_TYPE_ACTION[et]) return clip(EVENT_TYPE_ACTION[et], MAX_ACTION_LEN);
  if (TYPE_ACTION_FALLBACK[type]) return clip(TYPE_ACTION_FALLBACK[type], MAX_ACTION_LEN);

  const sn = cleanSnippet(s.snippet || '');
  if (sn && sn.length >= 35) return clip(sn, MAX_ACTION_LEN);

  return clip(`Captured from ${sourceHumanLabel(s)} — open Details for excerpt`, MAX_ACTION_LEN);
}

/**
 * One line for "what competitor is doing": **Competitor: action + metrics** (source is its own column in the UI).
 * Headlines are not used here — they stay under Details with full evidence.
 */
function buildConciseCompetitorMove(s, nameMap) {
  const who = competitorDisplayName(s, nameMap);
  const action = specificActionPhrase(s);
  return `${who}: ${action}`;
}

/** Rich text for expandable Details (evidence + summary). */
function buildDetailBodyFromSignal(s) {
  const parts = [];
  if (s.headline && String(s.headline).trim()) parts.push(`Headline: ${String(s.headline).trim()}`);
  if (s.evidence_snippet && String(s.evidence_snippet).trim()) parts.push(String(s.evidence_snippet).trim());
  if (s.snippet && String(s.snippet).trim()) parts.push(String(s.snippet).trim());
  const joined = parts.filter(Boolean).join('\n\n');
  return joined.slice(0, 8000) || cleanSnippet(s.snippet || '');
}

/**
 * Map signal type to dimension and our-state key.
 * Types: blog, press, news, changelog, pricing, features, job.
 */
function inferDimension(signal) {
  const t = (signal.type || '').toLowerCase();
  const snip = (signal.snippet || '').toLowerCase();
  if (t === 'blog' && (snip.includes('live chat') || snip.includes('support'))) return { dimension: 'support', ourKey: 'support' };
  if (t === 'pricing' || snip.includes('pricing') || snip.includes('credit card') || snip.includes('cancel')) return { dimension: 'messaging', ourKey: 'pricing_messaging' };
  if (t === 'job' || snip.includes('hire') || snip.includes('vp') || snip.includes('international')) return { dimension: 'positioning', ourKey: 'positioning' };
  if (t === 'press' || t === 'news') return { dimension: 'positioning', ourKey: 'positioning' };
  if (t === 'youtube' || t === 'video') return { dimension: 'positioning', ourKey: 'positioning' };
  if (t === 'review_youtube') return { dimension: 'positioning', ourKey: 'positioning' };
  if (t === 'review_g2') return { dimension: 'features', ourKey: 'features' };
  if (t === 'changelog' || t === 'features') return { dimension: 'features', ourKey: 'features' };
  if (t === 'blog') return { dimension: 'features', ourKey: 'features' };
  return { dimension: 'features', ourKey: 'features' };
}

function priorityFromDimension(dimension) {
  if (dimension === 'support' || dimension === 'features') return 'high';
  if (dimension === 'messaging' || dimension === 'pricing') return 'medium';
  return 'low';
}

/** Group key: same competitor + inferred dimension + event theme (event_type when known, else type). */
function clusterKeyFromSignal(s) {
  const { dimension } = inferDimension(s);
  const et = String(s.event_type || '').trim();
  const type = String(s.type || 'unknown').toLowerCase();
  const theme = et && EVENT_TYPE_ACTION[et] ? et : type;
  return `${String(s.competitor_id || '')}|${dimension}|${theme}`;
}

const MERGE_STOPWORDS = new Set(
  `the and for are but not you all any can her was one our out day get has him his how man new now old see two way who boy did its let put say she too use may act add buy did few got per ran raw sit try won abcs able also area back base beat best blog book both call came case city code come copy core cost date deal does each edit else ever face fact fair fell felt file find fine fire firm five foot form four free from full game gave girl give good great grey group grow guide half hand hang hard head hear help here hero high hill hold home hope host hour huge idea inch info into item join just keep keen kind know land last late lead left less life like line link list live long look lord lose love made make many mark mean menu mile miss mode money month more most move much must name near need news next nice nine none noon note okay once only open order other over pace page part pass past pick plan play plug post pull pure push quick race rain read real rest rice rich ride ring rise road rock role room root rule safe said sale same save seat seem self sell send shot show shut side sign sing site size skin skip slip slow snow soft soil sold some song soon sort soul spit star stay step stop such suit sure take tale talk tall team tell ten terms text than that thee them then they thin this those thou three thro thru tick time told tone took tour town tree true turn twin two types undo unit upon used user vary vast very vice view visa visit void wage wait walk wall want warm wash wave weak wear week well went were west what when where which while whom wide wife wild wind wine wing wire wise wish with word work wrap yard year your zone https http www com org img src alt rel`.split(
    /\s+/
  )
);

/** Tokens + entity terms used to decide if two signals describe the same story (avoid merging unrelated items). */
function extractMergeTokens(s) {
  const set = new Set();
  const ent = entitiesObject(s);
  const raw = [s.headline, s.snippet, s.evidence_snippet].filter(Boolean).join(' ');
  const words = String(raw).toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || [];
  for (const w of words) {
    if (w.length < 4 || MERGE_STOPWORDS.has(w)) continue;
    set.add(w);
  }
  for (const key of ['integrations', 'keywords', 'features', 'positioning_keywords', 'ai_terms', 'roles', 'tiers']) {
    const arr = Array.isArray(ent[key]) ? ent[key] : [];
    for (const x of arr) {
      for (const w of String(x).toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || []) {
        if (w.length >= 3 && !MERGE_STOPWORDS.has(w)) set.add(w);
      }
    }
  }
  return set;
}

function normalizedHeadline(s) {
  return String(s.headline || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function sharedIntegrationHit(a, b) {
  const A = new Set(
    (Array.isArray(entitiesObject(a).integrations) ? entitiesObject(a).integrations : []).map((x) =>
      String(x).toLowerCase().trim()
    ).filter(Boolean)
  );
  const B = new Set(
    (Array.isArray(entitiesObject(b).integrations) ? entitiesObject(b).integrations : []).map((x) =>
      String(x).toLowerCase().trim()
    ).filter(Boolean)
  );
  for (const x of A) if (B.has(x)) return true;
  return false;
}

function sharedPriceHit(a, b) {
  const A = new Set((Array.isArray(entitiesObject(a).prices) ? entitiesObject(a).prices : []).map(String).filter(Boolean));
  const B = new Set((Array.isArray(entitiesObject(b).prices) ? entitiesObject(b).prices : []).map(String).filter(Boolean));
  for (const x of A) if (B.has(x)) return true;
  return false;
}

/**
 * True if two signals should merge into one gap (same coarse bucket already applies).
 */
function signalsSimilarForMerge(a, b) {
  const urlA = String(a.source_url || '').trim();
  const urlB = String(b.source_url || '').trim();
  if (urlA && urlB && urlA === urlB) return true;

  if (sharedIntegrationHit(a, b) || sharedPriceHit(a, b)) return true;

  const hA = normalizedHeadline(a);
  const hB = normalizedHeadline(b);
  if (hA.length >= 14 && hA === hB) return true;

  const tA = extractMergeTokens(a);
  const tB = extractMergeTokens(b);
  let inter = 0;
  for (const x of tA) if (tB.has(x)) inter++;

  const uni = tA.size + tB.size - inter;
  const jaccard = uni > 0 ? inter / uni : 0;

  if (tA.size < 5 || tB.size < 5) {
    return inter >= 2;
  }
  if (inter >= 2 && jaccard >= 0.1) return true;
  if (jaccard >= 0.2) return true;
  return false;
}

/**
 * Split a coarse bucket into sub-clusters: only merge related signals (union-find on similarity).
 */
function splitByMergeSimilarity(members) {
  const n = members.length;
  if (n <= 1) return [members];
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i) {
    return parent[i] === i ? i : (parent[i] = find(parent[i]));
  }
  function union(i, j) {
    const pi = find(i);
    const pj = find(j);
    if (pi !== pj) parent[pj] = pi;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (signalsSimilarForMerge(members[i], members[j])) union(i, j);
    }
  }
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!map.has(r)) map.set(r, []);
    map.get(r).push(members[i]);
  }
  return [...map.values()];
}

function pickRepresentativeSignal(members) {
  const list = Array.isArray(members) ? members.slice() : [];
  list.sort((a, b) => {
    const ia = typeof a.importance === 'number' ? a.importance : 0;
    const ib = typeof b.importance === 'number' ? b.importance : 0;
    if (ib !== ia) return ib - ia;
    const ca = typeof a.confidence === 'number' ? a.confidence : 0;
    const cb = typeof b.confidence === 'number' ? b.confidence : 0;
    return cb - ca;
  });
  return list[0] || members[0];
}

/** Pillar per signal: stored metadata, or infer from source/type (older signals.json had no metadata). */
function intelPillarForSignal(s) {
  const fromMeta = s.metadata && typeof s.metadata.intel_pillar === 'number' ? s.metadata.intel_pillar : null;
  if (fromMeta >= 1 && fromMeta <= 4) return fromMeta;
  const inf = intelPillarFromSourceType(s.source, s.type);
  return typeof inf.pillar === 'number' && inf.pillar >= 1 && inf.pillar <= 4 ? inf.pillar : null;
}

function distinctIntelPillars(members) {
  const set = new Set();
  for (const s of members) {
    const p = intelPillarForSignal(s);
    if (p != null) set.add(p);
  }
  return [...set].sort((a, b) => a - b);
}

/** Unique source rows for UI filter + summary. */
function corroborationSourcesFromMembers(members) {
  const seen = new Set();
  const out = [];
  for (const s of members) {
    const src = (s.source && String(s.source).trim()) ? s.source.trim() : '';
    const url = (s.source_url && String(s.source_url).trim()) ? String(s.source_url).trim() : '';
    const key = `${src}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      source: src || null,
      source_url: url || null,
      label: sourceHumanLabel(s),
    });
  }
  return out;
}

function mergeClusterDetailBodies(members) {
  const blocks = members.map((s) => {
    const label = sourceHumanLabel(s);
    const url = s.source_url ? ` ${String(s.source_url).trim()}` : '';
    const body = buildDetailBodyFromSignal(s);
    return `[${label}${url}]\n${body}`;
  });
  return blocks.join('\n\n—\n\n').slice(0, 12000);
}

function intelPillarSummaryLine(pillars, corroboration) {
  if (!pillars.length) return 'Unclassified';
  const p = pillars.map((n) => `P${n}`).join('+');
  return corroboration === 'confirmed' ? `${p} · Multi-pillar` : `${p} · Single pillar (watch)`;
}

function applyCorroborationPriority(basePriority, corroboration) {
  if (corroboration === 'watch' && basePriority === 'high') return 'medium';
  return basePriority;
}

/**
 * Build a GapReport from stored signals and our state.
 * Coarse bucket: competitor + dimension + theme. Within a bucket, only merge signals that pass
 * headline/URL/entity/token similarity so unrelated items stay separate gaps.
 */
function buildGapReport(productId, periodStart, periodEnd) {
  const signals = getSignals(productId, periodStart, periodEnd);
  const ourState = getOurState(productId);
  const names = competitorNameMap();

  const byCluster = new Map();
  for (const s of signals) {
    const key = clusterKeyFromSignal(s);
    if (!byCluster.has(key)) byCluster.set(key, []);
    byCluster.get(key).push(s);
  }

  const gaps = [];
  let gapIndex = 1;
  for (const rawMembers of byCluster.values()) {
    const subclusters = splitByMergeSimilarity(rawMembers);
    for (const members of subclusters) {
      const rep = pickRepresentativeSignal(members);
      const { dimension, ourKey } = inferDimension(rep);
      const ourVal = ourState[ourKey];
      const hasGap = ourVal === undefined || ourVal === null || ourVal === '' || (Array.isArray(ourVal) && ourVal.length === 0);
      if (!hasGap && typeof ourVal === 'string' && ourVal.toLowerCase().includes('no ') && ourVal.length < 200) {
        // e.g. "No live chat" -> gap
      }

      const pillarsDistinct = distinctIntelPillars(members);
      const repInferred = intelPillarFromSourceType(rep.source, rep.type);
      const intel_pillars =
        pillarsDistinct.length > 0
          ? pillarsDistinct
          : repInferred.pillar != null
            ? [repInferred.pillar]
            : [];
      const corroboration = pillarsDistinct.length >= 2 ? 'confirmed' : 'watch';
      const corroboration_sources = corroborationSourcesFromMembers(members);
      const basePriority = priorityFromDimension(dimension);
      const priority = applyCorroborationPriority(basePriority, corroboration);

      let competitor_move = buildConciseCompetitorMove(rep, names);
      if (corroboration === 'confirmed') {
        competitor_move = clip(`${competitor_move} · Multi-pillar`, MAX_ACTION_LEN + 18);
      } else if (members.length > 1) {
        competitor_move = clip(`${competitor_move} · Watch (same pillar)`, MAX_ACTION_LEN + 22);
      }

      const detailBody = mergeClusterDetailBodies(members);
      const our_gap = normalizeOurStateStatus(ourVal);
      const primarySrc = corroboration_sources[0];
      const source = primarySrc && primarySrc.source ? primarySrc.source : null;
      const sourceUrl = primarySrc && primarySrc.source_url ? primarySrc.source_url : null;
      const headline =
        members.length === 1 && rep.headline && String(rep.headline).trim()
          ? String(rep.headline).trim()
          : members.length > 1
            ? `${members.length} signals merged`
            : null;

      const repMd = rep.metadata && typeof rep.metadata === 'object' ? rep.metadata : {};
      const intel_pillar =
        intel_pillars.length > 0
          ? intel_pillars[0]
          : typeof repMd.intel_pillar === 'number'
            ? repMd.intel_pillar
            : null;
      const intel_pillar_key = repMd.intel_pillar_key || repInferred.pillar_key || null;
      const intel_pillar_label = intelPillarSummaryLine(intel_pillars, corroboration);

      const source_summary =
        corroboration_sources.length > 1
          ? clip(
              corroboration_sources
                .map((x) => x.label)
                .filter(Boolean)
                .slice(0, 4)
                .join(', ') + (corroboration_sources.length > 4 ? '…' : ''),
              120
            )
          : primarySrc
            ? primarySrc.label
            : null;

      const interpretation = buildGapInterpretation({
        factual_competitor_move: competitor_move,
        dimension,
        priority,
        corroboration,
        intel_pillars,
        cluster_signal_count: members.length,
        metric_excerpt: metricOrFactExcerpt(rep),
        entities:
          rep.entities && typeof rep.entities === 'object' && !Array.isArray(rep.entities)
            ? { ...rep.entities }
            : {},
        source_labels: corroboration_sources.map((s) => s.label).filter(Boolean),
      });

      const gapId = `gap-${String(gapIndex).padStart(3, '0')}`;
      gapIndex++;
      gaps.push({
        gap_id: gapId,
        product_id: productId,
        dimension,
        our_key: ourKey,
        title: interpretation.headline.slice(0, 80),
        description: ourVal
          ? `Competitor: ${(rep.snippet || '').slice(0, 120)}. Our state: ${ourVal}`
          : `Competitor signal: ${rep.snippet || ''}`,
        competitor_signal: detailBody,
        competitor_move,
        interpretation,
        our_gap,
        source: source || null,
        source_url: sourceUrl,
        headline: headline || null,
        intel_pillar,
        intel_pillar_key: intel_pillar_key || null,
        intel_pillar_label: intel_pillar_label,
        intel_pillars,
        corroboration,
        cluster_signal_count: members.length,
        corroboration_sources,
        source_summary,
        priority,
        detected_at: members.map((m) => m.date).sort().slice(-1)[0] || rep.date,
      });
    }
  }
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
  gaps.forEach((g, i) => {
    g.gap_id = `gap-${String(i + 1).padStart(3, '0')}`;
  });

  const reportId = `report-${productId}-${periodStart}-${periodEnd}`;
  const generatedAt = new Date().toISOString();
  return {
    report_id: reportId,
    product_id: productId,
    period_start: periodStart,
    period_end: periodEnd,
    gaps,
    generated_at: generatedAt,
    summary: {
      by_priority: gaps.reduce((acc, g) => {
        acc[g.priority] = (acc[g.priority] || 0) + 1;
        return acc;
      }, {}),
      by_dimension: gaps.reduce((acc, g) => {
        acc[g.dimension] = (acc[g.dimension] || 0) + 1;
        return acc;
      }, {}),
      by_intel_pillar: gaps.reduce((acc, g) => {
        const list = Array.isArray(g.intel_pillars) && g.intel_pillars.length ? g.intel_pillars : [];
        if (list.length) {
          for (const p of list) acc[String(p)] = (acc[String(p)] || 0) + 1;
        } else {
          acc.unclassified = (acc.unclassified || 0) + 1;
        }
        return acc;
      }, {}),
      by_corroboration: gaps.reduce((acc, g) => {
        const k = g.corroboration || 'watch';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

module.exports = {
  buildGapReport,
  DIMENSIONS,
  metricOrFactExcerpt,
  clusterKeyFromSignal,
  distinctIntelPillars,
  pickRepresentativeSignal,
  splitByMergeSimilarity,
  signalsSimilarForMerge,
};
