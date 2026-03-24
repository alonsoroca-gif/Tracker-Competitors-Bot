#!/usr/bin/env node
/**
 * Print all source files involved in competitor data collection — paste output into any AI chat.
 * Usage (from repo root): node scripts/export-competitor-pull-context.js
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const tracker = path.join(root, 'initiative-1-tracker', 'tracker');

const chunks = [
  {
    title: 'DOCS: COMPETITOR-DATA-PULL-REFERENCE.md (architecture summary)',
    file: path.join(root, 'initiative-1-tracker', 'docs', 'COMPETITOR-DATA-PULL-REFERENCE.md'),
  },
  { title: 'config/products.json', file: path.join(tracker, 'config', 'products.json') },
  { title: 'lib/loadConfig.js', file: path.join(tracker, 'lib', 'loadConfig.js') },
  { title: 'lib/storage.js', file: path.join(tracker, 'lib', 'storage.js') },
  { title: 'lib/collect.js', file: path.join(tracker, 'lib', 'collect.js') },
  { title: 'server.js (collect route excerpt only)', file: path.join(tracker, 'server.js'), maxLines: 125 },
  { title: 'index.js (collect CLI excerpt)', file: path.join(tracker, 'index.js'), maxLines: 58 },
  { title: 'lib/gapReport.js (inferDimension + cleanSnippet area)', file: path.join(tracker, 'lib', 'gapReport.js'), maxLines: 85 },
];

console.log('='.repeat(72));
console.log('TRACKER — COMPETITOR DATA PULL — FULL CONTEXT FOR EXTERNAL CHAT');
console.log('Repo: Tracker Competitors Bot / initiative-1-tracker/tracker');
console.log('='.repeat(72));
console.log('');

for (const { title, file, maxLines } of chunks) {
  if (!fs.existsSync(file)) {
    console.log(`\n--- MISSING: ${title} ---\nPath: ${file}\n`);
    continue;
  }
  let text = fs.readFileSync(file, 'utf8');
  if (maxLines) {
    text = text.split('\n').slice(0, maxLines).join('\n') + '\n/* … truncated … */\n';
  }
  console.log('\n' + '-'.repeat(72));
  console.log(`FILE: ${path.relative(root, file)}`);
  console.log(`SECTION: ${title}`);
  console.log('-'.repeat(72) + '\n');
  console.log(text);
}

console.log('\n' + '='.repeat(72));
console.log('END — ask your model for suggestions on sources, robustness, and architecture.');
console.log('='.repeat(72) + '\n');
