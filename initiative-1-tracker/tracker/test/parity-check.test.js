#!/usr/bin/env node
/**
 * Regression test for the Core parity check.
 *
 * Walks every fixture in `parity-fixtures.json`, runs the parity check
 * against the live Entrata Core checkout (auto-discovered), and asserts
 * the resulting verdict is in the fixture's `expected_verdict` set.
 *
 * The test SOFT-SKIPS when Core can't be resolved on this machine (e.g.
 * CI runners without an Entrata Core checkout). That's intentional —
 * we don't want CI red-builds when the only failure is "no Core to
 * scan against." Local-dev runs are the source of truth for this gate.
 *
 * Usage:
 *   npm run test:parity                     (from initiative-1-tracker/tracker)
 *   node test/parity-check.test.js          (direct invocation)
 *
 * Output shape:
 *   ✓ <fixture-id>: Existing (score=388, files=20, apps=5)
 *   ✗ <fixture-id>: got Partial, expected one of [Existing] (score=12, files=3)
 *   <passed>/<total> passed
 */

const fs = require('fs');
const path = require('path');

const fixturesPath = path.join(__dirname, 'parity-fixtures.json');
const {
  checkOne,
  resolveCoreRoot,
  DEFAULT_THRESHOLDS,
  buildCoreFileCache,
} = require('../scripts/core-parity-check.js');

const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

const { root, applicationsDir, source, tried } = resolveCoreRoot();
if (!root) {
  process.stderr.write(
    `parity-check.test: SKIP — Entrata Core could not be auto-resolved on this machine.\n` +
      `Tried:\n${(tried || []).map((p) => `  - ${p}`).join('\n')}\n` +
      `Fix locally: \`node scripts/core-parity-check.js --save-core <path>\`.\n` +
      `(This is a soft skip — CI runners don't have Core, so the test must not fail there.)\n`,
  );
  process.exit(0);
}

process.stderr.write(`parity-check.test: using Core at ${root} (resolved via ${source})\n\n`);

const allApps = fs
  .readdirSync(applicationsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  .map((e) => ({ name: e.name, abs: path.join(applicationsDir, e.name) }));

// Read the monolith into memory once and reuse it across every fixture.
// Without this each fixture re-reads ~3.7k files from disk, turning the
// suite into a ~40-minute I/O grind that blows past the 2-minute gate
// timeout in manager-core-preflight.js. The cache keeps verdicts identical.
const fileCache = buildCoreFileCache(allApps);

let passed = 0;
let failed = 0;
const fails = [];

for (const fixture of fixtures) {
  const expectedSet = Array.isArray(fixture.expected_verdict)
    ? fixture.expected_verdict
    : [fixture.expected_verdict];

  const result = checkOne(fixture, applicationsDir, allApps, DEFAULT_THRESHOLDS, fileCache);
  const stats = `score=${result.total_score}, files=${result.files_with_hits}, apps=${result.apps_with_hits}`;

  if (expectedSet.includes(result.parity)) {
    passed += 1;
    process.stdout.write(`✓ ${fixture.id}: ${result.parity} (${stats})\n`);
  } else {
    failed += 1;
    fails.push({
      id: fixture.id,
      expected: expectedSet,
      got: result.parity,
      stats,
      top_file: result.top_files[0]
        ? `${result.top_files[0].app}/${result.top_files[0].relativePath}`
        : '(none)',
      grounding_terms: result.grounding_terms,
    });
    process.stdout.write(
      `✗ ${fixture.id}: got ${result.parity}, expected one of [${expectedSet.join(', ')}] (${stats})\n`,
    );
  }
}

process.stdout.write(`\n${passed}/${passed + failed} passed\n`);

if (failed > 0) {
  process.stderr.write('\nFailure detail (debug):\n');
  for (const f of fails) {
    process.stderr.write(
      `  ${f.id}\n` +
        `    expected: ${f.expected.join(' or ')}\n` +
        `    got:      ${f.got}\n` +
        `    stats:    ${f.stats}\n` +
        `    top:      ${f.top_file}\n` +
        `    terms:    ${(f.grounding_terms || []).join(', ')}\n\n`,
    );
  }
  process.exit(1);
}

process.exit(0);
