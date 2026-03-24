/**
 * Build response records from a GapReport. One record per gap with response_type, rationale, actions, timeline.
 */

function buildResponseSchema(gapReport) {
  const responses = [];
  const gaps = gapReport.gaps || [];
  let respIndex = 1;
  for (const gap of gaps) {
    const response_type = gap.dimension === 'features' || gap.dimension === 'support' ? 'match' : gap.dimension === 'positioning' ? 'differentiate' : 'match';
    const response_id = `resp-${gapReport.period_start.replace(/-/g, '')}-${String(respIndex).padStart(3, '0')}`;
    respIndex++;
    const competitor_action = gap.competitor_move || gap.title || gap.competitor_signal?.slice(0, 60);
    const our_gap = gap.our_gap || '(not set)';
    const recommendation = response_type === 'match'
      ? `Consider matching: ${competitor_action}`
      : `Differentiate: ${competitor_action}`;
    const rationale = `Competitor: ${competitor_action}. We have: ${our_gap}. Recommended: ${response_type}.`;
    responses.push({
      response_id,
      gap_id: gap.gap_id,
      competitor_action,
      our_gap,
      recommendation,
      response_type,
      rationale,
      actions: [recommendation],
      timeline: gap.priority === 'high' ? 'Within 2 weeks' : gap.priority === 'medium' ? 'Within 1 month' : 'No deadline',
      priority: gap.priority,
    });
  }
  return responses;
}

module.exports = { buildResponseSchema };
