/**
 * Strategic interpretation — core product output of the tracker.
 *
 * Primary path: Anthropic (Claude) for headline, manager_takeaway, strategic_why, and threat
 * (mapped to the existing `threat_tag` display field). If ANTHROPIC_API_KEY is unset, this file
 * falls back to the legacy rule-based implementation so local runs and tests stay green.
 * API failures return a clearly labeled placeholder object (UI never breaks).
 */

const { execFileSync } = require('child_process');
const { buildSignalDataForAnthropic } = require('./interpreterPayload');

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

/** Stable 0..n-1 from string so adjacent gaps do not get identical copy. */
function stringHash(s) {
  const t = String(s || '');
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Multi-signal gaps: vary copy by theme + evidence fingerprint (not the same paragraph on every gap).
 */
function buildMultiSurfaceWhy(who, dimension, clusterSignalCount, sourceLabels, themeHint, evidenceFingerprint) {
  const story = dimStoryNoun(dimension);
  const uniq = [...new Set((sourceLabels || []).map((s) => String(s).trim()).filter(Boolean))];
  const n = Math.max(2, clusterSignalCount);
  const theme = themeHint && String(themeHint).trim() ? clip(String(themeHint).trim(), 72) : '';
  const fp = evidenceFingerprint || `${who}|${uniq.join(',')}|${n}`;
  const h = stringHash(fp) % 3;

  if (uniq.length >= 2) {
    const a = uniq.slice(0, -1).join(', ');
    const b = uniq[uniq.length - 1];
    if (h === 0) {
      return `${who} is telling a consistent ${story} on ${a} and ${b}${theme ? ` (thread: “${theme}”)` : ''}. That is coordinated messaging, not independent proof.`;
    }
    if (h === 1) {
      return `The same ${story} appears on ${a} and ${b}${theme ? ` around “${theme}”` : ''}—useful for narrative tracking, not as a stand‑in for what shipped.`;
    }
    return `${who} aligned ${a} and ${b} on this ${story}${theme ? ` (“${theme}”)` : ''}. Next: check if pricing, reviews, or jobs tell the same story.`;
  }
  if (uniq.length === 1) {
    if (h === 0) {
      return `${who} repeated a similar ${story} ${n} times via ${uniq[0]}${theme ? ` (“${theme}”)` : ''}. One surface echoing itself—treat as content sync, not a second source.`;
    }
    if (h === 1) {
      return `${n} similar captures on ${uniq[0]}${theme ? ` about “${theme}”` : ''}: likely a crawl or copy refresh, not proof of a new build. Compare week over week before reacting.`;
    }
    return `${who} hit the same ${story} on ${uniq[0]}${theme ? ` with “${theme}” visible in both scrapes` : ''}. Validate on a different pillar (pricing, G2, careers) before you match in product.`;
  }
  return `${who} showed the same ${story} in ${n} places this week. Treat as one public narrative until a non‑owned source backs it.`;
}

function buildStrategicWhy(
  dimension,
  corroboration,
  intel_pillars,
  clusterSignalCount,
  who,
  sourceLabels,
  themeHint,
  evidenceFingerprint
) {
  const onlyOwned = intel_pillars.length === 1 && intel_pillars[0] === 1;
  const whoSafe = String(who || 'They').trim() || 'They';
  const th = themeHint && String(themeHint).trim() ? clip(String(themeHint).trim(), 72) : '';
  const fp = evidenceFingerprint || `${whoSafe}|${(sourceLabels || []).join(',')}`;

  if (corroboration === 'confirmed') {
    return th
      ? `${whoSafe} shows the same move across different intel pillars, centered on “${th}”. That is closer to a real bet than a single page tweak.`
      : `${whoSafe} shows the same move across different intel pillars (owned vs behavioral vs third party). That pattern usually means a real bet, not a one-off page edit.`;
  }
  if (clusterSignalCount > 1 && corroboration !== 'confirmed') {
    return buildMultiSurfaceWhy(whoSafe, dimension, clusterSignalCount, sourceLabels, th, fp);
  }
  if (onlyOwned || intel_pillars.length === 0) {
    const v = stringHash(fp) % 2;
    if (v === 0) {
      return th
        ? `${whoSafe} is loudest on owned channels on “${th}”. Cross‑check with jobs, reviews, or pricing before you reprioritize.`
        : `${whoSafe} is loudest on owned channels here. Before you react, look for jobs, pricing moves, or reviews that say the same thing.`;
    }
    return th
      ? `Owned sites emphasize “${th}”—${whoSafe}’s public line, not yet a second pillar. Get one independent signal.`
      : `${whoSafe} is loudest on owned channels here. Before you react, look for jobs, pricing moves, or reviews that say the same thing.`;
  }
  const dim = dimensionPlainEnglish(dimension);
  return th
    ? `${whoSafe} is pushing ${dim} on “${th}”. Map that to your funnel and delivery state, not to hero copy alone.`
    : `${whoSafe} is pushing ${dim}. Compare that to your funnel gaps and what you already have in market.`;
}

/** One-line, exec-style action (not a repeat of strategic_why). */
function buildManagerTakeaway(
  dimension,
  corroboration,
  clusterSignalCount,
  priority,
  who,
  themeHint
) {
  const th = themeHint && String(themeHint).trim() ? clip(String(themeHint).trim(), 56) : '';
  if (corroboration === 'confirmed') {
    return th
      ? `Decide with PM and GTM how to respond to “${th}” this sprint—this one is worth a timed response.`
      : `Decide with PM and GTM how to respond this sprint—corroboration makes this worth a timed response, not a ticket in the backlog.`;
  }
  if (clusterSignalCount > 1) {
    return th
      ? `Do not increase build priority for “${th}” until a non‑marketing source (pricing, reviews, jobs) says the same thing.`
      : `Do not increase build priority until a non‑marketing source (pricing, reviews, jobs) confirms the same story.`;
  }
  if (dimension === 'features' || dimension === 'support') {
    return th
      ? `Use “${th}” in sales and competitive talk tracks only—no engineering bet until customers ask for it.`
      : `Use for sales and competitive context only—no engineering bet until customers or a second source ask for it.`;
  }
  if (dimension === 'pricing' || dimension === 'messaging') {
    return `Refresh battlecards and talk tracks; avoid repricing or roadmap promises on one scrape alone.`;
  }
  return `Log and monitor—no program-level reaction until a second, independent surface agrees.`;
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
 *   theme_hint?: string,
 *   evidence_fingerprint?: string,
 * }} input
 */
