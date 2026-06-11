#!/usr/bin/env node
/**
 * Push origin when local branch is exactly N commits ahead and checks pass.
 *
 * Usage:
 *   node scripts/maybe-auto-push.js
 *   node scripts/maybe-auto-push.js --json
 *   node scripts/maybe-auto-push.js --ahead 1 --test npm run test:brief --prefix initiative-1-tracker/tracker
 */

const { spawnSync } = require('child_process');
const path = require('path');

const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');

function parseArgs(argv) {
  const args = { json: false, ahead: 1, testCmd: null, branch: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--ahead' && argv[i + 1]) {
      args.ahead = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--branch' && argv[i + 1]) {
      args.branch = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--test' && argv[i + 1]) {
      args.testCmd = argv.slice(i + 1).join(' ');
      break;
    }
  }
  if (!args.testCmd) {
    args.testCmd = 'npm run test:brief --prefix initiative-1-tracker/tracker';
  }
  return args;
}

function git(args, opts = {}) {
  return spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...opts,
  });
}

function resolveUpstream() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const current = (branch.stdout || '').trim() || 'main';
  const upstream = git(['rev-parse', '--abbrev-ref', '@{upstream}']);
  if (upstream.status === 0 && upstream.stdout.trim()) {
    return upstream.stdout.trim();
  }
  return `origin/${current}`;
}

function aheadCount(upstream) {
  const r = git(['rev-list', '--count', `${upstream}..HEAD`]);
  if (r.status !== 0) return null;
  return Number((r.stdout || '').trim());
}

function runShell(cmd) {
  const r = spawnSync(cmd, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: true,
  });
  return {
    ok: r.status === 0,
    code: r.status ?? 1,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

function main() {
  const args = parseArgs(process.argv);
  const upstream = args.branch ? args.branch : resolveUpstream();
  const ahead = aheadCount(upstream);
  const issues = [];

  if (ahead == null || Number.isNaN(ahead)) {
    issues.push(`could not compute ahead count vs ${upstream}`);
  }

  let action = 'skip';
  let pushed = false;
  let test = null;

  if (issues.length === 0 && ahead === 0) {
    action = 'skip_up_to_date';
  } else if (issues.length === 0 && ahead !== args.ahead) {
    action = ahead > args.ahead ? 'skip_ahead_mismatch_high' : 'skip_ahead_mismatch_low';
  } else if (issues.length === 0) {
    test = runShell(args.testCmd);
    if (!test.ok) {
      action = 'skip_tests_failed';
      issues.push(`preflight test failed (exit ${test.code})`);
    } else if (args.dryRun) {
      action = 'would_push';
    } else {
      const push = git(['push', 'origin', 'HEAD'], { stdio: 'pipe' });
      if (push.status !== 0) {
        action = 'push_failed';
        issues.push((push.stderr || push.stdout || 'git push failed').trim());
      } else {
        action = 'pushed';
        pushed = true;
      }
    }
  }

  const payload = {
    ok: issues.length === 0 && (action === 'pushed' || action === 'would_push' || action.startsWith('skip')),
    action,
    pushed,
    ahead,
    expected_ahead: args.ahead,
    upstream,
    test: test
      ? { ok: test.ok, code: test.code, cmd: args.testCmd, stderr: test.stderr || null }
      : null,
    issues,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(issues.length && action !== 'skip_up_to_date' && !action.startsWith('skip_ahead') ? 2 : 0);
  }

  if (action === 'pushed') {
    process.stdout.write(`maybe-auto-push: pushed HEAD → origin (${ahead} commit ahead of ${upstream})\n`);
  } else if (action === 'would_push') {
    process.stdout.write(`maybe-auto-push: dry-run — would push (${ahead} ahead)\n`);
  } else {
    process.stdout.write(`maybe-auto-push: ${action} (ahead=${ahead}, want=${args.ahead})\n`);
  }
  for (const issue of issues) {
    process.stderr.write(`  ${issue}\n`);
  }
  process.exit(issues.length && action === 'push_failed' ? 2 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { main, aheadCount, resolveUpstream };
