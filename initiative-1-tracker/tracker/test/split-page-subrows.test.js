/**
 * Multi-subrow page split + changelog lookback helpers.
 */
const fs = require('fs');
const path = require('path');
const {
  splitPageSubrows,
  shouldSplitSource,
  CHANGELOG_LOOKBACK_DAYS,
} = require('../lib/splitPageSubrows');
const { filterLastDays, lookbackDaysForSignal } = require('../lib/collect');

let ok = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) ok++;
  else {
    fail++;
    console.error('FAIL:', msg);
  }
}

const fixturePath = path.join(
  __dirname,
  'fixtures/anyonehome-30-june-2026-release.html'
);
const html = fs.readFileSync(fixturePath, 'utf8');

const { subrows, strategy } = splitPageSubrows(html, {
  pageTitle: '30 June 2026 Release',
  sourceUrl: 'https://anyonehome-updates.com/30-june-2026-release/',
  competitorId: 'anyone-home',
});

assert(strategy === 'h2_area_h3_capability', `strategy is h2/h3 (got ${strategy})`);
assert(subrows.length >= 5, `splits June 30 into ≥5 capabilities (got ${subrows.length})`);
assert(subrows.length <= 10, `respects max subrows (got ${subrows.length})`);

const headings = subrows.map((r) => r.heading);
assert(
  headings.some((h) => /Service Outage/i.test(h)),
  'includes Service Outage Expiration'
);
assert(
  headings.some((h) => /Calendar View/i.test(h)),
  'includes Access Leads from Calendar View'
);
assert(
  headings.some((h) => /60 Days/i.test(h)),
  'includes Tour Scheduling Window 60 Days'
);
assert(
  headings.every((h) => !/Share This Post|Future Releases/i.test(h)),
  'skips Share / Future Releases noise'
);

for (const row of subrows) {
  assert(row.capability_key && row.capability_key.length === 16, 'capability_key is 16 hex chars');
  assert(row.headline.includes('30 June'), 'headline keeps parent release title');
  assert(row.blurb && row.blurb.length >= 40, 'blurb is substantive');
}

const keys = new Set(subrows.map((r) => r.capability_key));
assert(keys.size === subrows.length, 'capability_keys are unique per heading');

assert(shouldSplitSource('changelog') === true, 'changelog opts into split');
assert(shouldSplitSource('blog') === false, 'blog not enabled in v1');
assert(shouldSplitSource('features') === false, 'features not enabled in v1');

// Lookback: changelog keeps 30d even when base collect is 7d
assert(CHANGELOG_LOOKBACK_DAYS === 45, 'changelog lookback is 45 days');
assert(
  lookbackDaysForSignal({ type: 'changelog' }, 7) === 45,
  'lookbackDaysForSignal widens changelog to 45'
);
assert(
  lookbackDaysForSignal({ type: 'blog' }, 7) === 7,
  'lookbackDaysForSignal leaves blog at 7'
);

const today = new Date();
const iso = (daysAgo) => {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const mixed = [
  { date: iso(3), type: 'blog', snippet: 'recent blog' },
  { date: iso(20), type: 'changelog', snippet: 'older release capability' },
  { date: iso(60), type: 'changelog', snippet: 'too old even for changelog' },
  { date: iso(20), type: 'blog', snippet: 'old blog should drop' },
];
const kept = filterLastDays(mixed, 7);
assert(
  kept.some((s) => s.type === 'changelog' && s.snippet.includes('older release')),
  'filterLastDays keeps 20-day-old changelog under 7d base window'
);
assert(
  !kept.some((s) => s.type === 'blog' && s.snippet.includes('old blog')),
  'filterLastDays still drops 20-day-old blog under 7d window'
);
assert(
  !kept.some((s) => s.snippet.includes('too old')),
  'filterLastDays drops changelog older than 45d'
);

const pinnedKept = filterLastDays(
  [{ date: iso(50), type: 'changelog', snippet: 'pinned old', metadata: { feed_pinned: true } }],
  7
);
assert(pinnedKept.length === 1, 'filterLastDays keeps feed_pinned changelog beyond lookback');

console.log(`split-page-subrows.test.js: ${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