const VALID_THREAT = new Set(['watch', 'respond', 'urgent']);

/**
 * @param {string} level
 * @returns {string} value for the existing `interpretation.threat_tag` field in the UI
 */
function mapThreatLevelToThreatTag(level) {
  const t = String(level || 'watch').trim().toLowerCase();
  const k = VALID_THREAT.has(t) ? t : 'watch';
  const c = k.charAt(0).toUpperCase() + k.slice(1);
  return `${c} — (AI view: ${k})`;
}

/**
 * @param {string} raw
 * @returns {object}
 */
function parseLlmOutputJsonObject(raw) {
  const t = String(raw || '').trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const body = m ? m[1].trim() : t;
  return JSON.parse(body);
}

/**
 * Synchronous call to the Anthropic Messages API (so callers like buildGapReport stay sync).
 * Requires `curl` on PATH and ANTHROPIC_API_KEY. Optional: ANTHROPIC_MODEL, ANTHROPIC_MAX_TOKENS.
 */
function callAnthropicMessagesApiSync(userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
  const maxTokens = Math.min(4096, Math.max(256, parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10) || 800));

  const requestBody = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userMessage }],
  });

  const out = execFileSync(
    'curl',
    [
      '-sS',
      '--max-time',
      String(Math.min(180, Math.max(30, parseInt(process.env.ANTHROPIC_CURL_TIMEOUT_SEC, 10) || 120))),
      '-H',
      'Content-Type: application/json',
      '-H',
      'x-api-key: ' + apiKey,
      '-H',
      'anthropic-version: 2023-06-01',
      'https://api.anthropic.com/v1/messages',
      '-d',
      '@-',
    ],
    {
      maxBuffer: 4 * 1024 * 1024,
      encoding: 'utf8',
      input: requestBody,
    }
  );
  const parsed = JSON.parse(out);
  if (parsed.error) {
    throw new Error(
      (parsed.error.message && String(parsed.error.message)) || JSON.stringify(parsed.error)
    );
  }
  const part = parsed.content && parsed.content[0];
  const textOut = part && (part.text != null ? String(part.text) : '');
  if (!textOut) {
    throw new Error('No text content in Anthropic response');
  }
  return textOut;
}

/**
 * @param {object} o
 * @param {{ headline: string, manager_takeaway: string, strategic_why: string, threat_tag: string, factual_line: string}} base
 */
