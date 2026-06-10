/** Shared ROI panel renderer — index.html + prototype.html */
function escRoi(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderRoiPanel(roi) {
  if (!roi || typeof roi !== 'object') {
    return '<p class="roi-empty">ROI pending publish.</p>';
  }
  const verdict = String(roi.verdict || 'modeled').toLowerCase();
  const cls = verdict === 'pursue' ? 'roi-pursue' : verdict === 'watch' ? 'roi-watch' : 'roi-neutral';
  const stats = [
    ['Per unit', roi.per_unit_annual],
    ['250 units', roi.property_250],
    ['10k portfolio', roi.portfolio_10k],
  ].filter(([, v]) => v);
  const statsHtml = stats.length
    ? `<div class="roi-stats">${stats.map(([lbl, val]) =>
        `<div class="roi-stat"><span class="val">${escRoi(val)}</span><span class="lbl">${escRoi(lbl)}</span></div>`
      ).join('')}</div>`
    : '';
  return `
    <div class="proto-roi ${cls}">
      <div class="roi-head">
        <span class="roi-badge">${escRoi(String(roi.verdict || 'ROI').toUpperCase())}</span>
        <span class="roi-lever">${escRoi(roi.lever || 'ROI lever')}</span>
      </div>
      ${statsHtml}
      <p class="roi-summary">${escRoi(roi.summary || 'ROI summary pending publish.')}</p>
      <p class="roi-conf">${escRoi(roi.confidence || 'modeled')} · roi-analyst</p>
    </div>`;
}

function parseRoiParam(encoded) {
  if (!encoded) return null;
  try {
    return JSON.parse(decodeURIComponent(encoded));
  } catch {
    try {
      return JSON.parse(encoded);
    } catch {
      return null;
    }
  }
}
