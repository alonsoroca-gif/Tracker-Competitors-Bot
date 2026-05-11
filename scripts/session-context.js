#!/usr/bin/env node
/**
 * Print handoff context for the next session (pending priorities + agreed focus).
 * Run from workspace root: node scripts/session-context.js
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const prTasks = path.join(root, 'docs', 'PR-TASKS-TODAY-TOMORROW.md');

function extractNextSessionSection(md) {
  const marker = '## Next session';
  const start = md.indexOf(marker);
  if (start === -1) return null;
  const after = md.indexOf('\n---\n', start);
  const end = after === -1 ? md.length : after;
  return md.slice(start, end).trim();
}

console.log('Tracker Competitors Bot — session context\n');
console.log('='.repeat(50));

if (!fs.existsSync(prTasks)) {
  console.log('Missing docs/PR-TASKS-TODAY-TOMORROW.md');
  process.exit(1);
}

const md = fs.readFileSync(prTasks, 'utf8');
const next = extractNextSessionSection(md);
if (next) {
  console.log(next);
} else {
  console.log('(No "## Next session" block yet — full file is still the source of truth.)\n');
  console.log(md.slice(0, 2500));
}

console.log('\n' + '='.repeat(50));
console.log('Docs: docs/PR-TASKS-TODAY-TOMORROW.md');
console.log('      initiative-1-tracker/docs/YOUTUBE-CHANNELS.md');
console.log('      initiative-1-tracker/TASKS.md');
console.log('\nTracker cycle: invoke /trackerstart in Cursor (see .cursor/skills/tracker-drop-cycle/SKILL.md)');
