const { buildResponseSchema } = require('./responseSchema');

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/**
 * From gap report + response schema, pick top 1–3 by priority and return formatted "what to change" items.
 */
function getWhatToChange(gapReport, responseSchema) {
  const responses = responseSchema || buildResponseSchema(gapReport);
  const sorted = [...responses].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const top = sorted.slice(0, 3);
  return top.map((r) => ({
    action: r.competitor_action,
    our_gap: r.our_gap,
    recommendation: r.recommendation,
    response_type: r.response_type,
    why: r.rationale,
    priority: r.priority,
    timeline: r.timeline,
    formatted: `- **What they're doing:** ${r.competitor_action}\n  **We have:** ${r.our_gap || '(not set)'}\n  **What to change:** ${r.recommendation || r.response_type} (${r.priority}). ${r.timeline}.`,
  }));
}

module.exports = { getWhatToChange };
