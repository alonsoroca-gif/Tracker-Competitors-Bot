#!/usr/bin/env node
/**
 * Dry-run health check for tracker-publish (no writes).
 * Validates each phase's prerequisites against the latest drop + brief fixture.
 *
 * Usage:
 *   node scripts/tracker-publish-dry-run.js
 *   node scripts/tracker-publish-dry-run.js --json
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');

const {
  readLatestDropId,
  priorDropId,
  loadDropManifest,
  loadLatest,
  loadRunManifest,
  loadSignalsTable,
  loadPrototypes,
} = require('../lib/briefPaths.js');

function runNode(script, args = []) {
  const r = spawnSync('node', [path.join(trackerRoot, 'scripts', script), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  return { code: r.status ?? 1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function phase(name, ok, detail, note = '') {
  return { phase: name, ok, detail, note };
}

function coreLocalOk() {
  try {
    const { resolveCoreRoot } = require('./core-parity-check.js');
    const { root } = resolveCoreRoot();
    return Boolean(root && fs.existsSync(path.join(root, 'Applications')));
  } catch {
    return false;
  }
}

function main() {
  const jsonOut = process.argv.includes('--json');
  const phases = [];

  const dropId = readLatestDropId();
  phases.push(
    phase(
      '1 — Resolve drop',
      Boolean(dropId),
      dropId ? `latest drop: ${dropId}` : 'tracker-drops/.latest-drop-id missing',
      priorDropId(dropId) ? `prior: ${priorDropId(dropId)}` : 'no prior drop',
    ),
  );

  const pf = runNode('publish-preflight.js', dropId ? ['--drop', dropId, '--json'] : ['--json']);
  let preflight = null;
  if (pf.code === 0 && pf.stdout) {
    try {
      preflight = JSON.parse(pf.stdout);
    } catch {
      /* ignore */
    }
  }
  phases.push(
    phase(
      '0 — Preflight',
      pf.code === 0,
      preflight
        ? `net_new_urls=${preflight.net_new_urls}, predicted Product=${preflight.predicted_product_rows}, est ~${preflight.estimated_publish_minutes}min, start ${preflight.recommended_start_mt} MT`
        : pf.stderr || pf.stdout || 'preflight failed',
      preflight?.note || '',
    ),
  );

  phases.push(
    phase(
      '2 — Interpret (fixture)',
      true,
      'Agent-driven in publish — fixture has interpreted signals-table.json',
      'PMM fixture: 1 row; live publish will classify from drop',
    ),
  );

  const localCore = coreLocalOk();
  const mgrPf = runNode('manager-core-preflight.js', ['--json']);
  let mgrOk = localCore;
  phases.push(
    phase(
      '0b — Manager Core preflight',
      mgrOk,
      localCore ? 'local Core: OK (local-core-only deployment)' : 'local Core: not found — run manager-core-preflight.js',
      'Morningbrief kickoff @ 8:00 — Billy Mac + entrata-core clone required',
    ),
  );

  const manifest = dropId ? loadDropManifest(dropId) : null;
  const productRows = 0;
  phases.push(
    phase(
      '4 — PRDs + prototypes',
      true,
      productRows === 0
        ? 'skipped — 0 Product rows on fixture day'
        : 'build vignettes per Tier-Now row',
      'Sample Product QA: tracker-briefs/runs/_sample-product-day/',
    ),
  );

  const latest = loadLatest();
  const readiness = runNode('brief-readiness-check.js', ['--json']);
  let readyPayload = null;
  if (readiness.code === 0 && readiness.stdout) {
    try {
      readyPayload = JSON.parse(readiness.stdout);
    } catch {
      /* ignore */
    }
  }
  const runId = latest?.run_id;
  const table = runId ? loadSignalsTable(runId) : [];
  const protos = runId ? loadPrototypes(runId) : [];
  const runManifest = runId ? loadRunManifest(runId) : null;

  phases.push(
    phase(
      '5 — Write brief + readiness',
      Boolean(readyPayload?.ok),
      readyPayload
        ? `latest.json ready · ${runId} · ${table.length} rows · ${protos.length} prototypes`
        : readiness.stderr || 'not ready',
      runManifest?.source === 'tracker-publish-fixture'
        ? 'fixture output — live publish will replace on first run'
        : '',
    ),
  );

  const feed = runNode('tracker-feed-render.js');
  phases.push(
    phase(
      '6 — Handoff to tracker-feed',
      feed.code === 0 && feed.stdout.includes('Tracker brief'),
      feed.code === 0 ? 'tracker-feed-render.js OK' : feed.stderr || 'feed render failed',
      'Billy morningbrief consumes this output',
    ),
  );

  const allOk = phases.every((p) => p.ok);
  const payload = { ok: allOk, drop_id: dropId, phases };

  if (jsonOut) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    process.exit(allOk ? 0 : 2);
  }

  process.stdout.write('tracker-publish dry-run\n');
  process.stdout.write(`drop: ${dropId || '(none)'}\n\n`);
  for (const p of phases) {
    const mark = p.ok ? '✓' : '✗';
    process.stdout.write(`${mark} Phase ${p.phase}\n`);
    process.stdout.write(`    ${p.detail}\n`);
    if (p.note) process.stdout.write(`    → ${p.note}\n`);
  }
  process.stdout.write('\n');
  if (allOk) {
    process.stdout.write(
      'tracker-publish dry-run: PASS — scaffold + fixture handoff OK. Live publish still needs agent Phases 2–4 on new drops.\n',
    );
    process.exit(0);
  }
  process.stderr.write('tracker-publish dry-run: FAIL — fix phases marked ✗\n');
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = { main };
