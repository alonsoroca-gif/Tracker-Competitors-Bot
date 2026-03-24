const path = require('path');
const fs = require('fs');
const express = require('express');
const { getReportData } = require('./lib/reportApi');
const { loadConfig } = require('./lib/loadConfig');
const { collect } = require('./lib/collect');
const { writeSignals, pruneSignalsToRetentionDays } = require('./lib/storage');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const COLLECT_META_FILE = path.join(DATA_DIR, 'collect-meta.json');
const PROJECT_FOCUS_PATH = path.join(__dirname, 'config', 'project-focus.json');

function loadProjectFocus() {
  try {
    const raw = fs.readFileSync(PROJECT_FOCUS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

app.use(express.static(PUBLIC));

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

/** Last collect run (written after POST /api/collect). */
app.get('/api/collect-status', (req, res) => {
  try {
    if (!fs.existsSync(COLLECT_META_FILE)) {
      return res.json({ last_collected_at: null, signals_stored: null });
    }
    const meta = JSON.parse(fs.readFileSync(COLLECT_META_FILE, 'utf8'));
    res.json({
      last_collected_at: meta.last_collected_at || null,
      signals_stored: meta.signals_stored != null ? meta.signals_stored : null,
      retention_days: meta.retention_days != null ? meta.retention_days : null,
      signals_kept: meta.signals_kept != null ? meta.signals_kept : null,
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
    const config = loadConfig();
    let newSignals = 0;
    for (const product of config.products) {
      for (const competitor of config.competitors) {
        const signals = await collect(competitor.id, product.id, retentionDays);
        if (signals.length > 0) {
          const { added } = writeSignals(signals, false);
          newSignals += added;
        }
      }
    }
    const pruned = pruneSignalsToRetentionDays(retentionDays);
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(
        COLLECT_META_FILE,
        JSON.stringify(
          {
            last_collected_at: new Date().toISOString(),
            signals_stored: newSignals,
            retention_days: retentionDays,
            signals_kept: pruned.kept,
            signals_removed_retention: pruned.removed,
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (e) {
      console.error('collect-meta write failed:', e.message);
    }
    return {
      ok: true,
      signalsStored: newSignals,
      retentionDays,
      signalsKept: pruned.kept,
      signalsRemovedByRetention: pruned.removed,
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
