#!/usr/bin/env node
/**
 * GitHub parity smoke test — compares one fixture against live entrata-core @ main.
 * Soft-skips when ENTRATA_CORE_GITHUB_TOKEN is unset or owner not configured.
 */

const fs = require('fs');
const path = require('path');

const fixturesPath = path.join(__dirname, 'parity-fixtures.json');
const { ParityGitHubClient, resolveToken } = require('../lib/parityGitHubClient.js');
const { checkOneGitHub } = require('../lib/parityGitHubScan.js');
const { DEFAULT_THRESHOLDS } = require('../scripts/core-parity-check.js');

const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
const fixture = fixtures.find((f) => f.id === 'borderline-sightmap-siteplan') || fixtures[0];

async function main() {
  const client = new ParityGitHubClient();
  if (!resolveToken() || !client.configured()) {
    process.stderr.write(
      'parity-github.test: SKIP — set ENTRATA_CORE_GITHUB_TOKEN and owner in config/entrata-core-github.json\n',
    );
    process.exit(0);
  }

  process.stderr.write(`parity-github.test: fixture ${fixture.id}\n`);

  const tree = await client.getRecursiveTree();
  const allApps = client.listApplicationNames(tree);
  const result = await checkOneGitHub(fixture, client, allApps, { ...DEFAULT_THRESHOLDS });

  const expectedSet = Array.isArray(fixture.expected_verdict)
    ? fixture.expected_verdict
    : [fixture.expected_verdict];

  const stats = `score=${result.total_score}, files=${result.files_with_hits}, apps=${result.apps_with_hits}`;
  const top = result.top_files[0];
  const topLine = top ? `${top.app}/${top.relativePath}` : '(none)';

  if (expectedSet.includes(result.parity)) {
    process.stdout.write(`✓ ${fixture.id}: ${result.parity} (${stats}) @ ${result.github_ref}\n`);
    process.stdout.write(`  top: ${topLine}\n`);
    process.exit(0);
  }

  process.stdout.write(
    `✗ ${fixture.id}: got ${result.parity}, expected [${expectedSet.join(', ')}] (${stats})\n`,
  );
  process.stdout.write(`  top: ${topLine}\n`);
  process.stderr.write(
    'Note: GitHub @ main may differ from stale local clone — promote broader expected_verdict if needed.\n',
  );
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`parity-github.test: FAIL — ${err.message}\n`);
  process.exit(1);
});
