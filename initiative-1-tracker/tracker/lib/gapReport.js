const { getSignals } = require('./storage');
const { getOurState } = require('./ourState');
const { loadConfig } = require('./loadConfig');

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
    docs: 'Documentation',
  };
  if (labels[src]) return labels[src];
  if (signal.source) return String(signal.source).replace(/_/g, ' ');
  return 'Web';
}

const MAX_ACTION_LEN = 260;

function clip(str, max) {
  const t = String(str || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Join first N strings, each capped (for table row readability). */
function joinEntityList(items, { maxItems = 4, maxEach = 52, sep = ' · ' } = {}) {
  if (!Array.isArray(items) || !items.length) return '';
  return items
    .filter(Boolean)
    .slice(0, maxItems)
    .map((x) => clip(x, maxEach))
    .join(sep);
}

function entitiesObject(s) {
  return s.entities && typeof s.entities === 'object' && !Array.isArray(s.entities) ? s.entities : {};
}

/**
 * Collect often writes analytical one-liners ("Detected pricing values: …"). Use when present.
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

/** Concrete middle segment: specs from collect entities + snippets; fallback to generic labels. */
function specificActionPhrase(s) {
  const ent = entitiesObject(s);
  const type = String(s.type || '').toLowerCase();
  const src = String(s.source || '').toLowerCase();
  const et = String(s.event_type || '').trim();

  // Pricing: dollar amounts, plan names, packaging keywords (from collect extractPricingSignals)
  if (type === 'pricing' || src === 'pricing_page' || et.startsWith('pricing')) {
    const prices = Array.isArray(ent.prices) ? ent.prices.filter(Boolean) : [];
    const tiers = Array.isArray(ent.tiers) ? ent.tiers.filter(Boolean) : [];
    const kws = Array.isArray(ent.keywords) ? ent.keywords.filter(Boolean) : [];
    const parts = [];
    if (prices.length) parts.push(`Prices: ${prices.slice(0, 6).join(', ')}`);
    if (tiers.length) parts.push(`Plans/tiers: ${joinEntityList(tiers, { maxItems: 5, maxEach: 48 })}`);
    if (kws.length) parts.push(`Packaging: ${kws.slice(0, 10).join(', ')}`);
    if (parts.length) return clip(parts.join(' · '), MAX_ACTION_LEN);
  }

  // Features: named themes from headings/bullets + optional positioning keywords
  if (type === 'features' || src === 'features_page') {
    const feats = Array.isArray(ent.features) ? ent.features.filter(Boolean) : [];
    const pos = Array.isArray(ent.positioning_keywords) ? ent.positioning_keywords.filter(Boolean) : [];
    const kws = Array.isArray(ent.keywords) ? ent.keywords.filter(Boolean) : [];
    if (feats.length) {
      let line = `Capabilities: ${joinEntityList(feats, { maxItems: 4, maxEach: 56 })}`;
      if (pos.length) line = clip(`${line} · Positioning: ${pos.slice(0, 5).join(', ')}`, MAX_ACTION_LEN);
      else line = clip(line, MAX_ACTION_LEN);
      return line;
    }
    if (kws.length) return clip(`Product themes: ${kws.slice(0, 12).join(', ')}`, MAX_ACTION_LEN);
  }

  // Careers: role lines + hiring focus groups
  if (type === 'job' || src === 'careers') {
    const roles = Array.isArray(ent.roles) ? ent.roles.filter(Boolean) : [];
    const groups = Array.isArray(ent.role_groups) ? ent.role_groups.filter(Boolean) : [];
    if (roles.length) {
      let line = `Hiring: ${joinEntityList(roles, { maxItems: 5, maxEach: 50 })}`;
      if (groups.length) line = clip(`${line} · Focus: ${groups.join(', ')}`, MAX_ACTION_LEN);
      else line = clip(line, MAX_ACTION_LEN);
      return line;
    }
  }

  // Feeds: integrations / AI terms when extractNamedEntities filled them
  const integ = Array.isArray(ent.integrations) ? ent.integrations.filter(Boolean) : [];
  const aiTerms = Array.isArray(ent.ai_terms) ? ent.ai_terms.filter(Boolean) : [];
  if (integ.length || aiTerms.length) {
    const parts = [];
    if (integ.length) parts.push(`Mentions: ${integ.slice(0, 6).join(', ')}`);
    if (aiTerms.length) parts.push(aiTerms.slice(0, 4).join(', '));
    return clip(parts.join(' · '), MAX_ACTION_LEN);
  }

  const fromSnippet = actionFromAnalyticalSnippet(s);
  if (fromSnippet) return fromSnippet;

  // Generic fallback (legacy signals with no entities)
  if (et && EVENT_TYPE_ACTION[et]) return EVENT_TYPE_ACTION[et];
  if (TYPE_ACTION_FALLBACK[type]) return TYPE_ACTION_FALLBACK[type];
  const hl = s.headline && String(s.headline).trim();
  if (hl && hl !== '(no title)' && hl.length <= 90) return `Noted: ${hl}`;
  if (hl && hl.length > 90) return `Noted: ${hl.slice(0, 87)}…`;
  const sn = cleanSnippet(s.snippet || '');
  if (sn && sn.length >= 20 && sn.length <= 100) return sn;
  return `Activity on ${sourceHumanLabel(s)}`;
}

/**
 * One concise line: Competitor · interpreted action · source.
 * Full text stays on the signal for the Details row (competitor_signal).
 */
function buildConciseCompetitorMove(s, nameMap) {
  const who = competitorDisplayName(s, nameMap);
  const action = specificActionPhrase(s);
  const where = sourceHumanLabel(s);
  return `${who} · ${action} · ${where}`;
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
  if (t === 'changelog' || t === 'features') return { dimension: 'features', ourKey: 'features' };
  if (t === 'blog') return { dimension: 'features', ourKey: 'features' };
  return { dimension: 'features', ourKey: 'features' };
}

function priorityFromDimension(dimension) {
  if (dimension === 'support' || dimension === 'features') return 'high';
  if (dimension === 'messaging' || dimension === 'pricing') return 'medium';
  return 'low';
}

/**
 * Build a GapReport from stored signals and our state. Simple rules: each signal can produce a gap if our state lacks it.
 */
function buildGapReport(productId, periodStart, periodEnd) {
  const signals = getSignals(productId, periodStart, periodEnd);
  const ourState = getOurState(productId);
  const names = competitorNameMap();
  const gaps = [];
  let gapIndex = 1;
  for (const s of signals) {
    const { dimension, ourKey } = inferDimension(s);
    const ourVal = ourState[ourKey];
    const hasGap = ourVal === undefined || ourVal === null || ourVal === '' || (Array.isArray(ourVal) && ourVal.length === 0);
    if (!hasGap && typeof ourVal === 'string' && ourVal.toLowerCase().includes('no ') && ourVal.length < 200) {
      // e.g. "No live chat" -> gap
    }
    const gapId = `gap-${String(gapIndex).padStart(3, '0')}`;
    gapIndex++;
    const competitor_move = buildConciseCompetitorMove(s, names);
    const detailBody = buildDetailBodyFromSignal(s);
    const our_gap = normalizeOurStateStatus(ourVal);
    const source = (s.source && s.source.trim()) ? s.source.trim() : null;
    const sourceUrl = (s.source_url && String(s.source_url).trim()) ? String(s.source_url).trim() : null;
    const headline = (s.headline && String(s.headline).trim()) ? String(s.headline).trim() : null;
    gaps.push({
      gap_id: gapId,
      product_id: productId,
      dimension,
      our_key: ourKey,
      title: competitor_move.slice(0, 80),
      description: ourVal ? `Competitor: ${(s.snippet || '').slice(0, 120)}. Our state: ${ourVal}` : `Competitor signal: ${s.snippet || ''}`,
      competitor_signal: detailBody,
      competitor_move,
      our_gap,
      our_key: ourKey,
      source: source || null,
      source_url: sourceUrl,
      headline: headline || null,
      priority: priorityFromDimension(dimension),
      detected_at: s.date,
    });
  }
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
  gaps.forEach((g, i) => { g.gap_id = `gap-${String(i + 1).padStart(3, '0')}`; });

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
      by_priority: gaps.reduce((acc, g) => { acc[g.priority] = (acc[g.priority] || 0) + 1; return acc; }, {}),
      by_dimension: gaps.reduce((acc, g) => { acc[g.dimension] = (acc[g.dimension] || 0) + 1; return acc; }, {}),
    },
  };
}

module.exports = { buildGapReport, DIMENSIONS };
