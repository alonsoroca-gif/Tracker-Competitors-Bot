/**
 * Net-new signal detection between drops (source_url diff).
 */

const crypto = require('crypto');

function signalKey(s) {
  // Accept either a signal/row object or a raw source_url string. Several callers
  // pass `row.source_url` directly; without the string branch this returned ''
  // for those, silently emptying publishedUrlKeys and disabling dedup.
  if (typeof s === 'string') return s.trim().toLowerCase();
  return ((s && s.source_url) || '').trim().toLowerCase();
}

/**
 * Stable content fingerprint for a signal or published row.
 * Hashes the page's own content (headline + snippet) so the same unchanged
 * page produces the same hash across drops. Used to tell a real content
 * refresh apart from a page we already published verbatim.
 */
function contentFingerprint(s) {
  const headline = String((s && s.headline) || '').trim().toLowerCase();
  const snippet = String((s && s.snippet) || '').trim().toLowerCase().slice(0, 200);
  return crypto.createHash('sha1').update(`${headline}|${snippet}`).digest('hex').slice(0, 16);
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

/** Same URL already published in brief table but the page content changed in latest collect. */
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
    let changed;
    if (pub.content_hash) {
      // Compare like-for-like: the page's content fingerprint, recomputed
      // from the live signal, against the hash stamped when it was published.
      changed = contentFingerprint(s) !== pub.content_hash;
    } else {
      // Legacy rows predate content_hash. Only re-surface on a real headline
      // change — never the old snippet-vs-why_routing mismatch, which compared
      // two different fields and so flagged every URL as "changed" every run.
      changed =
        String(s.headline || '').trim().toLowerCase() !==
        String(pub.headline || '').trim().toLowerCase();
    }
    if (changed) {
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

/** Whether a Product row finished parity + prototype (Existing skips prototype). */
function isProductPipelineComplete(row) {
  if (row?.classification !== 'Product') return true;
  const parity = String(row.parity || 'not_scanned').toLowerCase();
  if (!parity || parity === 'not_scanned' || parity === '—') return false;
  if (parity === 'existing') return true;
  if (parity === 'unknown' || parity === 'borderline') return false;
  if (parity === 'gap' || parity === 'partial') {
    // A prototype is only required for Tier-Now rows. Rows the publish
    // deliberately deferred (Later) or dropped (Won't chase) are complete once
    // scanned — deferral is a decision, not unfinished work. Without this, a
    // Tier-Later Gap row with no prototype made the kickoff gate re-trigger a
    // full republish on every run.
    const tierNow = String(row.tier || '').toLowerCase() === 'now';
    return tierNow ? Boolean(row.prototype_path) : true;
  }
  return Boolean(row.prototype_path);
}

/** Product rows missing Core parity and/or prototype (must not skip agent path). */
function countProductRowsIncompletePipeline(signalsTable) {
  return (signalsTable || []).filter(
    (r) => r.classification === 'Product' && !isProductPipelineComplete(r),
  ).length;
}

/** @deprecated alias — use countProductRowsIncompletePipeline */
function countProductRowsPendingParity(signalsTable) {
  return countProductRowsIncompletePipeline(signalsTable);
}

module.exports = {
  signalKey,
  contentFingerprint,
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
  countProductRowsIncompletePipeline,
  isProductPipelineComplete,
};
