const path = require('path');
const fs = require('fs');
const { readSignalsArray, writeSignalsArray } = require('./signalsAtRest');
const { CHANGELOG_LOOKBACK_DAYS } = require('./splitPageSubrows');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SIGNALS_FILE = path.join(DATA_DIR, 'signals.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** YYYY-MM-DD cutoff for "keep signals on or after this date" (same logic as reportApi getPeriodDays). */
function retentionCutoffDate(days) {
  const d = Math.min(365, Math.max(1, parseInt(days, 10) || 7));
  const start = new Date();
  start.setDate(start.getDate() - d);
  return start.toISOString().slice(0, 10);
}

/**
 * Drop stored signals older than the rolling window (inclusive of cutoff date).
 * Changelog / feed-pinned release rows keep a longer window so capability splits
 * are not deleted right after collect (RSS pubDate can be weeks old).
 * @returns {{ kept: number, removed: number }}
 */
function pruneSignalsToRetentionDays(days) {
  ensureDataDir();
  if (!fs.existsSync(SIGNALS_FILE)) return { kept: 0, removed: 0 };
  const baseDays = Math.min(365, Math.max(1, parseInt(days, 10) || 7));
  const baseCutoff = retentionCutoffDate(baseDays);
  const changelogCutoff = retentionCutoffDate(Math.max(baseDays, CHANGELOG_LOOKBACK_DAYS));
  const list = readSignalsArray(SIGNALS_FILE);
  if (!Array.isArray(list) || !list.length) return { kept: 0, removed: 0 };
  const before = list.length;
  const keptList = list.filter((s) => {
    if (!s || typeof s.date !== 'string') return false;
    if (s.metadata && s.metadata.feed_pinned) return true;
    const cutoff =
      s.type === 'changelog' || s.source === 'changelog' ? changelogCutoff : baseCutoff;
    return s.date >= cutoff;
  });
  writeSignalsArray(SIGNALS_FILE, keptList);
  return { kept: keptList.length, removed: before - keptList.length };
}

/**
 * Append or replace signals in storage. If replace is true, overwrites; else merges by (date, competitor_id, product_id, type, snippet) and writes.
 * @returns {{ total: number, added: number }}
 */
function writeSignals(signals, replace = false) {
  ensureDataDir();
  let existing = [];
  if (!replace && fs.existsSync(SIGNALS_FILE)) {
    existing = readSignalsArray(SIGNALS_FILE);
  }
  if (!Array.isArray(existing)) existing = [];

  let added = 0;
  if (replace) {
    existing = Array.isArray(signals) ? signals.slice() : [];
    added = existing.length;
  } else {
    const key = (s) =>
      `${s.date}|${s.competitor_id}|${s.product_id}|${s.type}|${
        (s.metadata && s.metadata.capability_key) || ''
      }|${(s.snippet || '').slice(0, 80)}`;
    const seen = new Set(existing.map(key));
    for (const s of signals) {
      if (!seen.has(key(s))) {
        existing.push(s);
        seen.add(key(s));
        added++;
      }
    }
  }
  writeSignalsArray(SIGNALS_FILE, existing);
  return { total: existing.length, added };
}

/**
 * Read signals from storage for productId between periodStart and periodEnd (inclusive, YYYY-MM-DD).
 */
function getSignals(productId, periodStart, periodEnd) {
  if (!fs.existsSync(SIGNALS_FILE)) return [];
  const list = readSignalsArray(SIGNALS_FILE);
  if (!Array.isArray(list)) return [];
  return list.filter(
    (s) => s.product_id === productId && s.date >= periodStart && s.date <= periodEnd
  );
}

module.exports = { writeSignals, getSignals, pruneSignalsToRetentionDays, retentionCutoffDate, SIGNALS_FILE };
