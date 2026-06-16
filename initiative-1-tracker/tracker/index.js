#!/usr/bin/env node
/**
 * Tracker Bot — entry point.
 * Run: node index.js           → print "Tracker" (smoke)
 * Run: node index.js collect   → collect signals, write to storage + collect-meta (pillar summary)
 * Run: node index.js weekly    → same as collect (default 7d) + print weekly intel checklist
 * Run: node index.js demo      → seed demo signals (first-version-demo), then run report
 * Run: node index.js report    → build gap report + response schema + what to change (from storage)
 * Run: node index.js prototype-youtube-search "<query>" [--days N]  → YouTube API discovery smoke (needs YOUTUBE_DATA_API_KEY)
 */

const { loadConfig } = require('./lib/loadConfig');
const { writeSignals, getSignals } = require('./lib/storage');
const { runFullCollect } = require('./lib/runCollectAll');
const { writeCollectMeta } = require('./lib/collectMeta');
const { formatWeeklyFlowConsole } = require('./lib/weeklyIntelFlow');
const { buildGapReport } = require('./lib/gapReport');
const { buildResponseSchema } = require('./lib/responseSchema');
const { getWhatToChange } = require('./lib/whatToChange');
const { getDemoSignals } = require('./lib/demoSignals');
const { fetchYouTubeCommentThreads } = require('./lib/youtubeComments');
const { searchYouTubeVideos, listVideoDetails } = require('./lib/youtubeDiscovery');

const command = process.argv[2];

function isValidYoutubeVideoIdCli(v) {
  return typeof v === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(v.trim());
}

function getPeriodDays(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

function parseCollectDaysFromArgv() {
  let collectDays = 7;
  const dIdx = process.argv.indexOf('--days');
  if (dIdx !== -1 && process.argv[dIdx + 1]) {
    collectDays = Math.min(90, Math.max(1, parseInt(process.argv[dIdx + 1], 10) || 7));
  }
  return collectDays;
}

if (command === 'collect' || command === 'weekly') {
  const collectDays = parseCollectDaysFromArgv();
  const printWeekly = command === 'weekly';
  (async () => {
    const { newCount, pruned, intelMeta } = await runFullCollect(collectDays, { verbose: true });
    try {
      writeCollectMeta({ newCount, pruned, retentionDays: collectDays, intelMeta });
    } catch (e) {
      console.error('collect-meta write failed:', e.message);
    }
    console.log(
      `Stored ${newCount} new signals. Retention ${collectDays}d: ${pruned.kept} kept, ${pruned.removed} dropped (older than window).`
    );
    if (printWeekly) {
      process.stdout.write(formatWeeklyFlowConsole(intelMeta, newCount, pruned));
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
  return;
}

if (command === 'demo') {
  const demo = getDemoSignals();
  writeSignals(demo, true);
  console.log('Seeded', demo.length, 'demo signals. Running report...');
  const config = loadConfig();
  const product = config.products[0];
  if (!product) { console.log('No product in config.'); return; }
  const { periodStart, periodEnd } = getPeriodDays(7);
  const report = buildGapReport(product.id, periodStart, periodEnd);
  const responses = buildResponseSchema(report, product.id);
  const changes = getWhatToChange(report, responses);
  console.log('\n--- Gap report ---');
  console.log(JSON.stringify(report, null, 2));
  console.log('\n--- What to change (top 3) ---');
  changes.forEach((c) => console.log(c.formatted));
  return;
}

if (command === 'report') {
  const config = loadConfig();
  const product = config.products[0];
  if (!product) { console.log('No product in config.'); return; }
  const { periodStart, periodEnd } = getPeriodDays(7);
  const report = buildGapReport(product.id, periodStart, periodEnd);
  const responses = buildResponseSchema(report, product.id);
  const changes = getWhatToChange(report, responses);
  console.log('Tracker — Weekly report');
  console.log(`${product.name} · ${periodStart} – ${periodEnd}\n`);
  console.log('Gaps:', report.gaps.length);
  report.gaps.forEach((g) => console.log(`  ${g.gap_id} [${g.priority}] ${g.dimension}: ${g.title}`));
  console.log('\nWhat to change this week:');
  changes.forEach((c) => console.log(c.formatted));
  return;
}

if (command === 'prototype-youtube') {
  const videoId = process.argv[3];
  const key = process.env.YOUTUBE_DATA_API_KEY || '';
  if (!videoId || !isValidYoutubeVideoIdCli(videoId)) {
    console.log('Usage: node index.js prototype-youtube <11-char-video-id>');
    console.log('Requires env YOUTUBE_DATA_API_KEY (Google Cloud → YouTube Data API v3).');
    process.exit(videoId ? 1 : 0);
  }
  if (!key) {
    console.error('Set YOUTUBE_DATA_API_KEY in .env or the environment.');
    process.exit(1);
  }
  (async () => {
    const rows = await fetchYouTubeCommentThreads(videoId, key, { maxResults: 8 });
    console.log('Top comments for', videoId, '→', rows.length, 'items');
    rows.forEach((r, i) => console.log(`${i + 1}. [${r.author}] ${r.text.slice(0, 200)}`));
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
  return;
}

if (command === 'prototype-youtube-search') {
  const key = process.env.YOUTUBE_DATA_API_KEY || '';
  const argv = process.argv.slice(3);
  let days = 90;
  const dIdx = argv.indexOf('--days');
  if (dIdx !== -1 && argv[dIdx + 1]) {
    days = Math.min(365, Math.max(1, parseInt(argv[dIdx + 1], 10) || 90));
    argv.splice(dIdx, 2);
  }
  const query = argv.join(' ').trim();
  if (!query) {
    console.log('Usage: node index.js prototype-youtube-search <search query> [--days N]');
    console.log('Example: node index.js prototype-youtube-search "EliseAI review multifamily" --days 120');
    console.log('Requires YOUTUBE_DATA_API_KEY. Uses ~100 quota units per run (search) + 1 (videos).');
    process.exit(0);
  }
  if (!key) {
    console.error('Set YOUTUBE_DATA_API_KEY in .env or the environment.');
    process.exit(1);
  }
  const publishedAfterDate = new Date();
  publishedAfterDate.setDate(publishedAfterDate.getDate() - days);
  const publishedAfter = publishedAfterDate.toISOString();
  (async () => {
    const rows = await searchYouTubeVideos(key, query, { maxResults: 8, publishedAfter });
    const detailMap = await listVideoDetails(
      key,
      rows.map((r) => r.videoId)
    );
    console.log('Results:', rows.length, `(publishedAfter=${publishedAfter.slice(0, 10)})`);
    rows.forEach((r, i) => {
      const d = detailMap.get(r.videoId) || {};
      console.log(
        `${i + 1}. ${r.title}\n   ${r.channelTitle} · ${r.publishedAt} · views=${d.viewCount || '—'} · https://www.youtube.com/watch?v=${r.videoId}`
      );
    });
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
  return;
}

// Default: smoke
console.log('Tracker');
