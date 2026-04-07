const { buildResponseSchema } = require('./responseSchema');
const { getAppInventory, formatInventoryOneLine, buildStructuredWorkItems } = require('./appInventory');
const { getRepoInsightsForGap, buildRepoAwareRecommendation } = require('./repoInsight');
const { applyFenceToTouchpoints, fenceMetaForApi } = require('./intelFence');
const { buildMinimalModelBundle } = require('./modelBundle');
const { getLlmGatewayStatus } = require('./llmGateway');

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function gapById(gapReport, gapId) {
  const gaps = gapReport.gaps || [];
  return gaps.find((g) => g.gap_id === gapId) || null;
}

/**
 * From gap report + response schema, pick top 1–3 by priority and return formatted "what to change" items.
 * Adds `structured` (prototype): app-inventory snapshot + concrete work-item shapes beyond a single paragraph.
 */
function getWhatToChange(gapReport, responseSchema) {
  const productId = gapReport.product_id || '';
  const inventory = getAppInventory(productId);
  const invSummary = formatInventoryOneLine(inventory);

  const responses = responseSchema || buildResponseSchema(gapReport, productId);
  const sorted = [...responses].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const top = sorted.slice(0, 3);
  return top.map((r) => {
    const gap = gapById(gapReport, r.gap_id);
    const repo = gap ? getRepoInsightsForGap(gap, inventory, productId) : { touchpoints: [], grounding_terms: [] };
    const repoTouchpoints = applyFenceToTouchpoints(repo.touchpoints);
    const recommendation = gap
      ? buildRepoAwareRecommendation(r, gap, repoTouchpoints, productId)
      : r.recommendation;

    const minimalBundle = buildMinimalModelBundle(
      gap || null,
      r,
      repoTouchpoints,
      repo.grounding_terms || [],
      productId
    );
    const llmReadiness = {
      gateway: getLlmGatewayStatus(),
      minimal_model_bundle: minimalBundle,
      bundle_json_chars: JSON.stringify(minimalBundle).length,
    };

    const structured = gap
      ? {
          our_app_inventory: inventory,
          inventory_summary_line: invSummary || null,
          work_items: buildStructuredWorkItems(gap, inventory, productId),
          repo_touchpoints: repoTouchpoints,
          repo_grounding_terms: repo.grounding_terms,
          intel_fence: fenceMetaForApi(),
          llm_readiness: llmReadiness,
        }
      : {
          our_app_inventory: inventory,
          inventory_summary_line: invSummary || null,
          work_items: [],
          repo_touchpoints: [],
          repo_grounding_terms: [],
          intel_fence: fenceMetaForApi(),
          llm_readiness: llmReadiness,
        };

    const workBullets = (structured.work_items || [])
      .map((w) => `  - [${w.kind}] ${w.title}`)
      .join('\n');

    const formatted = `- **Competitive move (summary):** ${r.competitor_action}\n  **Our delivery state:** ${r.our_gap || '(not set)'}\n  **Recommended response:** ${recommendation} (${r.priority}). ${r.timeline}.${
      invSummary ? `\n  **Our apps (inventory):** ${invSummary}` : '\n  **Our apps (inventory):** _(configure config/app-inventory.json)_'
    }${workBullets ? `\n  **Suggested work items:**\n${workBullets}` : ''}`;

    return {
      action: r.competitor_action,
      our_gap: r.our_gap,
      recommendation,
      response_type: r.response_type,
      why: r.rationale,
      priority: r.priority,
      timeline: r.timeline,
      gap_id: r.gap_id,
      structured,
      formatted,
    };
  });
}

module.exports = { getWhatToChange };
