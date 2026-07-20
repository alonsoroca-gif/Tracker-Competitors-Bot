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
  if (pk === 'changelog' || /anyonehome-updates|\/changelog|\/releases?\//i.test(url)) {
    return 'changelog';
  }
  if (pk) return pk;
  const src = String(signal.source || '').replace(/_/g, ' ').trim();
  if (src === 'pricing page') return 'pricing page';
  if (src === 'changelog') return 'changelog';
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

/**
 * Product description for prototype decisions — lead with what they shipped,
 * not scrape meta. Uses the full capability blurb (not first-sentence chop).
 */
function extractProductFact(signal) {
  const page = pageContext(signal);
  const who = competitorShort(signal);
  const capability =
    cleanText(signal.metadata?.capability_heading || '', 100) ||
    cleanText(String(signal.headline || '').split('—').slice(1).join('—').trim(), 100);
  const area = cleanText(signal.metadata?.capability_area || '', 40);
  const productDesc = cleanText(signal.snippet || signal.evidence_snippet || '', 240);

  if (page === 'changelog' && capability) {
    const areaUseful =
      area &&
      area.length >= 4 &&
      !capability.toLowerCase().includes(area.toLowerCase()) &&
      !area.toLowerCase().includes(capability.toLowerCase().slice(0, 12));
    const where = areaUseful ? `${area} → ${capability}` : capability;
    if (productDesc) {
      return `${who} shipped "${where}": ${productDesc}`;
    }
    return `${who} shipped "${where}" on their changelog.`;
  }

  if (capability && productDesc) {
    return `${who} shipped "${capability}": ${productDesc}`;
  }
  if (productDesc) {
    return `${who} shipped a product update: ${productDesc}`;
  }
  return `${who} published a product-shaped capability update on their ${page}.`;
}

/**
 * Plain-English Core reason for Existing / Partial / Gap.
 * Never emit bare "N matches across files" as the only explanation.
 */
