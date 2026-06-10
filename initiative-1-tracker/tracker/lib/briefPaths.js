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
};
