#!/usr/bin/env node
/**
 * Morningbrief Step 1 gate — pull latest drop, decide publish path, never reuse yesterday's brief.
 *
 * Usage:
 *   node scripts/morningbrief-kickoff-publish.js
 *   node scripts/morningbrief-kickoff-publish.js --json
 *   node scripts/morningbrief-kickoff-publish.js --skip-pull   # offline / already pulled
 */

const { spawnSync } = require('child_process');
const path = require('path');
const {
  repoRoot,
  readLatestDropId,
  loadLatest,
  loadRunManifest,
  loadDropSignals,
  writeJson,
  latestPath,
  mtCalendarDay,
  isBriefFreshForToday,
  lastPublishedBriefDropId,
  listDropIds,
  loadDropManifest,
  loadSignalsTable,
  isMondayMt,
  mtWeekday,
} = require('../lib/briefPaths.js');
const {
  weekendIntelPendingForMonday,
  publishedUrlKeys,
  countProductRowsPendingParity,
  countProductRowsIncompletePipeline,
  estimatePublishMinutes,
} = require('../lib/briefNetNew.js');
const { gatherIntelSignals } = require('./tracker-publish-intel.js');
const { buildSignalsTableRows } = require('../lib/briefClassify.js');

function parseArgs(argv) {
  const args = { json: false, skipPull: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--json') args.json = true;
    if (argv[i] === '--skip-pull') args.skipPull = true;
  }
  return args;
}

