#!/usr/bin/env node
/**
 * Interpretation pointer — tracks the last drop the manager actually
 * interpreted in chat (Phase 4 of tracker-drop-cycle), so the dedupe + diff
 * step uses that as the base instead of strict `drops[idx-1]`.
 *
 * Why this exists: the cron writes drops continuously, but human
 * interpretation is intermittent. If the manager skips 5 CI cycles, the
 * strict prior-drop diff still only shows them 1 drop's worth of changes —
 * everything that landed during the skipped cycles is suppressed as carryover.
 * The interpretation pointer fixes this structurally: the diff base is "the
 * last drop the manager closed Phase 4 on," not "the latest cron drop minus 1."
 *
 * Pointer file: tracker-drops/.last-interpreted-drop-id (gitignored — per-machine
 * state, not shared across operators).
 *
 * Subcommands:
 *
 *   node scripts/interpretation-pointer.js base [--latest <drop-id>]
 *     Print the diff-base drop ID to stdout. Resolution order:
 *       1. If pointer file exists AND its value is in tracker-drops/ AND it is
 *          NOT equal to <latest> (defaults to .latest-drop-id) → print pointer.
 *       2. Else fall back to drops[idx-1] (immediately prior drop).
 *       3. Else print empty string + exit 1 (no prior drop).
 *
 *   node scripts/interpretation-pointer.js mark <drop-id>
 *     Write <drop-id> to the pointer file. Idempotent.
 *
 *   node scripts/interpretation-pointer.js status
 *     Human-readable summary: latest drop, pointer drop, drops between (i.e.
 *     how much the diff would cover).
 *
 * Exit codes:
 *   0 — success
 *   1 — could not resolve a base (e.g., latest drop is the first one ever)
 *   2 — bad arguments / pointer file write failure
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DROPS_ROOT = path.join(REPO_ROOT, 'tracker-drops');
const LATEST_PTR = path.join(DROPS_ROOT, '.latest-drop-id');
const INTERPRETED_PTR = path.join(DROPS_ROOT, '.last-interpreted-drop-id');

function listDrops() {
  if (!fs.existsSync(DROPS_ROOT)) return [];
  return fs
    .readdirSync(DROPS_ROOT)
    .filter((f) => /^\d{4}-/.test(f))
    .sort();
}

function readLatestId() {
  if (!fs.existsSync(LATEST_PTR)) return null;
  return fs.readFileSync(LATEST_PTR, 'utf8').trim() || null;
}

function readInterpretedId() {
  if (!fs.existsSync(INTERPRETED_PTR)) return null;
  return fs.readFileSync(INTERPRETED_PTR, 'utf8').trim() || null;
}

function resolveBase(latestId) {
  const drops = listDrops();
  if (drops.length === 0) return { base: null, reason: 'no-drops' };
  const latest = latestId || readLatestId();
  if (!latest) return { base: null, reason: 'no-latest' };
  const idx = drops.indexOf(latest);
  if (idx === -1) return { base: null, reason: 'latest-not-in-drops' };

  const pointer = readInterpretedId();
  if (pointer && pointer !== latest && drops.includes(pointer)) {
    const pointerIdx = drops.indexOf(pointer);
    if (pointerIdx < idx) {
      return {
        base: pointer,
        reason: 'interpretation-pointer',
        coverage: idx - pointerIdx,
      };
    }
  }

  if (idx === 0) return { base: null, reason: 'first-drop-ever' };
  return { base: drops[idx - 1], reason: 'fallback-prior-drop', coverage: 1 };
}

function cmdBase(argv) {
  let latestId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--latest') latestId = argv[++i];
    else if (argv[i] === '--verbose') {
      // handled below
    } else {
      process.stderr.write(`interpretation-pointer base: unknown flag "${argv[i]}"\n`);
      process.exit(2);
    }
  }
  const r = resolveBase(latestId);
  if (!r.base) {
    process.stderr.write(`interpretation-pointer: cannot resolve base (${r.reason})\n`);
    process.exit(1);
  }
  if (argv.includes('--verbose')) {
    process.stderr.write(`base=${r.base} reason=${r.reason} coverage=${r.coverage} drops\n`);
  }
  process.stdout.write(`${r.base}\n`);
}

function cmdMark(argv) {
  const id = argv[0];
  if (!id) {
    process.stderr.write('interpretation-pointer mark: missing <drop-id>\n');
    process.exit(2);
  }
  const drops = listDrops();
  if (!drops.includes(id)) {
    process.stderr.write(`interpretation-pointer mark: drop "${id}" not in tracker-drops/\n`);
    process.exit(2);
  }
  fs.writeFileSync(INTERPRETED_PTR, `${id}\n`, 'utf8');
  process.stdout.write(
    `interpretation-pointer: marked "${id}" as last interpreted\n`
  );
}

function cmdStatus() {
  const drops = listDrops();
  const latest = readLatestId();
  const pointer = readInterpretedId();
  const latestIdx = latest ? drops.indexOf(latest) : -1;
  const pointerIdx = pointer ? drops.indexOf(pointer) : -1;

  const lines = [];
  lines.push(`Latest drop      : ${latest || '(none)'}`);
  lines.push(`Last interpreted : ${pointer || '(none — first run)'}`);
  if (latest && pointer && latestIdx > -1 && pointerIdx > -1) {
    const coverage = Math.max(0, latestIdx - pointerIdx);
    lines.push(`Drops between    : ${coverage}  (the next /trackerstart will diff across these)`);
  } else if (latest && !pointer) {
    lines.push(`Drops between    : (pointer unset — next /trackerstart will fall back to prior-drop diff)`);
  }
  const r = resolveBase(latest);
  lines.push(
    `Resolved base    : ${r.base || '(none)'}  [${r.reason}${r.coverage ? `, coverage=${r.coverage}` : ''}]`
  );
  process.stdout.write(lines.join('\n') + '\n');
}

function main() {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write(
      [
        'Usage:',
        '  interpretation-pointer base [--latest <id>] [--verbose]',
        '  interpretation-pointer mark <drop-id>',
        '  interpretation-pointer status',
      ].join('\n') + '\n'
    );
    process.exit(0);
  }
  if (sub === 'base') return cmdBase(argv.slice(1));
  if (sub === 'mark') return cmdMark(argv.slice(1));
  if (sub === 'status') return cmdStatus();
  process.stderr.write(`interpretation-pointer: unknown subcommand "${sub}"\n`);
  process.exit(2);
}

if (require.main === module) main();

module.exports = { resolveBase, listDrops, readLatestId, readInterpretedId };
