#!/usr/bin/env node
/**
 * Read initiative-1-tracker/TASKS.md and output the first unchecked task (Priority then Backup).
 * Output: JSON line { "id": "P1.2", "row": "| P1.2 | ... | [ ] |" } or {} if none.
 * With --write-file: also write initiative-1-tracker/AGENT-NEXT-TASK.md for Cursor to implement.
 */
const fs = require('fs');
const path = require('path');

const root = process.env.GITHUB_WORKSPACE || process.cwd();
const tasksPath = path.join(root, 'initiative-1-tracker', 'TASKS.md');
const writeFile = process.argv.includes('--write-file');

if (!fs.existsSync(tasksPath)) {
  console.log(JSON.stringify({}));
  process.exit(0);
}

const content = fs.readFileSync(tasksPath, 'utf8');
// First unchecked task row: | P1.2 | ... | [ ] | or | AS1 | ... | [ ] |
const taskRowRe = /^\|\s*(P\d+\.\d+|AS\d+|BM\d+)\s*\|(.+)\|\s*\[\s\]\s*\|/m;
const m = content.match(taskRowRe);
if (!m) {
  console.log(JSON.stringify({}));
  process.exit(0);
}

const id = m[1].trim();
const row = m[0].trim();

if (writeFile) {
  const outPath = path.join(root, 'initiative-1-tracker', 'AGENT-NEXT-TASK.md');
  const body = `# Next task for Cursor

Implement this task from \`initiative-1-tracker/TASKS.md\`. Use Cursor (no API key).

## Task ID
${id}

## Task row (acceptance criteria)
${row}

## After implementing
1. Run tests: \`cd initiative-1-tracker/tracker && node test/run.js\`
2. Mark task done in TASKS.md: change \`[ ]\` to \`[x]\` for this row.
3. Commit, push this branch, and open or update the PR. Virtual me will run on the PR.
`;
  fs.writeFileSync(outPath, body, 'utf8');
}

console.log(JSON.stringify({ id, row }));
