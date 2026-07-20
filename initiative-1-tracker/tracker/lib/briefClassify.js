/**
 * Deterministic signal → signals-table row classification for tracker-publish-intel.
 * Mirrors tracker-drop-cycle §4.2a heuristics (auto-suggest only — no AskQuestion).
 */

const { loadConfig } = require('./loadConfig');
const { buildSignalAnalysis, applyContextPrefix } = require('./briefSignalAnalysis.js');
const { contentFingerprint, signalKey } = require('./briefNetNew.js');

function isG2Signal(signal) {
  const type = String(signal?.type || '').toLowerCase();
  const src = String(signal?.source || '').toLowerCase();
  const url = String(signal?.source_url || '').toLowerCase();
  return type === 'review_g2' || src === 'g2_reviews' || /(^|\.)g2\.com/.test(url);
}

function competitorNameMap() {
  try {
    const config = loadConfig();
    const map = {};
    for (const c of config.competitors || []) {
      if (c && c.id) map[c.id] = c.name || c.id;
    }
    return map;
  } catch {
    return {};
  }
}

function displayName(signal, nameMap) {
  if (signal.competitor) return signal.competitor;
  const id = signal.competitor_id || '';
  if (nameMap[id]) return nameMap[id];
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function isAggregatorUrl(url) {
  return /featuredcustomers\.com|capterra\.com|getapp\.com|softwareadvice\.com/i.test(url);
}

function isProductSignal(signal) {
  const type = String(signal.type || '').toLowerCase();
  const src = String(signal.source || '').toLowerCase();
  const et = String(signal.event_type || '').toLowerCase();
  const sn = String(signal.snippet || '').toLowerCase();
  if (type === 'features' || src === 'features_page') return true;
  if (et === 'feature_launch' || et === 'feature_set_update' || et === 'integration_launch') return true;
  if (/\b(launch(?:es|ed|ing)?|introduc|new module|now you can|release notes)\b/i.test(sn)) return true;
  const imp = String(signal.importance || '').toLowerCase();
  if (imp === 'critical') return true;
  return false;
}

function classifySignal(signal) {
  const type = String(signal.type || '').toLowerCase();
  const src = String(signal.source || '').toLowerCase();
  const url = String(signal.source_url || '').toLowerCase();
  const sn = String(signal.snippet || '').toLowerCase();
  const pk = String(signal.metadata?.page_kind || '').toLowerCase();

  if (type.includes('review') || isAggregatorUrl(url)) {
    return {
      classification: 'PMM',
      classification_detail: 'channel-building',
      routing: "Won't chase",
      why_routing: 'Third-party social proof or review listing — PMM channel work, not an engineering PRD.',
      tier: "Won't chase",
    };
  }

  if (type === 'press' || type === 'news') {
    return {
      classification: 'News',
      classification_detail: 'press-release',
      routing: "Won't chase",
      why_routing: 'Press or news wire item — monitor for positioning; no product build implied.',
      tier: "Won't chase",
    };
  }

  if (type === 'job' || src === 'careers' || pk === 'careers' || /hiring|careers|open role/i.test(sn)) {
    return {
      classification: 'Talent',
      classification_detail: 'hiring',
      routing: "Won't chase",
      why_routing: 'Careers or hiring signal — talent move, not a product capability gap.',
      tier: "Won't chase",
    };
  }

  if (
    type === 'blog' ||
    type === 'insights' ||
    type === 'article' ||
    type === 'articles' ||
    type === 'podcast' ||
    src === 'articles_index' ||
    src === 'insights' ||
    src === 'podcast' ||
    pk === 'articles_index'
  ) {
    return {
      classification: 'PMM',
      classification_detail: 'editorial-cadence',
      routing: "Won't chase",
      why_routing: 'Editorial or thought-leadership content — positioning signal, not a product PRD.',
      tier: "Won't chase",
    };
  }

  if (type === 'case_study' || src === 'case_studies' || pk === 'case_studies' || /testimonial|customer story|client logo/i.test(sn)) {
    return {
      classification: 'PMM',
      classification_detail: 'social-proof',
      routing: "Won't chase",
      why_routing: 'Case study or testimonial content — channel-building, not platform engineering.',
      tier: "Won't chase",
    };
  }

  if (type === 'pricing' || src === 'pricing_page' || pk === 'pricing') {
    return {
      classification: 'Pricing',
      classification_detail: 'packaging',
      routing: "Won't chase",
      why_routing: 'Pricing or packaging page update — validate against Core fee disclosure before chasing.',
      tier: "Won't chase",
    };
  }

  if (type === 'media') {
    return {
      classification: 'News',
      classification_detail: 'media-coverage',
      routing: "Won't chase",
      why_routing: 'Third-party media mention — monitor; no direct engineering ask.',
      tier: "Won't chase",
    };
  }

  if (isProductSignal(signal)) {
    return {
      classification: 'Product',
      classification_detail: 'capability',
      routing: 'Later',
      why_routing:
        'Product-shaped signal — needs Core parity scan (run full tracker-publish or /trackerstart). Auto-classified only.',
      tier: 'Later',
      parity: 'not_scanned',
    };
  }

  return {
    classification: 'PMM',
    classification_detail: 'signal-only',
    routing: "Won't chase",
    why_routing: 'General competitor page update — logged for awareness; no Product classification fired.',
    tier: "Won't chase",
  };
}

/** One table row per unique source_url (+ capability_key when split). */
function dedupeSignalsByUrl(signals) {
  const byKey = new Map();
  for (const s of signals || []) {
    const key = signalKey(s);
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev || (s.importance || 0) > (prev.importance || 0)) byKey.set(key, s);
  }
  return [...byKey.values()];
}

/**
 * Build signals-table.json rows from raw drop signals.
 * @param {object[]} signals
 * @param {{ carryover?: boolean }} [opts]
 */
function buildSignalsTableRows(signals, opts = {}) {
  const nameMap = competitorNameMap();
  const deduped = dedupeSignalsByUrl(signals).filter((s) => !isG2Signal(s));
  deduped.sort((a, b) => (b.importance || 0) - (a.importance || 0));

  return deduped.map((s, idx) => {
    const c = classifySignal(s);
    const isProduct = c.classification === 'Product';
    const analysis = applyContextPrefix(buildSignalAnalysis(s, c), s);
    return {
      id: idx + 1,
      competitor_id: s.competitor_id || '',
      competitor: displayName(s, nameMap),
      headline: String(s.headline || s.snippet || 'Competitor update').trim().slice(0, 120),
      capability_key: s.metadata?.capability_key || null,
      capability_heading: s.metadata?.capability_heading || null,
      // Persist the scraped excerpt (whitespace-normalized, widened to 1000) so a
      // later "changed" classification can show the actual old→new body diff and
      // score its significance. content_hash is computed from this same text.
      snippet: String(s.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 1000),
      classification: c.classification,
      classification_detail: c.classification_detail,
      parity: isProduct ? c.parity || 'not_scanned' : '—',
      parity_l1: isProduct ? null : null,
      parity_l2: isProduct ? null : null,
      routing: c.routing,
      why_routing: analysis,
      // Plain-English verdict reason ("why we are / aren't chasing"), kept
      // separate from the dense L1/L2 analysis so the viewer can lead with it.
      routing_reason: c.why_routing,
      signal_summary: analysis,
      tier: c.tier,
      source_url: s.source_url || '',
      content_hash: contentFingerprint(s),
      prototype_path: null,
      prd_path: null,
    };
  });
}

module.exports = {
  classifySignal,
  buildSignalsTableRows,
  dedupeSignalsByUrl,
  isProductSignal,
  isG2Signal,
};
