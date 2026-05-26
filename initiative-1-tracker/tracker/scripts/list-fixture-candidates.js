#!/usr/bin/env node
/**
 * List, inspect, promote, or discard fixture candidates that the parity
 * check has auto-saved from production runs.
 *
 * Usage:
 *   node scripts/list-fixture-candidates.js
 *       List all pending candidates with a one-line summary each.
 *
 *   node scripts/list-fixture-candidates.js show <id-or-filename>
 *       Print the full JSON of one candidate.
 *
 *   node scripts/list-fixture-candidates.js promote <id-or-filename> [verdict-set]
 *       Move the candidate into parity-fixtures.json. The verdict-set
 *       argument is a comma-separated list (e.g. "Partial,Borderline,Gap").
 *       If omitted, the candidate's observed verdict is used as the only
 *       expected verdict (strict lock).
 *
 *   node scripts/list-fixture-candidates.js discard <id-or-filename>
 *       Delete the candidate file. Use when the run was a known bug or
 *       the candidate isn't worth defending.
 *
 *   node scripts/list-fixture-candidates.js clear
 *       Discard ALL pending candidates. Use when starting fresh.
 *
 * Promotion is always a manual decision. The pipeline never auto-merges
 * candidates into the regression suite.
 */

const fs = require('fs');
const path = require('path');

const PENDING_DIR = path.join(__dirname, '..', 'test', 'fixtures-pending');
const FIXTURES_PATH = path.join(__dirname, '..', 'test', 'parity-fixtures.json');

function ensurePendingDir() {
  if (!fs.existsSync(PENDING_DIR)) {
    fs.mkdirSync(PENDING_DIR, { recursive: true });
  }
}

