const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const COLLECT_META_FILE = path.join(DATA_DIR, 'collect-meta.json');

/**
 * @param {{ newCount: number, pruned: { kept: number, removed: number }, retentionDays: number, intelMeta: object }} opts
 */
function writeCollectMeta({ newCount, pruned, retentionDays, intelMeta }) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    COLLECT_META_FILE,
    JSON.stringify(
      {
        last_collected_at: new Date().toISOString(),
        signals_stored: newCount,
        retention_days: retentionDays,
        signals_kept: pruned.kept,
        signals_removed_retention: pruned.removed,
        last_run_intel: intelMeta || null,
      },
      null,
      2
    ),
    'utf8'
  );
}

module.exports = { writeCollectMeta, COLLECT_META_FILE, DATA_DIR };
