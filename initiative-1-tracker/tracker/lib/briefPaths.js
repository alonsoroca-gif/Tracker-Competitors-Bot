/**
 * Paths and loaders for tracker-briefs (Billy-facing publish output).
 */

const fs = require('fs');
const path = require('path');

const trackerRoot = path.join(__dirname, '..');
const initiativeRoot = path.join(trackerRoot, '..');
const repoRoot = path.join(initiativeRoot, '..');
const briefsRoot = path.join(repoRoot, 'tracker-briefs');
const runsRoot = path.join(briefsRoot, 'runs');
const latestPath = path.join(briefsRoot, 'latest.json');
const runsIndexPath = path.join(briefsRoot, 'runs-index.json');
const dropsRoot = path.join(repoRoot, 'tracker-drops');

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

/** True when ready_at falls on today's calendar day in MT. */
function isBriefFreshForToday(readyAtIso) {
  if (!readyAtIso) return false;
  return mtCalendarDay(readyAtIso) === mtCalendarDay(new Date());
}

module.exports = {
  repoRoot,
  briefsRoot,
  runsRoot,
  latestPath,
  dropsRoot,
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
  isBriefFreshForToday,
};
