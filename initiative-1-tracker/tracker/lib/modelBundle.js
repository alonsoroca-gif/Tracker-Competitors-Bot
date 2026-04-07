/**
 * Single minimal JSON payload for a future approved LLM call (RAG-style: competitor + tiny repo excerpts).
 * Inputs should already pass through intel fence (redacted repo snippets).
 */

const { loadLlmGatewayFile } = require('./llmGateway');

function clip(str, max) {
  const t = String(str || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * @param {object|null} gap
 * @param {object|null} responseRow — response schema row
 * @param {object[]} repoTouchpoints — after applyFenceToTouchpoints
 * @param {string[]} repoGroundingTerms
 * @param {string} productId
 */
function buildMinimalModelBundle(gap, responseRow, repoTouchpoints, repoGroundingTerms, productId) {
  const cfg = loadLlmGatewayFile();
  const maxTp = cfg.max_touchpoints_in_bundle ?? 5;
  const maxLines = cfg.max_excerpt_lines_per_touchpoint ?? 2;
  const maxGround = cfg.max_grounding_terms_in_bundle ?? 14;
  const maxJson = cfg.max_bundle_json_chars ?? 12000;

  const excerpts = (Array.isArray(repoTouchpoints) ? repoTouchpoints : []).slice(0, maxTp).map((h) => ({
    path: String(h.relativePath || ''),
    app_label: String(h.app_label || ''),
    snippets: (Array.isArray(h.snippets) ? h.snippets : []).slice(0, maxLines).map((s) => ({
      line: s.line,
      text: clip(String(s.text || ''), 220),
    })),
  }));

  const terms = (Array.isArray(repoGroundingTerms) ? repoGroundingTerms : []).slice(0, maxGround);

  let bundle = {
    v: 1,
    product_id: String(productId || ''),
    gap_id: gap && gap.gap_id ? String(gap.gap_id) : '',
    dimension: gap && gap.dimension ? String(gap.dimension) : '',
    priority: (gap && gap.priority) || (responseRow && responseRow.priority) || '',
    response_type: responseRow && responseRow.response_type ? String(responseRow.response_type) : '',
    competitive_move: clip(gap && gap.competitor_move ? String(gap.competitor_move) : '', 520),
    strategic_interpretation: gap && gap.interpretation
      ? {
          headline: clip(String(gap.interpretation.headline || ''), 400),
          strategic_why: clip(String(gap.interpretation.strategic_why || ''), 500),
          threat_tag: clip(String(gap.interpretation.threat_tag || ''), 200),
        }
      : null,
    our_delivery_state: gap && gap.our_gap ? String(gap.our_gap) : '',
    source: gap && gap.source ? String(gap.source) : null,
    repo_excerpts: excerpts,
    grounding_terms: terms,
  };

  let json = JSON.stringify(bundle);
  while (json.length > maxJson && bundle.repo_excerpts.length > 0) {
    bundle.repo_excerpts.pop();
    bundle = { ...bundle };
    json = JSON.stringify(bundle);
  }
  if (json.length > maxJson) {
    bundle.grounding_terms = bundle.grounding_terms.slice(0, Math.max(0, bundle.grounding_terms.length - 3));
    json = JSON.stringify(bundle);
  }

  return bundle;
}

module.exports = { buildMinimalModelBundle };
