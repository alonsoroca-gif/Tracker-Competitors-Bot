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

/** Same source_url as baseline but headline or snippet changed (content refresh). */
function contentChangedBetween(currentSignals, baselineSignals) {
  const baselineByUrl = new Map();
  for (const s of baselineSignals || []) {
    const key = signalKey(s);
    if (key) baselineByUrl.set(key, s);
  }
  const seen = new Set();
  const out = [];
  for (const s of currentSignals || []) {
    const key = signalKey(s);
    if (!key || seen.has(key)) continue;
    const base = baselineByUrl.get(key);
    if (!base) continue;
    const a = `${s.headline || ''}|${(s.snippet || '').slice(0, 200)}`;
    const b = `${base.headline || ''}|${(base.snippet || '').slice(0, 200)}`;
    if (a !== b) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

/** URLs the manager already saw in the last published brief table. */
function publishedUrlKeys(signalsTableRows) {
  const keys = new Set();
  for (const r of signalsTableRows || []) {
    const key = signalKey(r.source_url || '');
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Net-new vs what was published in the last brief (not raw drop snapshot).
 * Use when the prior brief table was empty but intermediate drops had signals.
 */
function netNewVsPublished(signals, publishedKeys) {
  const seen = new Set();
  const out = [];
  for (const s of signals || []) {
    const key = signalKey(s);
    if (!key || publishedKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Walk every drop from after baselineDrop through latestDrop (inclusive) and
 * return signals whose URL was never published in the last brief table.
 */
function catchUpNetNewInDropWindow(dropIds, baselineDropId, latestDropId, loadSignals, publishedKeys) {
  const i0 = dropIds.indexOf(baselineDropId);
  const i1 = dropIds.indexOf(latestDropId);
  if (i1 === -1) return [];
  const start = i0 === -1 ? 0 : i0 + 1;
  const windowIds = dropIds.slice(start, i1 + 1);
  const seen = new Set();
  const out = [];

  for (const dropId of windowIds) {
    for (const s of loadSignals(dropId) || []) {
      const key = signalKey(s);
      if (!key || publishedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...s, _catchup_drop: dropId });
    }
  }
  return out;
}

/** Same URL already published in brief table but headline/snippet changed in latest collect. */
function contentChangedVsPublished(currentSignals, publishedTableRows) {
  const publishedByUrl = new Map();
  for (const r of publishedTableRows || []) {
    const key = signalKey(r.source_url || '');
    if (key) publishedByUrl.set(key, r);
  }
  const seen = new Set();
  const out = [];
  for (const s of currentSignals || []) {
    const key = signalKey(s);
    if (!key || seen.has(key)) continue;
    const pub = publishedByUrl.get(key);
    if (!pub) continue;
    const live = `${s.headline || ''}|${(s.snippet || '').slice(0, 200)}`;
    const prev = `${pub.headline || ''}|${(pub.why_routing || '').slice(0, 200)}`;
    if (live !== prev) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

/** Calendar days between last brief ready_at and now (America/Denver date). */
function calendarDaysSinceBriefReady(readyAtIso, mtCalendarDayFn) {
  if (!readyAtIso) return 999;
  const briefDay = mtCalendarDayFn(readyAtIso);
  const today = mtCalendarDayFn(new Date());
  const a = new Date(`${briefDay}T12:00:00Z`).getTime();
  const b = new Date(`${today}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

/**
 * Drop ids whose collect landed on Saturday or Sunday (America/Denver),
 * optionally only after lastBriefReadyAt.
 */
function weekendDropIds(dropIds, loadDropManifest, { afterReadyAt = null, mtWeekdayFn } = {}) {
  const afterMs = afterReadyAt ? new Date(afterReadyAt).getTime() : 0;
  return (dropIds || []).filter((id) => {
    const manifest = loadDropManifest(id) || {};
    const ts = manifest.created_at || id;
    if (afterMs && new Date(ts).getTime() <= afterMs) return false;
    return mtWeekdayFn(ts) === 0 || mtWeekdayFn(ts) === 6;
  });
}

/** All unique-URL signals from listed drops — no published-table filter (weekend rule). */
function allSignalsFromDrops(dropIds, loadSignals) {
  const seen = new Set();
  const out = [];
  for (const dropId of dropIds || []) {
    for (const s of loadSignals(dropId) || []) {
      const key = signalKey(s);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...s, _weekend_drop: dropId });
    }
  }
  return out;
}

/**
 * Monday rule: true when today is Monday MT and weekend drops since last brief
 * contain URLs not yet in the published table.
 */
function weekendIntelPendingForMonday(
  priorBrief,
  dropIds,
  loadDropManifest,
  loadSignals,
  loadSignalsTable,
  { mtWeekdayFn, isMondayFn, publishedUrlKeysFn },
) {
  if (!isMondayFn()) return { pending: false, weekendDropIds: [] };
  if (!priorBrief?.ready_at) return { pending: false, weekendDropIds: [] };

  const weekendIds = weekendDropIds(dropIds, loadDropManifest, {
    afterReadyAt: priorBrief.ready_at,
    mtWeekdayFn,
  });
  if (!weekendIds.length) return { pending: false, weekendDropIds: [] };

  const published = priorBrief.run_id ? loadSignalsTable(priorBrief.run_id) : [];
  const publishedKeys = publishedUrlKeysFn(published);
  const weekendSignals = allSignalsFromDrops(weekendIds, loadSignals);
  const unpublished = weekendSignals.filter((s) => !publishedKeys.has(signalKey(s)));

  return {
    pending: weekendIds.length > 0,
    weekendDropIds: weekendIds,
    weekendSignalCount: weekendSignals.length,
    unpublishedCount: unpublished.length,
  };
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

/** Product rows in a published table that still need agent parity + prototype pass. */
function countProductRowsPendingParity(signalsTable) {
  return (signalsTable || []).filter(
    (r) =>
      r.classification === 'Product' &&
      (r.parity === 'not_scanned' || !r.parity) &&
      !r.prototype_path,
  ).length;
}

module.exports = {
  signalKey,
  netNewBetween,
  contentChangedBetween,
  publishedUrlKeys,
  netNewVsPublished,
  catchUpNetNewInDropWindow,
  contentChangedVsPublished,
  calendarDaysSinceBriefReady,
  weekendDropIds,
  allSignalsFromDrops,
  weekendIntelPendingForMonday,
  predictProductCandidates,
  estimatePublishMinutes,
  countProductRowsPendingParity,
};
