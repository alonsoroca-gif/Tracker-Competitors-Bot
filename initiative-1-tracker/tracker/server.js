const path = require('path');
const fs = require('fs');
const express = require('express');
const { getReportData } = require('./lib/reportApi');
const { loadConfig } = require('./lib/loadConfig');
const { runFullCollect } = require('./lib/runCollectAll');
const { writeCollectMeta, COLLECT_META_FILE } = require('./lib/collectMeta');
const { buildWeeklyCoverageReport } = require('./lib/weeklyIntelFlow');
const { isSignalsEncryptionEnabled } = require('./lib/signalsAtRest');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const PROJECT_FOCUS_PATH = path.join(__dirname, 'config', 'project-focus.json');

function loadProjectFocus() {
  try {
    const raw = fs.readFileSync(PROJECT_FOCUS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Local UI: never let the browser reuse stale index.html/JS/CSS while iterating. */
app.use(
  express.static(PUBLIC, {
    etag: false,
    lastModified: false,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    },
  })
);

const SERVER_STARTED_AT = new Date().toISOString();

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('X-Tracker-Server-Started', SERVER_STARTED_AT);
  next();
});

app.get('/api/config', (req, res) => {
  try {
    const config = loadConfig();
    const projectFocus = loadProjectFocus();
    res.json({
      products: config.products || [],
      competitors: (config.competitors || []).map((c) => ({
        id: c.id,
        name: c.name,
        priority: c.priority || 'medium',
        website: c.website || null,
        focus: c.focus || null,
      })),
      projectFocus: projectFocus || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/report', (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
  const data = getReportData(days);
  res.json(data);
});

/** Phase A: one gap’s Cursor package (same shape as `gap.cursor_interpretation` on /api/report). */
app.get('/api/gap/:gapId/interpreter-payload', (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
  const gapId = decodeURIComponent(String(req.params.gapId || '').trim());
  if (!gapId) {
    return res.status(400).json({ error: 'missing_gap_id' });
  }
  const data = getReportData(days);
  if (data.error) {
    return res.status(500).json({ error: data.error });
  }
  const gaps = (data.report && data.report.gaps) || [];
  const gap = gaps.find((g) => g.gap_id === gapId);
  if (!gap || !gap.cursor_interpretation) {
    return res.status(404).json({ error: 'gap_not_found', gap_id: gapId });
  }
  res.json({
    gap_id: gapId,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    product: data.product,
    ...gap.cursor_interpretation,
  });
});

/** Which intel pillars have configured sources per competitor (no network). */
app.get('/api/weekly-coverage', (req, res) => {
  try {
    res.json(buildWeeklyCoverageReport());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Last collect run (written after POST /api/collect). */
app.get('/api/collect-status', (req, res) => {
  try {
    if (!fs.existsSync(COLLECT_META_FILE)) {
      return res.json({ last_collected_at: null, signals_stored: null, last_run_intel: null });
    }
    const meta = JSON.parse(fs.readFileSync(COLLECT_META_FILE, 'utf8'));
    res.json({
      last_collected_at: meta.last_collected_at || null,
      signals_stored: meta.signals_stored != null ? meta.signals_stored : null,
      retention_days: meta.retention_days != null ? meta.retention_days : null,
      signals_kept: meta.signals_kept != null ? meta.signals_kept : null,
      signals_encrypted_at_rest: isSignalsEncryptionEnabled(),
      last_run_intel: meta.last_run_intel || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Run the full collect pipeline (all products × competitors), merge into storage.
 * Viewer can trigger this from the UI via "Refresh data". May take 1–2 minutes.
 */
app.post('/api/collect', (req, res) => {
  const COLLECT_TIMEOUT_MS = 5 * 60 * 1000;
  req.setTimeout(COLLECT_TIMEOUT_MS);
  res.setTimeout(COLLECT_TIMEOUT_MS);
  const retentionDays = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));

  (async () => {
    const { newCount, pruned, intelMeta } = await runFullCollect(retentionDays);
    try {
      writeCollectMeta({
        newCount,
        pruned,
        retentionDays,
        intelMeta,
      });
    } catch (e) {
      console.error('collect-meta write failed:', e.message);
    }
    return {
      ok: true,
      signalsStored: newCount,
      retentionDays,
      signalsKept: pruned.kept,
      signalsRemovedByRetention: pruned.removed,
      last_run_intel: intelMeta,
    };
  })()
    .then((data) => res.json(data))
    .catch((err) => {
      console.error('Collect API error:', err);
      res.status(500).json({ ok: false, error: err.message });
    });
});

app.listen(PORT, () => {
  console.log(`Tracker report UI: http://localhost:${PORT}`);
});
