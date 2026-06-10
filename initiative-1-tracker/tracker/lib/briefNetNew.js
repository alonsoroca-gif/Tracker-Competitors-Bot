/**
 * Net-new signal detection between drops (source_url diff).
 */

function signalKey(s) {
  return (s.source_url || '').trim().toLowerCase();
}

function netNewBetween(currentSignals, priorSignals) {
  const priorKeys = new Set((priorSignals || []).map(signalKey).filter(Boolean));
  const seen = new Set();
  const out = [];

  for (const s of currentSignals || []) {
    const key = signalKey(s);
    if (!key || priorKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Rough pre-publish estimate — not a substitute for interpret classification. */
function predictProductCandidates(netNew) {
  return (netNew || []).filter((s) => {
    const t = String(s.type || '').toLowerCase();
    const src = String(s.source || '').toLowerCase();
    if (t === 'features' || src === 'features_page' || src === 'product_page') return true;
    const imp = String(s.importance || '').toLowerCase();
    return imp === 'high' || imp === 'critical';
  });
}

function estimatePublishMinutes(productRowCount) {
  const base = 12;
  const perRow = 8;
  return base + productRowCount * perRow;
}

module.exports = {
  signalKey,
  netNewBetween,
  predictProductCandidates,
  estimatePublishMinutes,
};
