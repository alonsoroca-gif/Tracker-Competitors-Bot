#!/usr/bin/env node
/**
 * tracker-briefs fixture + feed render smoke test.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');

function run(script, args = []) {
  return spawnSync('node', [path.join(trackerRoot, 'scripts', script), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

let failed = 0;

const readiness = run('brief-readiness-check.js', ['--json', '--allow-stale']);
if (readiness.status !== 0) {
  process.stderr.write('brief-feed.test: readiness check failed\n');
  process.stderr.write(readiness.stderr || readiness.stdout);
  failed += 1;
} else {
  const payload = JSON.parse(readiness.stdout);
  if (!payload.ok) {
    process.stderr.write(`brief-feed.test: expected ok readiness, got ${JSON.stringify(payload)}\n`);
    failed += 1;
  } else {
    process.stdout.write(`✓ readiness OK — ${payload.run_id} (${payload.signal_rows} rows)\n`);
  }
}

const feed = run('tracker-feed-render.js');
if (feed.status !== 0) {
  process.stderr.write('brief-feed.test: feed render failed\n');
  process.stderr.write(feed.stderr || feed.stdout);
  failed += 1;
} else {
  const out = feed.stdout;
  const checks = [
    ['Tracker brief', out.includes('Tracker brief')],
    ['signals table header', out.includes('| # | Competitor |')],
    ['PMM row or empty day', out.includes('PMM') || out.includes('No net-new signals')],
    ['viewer hint', out.includes('viewer/index.html')],
  ];
  for (const [name, ok] of checks) {
    if (ok) process.stdout.write(`✓ feed contains ${name}\n`);
    else {
      process.stderr.write(`✗ feed missing ${name}\n`);
      failed += 1;
    }
  }
}

const preflight = run('publish-preflight.js', ['--drop', '2026-06-02T00-10-59Z', '--json']);
if (preflight.status !== 0) {
  process.stderr.write('brief-feed.test: preflight failed\n');
  failed += 1;
} else {
  const pf = JSON.parse(preflight.stdout);
  if (typeof pf.net_new_urls !== 'number') failed += 1;
  else process.stdout.write(`✓ preflight OK — net_new_urls=${pf.net_new_urls}\n`);
}

const viewer = path.join(repoRoot, 'tracker-briefs/viewer/index.html');
if (!fs.existsSync(viewer)) {
  process.stderr.write('brief-feed.test: viewer missing\n');
  failed += 1;
} else {
  process.stdout.write('✓ viewer/index.html exists\n');
}

process.exit(failed ? 1 : 0);
