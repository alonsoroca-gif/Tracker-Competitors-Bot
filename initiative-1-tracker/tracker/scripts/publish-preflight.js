#!/usr/bin/env node
/**
 * Preflight before tracker-publish — alerts operator (not Billy).
 * Estimates net-new volume and predicted Product workload.
 *
 * Usage:
 *   node scripts/publish-preflight.js
 *   node scripts/publish-preflight.js --drop 2026-06-02T00-10-59Z
 *   node scripts/publish-preflight.js --json
 */

const {
  readLatestDropId,
  priorDropId,
  loadDropSignals,
  loadDropManifest,
} = require('../lib/briefPaths.js');
const {
  netNewBetween,
  predictProductCandidates,
  estimatePublishMinutes,
} = require('../lib/briefNetNew.js');

function parseArgs(argv) {
  const args = { drop: null, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--drop' && argv[i + 1]) {
      args.drop = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--json') {
      args.json = true;
    }
  }
  return args;
}

function recommendStart(estimatedMin, productCandidates) {
  if (productCandidates >= 4 || estimatedMin >= 75) {
    return {
      start_mt: '08:00',
      level: 'heavy',
      note: `Heavy day (~${estimatedMin}min). Kick off tracker-publish at morningbrief Step 0; tracker-feed may need to skip + Slack DM.`,
    };
  }
  if (productCandidates >= 2 || estimatedMin >= 45) {
    return {
      start_mt: '08:00',
      level: 'moderate',
      note: `~${estimatedMin}min publish — start at morningbrief Step 0; may finish during other subskills.`,
    };
  }
  return {
    start_mt: '08:00',
    level: 'normal',
    note: `~${estimatedMin}min — morningbrief Step 0 kickoff; usually ready before tracker-feed section.`,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const runId = args.drop || readLatestDropId();
  if (!runId) {
    process.stderr.write('publish-preflight: no drop id (tracker-drops/.latest-drop-id missing)\n');
    process.exit(2);
  }

  const priorId = priorDropId(runId);
  const current = loadDropSignals(runId);
  const prior = priorId ? loadDropSignals(priorId) : [];
  const netNew = netNewBetween(current, prior);
  const candidates = predictProductCandidates(netNew);
  const estimatedMin = estimatePublishMinutes(candidates.length);
  const rec = recommendStart(estimatedMin, candidates.length);
  const dropManifest = loadDropManifest(runId);

  const payload = {
    run_id: runId,
    prior_drop_id: priorId,
    drop_new_signals_added: dropManifest?.new_signals_added ?? null,
    net_new_urls: netNew.length,
    predicted_product_rows: candidates.length,
    estimated_publish_minutes: estimatedMin,
    recommended_start_mt: rec.start_mt,
    workload_level: rec.level,
    note: rec.note,
    sample_net_new: netNew.slice(0, 5).map((s) => ({
      competitor_id: s.competitor_id,
      headline: s.headline,
      source_url: s.source_url,
    })),
  };

  if (args.json) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    process.exit(0);
  }

  process.stdout.write(`publish-preflight: drop ${runId}\n`);
  process.stdout.write(`  prior drop:        ${priorId || '(none)'}\n`);
  process.stdout.write(`  net-new URLs:      ${netNew.length}\n`);
  process.stdout.write(`  predicted Product: ${candidates.length} (heuristic — interpret may differ)\n`);
  process.stdout.write(`  est. publish:      ~${estimatedMin} min\n`);
  process.stdout.write(`  recommend start:   ${rec.start_mt} MT (${rec.level})\n`);
  process.stdout.write(`  → ${rec.note}\n`);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main, recommendStart };
