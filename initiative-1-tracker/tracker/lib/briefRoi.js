/**
 * Short ROI block for tracker-brief prototypes (roi-analyst TL;DR shape).
 */

function formatRoiLine(roi) {
  if (!roi || !roi.summary) return '';
  const parts = [];
  if (roi.verdict) parts.push(`**${String(roi.verdict).toUpperCase()}**`);
  if (roi.lever) parts.push(`_${roi.lever}_`);
  parts.push(roi.summary);
  const scale = [roi.per_unit_annual, roi.property_250 && `250u ${roi.property_250}`, roi.portfolio_10k && `10k ${roi.portfolio_10k}`]
    .filter(Boolean)
    .join(' · ');
  if (scale) parts.push(`(${scale})`);
  return parts.join(' ');
}

function formatRoiCardHtml(roi) {
  if (!roi) return '';
  const verdict = (roi.verdict || 'modeled').toLowerCase();
  const cls = verdict === 'pursue' ? 'roi-pursue' : verdict === 'watch' ? 'roi-watch' : 'roi-neutral';
  const scale = [roi.per_unit_annual, roi.property_250, roi.portfolio_10k].filter(Boolean).join(' · ');
  return {
    verdict,
    className: cls,
    lever: roi.lever || 'ROI',
    summary: roi.summary || '',
    scale,
    confidence: roi.confidence || 'modeled',
  };
}

module.exports = { formatRoiLine, formatRoiCardHtml };
