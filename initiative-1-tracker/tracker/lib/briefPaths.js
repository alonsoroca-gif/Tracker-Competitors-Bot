/**
 * Paths and loaders for tracker-briefs (Billy-facing publish output).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const trackerRoot = path.join(__dirname, '..');
const initiativeRoot = path.join(trackerRoot, '..');
const repoRoot = path.join(initiativeRoot, '..');
const briefsRoot = path.join(repoRoot, 'tracker-briefs');
const runsRoot = path.join(briefsRoot, 'runs');
const latestPath = path.join(briefsRoot, 'latest.json');
const runsIndexPath = path.join(briefsRoot, 'runs-index.json');
const prototypeRegistryPath = path.join(briefsRoot, 'prototype-registry.json');
const dropsRoot = path.join(repoRoot, 'tracker-drops');

/** Stable key so Quiet-day empty prototypes.json cannot erase "already shipped". */
function stablePrototypeKey(p) {
  const id = String(p?.id || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const title = String(p?.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const competitor = String(p?.competitor_id || p?.competitor || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const slug = id || title || 'unknown';
  return `${competitor || 'any'}::${slug}`;
}

function loadPrototypeRegistry() {
  return readJson(prototypeRegistryPath, { version: 1, entries: {} });
}

/**
 * Persist first-shipped prototypes across quiet days. Keys are stablePrototypeKey
 * values; also index by bare id for older rows. Call after annotateCarriedOver.
 */
function upsertPrototypeRegistry(runId, prototypes, publishedAt = null) {
  const reg = loadPrototypeRegistry();
  if (!reg.entries || typeof reg.entries !== 'object') reg.entries = {};
  let wrote = false;
  for (const p of prototypes || []) {
    if (!p?.id && !p?.title) continue;
    const key = stablePrototypeKey(p);
    const fp = prototypeContentFingerprint(p);
    const existing = reg.entries[key] || (p.id ? reg.entries[p.id] : null);
    if (!existing) {
      reg.entries[key] = {
        id: p.id || null,
        title: p.title || null,
        competitor_id: p.competitor_id || null,
        first_shipped_run: runId,
        first_shipped_at: publishedAt || new Date().toISOString(),
        fingerprint: fp,
      };
      if (p.id && p.id !== key) {
        reg.entries[p.id] = { ...reg.entries[key], alias_of: key };
      }
      wrote = true;
    } else if (existing.fingerprint !== fp) {
      // Keep first_shipped_*; record latest content fingerprint for change detection.
      const targetKey = existing.alias_of || key;
      const target = reg.entries[targetKey] || existing;
      target.latest_fingerprint = fp;
      target.latest_run = runId;
      reg.entries[targetKey] = target;
      wrote = true;
    }
  }
  if (wrote) writeJson(prototypeRegistryPath, reg);
  return reg;
}

function registryLookup(p, reg) {
  const entries = reg?.entries || {};
  const key = stablePrototypeKey(p);
  if (entries[key] && !entries[key].alias_of) return { key, entry: entries[key] };
  if (p?.id && entries[p.id]) {
    const e = entries[p.id];
    if (e.alias_of && entries[e.alias_of]) return { key: e.alias_of, entry: entries[e.alias_of] };
    return { key: p.id, entry: e };
  }
  // Title-only fallback: match any entry with same normalized title (id drift).
  const titleSlug = String(p?.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (titleSlug) {
    for (const [k, e] of Object.entries(entries)) {
      if (e.alias_of) continue;
      const et = String(e.title || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (et === titleSlug || k.endsWith(`::${titleSlug}`)) return { key: k, entry: e };
    }
  }
  return null;
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function runDir(runId) {
  return path.join(runsRoot, runId);
}

function loadLatest() {
  return readJson(latestPath);
}

function loadRunManifest(runId) {
  return readJson(path.join(runDir(runId), 'manifest.json'));
}

function loadSignalsTable(runId) {
  return readJson(path.join(runDir(runId), 'signals-table.json'), []);
}

function loadPrototypes(runId) {
  return readJson(path.join(runDir(runId), 'prototypes.json'), []);
}

function loadDropManifest(runId) {
  return readJson(path.join(dropsRoot, runId, 'manifest.json'));
}

function readLatestDropId() {
  try {
    return fs.readFileSync(path.join(dropsRoot, '.latest-drop-id'), 'utf8').trim();
  } catch {
    return null;
  }
}

function listDropIds() {
  try {
    return fs
      .readdirSync(dropsRoot)
      .filter((f) => /^\d{4}-\d{2}-\d{2}T/.test(f))
      .sort();
  } catch {
    return [];
  }
}

function priorDropId(runId) {
  const drops = listDropIds();
  const idx = drops.indexOf(runId);
  return idx > 0 ? drops[idx - 1] : null;
}

function loadDropSignals(runId) {
  return readJson(path.join(dropsRoot, runId, 'signals.json'), []);
}

function listBriefRunIds() {
  try {
    return fs
      .readdirSync(runsRoot)
      .filter((f) => {
        if (f.startsWith('_')) return true;
        return /^\d{4}-\d{2}-\d{2}T/.test(f);
      })
      .filter((f) => fs.existsSync(path.join(runsRoot, f, 'manifest.json')))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** Refresh runs-index.json for viewer run dropdown (past briefs). */
function refreshRunsIndex() {
  const runs = listBriefRunIds().map((runId) => {
    const m = loadRunManifest(runId) || {};
    return {
      run_id: runId,
      published_at: m.published_at || null,
      day_type: m.day_type || null,
      net_new_count: m.net_new_count ?? 0,
      prototype_count: m.prototype_count ?? 0,
      summary: m.summary || null,
      fixture: Boolean(m.source === 'fixture-product-day' || runId.startsWith('_')),
    };
  });
  writeJson(runsIndexPath, { updated_at: new Date().toISOString(), runs });
  return runs;
}

function loadRunsIndex() {
  const idx = readJson(runsIndexPath);
  if (idx?.runs?.length) return idx;
  return { runs: refreshRunsIndex() };
}

/** Calendar day in America/Denver (YYYY-MM-DD). */
function mtCalendarDay(isoOrDate = new Date()) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** 0=Sun … 6=Sat in America/Denver. */
function mtWeekday(isoOrDate = new Date()) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    weekday: 'short',
  }).format(d);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[short] ?? null;
}

function isMondayMt(isoOrDate = new Date()) {
  return mtWeekday(isoOrDate) === 1;
}

function isWeekendMt(isoOrDate = new Date()) {
  const w = mtWeekday(isoOrDate);
  return w === 0 || w === 6;
}

/** True when ready_at falls on today's calendar day in MT. */
function isBriefFreshForToday(readyAtIso) {
  if (!readyAtIso) return false;
  return mtCalendarDay(readyAtIso) === mtCalendarDay(new Date());
}

/**
 * Run id of the most recent real brief published strictly before currentRunId.
 * Used as the baseline for "what did the manager already see" diffing.
 */
function priorPublishedRunId(currentRunId) {
  const currentManifest = loadRunManifest(currentRunId) || {};
  const currentPublishedAt = currentManifest.published_at || null;
  // listBriefRunIds() is newest-first.
  for (const runId of listBriefRunIds()) {
    if (runId === currentRunId || runId.startsWith('_')) continue;
    const publishedAt = (loadRunManifest(runId) || {}).published_at || null;
    if (!currentPublishedAt || !publishedAt || publishedAt < currentPublishedAt) {
      return runId;
    }
  }
  return null;
}

/**
 * Map of prototype id -> { run_id, published_at } for the EARLIEST published run
 * that shipped it, considering only runs published strictly before `currentRunId`.
 * Lets the renderer tell a net-new prototype from one carried forward across days
 * without trusting a flag the publish agent may forget to set.
 */
function prototypeFirstSeenBefore(currentRunId) {
  const currentManifest = loadRunManifest(currentRunId) || {};
  const currentPublishedAt = currentManifest.published_at || null;
  const firstSeen = {};
  // listBriefRunIds() is newest-first; iterate oldest-first so the first write wins.
  for (const runId of listBriefRunIds().reverse()) {
    if (runId === currentRunId || runId.startsWith('_')) continue;
    const manifest = loadRunManifest(runId) || {};
    const publishedAt = manifest.published_at || null;
    // Only count runs that were published before this one.
    if (currentPublishedAt && publishedAt && publishedAt >= currentPublishedAt) continue;
    for (const proto of loadPrototypes(runId) || []) {
      if (proto?.id && !firstSeen[proto.id]) {
        firstSeen[proto.id] = { run_id: runId, published_at: publishedAt };
      }
    }
  }
  return firstSeen;
}

/** Content fingerprint of a prototype, excluding run-id-bearing paths. */
function prototypeContentFingerprint(p) {
  const blob = JSON.stringify({ title: p?.title, brief: p?.brief, roi: p?.roi });
  return crypto.createHash('sha1').update(blob).digest('hex').slice(0, 16);
}

/**
 * Annotate prototypes with carried_over / changed / first_shipped. A prototype
 * re-surfaced from an earlier run is `carried_over`; if its content differs from
 * the first-shipped version it is also `changed` (an update worth showing). An
 * unchanged carry-forward is noise and gets suppressed by the renderer.
 *
 * Quiet days used to wipe memory (empty prototypes.json → next Partial rebuild
 * looked "new"). The persistent prototype-registry.json + stable keys survive
 * those empty days so SightMap-style regenerations stay hidden unless content
 * actually moved.
 */
function annotateCarriedOver(currentRunId, prototypes) {
  const firstSeen = prototypeFirstSeenBefore(currentRunId);
  const reg = loadPrototypeRegistry();
  return (prototypes || []).map((p) => {
    const prior = p?.id ? firstSeen[p.id] : null;
    const regHit = registryLookup(p, reg);

    if (!prior && !regHit) {
      return { ...p, carried_over: false, changed: true };
    }

    let firstProto = null;
    let first_shipped_run = null;
    let first_shipped_at = null;
    let baselineFp = null;

    if (prior) {
      first_shipped_run = prior.run_id;
      first_shipped_at = prior.published_at;
      firstProto = (loadPrototypes(prior.run_id) || []).find((x) => x.id === p.id);
      if (firstProto) baselineFp = prototypeContentFingerprint(firstProto);
    }

    if (regHit?.entry) {
      first_shipped_run = first_shipped_run || regHit.entry.first_shipped_run;
      first_shipped_at = first_shipped_at || regHit.entry.first_shipped_at;
      baselineFp = baselineFp || regHit.entry.fingerprint;
    }

    const currentFp = prototypeContentFingerprint(p);
    const changed = !baselineFp ? true : currentFp !== baselineFp;

    return {
      ...p,
      carried_over: true,
      changed,
      first_shipped_run,
      first_shipped_at,
    };
  });
}

/** Drop id the last published brief was built from (kickoff net-new baseline). */
function lastPublishedBriefDropId(latest) {
  const brief = latest || loadLatest();
  if (!brief?.run_id) return null;
  const manifest = loadRunManifest(brief.run_id);
  return manifest?.drop_run_id || brief.run_id;
}

module.exports = {
  repoRoot,
  briefsRoot,
  runsRoot,
  latestPath,
  dropsRoot,
  prototypeRegistryPath,
  readJson,
  writeJson,
  runDir,
  loadLatest,
  loadRunManifest,
  loadSignalsTable,
  loadPrototypes,
  loadDropManifest,
  readLatestDropId,
  listDropIds,
  priorDropId,
  loadDropSignals,
  runsIndexPath,
  listBriefRunIds,
  refreshRunsIndex,
  loadRunsIndex,
  mtCalendarDay,
  mtWeekday,
  isMondayMt,
  isWeekendMt,
  isBriefFreshForToday,
  priorPublishedRunId,
  prototypeFirstSeenBefore,
  prototypeContentFingerprint,
  stablePrototypeKey,
  loadPrototypeRegistry,
  upsertPrototypeRegistry,
  registryLookup,
  annotateCarriedOver,
  lastPublishedBriefDropId,
};
