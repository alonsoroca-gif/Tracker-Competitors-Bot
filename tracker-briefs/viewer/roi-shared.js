/** Shared ROI + brief renderers — index.html + prototype.html */
const VIEWER_BUILD = 'roi-v8';

function escRoi(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function normalizeRoi(roi) {
  if (!roi) return null;
  if (typeof roi === 'string') {
    try {
      roi = JSON.parse(roi);
    } catch {
      return null;
    }
  }
  return roi && typeof roi === 'object' ? roi : null;
}

function normalizeBrief(brief) {
  if (!brief) return null;
  if (typeof brief === 'string') {
    return { text: brief };
  }
  return brief && typeof brief === 'object' ? brief : null;
}

const NUMBER_TYPE_LABELS = {
  modeled_approximation: 'Modeled approximation',
  measured: 'Measured (client data)',
  benchmark_chunk: 'Benchmark chunk',
};

function normalizeNumbers(numbers, roi) {
  if (!numbers && roi) {
    numbers = {
      type: roi.confidence === 'measured' ? 'measured' : 'modeled_approximation',
      formula: roi.brief?.formula || null,
      inputs: roi.brief?.inputs || null,
      scaling: roi.brief?.scaling || null,
      disclaimer: roi.brief?.disclaimer || null,
    };
  }
  if (!numbers || typeof numbers !== 'object') return null;
  const type = numbers.type || 'modeled_approximation';
  return {
    type,
    type_label: numbers.type_label || NUMBER_TYPE_LABELS[type] || 'Modeled approximation',
    formula: numbers.formula || '',
    inputs: Array.isArray(numbers.inputs) ? numbers.inputs : (numbers.inputs ? [numbers.inputs] : []),
    scaling: numbers.scaling || 'Per-unit estimate scaled to 250-unit property and 10k-unit portfolio using standard chunk benchmarks.',
    disclaimer: numbers.disclaimer || 'Directional model for prioritization — not a measured client ROI guarantee.',
  };
}

function renderBriefLines(brief, fields) {
  const b = normalizeBrief(brief);
  if (!b) return '';
  if (b.text) {
    return `<p class="brief-line">${escRoi(b.text)}</p>`;
  }
  const lines = fields
    .map(([key, label]) => (b[key] ? `<p class="brief-line"><span class="brief-label">${escRoi(label)}</span> ${escRoi(b[key])}</p>` : ''))
    .filter(Boolean)
    .join('');
  return lines || '';
}

function renderRoiNumbersBlock(roi, opts = {}) {
  const numbers = normalizeNumbers(roi.numbers, roi);
  if (!numbers && !opts.includeNumbers) return '';

  const n = numbers || normalizeNumbers({}, roi);
  const typeCls = `num-type-${n.type.replace(/_/g, '-')}`;
  const inputsHtml = n.inputs.length
    ? `<ul class="roi-inputs">${n.inputs.map((i) => `<li>${escRoi(i)}</li>`).join('')}</ul>`
    : '';
  const formulaHtml = n.formula
    ? `<div class="roi-formula"><span class="brief-label">Formula</span> ${escRoi(n.formula)}</div>`
    : '';

  if (opts.compact) {
    return `<p class="roi-num-hint"><span class="num-type-pill ${typeCls}">${escRoi(n.type_label)}</span> ${escRoi(n.disclaimer)}</p>`;
  }

  return `
    <div class="roi-numbers-block">
      <div class="roi-numbers-head">
        <span class="brief-label">How we got these numbers</span>
        <span class="num-type-pill ${typeCls}">${escRoi(n.type_label)}</span>
      </div>
      ${formulaHtml}
      ${inputsHtml}
      <p class="roi-scaling"><span class="brief-label">Scaling</span> ${escRoi(n.scaling)}</p>
      <p class="roi-disclaimer">${escRoi(n.disclaimer)}</p>
    </div>`;
}

function renderRoiPanel(roi, opts = {}) {
  roi = normalizeRoi(roi);
  if (!roi) {
    return '<p class="roi-empty">ROI pending publish.</p>';
  }
  const verdict = String(roi.verdict || 'modeled').toLowerCase();
  const cls = verdict === 'pursue' ? 'roi-pursue' : verdict === 'watch' ? 'roi-watch' : 'roi-neutral';
  const stats = [
    ['Per unit', roi.per_unit_annual, 'Directional annual estimate'],
    ['250 units', roi.property_250, 'Single-property chunk'],
    ['10k portfolio', roi.portfolio_10k, 'Portfolio-scale chunk'],
  ].filter(([, v]) => v);
  const statsHtml = stats.length
    ? `<div class="roi-stats">${stats.map(([lbl, val, hint]) =>
        `<div class="roi-stat" title="${escRoi(hint)}">
          <span class="val">${escRoi(val)}</span>
          <span class="lbl">${escRoi(lbl)}</span>
          <span class="hint">${escRoi(hint)}</span>
        </div>`
      ).join('')}</div>`
    : '';
  /* Index cards: badge + lever + three stat boxes only */
  if (opts.metricsOnly) {
    return `
    <div class="proto-roi ${cls} proto-roi-skim">
      <div class="roi-head">
        <span class="roi-badge">${escRoi(String(roi.verdict || 'ROI').toUpperCase())}</span>
        <span class="roi-lever">${escRoi(roi.lever || 'ROI lever')}</span>
      </div>
      ${statsHtml}
    </div>`;
  }

  const numbersHtml = renderRoiNumbersBlock(roi, { includeNumbers: opts.includeNumbers !== false });
  const briefHtml = opts.includeBrief
    ? `<div class="brief-block roi-brief">${renderBriefLines(roi.brief, [
        ['advantage', 'Our edge'],
        ['why_pursue', 'Why pursue'],
      ])}</div>`
    : '';
  return `
    <div class="proto-roi ${cls}">
      <div class="roi-head">
        <span class="roi-badge">${escRoi(String(roi.verdict || 'ROI').toUpperCase())}</span>
        <span class="roi-lever">${escRoi(roi.lever || 'ROI lever')}</span>
      </div>
      ${statsHtml}
      ${numbersHtml}
      <p class="roi-summary">${escRoi(roi.summary || 'ROI summary pending publish.')}</p>
      ${briefHtml}
      <p class="roi-conf">${escRoi(roi.confidence || 'modeled')} · roi-analyst</p>
    </div>`;
}

function renderProtoBrief(proto) {
  if (!proto) return '<p class="roi-empty">Prototype brief pending publish.</p>';
  const lines = renderBriefLines(proto.brief, [
    ['what', 'What'],
    ['benefits', 'Entrata products'],
    ['why_build', 'Why build'],
  ]);
  if (lines) return `<div class="proto-brief-panel">${lines}</div>`;
  const fallback = [
    proto.title ? `<p class="brief-line"><span class="brief-label">What</span> ${escRoi(proto.title)} — counter to ${escRoi(proto.competitor || proto.competitor_id || 'competitor')}.</p>` : '',
    proto.competitor ? `<p class="brief-line"><span class="brief-label">Why build</span> Entrata-owned PMS path; ${escRoi(proto.competitor)} cannot ship the same integration depth.</p>` : '',
  ].filter(Boolean).join('');
  return fallback
    ? `<div class="proto-brief-panel">${fallback}</div>`
    : '<p class="roi-empty">Prototype brief pending publish.</p>';
}

function parseRoiParam(encoded) {
  if (!encoded) return null;
  try {
    return normalizeRoi(JSON.parse(decodeURIComponent(encoded)));
  } catch {
    try {
      return normalizeRoi(JSON.parse(encoded));
    } catch {
      return null;
    }
  }
}

function normalizePrototypes(data) {
  const list = Array.isArray(data) ? data : (data?.prototypes ?? data?.items ?? []);
  return list.map((p) => ({
    ...p,
    roi: normalizeRoi(p.roi ?? p.roi_analysis ?? null),
    brief: normalizeBrief(p.brief) ?? p.brief,
  }));
}

async function fetchPrototypesForRun(runId) {
  if (!runId) return [];
  const url = new URL(`../runs/${encodeURIComponent(runId)}/prototypes.json`, window.location.href);
  url.searchParams.set('v', VIEWER_BUILD);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`prototypes.json → ${res.status}`);
  return normalizePrototypes(await res.json());
}

function findProtoById(protos, id) {
  return protos.find((x) => x.id === id) ?? null;
}

function findProtoRoi(protos, id) {
  return findProtoById(protos, id)?.roi ?? null;
}