function parityExplanation(meta) {
  const parity = String(meta.parity || '').toLowerCase();
  const plain = cleanText(meta.parity_plain || meta.core_summary || '', 180);
  const anchor = cleanText(meta.parity_anchor || meta.top_file || '', 120);

  if (parity === 'existing') {
    if (plain && anchor) {
      return `Won't chase — already shipped in Core (${plain}; e.g. ${anchor}).`;
    }
    if (plain) {
      return `Won't chase — already shipped in Core (${plain}).`;
    }
    if (anchor) {
      return `Won't chase — already shipped in Core (parity Existing; e.g. ${anchor}).`;
    }
    return "Won't chase — already shipped in Core; no prototype.";
  }
  if (parity === 'partial') {
    if (plain) {
      return `Tier — Now candidate — Core has a partial foundation (${plain}); delta still needed.`;
    }
    return 'Tier — Now candidate — Core has a partial foundation; delta still needed.';
  }
  if (parity === 'gap') {
    if (plain) {
      return `Tier — Now candidate — no matching Core capability found (${plain}).`;
    }
    return 'Tier — Now candidate — no matching Core capability found; prototype warranted.';
  }
  return '';
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
  if (cls === 'Product' && (parity === 'existing' || parity === 'partial' || parity === 'gap')) {
    return parityExplanation(meta) || 'Needs Core parity scan — prototype if Gap/Partial, skip if Existing.';
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

  // Product rows lead with what the competitor shipped (prototype context).
  // PMM/Pricing/etc. keep the "We found…" opener. Parity may refine the
  // routing tail, but must never replace the fact with match-count jargon.
  const factBudget = meta.classification === 'Product' ? 360 : 280;
  return `${cleanText(fact, factBudget)} → ${routingTail(meta)}`;
}

const NOISE_MATCH_TERMS = new Set([
  'team',
  'help',
  'keep',
  'release',
  'july',
  'june',
  'may',
  'anyone',
  'enhancements',
  'update',
  'updates',
  'new',
]);

function capabilityLabel(row, signal) {
  return (
    cleanText(signal?.metadata?.capability_heading || row.capability_heading || '', 80) ||
    cleanText(String(row.headline || signal?.headline || '').split('—').slice(1).join('—').trim(), 80) ||
    cleanText(row.headline || signal?.headline || '', 80)
  );
}

function pickParityAnchor(parity = {}, capability = '') {
  if (parity.top_file || parity.anchor) {
    return String(parity.top_file || parity.anchor);
  }
  const files = Array.isArray(parity.top_files) ? parity.top_files : [];
  if (!files.length) return '';

  const caps = String(capability || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !NOISE_MATCH_TERMS.has(t));

  let best = null;
  let bestScore = 0;
  for (const f of files) {
    const rel = String(f.relativePath || '');
    if (/node_modules|OldNodeModules|vendor\/|dist\/|\.min\.js$/i.test(rel)) continue;

    const terms = (f.matched_terms || []).map((t) => String(t).toLowerCase());
    const meaningful = terms.filter((t) => !NOISE_MATCH_TERMS.has(t) && t.length >= 3);
    let score = meaningful.length * 8;
    let capabilityHit = false;
    for (const c of caps) {
      if (terms.some((t) => t.includes(c) || c.includes(t))) {
        score += 25;
        capabilityHit = true;
      }
      if (rel.toLowerCase().includes(c)) {
        score += 15;
        capabilityHit = true;
      }
    }
    if (
      /consent|sms|opt.?in|guest|pricing|siteplan|tour|lease|outage|maintenance|work.?order|service.?request|reminder/i.test(
        rel,
      )
    ) {
      score += 10;
      capabilityHit = true;
    }
    // Penalize weak keyword collisions on unrelated domains
    if (
      caps.some((c) => /outage|maintenance|service/.test(c)) &&
      /voip|phone.?number|invoice|employee|hr\/|competitor/i.test(rel)
    ) {
      score -= 40;
    }
    if (
      caps.some((c) => /sms|opt.?in|consent|tour|reminder/.test(c)) &&
      /employee|hr\/|invoice|fee.?guide|monitor|gateway/i.test(rel)
    ) {
      score -= 40;
    }
    if (!capabilityHit && meaningful.length === 0) score = 0;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  // Omit junk anchors — plain-English capability name is enough without a misleading path
  if (!best || bestScore < 20) return '';
  return String(best.relativePath || '');
}

function plainFromParity(row, signal, parity = {}) {
  const explicit = parity.plain || stripMatchCountJargon(parity.reason || parity.verdict_reason || '');
  if (explicit) return explicit;

  const capability = capabilityLabel(row, signal);
  if (!capability) return '';

  const verdict = String(parity.verdict || parity.parity || row.parity || '').toLowerCase();
  if (verdict === 'existing') {
    return `same class of capability as "${capability}"`;
  }
  if (verdict === 'partial') {
    return `related foundation for "${capability}"`;
  }
  if (verdict === 'gap') {
    return `no clear Core match for "${capability}"`;
  }
  return '';
}

/**
 * Merge Layer-1/2 parity into an existing table row without destroying the fact.
 * @param {object} row signals-table row
 * @param {object} signal raw collect signal (for fact rebuild)
 * @param {object} parity parity-results row or { verdict, reason, top_files, plain }
 */
function applyParityToRowAnalysis(row, signal, parity = {}) {
  const verdict = String(parity.verdict || parity.parity || row.parity || '').trim();
  const sig = signal || rowAsSignal(row);
  const capability = capabilityLabel(row, sig);
  const meta = {
    classification: row.classification || 'Product',
    classification_detail: row.classification_detail || 'capability',
    routing: verdict.toLowerCase() === 'existing' ? "Won't chase" : row.routing,
    parity: verdict,
    parity_plain: plainFromParity(row, sig, parity),
    parity_anchor: pickParityAnchor(parity, capability),
  };
  const analysis = buildSignalAnalysis(sig, meta);
  return {
    ...row,
    parity: verdict || row.parity,
    parity_l2: verdict || row.parity_l2,
    routing: meta.routing,
    tier: verdict.toLowerCase() === 'existing' ? "Won't chase" : row.tier,
    why_routing: analysis,
    signal_summary: analysis,
    routing_reason: routingTail(meta),
  };
}

function stripMatchCountJargon(reason) {
  const s = String(reason || '');
  if (/matches across \d+ files/i.test(s)) {
    return '';
  }
  return cleanText(s.replace(/\s*—\s*likely already shipped\.?/i, ''), 180);
}

function rowAsSignal(row) {
  return {
    competitor: row.competitor,
    competitor_id: row.competitor_id,
    source_url: row.source_url,
    source: row.source_url && /anyonehome-updates|changelog/i.test(row.source_url) ? 'changelog' : '',
    headline: row.headline,
    snippet: row.snippet,
    evidence_snippet: row.snippet,
    metadata: {
      page_kind: row.source_url && /anyonehome-updates|changelog/i.test(row.source_url) ? 'changelog' : '',
      capability_heading: row.capability_heading,
      capability_area: row.capability_area,
      capability_key: row.capability_key,
    },
  };
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
  applyParityToRowAnalysis,
  applyContextPrefix,
  cleanText,
  conversionClaimSentence,
  meaningfulPrices,
  extractProductFact,
  parityExplanation,
};
