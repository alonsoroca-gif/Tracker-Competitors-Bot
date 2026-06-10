#!/usr/bin/env node
/**
 * Morningbrief Step 0 — auto-verify skills + kickoff files exist.
 * No manual "confirm on disk" — agent runs this every /morningbrief.
 *
 * Usage:
 *   node scripts/morningbrief-preflight.js
 *   node scripts/morningbrief-preflight.js --json
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');
const home = os.homedir();

const REQUIRED = [
  {
    id: 'tracker_feed_skill',
    label: 'tracker-feed skill (repo)',
    path: path.join(repoRoot, '.cursor/skills/tracker-feed/SKILL.md'),
    fix: 'git pull origin main — skill ships in Tracker Competitors Bot/.cursor/skills/',
  },
  {
    id: 'tracker_publish_skill',
    label: 'tracker-publish skill (repo)',
    path: path.join(repoRoot, '.cursor/skills/tracker-publish/SKILL.md'),
    fix: 'git pull origin main — skill ships in Tracker Competitors Bot/.cursor/skills/',
  },
  {
    id: 'morningbrief_skill',
    label: 'morningbrief skill (personal)',
    path: path.join(home, '.cursor/skills/morningbrief/SKILL.md'),
    fix: 'Copy or create ~/.cursor/skills/morningbrief/SKILL.md (or ask Alonso for the morningbrief skill pack)',
  },
  {
    id: 'publish_kickoff',
    label: 'tracker-publish kickoff prompt',
    path: path.join(repoRoot, 'initiative-1-tracker/automation/morningbrief/tracker-publish-kickoff.md'),
    fix: 'git pull origin main',
  },
];

const OPTIONAL = [
  {
    id: 'billy_onboard_skill',
    label: 'billy-tracker-onboard skill (repo)',
    path: path.join(repoRoot, '.cursor/skills/billy-tracker-onboard/SKILL.md'),
  },
  {
    id: 'workspace_file',
    label: 'entrata-plus-tracker workspace',
    path: path.join(repoRoot, 'entrata-plus-tracker.code-workspace'),
  },
];

function checkFile(entry) {
  const exists = fs.existsSync(entry.path);
  return {
    id: entry.id,
    label: entry.label,
    ok: exists,
    path: entry.path,
    fix: entry.fix || null,
  };
}

function main() {
  const jsonOut = process.argv.includes('--json');
  const required = REQUIRED.map(checkFile);
  const optional = OPTIONAL.map((e) => checkFile(e));
  const allOk = required.every((c) => c.ok);

  const payload = {
    ok: allOk,
    repo_root: repoRoot,
    required,
    optional,
    next: allOk
      ? 'Continue morningbrief — Step 1 tracker-publish (background) or smoke test Step 7 tracker-feed'
      : 'Fix failed checks before running morningbrief',
  };

  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(allOk ? 0 : 1);
  }

  process.stdout.write('morningbrief-preflight\n');
  process.stdout.write(`  repo: ${repoRoot}\n\n`);

  for (const c of required) {
    process.stdout.write(`${c.ok ? '✓' : '✗'} ${c.label}\n`);
    if (!c.ok) {
      process.stdout.write(`    missing: ${c.path}\n`);
      process.stdout.write(`    fix: ${c.fix}\n`);
    }
  }

  process.stdout.write('\nOptional:\n');
  for (const c of optional) {
    process.stdout.write(`  ${c.ok ? '✓' : '·'} ${c.label}\n`);
  }

  process.stdout.write(
    allOk
      ? '\nmorningbrief-preflight: PASS — skills wired, continue morningbrief.\n'
      : '\nmorningbrief-preflight: FAIL — fix items above.\n',
  );
  process.exit(allOk ? 0 : 1);
}

main();
