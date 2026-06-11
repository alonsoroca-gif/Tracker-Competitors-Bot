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
} = require('../lib/briefPaths.js');
const { netNewBetween, predictProductCandidates } = require('../lib/briefNetNew.js');

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

function lastPublishedDropId(latest) {
  if (!latest?.run_id) return null;
  const manifest = loadRunManifest(latest.run_id);
  return manifest?.drop_run_id || latest.run_id;
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
  const freshForToday = latest?.ready_at ? isBriefFreshForToday(latest.ready_at) : false;
  const dropId = readLatestDropId();

  if (!dropId) {
    issues.push('tracker-drops/.latest-drop-id missing after pull');
  }

  let netNewCount = null;
  let predictedProduct = null;
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

    const baselineDrop = priorBriefDropId;
    const currentSignals = loadDropSignals(dropId);
    const baselineSignals = baselineDrop ? loadDropSignals(baselineDrop) : [];
    const netNew = netNewBetween(currentSignals, baselineSignals);
    netNewCount = netNew.length;
    predictedProduct = predictProductCandidates(netNew).length;
    if (estimatedMinutes == null) {
      estimatedMinutes = predictedProduct >= 2 ? 28 : predictedProduct >= 1 ? 20 : 12;
    }
  }

  let action = 'skip_already_fresh';
  let kickoffRequired = false;
  let publishedZeroDay = false;
  let zeroDayPayload = null;

  if (!freshForToday && dropId && issues.length === 0) {
    if (netNewCount === 0 && predictedProduct === 0) {
      const zd = runNode('tracker-publish-zero-day.js', ['--drop', dropId, '--json']);
      if (zd.code === 0 && zd.stdout) {
        try {
          zeroDayPayload = JSON.parse(zd.stdout);
          publishedZeroDay = Boolean(zeroDayPayload.ok);
          action = publishedZeroDay ? 'published_zero_day' : 'zero_day_failed';
        } catch {
          action = 'zero_day_failed';
          issues.push('tracker-publish-zero-day returned invalid JSON');
        }
      } else {
        action = 'zero_day_failed';
        issues.push(zd.stderr || zd.stdout || 'tracker-publish-zero-day failed');
      }
    } else {
      markPublishing(dropId);
      kickoffRequired = true;
      action = 'kickoff_agent_required';
    }
  }

  const payload = {
    ok: issues.length === 0,
    today_mt: todayMt,
    fresh_for_today: freshForToday,
    action,
    kickoff_required: kickoffRequired,
    published_zero_day: publishedZeroDay,
    drop_id: dropId,
    prior_brief_drop_id: priorBriefDropId,
    net_new_urls: netNewCount,
    predicted_product_rows: predictedProduct,
    estimated_publish_minutes: estimatedMinutes,
    latest_status: latest?.status || null,
    latest_run_id: latest?.run_id || null,
    latest_ready_at: latest?.ready_at || null,
    latest_ready_day_mt: latest?.ready_at ? mtCalendarDay(latest.ready_at) : null,
    git_pull: pull,
    zero_day: zeroDayPayload,
    kickoff_prompt: kickoffRequired
      ? 'initiative-1-tracker/automation/morningbrief/tracker-publish-kickoff.md'
      : null,
    kickoff_skill: kickoffRequired ? '.cursor/skills/tracker-publish/SKILL.md' : null,
    agent_instruction: kickoffRequired
      ? 'Launch background Task agent NOW with tracker-publish skill + kickoff prompt. Do NOT skip because yesterday brief was ready.'
      : publishedZeroDay
        ? 'Zero-signal day published synchronously — continue morningbrief; tracker-feed should pass fresh_for_today.'
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
  if (publishedZeroDay) {
    process.stdout.write(`  → zero-day brief ready: ${dropId}\n`);
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