function listCandidateFiles() {
  ensurePendingDir();
  return fs
    .readdirSync(PENDING_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

function readCandidate(filename) {
  const full = path.join(PENDING_DIR, filename);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function findCandidateFile(token) {
  const files = listCandidateFiles();
  if (!token) return null;
  const exact = files.find((f) => f === token || f === token + '.json');
  if (exact) return exact;
  const byId = files.find((f) => {
    try {
      const c = readCandidate(f);
      return c.id === token;
    } catch {
      return false;
    }
  });
  if (byId) return byId;
  const partial = files.filter((f) => f.includes(token));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    process.stderr.write(
      `list-fixture-candidates: '${token}' is ambiguous. Matched:\n  ${partial.join('\n  ')}\n`,
    );
    process.exit(1);
  }
  return null;
}

function cmdList() {
  const files = listCandidateFiles();
  if (files.length === 0) {
    process.stdout.write('No pending fixture candidates.\n');
    process.stdout.write(`(Directory: ${PENDING_DIR})\n`);
    return;
  }
  process.stdout.write(`${files.length} pending candidate(s):\n\n`);
  process.stdout.write(
    'ID'.padEnd(50) +
      'Verdict'.padEnd(14) +
      'Score'.padStart(6) +
      'Files'.padStart(8) +
      'Apps'.padStart(7) +
      '  Captured\n',
  );
  process.stdout.write('-'.repeat(105) + '\n');
  for (const f of files) {
    let c;
    try {
      c = readCandidate(f);
    } catch (e) {
      process.stdout.write(`(unreadable) ${f}: ${e.message}\n`);
      continue;
    }
    const obs = c._observed || {};
    const captured = (obs.captured_at || '').slice(0, 19);
    process.stdout.write(
      (c.id || f).slice(0, 48).padEnd(50) +
        (obs.verdict || '?').padEnd(14) +
        String(obs.total_score ?? '?').padStart(6) +
        String(obs.files_with_hits ?? '?').padStart(8) +
        String(obs.apps_with_hits ?? '?').padStart(7) +
        '  ' +
        captured +
        '\n',
    );
  }
  process.stdout.write(
    '\nReview a candidate: node scripts/list-fixture-candidates.js show <id>\n' +
      'Promote to suite:  node scripts/list-fixture-candidates.js promote <id> [verdict-set]\n' +
      'Discard:           node scripts/list-fixture-candidates.js discard <id>\n',
  );
}

function cmdShow(token) {
  const f = findCandidateFile(token);
  if (!f) {
    process.stderr.write(`list-fixture-candidates: no candidate matches '${token}'.\n`);
    process.exit(1);
  }
  process.stdout.write(fs.readFileSync(path.join(PENDING_DIR, f), 'utf8'));
}

function cmdPromote(token, verdictSetArg) {
  const f = findCandidateFile(token);
  if (!f) {
    process.stderr.write(`list-fixture-candidates: no candidate matches '${token}'.\n`);
    process.exit(1);
  }
  const c = readCandidate(f);
  const observed = (c._observed && c._observed.verdict) || c.expected_verdict[0];
  const verdictSet = verdictSetArg
    ? verdictSetArg.split(',').map((s) => s.trim()).filter(Boolean)
    : [observed];

  const allowed = ['Existing', 'Partial', 'Borderline', 'Gap', 'Unknown'];
  for (const v of verdictSet) {
    if (!allowed.includes(v)) {
      process.stderr.write(
        `list-fixture-candidates: invalid verdict '${v}' (allowed: ${allowed.join(', ')})\n`,
      );
      process.exit(1);
    }
  }

  const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'));
  const newFixture = {
    id: c.id,
    competitor_signal: c.competitor_signal,
    proposed_feature: c.proposed_feature,
    product_id: c.product_id,
    expected_verdict: verdictSet,
    rationale:
      `Promoted from auto-saved production candidate on ${new Date().toISOString().slice(0, 10)}. ` +
      `Observed verdict at capture: ${observed} ` +
      `(score=${c._observed?.total_score ?? '?'}, files=${c._observed?.files_with_hits ?? '?'}, ` +
      `apps=${c._observed?.apps_with_hits ?? '?'}).`,
  };

  if (fixtures.some((existing) => existing.id === newFixture.id)) {
    process.stderr.write(
      `list-fixture-candidates: a fixture with id '${newFixture.id}' already exists in parity-fixtures.json. ` +
        `Rename the candidate before promoting.\n`,
    );
    process.exit(1);
  }

  fixtures.push(newFixture);
  fs.writeFileSync(FIXTURES_PATH, JSON.stringify(fixtures, null, 2) + '\n', 'utf8');
  fs.unlinkSync(path.join(PENDING_DIR, f));

  process.stdout.write(
    `Promoted: ${newFixture.id}\n` +
      `  expected_verdict: [${verdictSet.join(', ')}]\n` +
      `  parity-fixtures.json now has ${fixtures.length} fixtures\n` +
      `\nNext: node test/parity-check.test.js (verify the new fixture passes)\n`,
  );
}

function cmdDiscard(token) {
  const f = findCandidateFile(token);
  if (!f) {
    process.stderr.write(`list-fixture-candidates: no candidate matches '${token}'.\n`);
    process.exit(1);
  }
  fs.unlinkSync(path.join(PENDING_DIR, f));
  process.stdout.write(`Discarded: ${f}\n`);
}

function cmdClear() {
  const files = listCandidateFiles();
  for (const f of files) {
    fs.unlinkSync(path.join(PENDING_DIR, f));
  }
  process.stdout.write(`Cleared ${files.length} pending candidate(s).\n`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case undefined:
    case 'list':
      cmdList();
      break;
    case 'show':
      cmdShow(rest[0]);
      break;
    case 'promote':
      cmdPromote(rest[0], rest[1]);
      break;
    case 'discard':
      cmdDiscard(rest[0]);
      break;
    case 'clear':
      cmdClear();
      break;
    case '--help':
    case '-h':
      process.stdout.write(
        `\nUsage: node scripts/list-fixture-candidates.js [list|show|promote|discard|clear] [args]\n` +
          `\nSee the comment block at the top of this script for full docs.\n`,
      );
      break;
    default:
      process.stderr.write(`list-fixture-candidates: unknown command '${cmd}'.\n`);
      process.stderr.write(`Run with --help for usage.\n`);
      process.exit(1);
  }
}

main();
