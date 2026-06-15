#!/usr/bin/env node
/**
 * Synchronous intel publish — classify PMM / News / Press / Talent / Pricing rows
 * when no Tier-Now Product work is predicted. Replaces empty zero-day briefs.
 *
 * Row sources (in priority order):
 *   1. Weekend rule (Monday MT) — every URL from Sat/Sun collects since last brief
 *   2. Catch-up — URLs in weekday drops since last brief not in published table
 *   3. Content refresh — published URLs whose page text changed
 *   4. Carryover spotlight — when 1–3 empty
 */

const path = require('path');
const {
  readLatestDropId,
  runDir,
  loadDropManifest,
  loadLatest,
  loadDropSignals,
  loadSignalsTable,
  writeJson,
  refreshRunsIndex,
  latestPath,
  mtCalendarDay,
  mtWeekday,
  isMondayMt,
  lastPublishedBriefDropId,
  listDropIds,
} = require('../lib/briefPaths.js');
const {
  netNewBetween,
  publishedUrlKeys,
  catchUpNetNewInDropWindow,
  contentChangedVsPublished,
  calendarDaysSinceBriefReady,
  weekendDropIds,
  allSignalsFromDrops,
} = require('../lib/briefNetNew.js');
const { buildSignalsTableRows } = require('../lib/briefClassify.js');
const { buildSpotlight } = require('./carryover-spotlight.js');

function parseArgs(argv) {
  const args = { drop: null, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--drop' && argv[i + 1]) {
      args.drop = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--json') args.json = true;
  }
  return args;
}

function gatherIntelSignals(dropId) {
  const priorBrief = loadLatest();
  const baselineDropId = lastPublishedBriefDropId(priorBrief);
  const publishedTable =
    priorBrief?.run_id && priorBrief.run_id !== dropId ? loadSignalsTable(priorBrief.run_id) : [];
  const publishedKeys = publishedUrlKeys(publishedTable);
  const current = loadDropSignals(dropId);
  const allDrops = listDropIds();
  const gapDays = calendarDaysSinceBriefReady(priorBrief?.ready_at, mtCalendarDay);

  let weekendMandatory = [];
  let weekendDropIdsList = [];
  if (isMondayMt()) {
    weekendDropIdsList = weekendDropIds(allDrops, loadDropManifest, {
      afterReadyAt: priorBrief?.ready_at,
      mtWeekdayFn: mtWeekday,
    });
    weekendMandatory = allSignalsFromDrops(weekendDropIdsList, loadDropSignals);
    weekendMandatory.forEach((s) => {
      s._weekend = true;
    });
  }

  const weekendUrls = new Set(weekendMandatory.map((s) => String(s.source_url || '').toLowerCase()));

  const catchUp =
    baselineDropId && priorBrief?.run_id !== dropId
      ? catchUpNetNewInDropWindow(allDrops, baselineDropId, dropId, loadDropSignals, publishedKeys)
      : netNewBetween(current, baselineDropId ? loadDropSignals(baselineDropId) : []);

  const catchUpFiltered = catchUp.filter(
    (s) => !weekendUrls.has(String(s.source_url || '').toLowerCase()),
  );
  catchUpFiltered.forEach((s) => {
    if (s._catchup_drop) s._catchup = true;
  });

  const catchUpUrlSet = new Set(catchUpFiltered.map((s) => String(s.source_url || '').toLowerCase()));
  const refreshed = contentChangedVsPublished(current, publishedTable).filter(
    (s) =>
      !weekendUrls.has(String(s.source_url || '').toLowerCase()) &&
      !catchUpUrlSet.has(String(s.source_url || '').toLowerCase()),
  );
  refreshed.forEach((s) => {
    s._content_refresh = true;
  });

  let carryover = [];
  if (weekendMandatory.length === 0 && catchUpFiltered.length === 0 && refreshed.length === 0) {
    const spotlight = buildSpotlight({
      dropId,
      minImportance: 0.65,
      windowDays: 7,
      top: 8,
      includeNetNew: gapDays >= 1,
      force: gapDays >= 2,
      gapDays: 1,
      coverageThreshold: 2,
    });
    carryover = (spotlight.rows || []).map((c) => ({ ...c.row, _carryover: true }));
  }

  const combined = [...weekendMandatory, ...catchUpFiltered, ...refreshed, ...carryover];
  const sources = {
    net_new: catchUpFiltered.length + weekendMandatory.length,
    weekend_mandatory: weekendMandatory.length,
    weekend_drop_ids: weekendDropIdsList,
    catch_up: catchUpFiltered.filter((s) => s._catchup).length,
    content_refreshed: refreshed.length,
    carryover: carryover.length,
    baseline_drop_id: baselineDropId,
    prior_brief_run_id: priorBrief?.run_id || null,
    published_row_count: publishedTable.length,
    calendar_gap_days: gapDays,
    monday_mt: isMondayMt(),
  };

  return { combined, sources, weekendMandatory, catchUp: catchUpFiltered, refreshed, carryover };
}

