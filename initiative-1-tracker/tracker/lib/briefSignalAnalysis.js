/**
 * Manager-facing signal analysis — brief narrative from collect evidence + routing tail.
 */

function cleanText(text, max = 280) {
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

function competitorShort(signal) {
  if (signal.competitor) return signal.competitor;
  const id = signal.competitor_id || '';
  if (!id) return 'The competitor';
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function pageContext(signal) {
  const url = String(signal.source_url || '');
  const pk = String(signal.metadata?.page_kind || '').replace(/_/g, ' ').trim();

  if (/\/pricing/i.test(url) || pk === 'pricing') return 'pricing page';
  if (pk === 'articles index' || /\/articles|\/blog|\/insights|\/newsroom/i.test(url)) {
    return 'articles/blog index';
  }
  if (pk === 'careers' || /careers|\/jobs/i.test(url)) return 'careers page';
  if (pk === 'case studies') return 'case studies page';
  if (pk === 'features' || /\/features/i.test(url)) return 'features page';
  if (pk) return pk;
  const src = String(signal.source || '').replace(/_/g, ' ').trim();
  if (src === 'pricing page') return 'pricing page';
  if (src) return src;
  return 'site';
}

/** Drop lone small dollar amounts — common homepage scrape noise (e.g. "$4" from footer). */
function meaningfulPrices(prices) {
  return (prices || []).filter((p) => {
    const s = String(p);
    if (/\/mo|per unit|per door|starting at/i.test(s)) return true;
    const n = parseFloat(s.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(n)) return false;
    return n >= 15;
  });
}

/**
 * Full-sentence conversion claim — stats embedded with subject and comparison.
 * @param {string} who competitor display name
 */
function conversionClaimSentence(who, text) {
  const src = String(text || '');
  const m = src.match(
    /(\d{1,2})%\s*(?:tour\s*)?conversion\s+for\s+AI-handled\s+prospects,?\s*compared\s+to\s+(\d{1,2})%\s*(?:tour\s*)?conversion\s+for\s+non-AI/i,
  );
  if (m) {
    return `${who} claims AI-handled prospects convert to tours at ${m[1]}%, compared to ${m[2]}% when staff handle tours without AI (their marketing claim).`;
  }
  const partial = src.match(/(\d{1,2})%\s*tour\s*conversion\s+for\s+non-AI/i);
  if (partial) {
    return `${who} cites ${partial[1]}% tour conversion for prospects staff handle without AI (no paired AI rate found on the page).`;
  }
  return null;
}

function openChange(page) {
  return `We found a change on the ${page}.`;
}

function extractPricingFact(signal) {
  const who = competitorShort(signal);
  const page = pageContext(signal);
  const snippet = signal.evidence_snippet || signal.snippet || '';
  const tiers = (signal.entities?.tiers || []).join(' ');
  const prices = meaningfulPrices(signal.entities?.prices);
  const hadScrapePrices = (signal.entities?.prices || []).length > 0;

  const conv =
    conversionClaimSentence(who, tiers) || conversionClaimSentence(who, snippet);

  if (prices.length === 1) {
    return `${openChange(page)} ${who} updated published pricing to ${prices[0]}.`;
  }
  if (prices.length > 1) {
    return `${openChange(page)} ${who} updated published pricing (${prices.join(', ')}).`;
  }

  if (conv) {
    const suffix = hadScrapePrices
      ? ' No clear public rate card on the page.'
      : '';
    return `${openChange(page)} ${conv}${suffix}`;
  }

  const body = firstChunk(snippet, 140);
  if (body && !/^detected pricing values/i.test(body)) {
    return `${openChange(page)} ${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
  }

  return `${openChange(page)} ${who} updated packaging or marketing language (no public price tiers parsed).`;
}

function extractArticleFact(signal) {
  const page = pageContext(signal);
  const titles = signal.entities?.article_titles || [];
  if (titles.length === 1) {
    return `${openChange(page)} New article: "${cleanText(titles[0], 90)}".`;
  }
  if (titles.length > 1) {
    const lead = titles
      .slice(0, 2)
      .map((t) => `"${cleanText(t, 70)}"`)
      .join(' and ');
    const more = titles.length > 2 ? ` (${titles.length} total on the index)` : '';
    return `${openChange(page)} New articles including ${lead}${more}.`;
  }
  const sn = firstChunk(signal.snippet || signal.evidence_snippet || signal.headline, 140);
  return `${openChange(page)} ${sn || 'Editorial content updated'}.`;
}

function extractTalentFact(signal) {
  const page = pageContext(signal);
  const who = competitorShort(signal);
  const groups = (signal.entities?.role_groups || []).filter(Boolean);
  if (groups.length) {
    return `${openChange(page)} ${who} is hiring for ${groups.join(', ')}.`;
  }
  if (signal.headline && /career|job|hiring|join/i.test(signal.headline)) {
    return `${openChange(page)} ${cleanText(signal.headline, 120)}.`;
  }
  const roles = (signal.entities?.roles || [])
    .map((r) => cleanText(r, 100))
    .filter((r) => r.length >= 12);
  if (roles[0]) {
    return `${openChange(page)} Open role spotlight: ${roles[0]}.`;
  }
  return `${openChange(page)} ${firstChunk(signal.snippet, 120) || 'Hiring page updated'}.`;
}

function extractNewsFact(signal) {
  const headline = cleanText(signal.headline || signal.evidence_snippet || signal.snippet, 160);
  if (headline) {
    return `We found a press or news item: ${headline}.`;
  }
  return 'We found a press or news item on their site.';
}

function extractPmmFact(signal, detail) {
  const page = pageContext(signal);
  const src = String(signal.source || '').toLowerCase();
  const pk = String(signal.metadata?.page_kind || '').toLowerCase();

  if (pk === 'articles_index' || src === 'articles_index' || signal.type === 'article') {
    return extractArticleFact(signal);
  }

  if (detail === 'channel-building' || /review|capterra|featuredcustomers/i.test(signal.source_url || '')) {
    const sn = firstChunk(signal.snippet || signal.headline, 140);
    return `${openChange('review listing')}${sn ? ` ${sn}.` : ' Third-party review or rating page updated.'}`;
  }

  if (detail === 'social-proof' || pk === 'case_studies') {
    const sn = firstChunk(signal.evidence_snippet || signal.snippet || signal.headline, 140);
    return `${openChange(page)}${sn ? ` ${sn}.` : ' New case study or customer proof content.'}`;
  }

  if (detail === 'editorial-cadence') {
    const sn = firstChunk(signal.evidence_snippet || signal.snippet || signal.headline, 140);
    return `${openChange(page)}${sn ? ` ${sn}.` : ' New thought-leadership or blog content.'}`;
  }

  const sn = firstChunk(signal.evidence_snippet || signal.snippet || signal.headline, 150);
  return `${openChange(page)}${sn ? ` ${sn}.` : ' Marketing or site page updated.'}`;
}

function extractProductFact(signal) {
  const page = pageContext(signal);
  const who = competitorShort(signal);
  const body = firstChunk(signal.evidence_snippet || signal.snippet, 160);

  if (body) {
    return `${openChange(page)} ${who} updated their product messaging: ${body}.`;
  }
  return `${openChange(page)} ${who} published a product-shaped capability update.`;
}

function routingTail(meta) {
  const cls = meta.classification;
  const routing = String(meta.routing || '').toLowerCase();
  const parity = String(meta.parity || '').toLowerCase();

  if (cls === 'Pricing') {
    return "Won't chase — competitor pricing/marketing packaging; monitor positioning only (no Core parity or prototype).";
  }
  if (cls === 'Talent') {
    return "Won't chase — hiring/capacity signal, not a product capability gap.";
  }
  if (cls === 'News') {
    return "Won't chase — press/narrative; monitor only.";
  }
  if (cls === 'Product' && parity === 'existing') {
    return "Won't chase — Core already ships this; no prototype.";
  }
  if (cls === 'Product' && (parity === 'partial' || parity === 'gap')) {
    return 'Tier — Now candidate — parity gap vs Core; prototype warranted.';
  }
  if (cls === 'Product') {
    return 'Needs Core parity scan — prototype if Gap/Partial, skip if Existing.';
  }
  if (cls === 'PMM' || routing.includes("won't chase")) {
    return "Won't chase — PMM/positioning; no engineering PRD unless you promote manually.";
  }
  return "Won't chase — logged for awareness.";
}

/**
 * @param {object} signal raw collect row
 * @param {{ classification: string, classification_detail?: string, routing?: string, parity?: string }} meta
 */
function buildSignalAnalysis(signal, meta) {
  const detail = meta.classification_detail || '';

  let fact;
  switch (meta.classification) {
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

  return `${cleanText(fact, 260)} → ${routingTail(meta)}`;
}

/** Only prefix when the reader needs timing context catch-up does not provide. */
function applyContextPrefix(analysis, signal) {
  if (signal._weekend) return `[Weekend collect — Monday brief] ${analysis}`;
  if (signal._carryover) return `[Carryover spotlight] ${analysis}`;
  if (signal._content_refresh) return `[Page content changed since last brief] ${analysis}`;
  return analysis;
}

module.exports = {
  buildSignalAnalysis,
  applyContextPrefix,
  cleanText,
  conversionClaimSentence,
  meaningfulPrices,
};
