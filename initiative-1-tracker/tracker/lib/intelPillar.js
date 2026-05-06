/**
 * Maps each signal to one of four intel pillars (methodology doc).
 * Pillar 4 (structural) has no automated collectors yet — coverage checklist only.
 */

const PILLAR_META = {
  1: { key: 'owned', short: 'Owned (what they say)' },
  2: { key: 'behavioral', short: 'Behavioral (what they do)' },
  3: { key: 'third_party', short: 'Third party (what others say)' },
  4: { key: 'structural', short: 'Structural (headcount, funding, stack)' },
};

/**
 * @param {string} [source]
 * @param {string} [type]
 * @returns {{ pillar: number|null, pillar_key: string|null, pillar_label: string }}
 */
function intelPillarFromSourceType(source, type) {
  const t = String(type || '').toLowerCase();
  const src = String(source || '').toLowerCase();

  if (t === 'pricing' || t === 'job') {
    return { pillar: 2, pillar_key: PILLAR_META[2].key, pillar_label: PILLAR_META[2].short };
  }
  if (t === 'review_g2' || t === 'review_youtube' || t === 'review_other') {
    return { pillar: 3, pillar_key: PILLAR_META[3].key, pillar_label: PILLAR_META[3].short };
  }
  if (t === 'media') {
    return { pillar: 3, pillar_key: PILLAR_META[3].key, pillar_label: PILLAR_META[3].short };
  }
  if (
    src === 'youtube_search' ||
    src === 'youtube_comments' ||
    src === 'g2_reviews' ||
    src === 'reviews_other' ||
    src === 'media'
  ) {
    return { pillar: 3, pillar_key: PILLAR_META[3].key, pillar_label: PILLAR_META[3].short };
  }
  if (src === 'pricing_page') {
    return { pillar: 2, pillar_key: PILLAR_META[2].key, pillar_label: PILLAR_META[2].short };
  }
  if (src === 'features_page' || src === 'careers') {
    return {
      pillar: src === 'careers' ? 2 : 1,
      pillar_key: src === 'careers' ? PILLAR_META[2].key : PILLAR_META[1].key,
      pillar_label: src === 'careers' ? PILLAR_META[2].short : PILLAR_META[1].short,
    };
  }

  if (
    ['blog', 'press', 'changelog', 'youtube', 'features', 'insights', 'podcast', 'case_study', 'article'].includes(t)
  ) {
    return { pillar: 1, pillar_key: PILLAR_META[1].key, pillar_label: PILLAR_META[1].short };
  }
  if (
    ['blog', 'press', 'changelog', 'youtube', 'insights', 'podcast', 'case_studies', 'articles_index'].includes(src)
  ) {
    return { pillar: 1, pillar_key: PILLAR_META[1].key, pillar_label: PILLAR_META[1].short };
  }

  return { pillar: null, pillar_key: null, pillar_label: 'Unclassified' };
}

/**
 * Merge pillar fields into signal metadata (non-destructive for other keys).
 * @param {object} metadata
 * @param {string} source
 * @param {string} type
 */
function attachIntelPillarMetadata(metadata, source, type) {
  const base = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  const { pillar, pillar_key, pillar_label } = intelPillarFromSourceType(source, type);
  base.intel_pillar = pillar;
  base.intel_pillar_key = pillar_key;
  base.intel_pillar_label = pillar_label;
  return base;
}

/**
 * Count signals per pillar for a batch (e.g. one collect run).
 * @param {object[]} signals
 * @returns {{ counts: Record<string, number>, pillars_touched: number[], distinct_pillars: number }}
 */
function summarizePillarsFromSignals(signals) {
  const counts = { '1': 0, '2': 0, '3': 0, '4': 0, unclassified: 0 };
  const touched = new Set();
  for (const s of Array.isArray(signals) ? signals : []) {
    const p = s && s.metadata && typeof s.metadata.intel_pillar === 'number' ? s.metadata.intel_pillar : null;
    if (p === 1 || p === 2 || p === 3 || p === 4) {
      counts[String(p)] += 1;
      touched.add(p);
    } else {
      counts.unclassified += 1;
    }
  }
  const pillars_touched = [...touched].sort((a, b) => a - b);
  return {
    counts,
    pillars_touched,
    distinct_pillars: pillars_touched.length,
  };
}

module.exports = {
  PILLAR_META,
  intelPillarFromSourceType,
  attachIntelPillarMetadata,
  summarizePillarsFromSignals,
};
