/**
 * Strategic interpretation — core product output of the tracker.
 *
 * Scrapes answer "what did we see?" This module answers "how should we read it?" without an LLM:
 * headline + epistemic why + threat tag. Headlines prefer metrics and structured entities over
 * marketing shells. Tune copy in this file when strategy language changes.
 */

function clip(str, max) {
  const t = String(str || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

/** Simple, scannable headline: max length + at most two sentences. */
const MAX_HEADLINE_CHARS = 158;
const MAX_HEADLINE_SENTENCES = 2;

function limitSentences(text, maxSentences) {
  const t = String(text || '').trim();
  if (!t || maxSentences <= 0) return t;
  const parts = t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length <= maxSentences) return t;
  return parts.slice(0, maxSentences).join(' ');
}

function finalizeHeadline(line) {
  return clip(limitSentences(line, MAX_HEADLINE_SENTENCES), MAX_HEADLINE_CHARS);
}

/** Strip merge suffixes for cleaner headline action. */
function factualActionOnly(factual) {
  return String(factual || '')
    .replace(/\s*·\s*Multi-pillar\s*$/i, '')
    .replace(/\s*·\s*Watch\s*\(same pillar\)\s*$/i, '')
    .trim();
}

function parseCompetitorMoveLine(factual) {
  const t = factualActionOnly(factual);
  const idx = t.indexOf(':');
  if (idx > 0 && idx < 100) {
    return {
      who: t.slice(0, idx).trim() || 'Competitor',
      action: t.slice(idx + 1).trim() || t,
    };
  }
  return { who: 'Competitor', action: t };
}

function dimensionPlainEnglish(d) {
  const m = {
    features: 'product and capabilities',
    support: 'service and support experience',
    messaging: 'messaging and packaging',
    positioning: 'positioning and segment focus',
    pricing: 'pricing narrative',
  };
  return m[d] || 'go-to-market motion';
}

function surfaceLabel(dimension) {
  const m = {
    features: 'features surface',
    support: 'support experience',
    messaging: 'messaging',
    positioning: 'positioning',
    pricing: 'pricing',
  };
  return m[dimension] || 'market touchpoint';
}

/** Metric / proof excerpt is strong enough to lead the headline. */
function isMetricWorthy(excerpt) {
  const t = String(excerpt || '').trim();
  if (t.length < 18) return false;
  return /[\d%$]/.test(t);
}

const HERO_FLUFF_START =
  /^(driving the future|the future of|reimagin\w*|transform(?:ing)?\s+the|welcome to|introduc\w+\s+\w+|unlock(?:ing)?\s+the)\b/i;

function segmentIsBoilerplate(seg) {
  const t = String(seg || '').trim();
  if (t.length < 10) return false;
  if (HERO_FLUFF_START.test(t)) return true;
  if (/^(industry leading|world[\s-]?class|leading provider|trusted by)\b/i.test(t) && t.length < 55) return true;
  if (t.length > 88 && !/[\d%$]/.test(t)) return true;
  return false;
}

/**
 * From "Competitor: A · B · C", keep segments that are not hero fluff; prefer ones with numbers/$/%.
 */
function refineActionForHeadline(action) {
  const parts = String(action)
    .split(/\s*·\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!parts.length) return '';
  const scored = parts.filter((p) => !segmentIsBoilerplate(p));
  if (!scored.length) return '';
  const withFacts = scored.filter((p) => /[\d%$]/.test(p));
  const pick = withFacts[0] || scored[0];
  return clip(pick, 78);
}

function filterConcreteFeatureBullets(features) {
  return (Array.isArray(features) ? features : [])
    .map((f) => String(f).trim())
    .filter((f) => f.length >= 5 && f.length <= 90)
    .filter((f) => !segmentIsBoilerplate(f))
    .slice(0, 2)
    .map((f) => clip(f, 44));
}

/** Tight clause for headline only (no long “Capability themes:” dumps). */
function buildShortEntityClause(entities) {
  const e = entities && typeof entities === 'object' && !Array.isArray(entities) ? entities : {};
  const prices = Array.isArray(e.prices) ? e.prices.filter(Boolean).slice(0, 2) : [];
  const tiers = Array.isArray(e.tiers) ? e.tiers.filter(Boolean).slice(0, 2) : [];
  const integrations = Array.isArray(e.integrations) ? e.integrations.filter(Boolean).slice(0, 2) : [];
  const feats = filterConcreteFeatureBullets(e.features);
  const kws = Array.isArray(e.keywords) ? e.keywords.filter(Boolean).slice(0, 3) : [];
  const pos = Array.isArray(e.positioning_keywords) ? e.positioning_keywords.filter(Boolean).slice(0, 3) : [];

  const parts = [];
  if (prices.length) parts.push(prices.join(', '));
  if (tiers.length) parts.push(tiers.map((t) => clip(String(t), 36)).join(', '));
  if (integrations.length) parts.push(integrations.map((x) => clip(String(x), 32)).join(', '));
  if (feats.length) parts.push(feats.join(', '));
  if (!parts.length && kws.length) parts.push(kws.map((k) => clip(String(k), 28)).join(', '));
  if (!parts.length && pos.length) parts.push(pos.map((p) => clip(String(p), 28)).join(', '));
  return clip(parts.join(' · '), 92);
}

function buildEntitySummaryClause(entities) {
  return buildShortEntityClause(entities);
}

function buildThreatTag(priority, dimension, corroboration) {
  const conf = corroboration === 'confirmed';
  if (dimension === 'features' || dimension === 'support') {
    if (priority === 'high') {
      return conf ? 'High — direct product / experience pressure' : 'Medium — product signal (verify before matching)';
    }
    return conf ? 'Medium — capability story (corroborated)' : 'Low — product mention (watch)';
  }
  if (dimension === 'messaging' || dimension === 'pricing') {
    if (priority === 'medium' || priority === 'high') {
      return conf ? 'Medium–High — packaging / proof story (corroborated)' : 'Medium — packaging or proof-point (watch)';
    }
    return conf ? 'Medium — narrative shift (corroborated)' : 'Low — messaging tweak (watch)';
  }
  if (dimension === 'positioning') {
    return conf ? 'Medium — ICP / segment shift (corroborated)' : 'Low — positioning noise (watch)';
  }
  return conf ? 'Medium — corroborated move' : 'Low — watch';
}

function dimStoryNoun(dimension) {
  const m = {
    features: 'product story',
    positioning: 'positioning line',
    messaging: 'messaging line',
    pricing: 'pricing story',
    support: 'support story',
  };
  return m[dimension] || 'thread';
}

/**
 * Multi-signal gaps: vary copy using who + source labels + dimension (not one boilerplate paragraph).
 */
function buildMultiSurfaceWhy(who, dimension, clusterSignalCount, sourceLabels) {
  const story = dimStoryNoun(dimension);
  const uniq = [...new Set((sourceLabels || []).map((s) => String(s).trim()).filter(Boolean))];
  const n = Math.max(2, clusterSignalCount);

  if (uniq.length >= 2) {
    const a = uniq.slice(0, -1).join(', ');
    const b = uniq[uniq.length - 1];
    return `${who} repeated a similar ${story} across ${a} and ${b}. That aligns what they want the market to hear—not proof of intent. Check hiring, reviews, or pricing next.`;
  }
  if (uniq.length === 1) {
    return `${who} hit the same ${story} ${n} times via ${uniq[0]}. Reads as one coordinated push on that surface; validate with a second pillar (jobs, G2, pricing) before you treat it as strategy.`;
  }
  return `${who} showed the same ${story} in ${n} places this week. Treat it as one public narrative until behavioral or third-party signals back it up.`;
}

function buildStrategicWhy(
  dimension,
  corroboration,
  intel_pillars,
  clusterSignalCount,
  who,
  sourceLabels
) {
  const onlyOwned = intel_pillars.length === 1 && intel_pillars[0] === 1;
  const whoSafe = String(who || 'They').trim() || 'They';

  if (corroboration === 'confirmed') {
    return `${whoSafe} shows the same move across different intel pillars (owned vs behavioral vs third party). That pattern usually means a real bet, not a one-off page edit.`;
  }
  if (clusterSignalCount > 1 && corroboration !== 'confirmed') {
    return buildMultiSurfaceWhy(whoSafe, dimension, clusterSignalCount, sourceLabels);
  }
  if (onlyOwned || intel_pillars.length === 0) {
    return `${whoSafe} is loudest on owned channels here. Before you react, look for jobs, pricing moves, or reviews that say the same thing.`;
  }
  const dim = dimensionPlainEnglish(dimension);
  return `${whoSafe} is pushing ${dim}. Compare that to your funnel gaps and what you already have in market.`;
}

function buildInterpretationHeadline(who, dimension, action, corroboration, metricExcerpt, entities) {
  const surf = surfaceLabel(dimension);
  let line = '';

  if (isMetricWorthy(metricExcerpt)) {
    line = `${who}: ${clip(metricExcerpt, 88)} (${surf}).`;
  } else {
    const entityClause = buildShortEntityClause(entities);
    if (entityClause) {
      line = `${who}: ${entityClause} (${surf}).`;
    } else {
      const refined = refineActionForHeadline(action);
      if (refined) {
        line = `${who}: ${refined} (${surf}).`;
      } else {
        line = `${who} updated ${surf}. Details are thin in the scrape—see Captured below.`;
      }
    }
  }

  if (corroboration === 'confirmed') {
    line = `${line} Corroborated across pillars.`;
  }
  return finalizeHeadline(line);
}

/**
 * @param {{
 *   factual_competitor_move: string,
 *   dimension: string,
 *   priority: string,
 *   corroboration: string,
 *   intel_pillars: number[],
 *   cluster_signal_count: number,
 *   metric_excerpt?: string,
 *   entities?: object,
 *   source_labels?: string[],
 * }} input
 */
function buildGapInterpretation(input) {
  const factual = String(input.factual_competitor_move || '');
  const { who, action } = parseCompetitorMoveLine(factual);
  const dimension = String(input.dimension || 'features');
  const priority = String(input.priority || 'medium');
  const corroboration = input.corroboration === 'confirmed' ? 'confirmed' : 'watch';
  const intel_pillars = Array.isArray(input.intel_pillars) ? input.intel_pillars : [];
  const cluster_signal_count = Math.max(1, parseInt(input.cluster_signal_count, 10) || 1);
  const metric_excerpt = String(input.metric_excerpt || '').trim();
  const entities =
    input.entities && typeof input.entities === 'object' && !Array.isArray(input.entities) ? input.entities : {};
  const source_labels = Array.isArray(input.source_labels) ? input.source_labels : [];

  const headline = buildInterpretationHeadline(
    who,
    dimension,
    action,
    corroboration,
    metric_excerpt,
    entities
  );
  const strategic_why = buildStrategicWhy(
    dimension,
    corroboration,
    intel_pillars,
    cluster_signal_count,
    who,
    source_labels
  );
  const threat_tag = buildThreatTag(priority, dimension, corroboration);

  return {
    headline,
    strategic_why,
    threat_tag,
    factual_line: factual,
  };
}

module.exports = {
  buildGapInterpretation,
  parseCompetitorMoveLine,
  factualActionOnly,
  refineActionForHeadline,
  buildEntitySummaryClause,
  isMetricWorthy,
};
