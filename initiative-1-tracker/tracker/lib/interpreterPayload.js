/**
 * Phase A: build InterpreterGapPayload + copy-friendly package for Cursor (no server LLM).
 * @see docs/LLM-INTERPRETER-SPEC.md
 */

const SCHEMA_VERSION = '1.0';

/**
 * Assembles a JSON-serializable "raw signal" for the Anthropic PM prompt. Uses the
 * same shape of object that buildGapReport passes into buildGapInterpretation
 * (no full gap / evidence_sections required for Job 1–2 boundary).
 * @param {object} interpretationInput — see buildGapInterpretation in gapInterpretation.js
 */
function buildSignalDataForAnthropic(interpretationInput) {
  const in0 = interpretationInput && typeof interpretationInput === 'object' ? interpretationInput : {};
  return {
    competitor_move_line: String(in0.factual_competitor_move || '').trim(),
    dimension: in0.dimension || 'features',
    priority: in0.priority || 'medium',
    corroboration: in0.corroboration || 'watch',
    intel_pillars: Array.isArray(in0.intel_pillars) ? in0.intel_pillars : [],
    signal_cluster_count: Math.max(1, parseInt(in0.cluster_signal_count, 10) || 1),
    source_surfaces: Array.isArray(in0.source_labels) ? in0.source_labels : [],
    theme_hint: String(in0.theme_hint || '').trim() || undefined,
    evidence_fingerprint: String(in0.evidence_fingerprint || '').trim() || undefined,
    metric_excerpt: String(in0.metric_excerpt || '').trim() || undefined,
    entities:
      in0.entities && typeof in0.entities === 'object' && !Array.isArray(in0.entities) ? in0.entities : {},
  };
}

function clip(s, max) {
  const t = String(s || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** Split merged L2 body from gapReport into blocks aligned with corroboration rows when possible. */
function signalChunksFromGap(gap) {
  const raw = String(gap.competitor_signal || '').trim();
  if (!raw) return [''];
  const parts = raw.split(/\n\n—\n\n/);
  return parts.length ? parts : [raw];
}

function buildSignalsArray(gap) {
  const rows =
    gap.corroboration_sources && gap.corroboration_sources.length
      ? gap.corroboration_sources
      : [
          {
            source: gap.source || 'unknown',
            label: gap.source_summary || gap.source || 'Signal',
            source_url: gap.source_url || null,
          },
        ];
  const chunks = signalChunksFromGap(gap);
  const date = gap.detected_at || '';
  return rows.map((r, i) => {
    const src = (r.source && String(r.source).trim()) || 'unknown';
    const block = (chunks[i] || chunks[0] || gap.competitor_move || '').replace(/^\[[^\]]+\]\s*/m, '').trim();
    const type = src === 'changelog' ? 'release' : 'content';
    const headline = clip(r.label || r.source || 'Captured signal', 160);
    const snippet = clip(block, 520);
    const out = {
      source: src,
      type,
      date,
      headline,
      snippet,
    };
    const url = r.source_url && String(r.source_url).trim();
    if (url && /^https?:\/\//i.test(url)) out.source_url = url;
    const ev = clip(block.replace(/\s+/g, ' '), 240);
    if (ev && ev !== snippet) out.evidence_snippet = ev;
    return out;
  });
}

/**
 * @param {object} gap — gap row from buildGapReport (must include competitor_id when available)
 * @param {object} meta
 * @param {string} meta.product_id
 * @param {string} [meta.product_name]
 * @param {string} [meta.period_start]
 * @param {string} [meta.period_end]
 * @param {string} [meta.competitor_name]
 */
function buildInterpreterGapPayload(gap, meta) {
  const product_id = String(meta.product_id || gap.product_id || '').trim();
  const competitor_id = String(gap.competitor_id || '').trim() || 'unknown';
  const labels = (gap.corroboration_sources || []).map((x) => x.label).filter(Boolean);
  const interp = gap.interpretation && typeof gap.interpretation === 'object' ? gap.interpretation : null;
  const existing_rule_based =
    interp && (interp.headline || interp.strategic_why || interp.threat_tag || interp.manager_takeaway)
      ? {
          headline: interp.headline || '',
          manager_takeaway: interp.manager_takeaway || '',
          strategic_why: interp.strategic_why || '',
          threat_tag: interp.threat_tag || '',
        }
      : undefined;

  return {
    schema_version: SCHEMA_VERSION,
    gap_id: gap.gap_id || '',
    product_id,
    product_name: meta.product_name || undefined,
    dimension: gap.dimension || 'features',
    competitor_id,
    competitor_name: meta.competitor_name || undefined,
    priority: gap.priority || 'medium',
    signals: buildSignalsArray(gap),
    cluster_signal_count: typeof gap.cluster_signal_count === 'number' ? gap.cluster_signal_count : undefined,
    corroboration: gap.corroboration || 'watch',
    intel_pillar_label: gap.intel_pillar_label || undefined,
    corroboration_source_labels: labels.length ? labels : undefined,
    competitor_move: gap.competitor_move || undefined,
    competitor_signal: gap.competitor_signal ? String(gap.competitor_signal) : undefined,
    our_gap: gap.our_gap || undefined,
    existing_rule_based,
  };
}

const SYSTEM_HINT = [
  'You are the competitive intelligence interpreter for Entrata’s Tracker (multifamily / L2L software).',
  'You receive ONE JSON object: InterpreterGapPayload. Public scrapes only—no web search.',
  'Output ONLY valid JSON matching InterpreterGapResult (see docs/LLM-INTERPRETER-SPEC.md). No markdown fences.',
].join(' ');

function buildInstructionsMarkdown() {
  return [
    '**Cursor (Phase A)**',
    '',
    '1. Click **Copy for Cursor** below (copies JSON + short prompts).',
    '2. In Cursor Chat or Composer, paste the **system hint** once, then the **user prompt** (or paste the JSON block alone if your rule already loads the spec).',
    '3. Save the model’s JSON result next to this gap in your notes or PR; the Tracker UI still owns L2 evidence.',
  ].join('\n');
}

/**
 * @returns {{ payload: object, system_hint: string, user_prompt: string, copy_block: string, instructions_markdown: string }}
 */
function buildCursorInterpretationPackage(gap, meta) {
  const payload = buildInterpreterGapPayload(gap, meta);
  const json = JSON.stringify(payload, null, 2);
  const periodLine =
    meta.period_start && meta.period_end
      ? `Report period (context only): ${meta.period_start} – ${meta.period_end}.\n\n`
      : '';
  const user_prompt = [
    periodLine + 'Interpret this single gap. Input is valid JSON: InterpreterGapPayload (schema in docs/LLM-INTERPRETER-SPEC.md).',
    'Return ONLY valid JSON matching InterpreterGapResult with the same gap_id.',
    '',
    json,
  ].join('\n');
  return {
    payload,
    system_hint: SYSTEM_HINT,
    user_prompt,
    copy_block: `${SYSTEM_HINT}\n\n---\n\n${user_prompt}`,
    instructions_markdown: buildInstructionsMarkdown(),
  };
}

module.exports = {
  SCHEMA_VERSION,
  buildSignalDataForAnthropic,
  buildInterpreterGapPayload,
  buildCursorInterpretationPackage,
};
