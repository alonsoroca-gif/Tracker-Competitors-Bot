#!/usr/bin/env node
/**
 * Carryover spotlight — surfaces still-fresh, high-importance signals from the
 * rolling 7-day window that the strict "vs prior drop" diff in Phase 4 would
 * otherwise suppress.
 *
 * Why this exists: the Phase 4 net-new diff in tracker-drop-cycle compares
 * latest drop -> immediately prior drop only. If a meaningful Product release
 * landed 3 cycles ago and has been carried forward unchanged since, the manager
 * never sees it again unless they reach for raw signals.json. This script is
 * the §4.1b block that fixes that.
 *
 * Run from <repo-root>:
 *   node initiative-1-tracker/tracker/scripts/carryover-spotlight.js
 *
 * Trigger logic (added 2026-06-08): the spotlight no longer fires
 * unconditionally. It evaluates four triggers against the interpretation
 * pointer (`tracker-drops/.last-interpreted-drop-id`) and only emits the
 * full markdown table if at least one fires. Otherwise it prints a single-
 * line "skipped — pointer up-to-date" note. Triggers (any one fires):
 *
 *   1. First run        — no pointer file exists yet
 *   2. Calendar gap     — dateOf(latest drop) − dateOf(pointer drop) ≥ N days
 *                         (default N = 2; covers weekend / sick / vacation)
 *   3. High coverage    — drops between pointer and latest ≥ M
 *                         (default M = 6; backstop for cron-burst cases
 *                         where calendar math undercounts)
 *   4. Forced           — --force flag (manual audit / debug)
 *
 * Optional flags:
 *   --min-importance <0..1>      default 0.7
 *   --window-days <N>            default 7
 *   --top <N>                    default 5    (cap on rows printed)
 *   --json                       machine-readable output instead of markdown
 *   --include-net-new            also include rows first-seen in latest drop
 *                                (default: only carryovers — net-new lives in §4.2)
 *   --drop-id <id>               override latest drop id (default: read from
 *                                tracker-drops/.latest-drop-id)
 *   --gap-days <N>               trigger threshold (default 2)
 *   --coverage-threshold <N>     trigger threshold (default 6)
 *   --force, --always            ignore triggers; always print full output
 *
 * Exit codes:
 *   0  — success (markdown or JSON written to stdout, regardless of fire/skip)
 *   1  — no drops found / cannot read .latest-drop-id
 *   2  — bad flag value
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DROPS_ROOT = path.join(REPO_ROOT, 'tracker-drops');
const LATEST_PTR = path.join(DROPS_ROOT, '.latest-drop-id');
const INTERPRETED_PTR = path.join(DROPS_ROOT, '.last-interpreted-drop-id');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ------------ CLI parsing ----------------------------------------------------

function parseArgs(argv) {
  const args = {
    minImportance: 0.7,
    windowDays: 7,
    top: 5,
    json: false,
    includeNetNew: false,
    dropId: null,
    gapDays: 2,
    coverageThreshold: 6,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--min-importance') {
      const v = parseFloat(argv[++i]);
      if (Number.isNaN(v) || v < 0 || v > 1) {
        process.stderr.write(`carryover-spotlight: bad --min-importance "${argv[i]}"\n`);
        process.exit(2);
      }
      args.minImportance = v;
    } else if (a === '--window-days') {
      const v = parseInt(argv[++i], 10);
      if (Number.isNaN(v) || v < 1 || v > 90) {
        process.stderr.write(`carryover-spotlight: bad --window-days "${argv[i]}"\n`);
        process.exit(2);
      }
      args.windowDays = v;
    } else if (a === '--top') {
      const v = parseInt(argv[++i], 10);
      if (Number.isNaN(v) || v < 1) {
        process.stderr.write(`carryover-spotlight: bad --top "${argv[i]}"\n`);
        process.exit(2);
      }
      args.top = v;
    } else if (a === '--json') {
      args.json = true;
    } else if (a === '--include-net-new') {
      args.includeNetNew = true;
    } else if (a === '--drop-id') {
      args.dropId = argv[++i];
    } else if (a === '--gap-days') {
      const v = parseInt(argv[++i], 10);
      if (Number.isNaN(v) || v < 0 || v > 365) {
        process.stderr.write(`carryover-spotlight: bad --gap-days "${argv[i]}"\n`);
        process.exit(2);
      }
      args.gapDays = v;
    } else if (a === '--coverage-threshold') {
      const v = parseInt(argv[++i], 10);
      if (Number.isNaN(v) || v < 0) {
        process.stderr.write(`carryover-spotlight: bad --coverage-threshold "${argv[i]}"\n`);
        process.exit(2);
      }
      args.coverageThreshold = v;
    } else if (a === '--force' || a === '--always') {
      args.force = true;
    } else {
      process.stderr.write(`carryover-spotlight: unknown flag "${a}"\n`);
      process.exit(2);
    }
  }
  return args;
}

// ------------ helpers --------------------------------------------------------

function listDrops() {
  if (!fs.existsSync(DROPS_ROOT)) return [];
  return fs
    .readdirSync(DROPS_ROOT)
    .filter((f) => /^\d{4}-/.test(f))
    .sort();
}

function readSignals(dropId) {
  const p = path.join(DROPS_ROOT, dropId, 'signals.json');
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function dedupByCompetitorUrl(rows) {
  // Keep the row with the highest importance per (competitor_id, source_url).
  // The publish-drop pipeline emits ~11 rows per scrape because of the
  // product-fan-out in runCollectAll.js (one tagged copy per Entrata product).
  const m = new Map();
  for (const r of rows) {
    const k = `${r.competitor_id}::${r.source_url}`;
    const cur = m.get(k);
    if (!cur || (r.importance || 0) > (cur.importance || 0)) m.set(k, r);
  }
  return m;
}

function evidenceHash(row) {
  return crypto.createHash('md5').update(row.evidence_snippet || '').digest('hex');
}

// Lanes that are stable home-page boilerplate by nature — high importance is
// not informative. Reviewer signals (case_studies, reviews_other, changelog,
// pricing_page) are kept because content there does evolve.
const NOISY_LANES = new Set(['features_page', 'articles_index', 'careers']);

function readLatestId() {
  if (!fs.existsSync(LATEST_PTR)) return null;
  return fs.readFileSync(LATEST_PTR, 'utf8').trim() || null;
}

function readInterpretedId() {
  if (!fs.existsSync(INTERPRETED_PTR)) return null;
  return fs.readFileSync(INTERPRETED_PTR, 'utf8').trim() || null;
}

// Convert ms-since-epoch to a UTC calendar-day key (ms at UTC midnight).
function toCalendarDayUTC(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Parse a tracker drop ID (e.g. "2026-06-02T00-10-59Z") into ms-since-epoch.
// We MUST derive the calendar timestamp from the ID, not from filesystem mtime —
// git checkout / pull rewrites every file's mtime to the checkout time, which
// would clamp every drop's mtime to the same calendar day after a fresh clone
// or pull and silently break the calendar-gap trigger. The drop ID itself is
// the only stable record of when the drop was originally collected.
//
// Returns NaN if the ID is malformed (caller should treat as "unknown date" and
// fall back conservatively — typically by firing the spotlight rather than
// suppressing it).
function parseDropIdToMs(dropId) {
  if (!dropId || typeof dropId !== 'string') return NaN;
  // ID format: 2026-06-02T00-10-59Z  →  2026-06-02T00:10:59Z (valid ISO)
  const iso = dropId.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/, '$1T$2:$3:$4Z');
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

// ------------ trigger evaluation --------------------------------------------

// Decide whether the spotlight should fire this run. Returns:
//   { fire: bool, reason: string, gapDays: number|null, coverage: number|null,
//     pointer: string|null, latestId: string|null }
function evaluateTriggers(args) {
  const drops = listDrops();
  if (drops.length === 0) {
    return { fire: false, reason: 'no-drops', gapDays: null, coverage: null, pointer: null, latestId: null };
  }
  const latestId = args.dropId || readLatestId();
  if (!latestId) {
    return { fire: false, reason: 'no-latest', gapDays: null, coverage: null, pointer: null, latestId: null };
  }
  if (args.force) {
    return { fire: true, reason: 'forced', gapDays: null, coverage: null, pointer: readInterpretedId(), latestId };
  }
  const pointer = readInterpretedId();
  if (!pointer) {
    return { fire: true, reason: 'first-run', gapDays: null, coverage: null, pointer: null, latestId };
  }
  if (!drops.includes(pointer)) {
    // Pointer points to a drop that was pruned out of the window. Treat as
    // a recoverable first-run condition — fire the spotlight, and the next
    // §4.7 mark will reset the pointer.
    return { fire: true, reason: 'pointer-pruned', gapDays: null, coverage: null, pointer, latestId };
  }
  if (pointer === latestId) {
    return { fire: false, reason: 'pointer-up-to-date', gapDays: 0, coverage: 0, pointer, latestId };
  }
  // Calendar-gap math uses the drop ID timestamps, NOT filesystem mtimes.
  // git checkout / pull rewrites mtimes; only the ID is stable across clones.
  const latestMs = parseDropIdToMs(latestId);
  const pointerMs = parseDropIdToMs(pointer);
  let gapDays = null;
  if (Number.isFinite(latestMs) && Number.isFinite(pointerMs)) {
    gapDays = Math.floor(
      (toCalendarDayUTC(latestMs) - toCalendarDayUTC(pointerMs)) / MS_PER_DAY
    );
  }
  const coverage = drops.indexOf(latestId) - drops.indexOf(pointer);

  if (gapDays === null) {
    // ID parse failure on either side — fire conservatively rather than
    // letting a malformed ID silently suppress the safety net.
    return { fire: true, reason: 'unparseable-drop-id', gapDays: null, coverage, pointer, latestId };
  }
  if (gapDays >= args.gapDays) {
    return { fire: true, reason: `calendar-gap=${gapDays}d`, gapDays, coverage, pointer, latestId };
  }
  if (coverage >= args.coverageThreshold) {
    return { fire: true, reason: `high-coverage=${coverage}-drops`, gapDays, coverage, pointer, latestId };
  }
  return { fire: false, reason: 'pointer-up-to-date', gapDays, coverage, pointer, latestId };
}

// ------------ core analysis --------------------------------------------------

function buildSpotlight(args) {
  const drops = listDrops();
  if (drops.length === 0) {
    process.stderr.write('carryover-spotlight: no drops found under tracker-drops/\n');
    process.exit(1);
  }

  let latestId = args.dropId;
  if (!latestId) {
    const ptr = path.join(DROPS_ROOT, '.latest-drop-id');
    if (!fs.existsSync(ptr)) {
      process.stderr.write('carryover-spotlight: tracker-drops/.latest-drop-id missing\n');
      process.exit(1);
    }
    latestId = fs.readFileSync(ptr, 'utf8').trim();
  }
  const latestIdx = drops.indexOf(latestId);
  if (latestIdx === -1) {
    process.stderr.write(`carryover-spotlight: drop "${latestId}" not in tracker-drops/\n`);
    process.exit(1);
  }

  // Build a true "first-seen-ever" map by walking ALL drops chronologically
  // up to and including the latest. We need this to distinguish:
  //   - signals that genuinely arrived inside the window (spotlight material)
  //   - signals that have been carrying forever and just happen to also be in
  //     the window's mtime range (stable boilerplate — exclude)
  const latestStat = fs.statSync(path.join(DROPS_ROOT, latestId));
  const windowFloorMs = latestStat.mtimeMs - args.windowDays * 24 * 60 * 60 * 1000;

  const firstSeen = new Map(); // sig -> { dropId, dropIdx, mtimeMs }
  for (let i = 0; i <= latestIdx; i++) {
    const d = drops[i];
    const stat = fs.statSync(path.join(DROPS_ROOT, d));
    const dm = dedupByCompetitorUrl(readSignals(d));
    for (const [k, r] of dm) {
      const sig = `${k}::${evidenceHash(r)}`;
      if (!firstSeen.has(sig)) {
        firstSeen.set(sig, { dropId: d, dropIdx: i, mtimeMs: stat.mtimeMs });
      }
    }
  }

  const latestMap = dedupByCompetitorUrl(readSignals(latestId));
  const candidates = [];
  for (const [k, r] of latestMap) {
    const importance = r.importance || 0;
    if (importance < args.minImportance) continue;
    if (NOISY_LANES.has(r.source)) continue;
    const sig = `${k}::${evidenceHash(r)}`;
    const fs_ = firstSeen.get(sig);
    const firstSeenMs = fs_ ? fs_.mtimeMs : latestStat.mtimeMs;
    const inWindow = firstSeenMs >= windowFloorMs;
    if (!inWindow) continue; // signal has been carrying since before window — stale
    const isNetNew = fs_ ? fs_.dropId === latestId : true;
    if (isNetNew && !args.includeNetNew) continue;
    candidates.push({
      key: k,
      row: r,
      firstSeenDropId: fs_ ? fs_.dropId : latestId,
      ageDrops: fs_ ? latestIdx - fs_.dropIdx : 0,
      isNetNew,
    });
  }

  candidates.sort((a, b) => {
    // Highest importance first; tie-break by oldest first-seen (i.e. most
    // suppressed by the strict diff).
    const di = (b.row.importance || 0) - (a.row.importance || 0);
    if (di !== 0) return di;
    return b.ageDrops - a.ageDrops;
  });

  return {
    latestId,
    windowDays: args.windowDays,
    minImportance: args.minImportance,
    totalCandidates: candidates.length,
    rows: candidates.slice(0, args.top),
  };
}

// ------------ output formatters ---------------------------------------------

function triggerHeaderLine(trigger) {
  // The trigger reason already encodes the firing condition value (e.g.
  // "calendar-gap=7d" or "high-coverage=9-drops"), so the supplementary
  // metrics are only added if they are NOT already conveyed by the reason.
  const parts = [`trigger=${trigger.reason}`];
  const reasonHasGap = /^calendar-gap=/.test(trigger.reason);
  const reasonHasCoverage = /^high-coverage=/.test(trigger.reason);
  if (!reasonHasGap && trigger.gapDays !== null && trigger.gapDays !== undefined)
    parts.push(`calendar-gap=${trigger.gapDays}d`);
  if (!reasonHasCoverage && trigger.coverage !== null && trigger.coverage !== undefined)
    parts.push(`coverage=${trigger.coverage}-drops`);
  if (trigger.pointer) parts.push(`pointer=${trigger.pointer}`);
  return `Spotlight fired (${parts.join(', ')}).`;
}

function fmtMarkdown(result, trigger) {
  const out = [];
  out.push(triggerHeaderLine(trigger));
  out.push('');
  if (result.rows.length === 0) {
    out.push(
      `_No carryover signals in the last ${result.windowDays} days at importance ≥ ${result.minImportance}. The strict prior-drop diff is sufficient this cycle._`
    );
    return out.join('\n');
  }
  out.push(
    `Top ${result.rows.length} of ${result.totalCandidates} carryover candidates ` +
      `(window=${result.windowDays}d, importance≥${result.minImportance}, excluded lanes: features_page/articles_index/careers).`
  );
  out.push('');
  out.push('| # | First seen | Age | Importance | Competitor / lane | Headline |');
  out.push('|---|---|---|---|---|---|');
  result.rows.forEach((c, i) => {
    const head = (c.row.headline || '').replace(/\|/g, '\\|').slice(0, 70);
    const age = c.isNetNew ? '🆕 net-new' : `${c.ageDrops} drops ago`;
    out.push(
      `| ${i + 1} | ${c.firstSeenDropId} | ${age} | ${(c.row.importance || 0).toFixed(2)} | ${c.row.competitor_id} / ${c.row.source} | ${head} |`
    );
  });
  out.push('');
  out.push('Source URLs:');
  result.rows.forEach((c, i) => {
    out.push(`${i + 1}. ${c.row.source_url}`);
  });
  return out.join('\n');
}

function formatSkip(trigger) {
  if (trigger.reason === 'no-drops') {
    return '§4.1b Spotlight: skipped — no drops found under tracker-drops/.';
  }
  if (trigger.reason === 'no-latest') {
    return '§4.1b Spotlight: skipped — tracker-drops/.latest-drop-id missing or empty.';
  }
  // pointer-up-to-date
  const parts = [];
  if (trigger.gapDays === 0 && trigger.coverage === 0) {
    parts.push('pointer matches latest drop');
  } else {
    if (trigger.gapDays !== null) parts.push(`calendar-gap=${trigger.gapDays}d`);
    if (trigger.coverage !== null) parts.push(`coverage=${trigger.coverage}-drops`);
  }
  return `§4.1b Spotlight: skipped — pointer up-to-date (${parts.join(', ')}). No accumulation since you last looked.`;
}

// ------------ main -----------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const trigger = evaluateTriggers(args);

  if (!trigger.fire) {
    if (args.json) {
      process.stdout.write(JSON.stringify({ fired: false, ...trigger }, null, 2) + '\n');
    } else {
      process.stdout.write(formatSkip(trigger) + '\n');
    }
    // Skip is exit 0 — it's a successful determination, not a failure.
    return;
  }

  const result = buildSpotlight(args);
  if (args.json) {
    process.stdout.write(JSON.stringify({ fired: true, trigger, ...result }, null, 2) + '\n');
  } else {
    process.stdout.write(fmtMarkdown(result, trigger) + '\n');
  }
}

if (require.main === module) main();

module.exports = { buildSpotlight, evaluateTriggers };
