#!/usr/bin/env node
/**
 * Manager Core preflight — checklist before tracker-publish parity works.
 * No GitHub token required. Use on Billy's machine after clone.
 *
 * Usage:
 *   node scripts/manager-core-preflight.js
 *   node scripts/manager-core-preflight.js --json
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');
const CACHE_FILE = path.join(trackerRoot, '.core-path');
const WORKSPACE_CANDIDATES = [
  path.join(repoRoot, 'entrata-plus-tracker.code-workspace'),
  path.join(repoRoot, 'entrata-plus-tracker.code-workspace.local'),
];

function runVerifyCore() {
  const r = spawnSync('node', [path.join(trackerRoot, 'scripts', 'verify-core-setup.js'), '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  try {
    return { code: r.status, data: JSON.parse(r.stdout || '{}') };
  } catch {
    return { code: r.status ?? 2, data: { ok: false, message: r.stderr || 'verify failed' } };
  }
}

function runParityTest() {
  // The parity suite scans the Entrata Core monolith (~3.7k source files).
  // With the in-memory file cache it scores in seconds, but the one-time
  // cold read of those files is syscall-latency-bound and runs ~3 min on a
  // cold disk. The old 120s ceiling killed a test that was working — give
  // it real headroom. A genuine hang still trips this; ~3 min is normal.
  const r = spawnSync('node', [path.join(trackerRoot, 'test', 'parity-check.test.js')], {
    cwd: trackerRoot,
    encoding: 'utf8',
    timeout: 300000,
  });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function workspaceStatus() {
  const found = WORKSPACE_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    return { ok: false, detail: 'No entrata-plus-tracker.code-workspace — copy from .example' };
  }
  try {
    const ws = JSON.parse(fs.readFileSync(found, 'utf8'));
    const coreFolder = (ws.folders || []).find((f) => /core|entrata/i.test(f.name || ''));
    const corePath = coreFolder?.path || '';
    if (!corePath || corePath.includes('ABSOLUTE/PATH')) {
      return { ok: false, detail: `${path.basename(found)} exists but Core path is still a placeholder` };
    }
    const apps = path.join(corePath, 'Applications');
    if (!fs.existsSync(apps)) {
      return { ok: false, detail: `Workspace Core path has no Applications/: ${corePath}` };
    }
    return { ok: true, detail: `Workspace OK — Core at ${corePath}` };
  } catch (e) {
    return { ok: false, detail: `Invalid workspace file: ${e.message}` };
  }
}

function main() {
  const jsonOut = process.argv.includes('--json');
  const checks = [];

  const ws = workspaceStatus();
  checks.push({ id: 'workspace', label: 'Multi-root workspace (Tracker + Core)', ok: ws.ok, detail: ws.detail });

  const cached = fs.existsSync(CACHE_FILE);
  checks.push({
    id: 'core_cache',
    label: 'Core path cached (.core-path)',
    ok: cached,
    detail: cached ? fs.readFileSync(CACHE_FILE, 'utf8').trim() : 'Run: node scripts/core-parity-check.js --save-core /path/to/entrata-core',
  });

  const envRoot = (process.env.ENTRATA_MONO_ROOT || '').trim();
  checks.push({
    id: 'env_mono',
    label: 'ENTRATA_MONO_ROOT env (optional)',
    ok: true,
    detail: envRoot ? envRoot : '(not set — OK if .core-path or --save-core used)',
  });

  const verify = runVerifyCore();
  checks.push({
    id: 'verify_core',
    label: 'verify-core-setup',
    ok: verify.code === 0 && verify.data.ok,
    detail: verify.data.message || verify.data.core_root || 'failed',
  });

  const parity = runParityTest();
  checks.push({
    id: 'parity_tests',
    label: 'parity-check.test.js',
    ok: parity.code === 0,
    detail: parity.code === 0 ? 'fixtures passed' : 'run npm run test:parity for full output',
  });

  const ghVerify = spawnSync('node', [path.join(trackerRoot, 'scripts', 'verify-github-core-access.js')], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  const ghOk = ghVerify.status === 0;
  checks.push({
    id: 'github_token',
    label: 'GitHub API token (Path B — optional)',
    ok: true,
    detail: ghOk
      ? 'Path B ready — automated freshest Layer 1 @ main each publish'
      : 'Path A or get token — see BILLY-TRACKER-SETUP.md §4 (Billy chooses)',
  });

  const verifyOk = checks.find((c) => c.id === 'verify_core')?.ok;
  const parityOk = checks.find((c) => c.id === 'parity_tests')?.ok;
  const requiredOk = Boolean(verifyOk && parityOk);
  const payload = {
    ok: requiredOk,
    checks,
    deployment: 'local-core-only',
    warnings: checks.filter((c) => !c.ok && c.id === 'workspace').map((c) => c.detail),
  };

  if (jsonOut) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    process.exit(requiredOk ? 0 : 2);
  }

  process.stdout.write('manager-core-preflight (local Core only — no GitHub token)\n\n');
  for (const c of checks) {
    process.stdout.write(`${c.ok ? '✓' : '✗'} ${c.label}\n    ${c.detail}\n`);
  }
  process.stdout.write('\n');
  if (requiredOk) {
    process.stdout.write('manager-core-preflight: PASS — ready for tracker-publish parity on this machine.\n');
    const wsFail = checks.find((c) => c.id === 'workspace' && !c.ok);
    if (wsFail) {
      process.stdout.write(`manager-core-preflight: WARN — ${wsFail.detail} (recommended for Layer 2 agent search)\n`);
    }
    process.exit(0);
  }
  process.stderr.write('manager-core-preflight: FAIL — fix ✗ items above. See initiative-1-tracker/docs/BILLY-TRACKER-SETUP.md\n');
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = { main };
