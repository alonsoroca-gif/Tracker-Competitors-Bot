#!/usr/bin/env node
/**
 * Tracker Bot — entry point.
 * Run: node index.js           → print "Tracker" (smoke)
 * Run: node index.js collect   → collect signals, write to storage
 * Run: node index.js demo      → seed demo signals (first-version-demo), then run report
 * Run: node index.js report    → build gap report + response schema + what to change (from storage)
 */

const { loadConfig } = require('./lib/loadConfig');
const { collect } = require('./lib/collect');
const { writeSignals, getSignals, pruneSignalsToRetentionDays } = require('./lib/storage');
const { buildGapReport } = require('./lib/gapReport');
const { buildResponseSchema } = require('./lib/responseSchema');
const { getWhatToChange } = require('./lib/whatToChange');
const { getDemoSignals } = require('./lib/demoSignals');

const command = process.argv[2];

function getPeriodDays(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

if (command === 'collect') {
  let collectDays = 7;
  const dIdx = process.argv.indexOf('--days');
  if (dIdx !== -1 && process.argv[dIdx + 1]) {
    collectDays = Math.min(90, Math.max(1, parseInt(process.argv[dIdx + 1], 10) || 7));
  }
  (async () => {
    const config = loadConfig();
    let newCount = 0;
    for (const product of config.products) {
      for (const competitor of config.competitors) {
        const signals = await collect(competitor.id, product.id, collectDays);
        if (signals.length > 0) {
          const { added } = writeSignals(signals, false);
          newCount += added;
        }
        console.log(`Collected ${signals.length} signals for ${competitor.name} / ${product.id}`);
      }
    }
    const pruned = pruneSignalsToRetentionDays(collectDays);
    console.log(
      `Stored ${newCount} new signals. Retention ${collectDays}d: ${pruned.kept} kept, ${pruned.removed} dropped (older than window).`
    );
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
  return;
}

if (command === 'demo') {
  const demo = getDemoSignals();
  writeSignals(demo, true);
  console.log('Seeded', demo.length, 'demo signals. Running report...');
  const config = loadConfig();
  const product = config.products[0];
  if (!product) { console.log('No product in config.'); return; }
  const { periodStart, periodEnd } = getPeriodDays(7);
  const report = buildGapReport(product.id, periodStart, periodEnd);
  const responses = buildResponseSchema(report);
  const changes = getWhatToChange(report, responses);
  console.log('\n--- Gap report ---');
  console.log(JSON.stringify(report, null, 2));
  console.log('\n--- What to change (top 3) ---');
  changes.forEach((c) => console.log(c.formatted));
  return;
}

if (command === 'report') {
  const config = loadConfig();
  const product = config.products[0];
  if (!product) { console.log('No product in config.'); return; }
  const { periodStart, periodEnd } = getPeriodDays(7);
  const report = buildGapReport(product.id, periodStart, periodEnd);
  const responses = buildResponseSchema(report);
  const changes = getWhatToChange(report, responses);
  console.log('Tracker — Weekly report');
  console.log(`${product.name} · ${periodStart} – ${periodEnd}\n`);
  console.log('Gaps:', report.gaps.length);
  report.gaps.forEach((g) => console.log(`  ${g.gap_id} [${g.priority}] ${g.dimension}: ${g.title}`));
  console.log('\nWhat to change this week:');
  changes.forEach((c) => console.log(c.formatted));
  return;
}

// Default: smoke
console.log('Tracker');