function buildGapInterpretationFromLlmObject(o, base) {
  if (!o || typeof o !== 'object') throw new Error('LLM did not return an object');
  const h = o.headline;
  const m = o.manager_takeaway;
  const s = o.strategic_why;
  const tl = o.threat_level;
  for (const name of ['headline', 'manager_takeaway', 'strategic_why', 'threat_level']) {
    if (o[name] !== undefined && typeof o[name] !== 'string') {
      throw new Error('LLM field ' + name + ' must be a string');
    }
  }
  if (typeof h !== 'string' || !h.trim()) throw new Error('headline empty');
  if (typeof m !== 'string' || !m.trim()) throw new Error('manager_takeaway empty');
  if (typeof s !== 'string' || !s.trim()) throw new Error('strategic_why empty');
  if (typeof tl !== 'string' || !tl.trim()) throw new Error('threat_level empty');
  return {
    headline: clip(h.trim(), MAX_HEADLINE_CHARS * 2),
    manager_takeaway: clip(m.trim(), 500),
    strategic_why: clip(s.trim(), 1000),
    threat_tag: mapThreatLevelToThreatTag(tl),
    factual_line: base.factual_line,
  };
}

function buildGapInterpretationFromLlm(input) {
  const factual = String(input.factual_competitor_move || '');
  const signalData = buildSignalDataForAnthropic(input);
  const signalJson = JSON.stringify(signalData, null, 2);
  const userMessage = `You are a product manager analyzing a competitor signal.

Raw signal: ${signalJson}

Respond in JSON with exactly these four fields:
- "headline": one sentence, what the competitor did, past tense, factual, no adjectives
- "manager_takeaway": one sentence, what our PM should do or decide this week, starts with a verb
- "strategic_why": one sentence, why this signal matters to our product specifically, not generically
- "threat_level": one word only — "watch", "respond", or "urgent"

Do not add any other fields. Do not explain your reasoning outside the JSON.`;

  const text = callAnthropicMessagesApiSync(userMessage);
  const obj = parseLlmOutputJsonObject(text);
  return buildGapInterpretationFromLlmObject(obj, { factual_line: factual });
}

/**
 * API failure, parse failure, or missing `curl` — still returns a valid interpretation shape
 * (clearly marked so the UI and humans can tell it is not model output).
 */
function buildLlmErrorPlaceholder(input, errMsg) {
  const factual = String(input.factual_competitor_move || '');
  const corro = input.corroboration === 'confirmed' ? 'confirmed' : 'watch';
  const th = buildThreatTag(
    String(input.priority || 'medium'),
    String(input.dimension || 'features'),
    corro
  );
  return {
    headline: clip(
      '[LLM unavailable] ' + (factual ? factual.slice(0, 100) : 'No competitive move line in input.'),
      MAX_HEADLINE_CHARS * 2
    ),
    manager_takeaway:
      'Check Details for raw evidence; retry when ANTHROPIC_API_KEY and network are set. (placeholder: LLM call did not return usable JSON).',
    strategic_why: clip('Placeholder only — ' + (errMsg || 'Anthropic call failed.'), 600),
    threat_tag: th,
    factual_line: factual,
  };
}

function buildGapInterpretationRuleBased(input) {
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
  const theme_hint = String(input.theme_hint || '').trim();
  const evidence_fingerprint = String(input.evidence_fingerprint || '');

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
    source_labels,
    theme_hint,
    evidence_fingerprint
  );
  const manager_takeaway = buildManagerTakeaway(
    dimension,
    corroboration,
    cluster_signal_count,
    priority,
    who,
    theme_hint
  );
  const threat_tag = buildThreatTag(priority, dimension, corroboration);

  return {
    headline,
    manager_takeaway,
    strategic_why,
    threat_tag,
    factual_line: factual,
  };
}

/**
 * @param {Parameters<typeof buildGapInterpretationRuleBased>[0]} input
 * @returns {ReturnType<typeof buildGapInterpretationRuleBased>}
 */
function buildGapInterpretation(input) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return buildGapInterpretationFromLlm(input);
    } catch (e) {
      return buildLlmErrorPlaceholder(
        input,
        e && (e.message != null) ? String(e.message) : String(e)
      );
    }
  }
  return buildGapInterpretationRuleBased(input);
}

module.exports = {
  buildGapInterpretation,
  parseCompetitorMoveLine,
  factualActionOnly,
  refineActionForHeadline,
  buildEntitySummaryClause,
  isMetricWorthy,
  stringHash,
};