function runNode(script, scriptArgs = []) {
  const trackerRoot = path.join(__dirname, '..');
  const r = spawnSync('node', [path.join(trackerRoot, 'scripts', script), ...scriptArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return {
    code: r.status ?? 1,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

function gitPull() {
  const r = spawnSync('git', ['pull', 'origin', 'main'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return { ok: r.status === 0, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function commitTrackerBriefs(message) {
  const status = spawnSync('git', ['status', '--porcelain', '--', 'tracker-briefs'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const dirty = (status.stdout || '').trim();
  if (!dirty) {
    return { committed: false, reason: 'clean' };
  }
  spawnSync('git', ['add', 'tracker-briefs'], { cwd: repoRoot });
  const commit = spawnSync('git', ['commit', '-m', message], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (commit.status !== 0) {
    return {
      committed: false,
      reason: 'commit_failed',
      stderr: (commit.stderr || commit.stdout || '').trim(),
    };
  }
  return { committed: true, message };
}

function tryAutoPush() {
  return runNode('maybe-auto-push.js', ['--json', '--ahead', '1']);
}

function lastPublishedDropId(latest) {
  return lastPublishedBriefDropId(latest);
}

function markPublishing(dropId) {
  const prior = loadLatest() || {};
  writeJson(latestPath, {
    ...prior,
    status: 'publishing',
    run_id: dropId,
    run_dir: `tracker-briefs/runs/${dropId}`,
    viewer_path: 'tracker-briefs/viewer/index.html',
    started_at: new Date().toISOString(),
    source: 'morningbrief-kickoff',
    net_new_count: null,
    prototype_count: null,
    product_row_count: null,
    ready_at: null,
  });
}

function main() {
  const args = parseArgs(process.argv);
  const issues = [];
  let pull = { ok: true, skipped: true };

  if (!args.skipPull) {
    pull = gitPull();
    pull.skipped = false;
    if (!pull.ok) {
      issues.push(`git pull failed: ${pull.stderr || pull.stdout || 'unknown error'}`);
    }
  }

  const latest = loadLatest();
  const todayMt = mtCalendarDay();
  let freshForToday = latest?.ready_at ? isBriefFreshForToday(latest.ready_at) : false;
  const dropId = readLatestDropId();

  const weekendPending = weekendIntelPendingForMonday(
    latest,
    listDropIds(),
    loadDropManifest,
    loadDropSignals,
    loadSignalsTable,
    { mtWeekdayFn: mtWeekday, isMondayFn: isMondayMt, publishedUrlKeysFn: publishedUrlKeys },
  );
  if (weekendPending.pending) {
    freshForToday = false;
  }
  if (dropId && latest?.run_id && latest.run_id !== dropId) {
    freshForToday = false;
  }
  const pendingParityProduct = latest?.run_id
    ? countProductRowsIncompletePipeline(loadSignalsTable(latest.run_id))
    : 0;
  if (pendingParityProduct > 0) {
    freshForToday = false;
  }

  if (!dropId) {
    issues.push('tracker-drops/.latest-drop-id missing after pull');
  }

  let netNewCount = null;
  let predictedProduct = null;
  let productRowsForAgent = pendingParityProduct;
  let estimatedMinutes = null;
  let priorBriefDropId = lastPublishedDropId(latest);

  if (dropId && !freshForToday) {
    const pf = runNode('publish-preflight.js', ['--drop', dropId, '--json']);
    if (pf.code === 0 && pf.stdout) {
      try {
        const preflight = JSON.parse(pf.stdout);
        estimatedMinutes = preflight.estimated_publish_minutes;
      } catch {
        /* ignore */
      }
    }

    const { combined, sources } = gatherIntelSignals(dropId);
    const previewRows = buildSignalsTableRows(combined);
    const previewProduct = previewRows.filter((r) => r.classification === 'Product').length;
    productRowsForAgent = Math.max(pendingParityProduct, previewProduct);
    predictedProduct = productRowsForAgent;
    netNewCount = sources.net_new ?? previewRows.length;

    if (estimatedMinutes == null) {
      estimatedMinutes = estimatePublishMinutes(predictedProduct);
    }
  }

  let action = 'skip_already_fresh';
  let kickoffRequired = false;
  let publishedIntel = false;
  let intelPayload = null;
  let briefCommit = null;
  let autoPush = null;

  if (!freshForToday && dropId && issues.length === 0) {
    if (productRowsForAgent > 0) {
      markPublishing(dropId);
      kickoffRequired = true;
      action = 'kickoff_agent_required';
    } else {
      const intel = runNode('tracker-publish-intel.js', ['--drop', dropId, '--json']);
      if (intel.code === 0 && intel.stdout) {
        try {
          intelPayload = JSON.parse(intel.stdout);
          publishedIntel = Boolean(intelPayload.ok);
          action = publishedIntel ? 'published_intel' : 'intel_publish_failed';
          if (publishedIntel) {
            briefCommit = commitTrackerBriefs(`tracker-publish: intel brief for ${dropId}`);
            if (briefCommit.committed) {
              const ap = tryAutoPush();
              if (ap.code === 0 && ap.stdout) {
                try {
                  autoPush = JSON.parse(ap.stdout);
                } catch {
                  autoPush = { parse_error: true, raw: ap.stdout };
                }
              } else {
                autoPush = { action: 'auto_push_skipped', stderr: ap.stderr || ap.stdout };
              }
            }
          }
        } catch {
          action = 'intel_publish_failed';
          issues.push('tracker-publish-intel returned invalid JSON');
        }
      } else {
        action = 'intel_publish_failed';
        issues.push(intel.stderr || intel.stdout || 'tracker-publish-intel failed');
      }
    }
  }

  const payload = {
    ok: issues.length === 0,
    today_mt: todayMt,
    fresh_for_today: freshForToday,
    weekend_intel_pending: weekendPending.pending,
    weekend_drop_ids: weekendPending.weekendDropIds,
    action,
    kickoff_required: kickoffRequired,
    published_intel: publishedIntel,
    published_zero_day: publishedIntel,
    drop_id: dropId,
    prior_brief_drop_id: priorBriefDropId,
    net_new_urls: netNewCount,
    predicted_product_rows: predictedProduct,
    product_rows_for_agent: productRowsForAgent,
    pending_parity_product_rows: pendingParityProduct,
    product_pipeline_incomplete: pendingParityProduct,
    estimated_publish_minutes: estimatedMinutes,
    latest_status: latest?.status || null,
    latest_run_id: latest?.run_id || null,
    latest_ready_at: latest?.ready_at || null,
    latest_ready_day_mt: latest?.ready_at ? mtCalendarDay(latest.ready_at) : null,
    git_pull: pull,
    zero_day: intelPayload,
    intel: intelPayload,
    brief_commit: briefCommit,
    auto_push: autoPush,
    kickoff_prompt: kickoffRequired
      ? 'initiative-1-tracker/automation/morningbrief/tracker-publish-kickoff.md'
      : null,
    kickoff_skill: kickoffRequired ? '.cursor/skills/tracker-publish/SKILL.md' : null,
    agent_instruction: kickoffRequired
      ? pendingParityProduct > 0
        ? 'Launch background Task agent NOW — Product rows in today\'s brief still have parity not_scanned (no prototypes). Run full tracker-publish with Core parity; only Existing parity skips prototype.'
        : 'Launch background Task agent NOW with tracker-publish skill + kickoff prompt. Product rows detected in catch-up or net-new — parity + prototypes required.'
      : publishedIntel
        ? 'Intel brief published synchronously — table includes PMM/News/Press rows; tracker-feed should pass fresh_for_today.'
        : freshForToday
          ? 'Today\'s brief already fresh — skip Step 1 publish.'
          : 'Fix issues before continuing.',
    issues,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(issues.length ? 2 : 0);
  }

  process.stdout.write(`morningbrief-kickoff-publish: ${action} (${todayMt} MT)\n`);
  if (kickoffRequired) {
    process.stdout.write(`  → kickoff agent required (~${estimatedMinutes} min)\n`);
  }
  if (publishedIntel) {
    process.stdout.write(`  → intel brief ready: ${dropId}\n`);
  }
  for (const issue of issues) {
    process.stderr.write(`  issue: ${issue}\n`);
  }
  process.exit(issues.length ? 2 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { main, lastPublishedDropId };