function summarizeDay(sources, rows) {
  const productRows = rows.filter((r) => r.classification === 'Product').length;
  const parts = [];
  if (sources.weekend_mandatory) parts.push(`${sources.weekend_mandatory} weekend collect(s)`);
  if (sources.catch_up) parts.push(`${sources.catch_up} catch-up URL(s)`);
  else if (sources.net_new && !sources.weekend_mandatory) parts.push(`${sources.net_new} net-new URL(s)`);
  if (sources.content_refreshed) parts.push(`${sources.content_refreshed} content refresh(es)`);
  if (sources.carryover) parts.push(`${sources.carryover} carryover(s)`);
  if (sources.calendar_gap_days >= 2) parts.push(`${sources.calendar_gap_days}d since last brief`);
  const lead = parts.length ? parts.join(', ') : 'retention collect';
  if (rows.length === 0) {
    return `${lead} — no classified rows for today's table (competitors quiet).`;
  }
  if (productRows === 0) {
    return `${lead} · ${rows.length} intel row(s) (PMM / News / Press / etc.) · 0 Product rows — no prototypes.`;
  }
  return `${lead} · ${rows.length} row(s) incl. ${productRows} Product (parity not scanned on intel path).`;
}

function main() {
  const args = parseArgs(process.argv);
  const dropId = args.drop || readLatestDropId();
  if (!dropId) {
    process.stderr.write('tracker-publish-intel: no drop id\n');
    process.exit(2);
  }

  const dropManifest = loadDropManifest(dropId);
  const { combined, sources } = gatherIntelSignals(dropId);
  const tableRows = buildSignalsTableRows(combined);
  const productRowCount = tableRows.filter((r) => r.classification === 'Product').length;
  const now = new Date().toISOString();
  const runRoot = runDir(dropId);

  let dayType = 'intel_only';
  if (sources.weekend_mandatory) dayType = 'weekend_catch_up';
  else if (productRowCount > 0 && tableRows.length > productRowCount) dayType = 'mixed';
  else if (productRowCount > 0) dayType = 'product';
  else if (tableRows.length > 0) dayType = sources.catch_up ? 'catch_up' : 'pmm_only';

  const summary = summarizeDay(sources, tableRows);

  const manifest = {
    run_id: dropId,
    drop_run_id: dropId,
    published_at: now,
    source: 'tracker-publish-intel',
    day_type: dayType,
    net_new_count: sources.net_new,
    weekend_mandatory_count: sources.weekend_mandatory,
    weekend_drop_ids: sources.weekend_drop_ids,
    catch_up_count: sources.catch_up,
    content_refreshed_count: sources.content_refreshed,
    carryover_count: sources.carryover,
    calendar_gap_days: sources.calendar_gap_days,
    product_row_count: productRowCount,
    tier_now_product_count: 0,
    prototype_count: 0,
    interpretation_pointer: dropId,
    summary,
  };

  writeJson(path.join(runRoot, 'manifest.json'), manifest);
  writeJson(path.join(runRoot, 'signals-table.json'), tableRows);
  writeJson(path.join(runRoot, 'prototypes.json'), []);

  const latest = {
    status: 'ready',
    run_id: dropId,
    deadline_mt: '07:45',
    viewer_path: 'tracker-briefs/viewer/index.html',
    run_dir: `tracker-briefs/runs/${dropId}`,
    prototype_count: 0,
    net_new_count: sources.net_new,
    product_row_count: productRowCount,
    source: 'tracker-publish-intel',
    ready_at: now,
    drop_new_signals_added: dropManifest?.new_signals_added ?? null,
  };

  writeJson(latestPath, latest);
  refreshRunsIndex();

  const payload = {
    ok: true,
    run_id: dropId,
    ready_at: now,
    today_mt: mtCalendarDay(),
    net_new_count: sources.net_new,
    signal_rows: tableRows.length,
    product_row_count: productRowCount,
    day_type: dayType,
    sources,
    summary,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(0);
  }

  process.stdout.write(
    `tracker-publish-intel: OK — ${dropId} (${tableRows.length} rows, ${sources.net_new} net-new/catch-up URLs)\n`,
  );
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main, gatherIntelSignals };
