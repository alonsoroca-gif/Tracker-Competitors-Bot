/**
 * Build response records from a GapReport. One record per gap with response_type, rationale, actions, timeline.
 * Copy is personalized per tracker product via config/product-keywords.json (match_focus / differentiate_focus rotate by gap_id).
 */

const { getProductVoice, pickVariantByGapId } = require('./productContext');

function clip(s, max) {
  const t = String(s || '').trim();
  if (!t) return '(no summary)';
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

/**
 * @param {object} gapReport
 * @param {string} [productId] — defaults to gapReport.product_id
 */
function buildResponseSchema(gapReport, productId) {
  const pid =
    productId != null && String(productId).trim() !== ''
      ? String(productId).trim()
      : String(gapReport.product_id || '').trim();

  const responses = [];
  const gaps = gapReport.gaps || [];
  let respIndex = 1;
  for (const gap of gaps) {
    const response_type =
      gap.dimension === 'features' || gap.dimension === 'support'
        ? 'match'
        : gap.dimension === 'positioning'
          ? 'differentiate'
          : 'match';
    const response_id = `resp-${gapReport.period_start.replace(/-/g, '')}-${String(respIndex).padStart(3, '0')}`;
    respIndex++;

    const factual = gap.competitor_move || gap.title || '';
    const move =
      (gap.interpretation && gap.interpretation.headline) || factual || gap.competitor_signal?.slice(0, 60) || '';
    const competitor_action = move;
    const our_gap = gap.our_gap || '(not set)';
    const voice = getProductVoice(pid);
    const pool = response_type === 'match' ? voice.match_focus : voice.differentiate_focus;
    const angle = pickVariantByGapId(gap.gap_id || '', pool);
    const dim = gap.dimension || (response_type === 'match' ? 'features' : 'positioning');
    const moveShort = clip(factual || move, 88);

    const recommendation = angle
      ? response_type === 'match'
        ? `${angle} — **${voice.display_name}** (${dim}). Evidence: ${moveShort}`
        : `${angle} — **${voice.display_name}** (${dim}). Counter vs: ${moveShort}`
      : response_type === 'match'
        ? `**${voice.display_name}** (${dim}): align roadmap to this move — ${moveShort}`
        : `**${voice.display_name}** (${dim}): sharpen positioning vs — ${moveShort}`;

    const rationale = `**${voice.display_name}** · ${dim} · us: ${our_gap}. Stance: ${response_type}. Signal: ${moveShort}`;

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
