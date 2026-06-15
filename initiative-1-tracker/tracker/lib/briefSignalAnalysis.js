/**
 * Manager-facing one-line signal analysis — grounded in collect data
 * (snippet, evidence_snippet, entities), not generic routing templates.
 */

function cleanText(text, max = 240) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\|\s*/g, '; ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

function firstChunk(text, max = 160) {
  const t = cleanText(text, max * 2);
  if (!t) return '';
  const parts = t.split(/;|\./).map((p) => p.trim()).filter(Boolean);
  return cleanText(parts[0] || t, max);
}

function joinParts(parts, max = 220) {
  return cleanText(parts.filter(Boolean).join(' — '), max);
}

function extractPricingFact(signal) {
  const snippet = signal.evidence_snippet || signal.snippet || '';
  const prices = (signal.entities?.prices || []).filter(Boolean).slice(0, 3);
  const tiers = (signal.entities?.tiers || []).filter(Boolean);
  const keywords = (signal.entities?.keywords || []).slice(0, 6);

  const parts = ['Pricing/packaging page update'];
  if (prices.length) parts.push(`values spotted: ${prices.join(', ')}`);

  const conv = snippet.match(/(\d+%[^;|.]{0,50}(?:conversion|prospect|tour)[^;|.]{0,60})/gi);
  if (conv?.length) parts.push(cleanText(conv[0], 100));
  else if (tiers[0]) parts.push(cleanText(tiers[0], 100));
  else if (keywords.length) parts.push(`themes: ${keywords.join(', ')}`);
  else parts.push(firstChunk(snippet, 120));

  return joinParts(parts);
}

function extractArticleFact(signal) {
  const titles = signal.entities?.article_titles || [];
  if (titles.length) {
    const lead = titles.slice(0, 2).map((t) => `"${cleanText(t, 70)}"`).join(', ');
    const more = titles.length > 2 ? ` (+${titles.length - 2} more on index)` : '';
    return joinParts([`${titles.length} article(s) on index`, `latest: ${lead}${more}`]);
  }
  const sn = signal.snippet || signal.evidence_snippet || signal.headline;
  return joinParts(['Editorial/articles index update', firstChunk(sn, 140)]);
}

function extractTalentFact(signal) {
  const groups = (signal.entities?.role_groups || []).filter(Boolean);
  const roles = (signal.entities?.roles || [])
    .map((r) => cleanText(r, 120))
    .filter((r) => r.length >= 12 && r.length <= 100);
  const parts = ['Careers/hiring signal'];
  if (groups.length) parts.push(`focus: ${groups.join(', ')}`);
  if (signal.headline && /career|job|hiring|join/i.test(signal.headline)) {
    parts.push(cleanText(signal.headline, 90));
  } else if (roles[0]) parts.push(roles[0]);
  else parts.push(cleanText(signal.snippet, 100));
  return joinParts(parts);
}

function extractNewsFact(signal) {
  const parts = ['Press/news item'];
  parts.push(firstChunk(signal.evidence_snippet || signal.snippet || signal.headline, 160));
  return joinParts(parts);
}

function extractPmmFact(signal, detail) {
  const src = String(signal.source || '').toLowerCase();
  const pk = String(signal.metadata?.page_kind || '').toLowerCase();

  if (pk === 'articles_index' || src === 'articles_index' || signal.type === 'article') {
    return extractArticleFact(signal);
  }

  if (detail === 'channel-building' || /g2|review|capterra/i.test(signal.source_url || '')) {
    return joinParts([
      'Third-party review or social-proof listing',
      firstChunk(signal.snippet || signal.headline, 140),
    ]);
  }

  if (detail === 'social-proof' || pk === 'case_studies') {
    return joinParts([
      'Case study or customer proof content',
      firstChunk(signal.evidence_snippet || signal.snippet || signal.headline, 140),
    ]);
  }

  if (detail === 'editorial-cadence') {
    return joinParts([
      'Thought-leadership or blog content',
      firstChunk(signal.evidence_snippet || signal.snippet || signal.headline, 140),
    ]);
  }

  return joinParts([
    'Marketing/site page update',
    firstChunk(signal.evidence_snippet || signal.snippet || signal.headline, 150),
  ]);
}

function extractProductFact(signal) {
  const et = String(signal.event_type || '').replace(/_/g, ' ').trim();
  const pk = signal.metadata?.page_kind ? String(signal.metadata.page_kind).replace(/_/g, ' ') : '';
  const body = firstChunk(signal.evidence_snippet || signal.snippet, 160);
  const parts = [];
  if (et && et !== 'pricing change') parts.push(`Product signal (${et})`);
  else if (pk) parts.push(`Product-shaped ${pk} page`);
  else parts.push('Product-shaped capability signal');
  if (body) parts.push(body);
  else parts.push(cleanText(signal.headline, 100));
  return joinParts(parts);
}

const ROUTING_TAIL = {
  PMM: 'PMM/positioning — no engineering PRD unless promoted manually.',
  News: 'Monitor narrative; no product build implied.',
  Talent: 'Talent/capacity signal — not a feature gap.',
  Pricing: 'Compare to Core fee/all-in disclosure before chasing packaging.',
  Product: 'Needs Core parity scan — prototype if Gap/Partial, skip if Existing.',
};

/**
 * @param {object} signal raw collect row
 * @param {{ classification: string, classification_detail?: string }} meta from classifySignal
 * @returns {string} manager-readable one-liner
 */
function buildSignalAnalysis(signal, meta) {
  const cls = meta.classification;
  const detail = meta.classification_detail || '';

  let fact;
  switch (cls) {
    case 'Pricing':
      fact = extractPricingFact(signal);
      break;
    case 'Talent':
      fact = extractTalentFact(signal);
      break;
    case 'News':
      fact = extractNewsFact(signal);
      break;
    case 'Product':
      fact = extractProductFact(signal);
      break;
    case 'PMM':
    default:
      fact = extractPmmFact(signal, detail);
      break;
  }

  const tail = ROUTING_TAIL[cls] || ROUTING_TAIL.PMM;
  return `${fact} → ${tail}`;
}

function applyContextPrefix(analysis, signal) {
  if (signal._weekend) return `[Weekend collect — Monday brief] ${analysis}`;
  if (signal._catchup) return `[Catch-up since last brief] ${analysis}`;
  if (signal._carryover) return `[Carryover spotlight] ${analysis}`;
  if (signal._content_refresh) return `[Content refresh] ${analysis}`;
  return analysis;
}

module.exports = {
  buildSignalAnalysis,
  applyContextPrefix,
  cleanText,
};
