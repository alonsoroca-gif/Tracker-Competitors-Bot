#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Diagnostic probe — runs the bot's actual fetcher + extractMeta against the
 * URLs that returned 200 OK but produced 0 signals in the latest CI drop.
 *
 * Goal: distinguish "DOM is there, our selectors miss it" (tunable) from
 * "page is a JS shell, headings/bullets simply aren't in the HTML" (Playwright).
 *
 * Run from the workspace root:
 *   node initiative-1-tracker/tracker/scripts/probe-zero-pages.js
 */

const path = require('path');
const cheerio = require('cheerio');

const COLLECT_PATH = path.join(__dirname, '..', 'lib', 'collect.js');
// The collect module is intentionally not exporting its internals, so re-create
// the same fetchText + extractMeta locally. Stay byte-for-byte aligned with the
// bot.

const DEFAULT_USER_AGENT =
  process.env.TRACKER_USER_AGENT ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_HTML_CHARS = 200000;

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'user-agent': DEFAULT_USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      },
    });
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      text: (await res.text()).slice(0, MAX_HTML_CHARS),
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalize(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function extractMeta($, pageUrl) {
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').first().text() ||
    $('h1').first().text() ||
    '';

  const description =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    '';

  const allHeadings = $('h1, h2, h3')
    .map((_, el) => normalize($(el).text()))
    .get();
  const headings = [...new Set(allHeadings.filter((t) => t.length >= 4 && t.length <= 140))].slice(0, 20);

  const allBullets = $('li')
    .map((_, el) => normalize($(el).text()))
    .get();
  const bullets = [...new Set(allBullets.filter((t) => t.length >= 8 && t.length <= 220))].slice(0, 40);

  // Article-card signals: typical "blog index" markup
  const articleCards = $('article, [class*="post"], [class*="card"], [class*="article"]').length;
  const linksWithTitles = $('a h2, a h3, h2 a, h3 a').length;

  return {
    pageUrl,
    title: normalize(title),
    description: normalize(description),
    headingCountRaw: allHeadings.length,
    headingsKept: headings,
    bulletCountRaw: allBullets.length,
    bulletsKept: bullets.length,
    articleCardCount: articleCards,
    linksWithTitlesCount: linksWithTitles,
  };
}

const URLS = [
  ['eliseai docs (datalog)', 'https://www.eliseai.com/datalog', 'docs_url → extractFeatureSignals'],
  ['leasehawk careers', 'https://leasehawk.com/careers/', 'careers_url → extractCareerSignals'],
];

(async () => {
  for (const [label, url, route] of URLS) {
    console.log('\n===================================================================');
    console.log(`URL:  ${label}`);
    console.log(`Path: ${route}`);
    try {
      const res = await fetchText(url);
      console.log(`HTTP ${res.status}, final ${res.finalUrl}, bytes ${res.text.length}`);
      if (!res.ok) continue;
      const $ = cheerio.load(res.text);
      const meta = extractMeta($, url);
      console.log(`title:        ${meta.title}`);
      console.log(`description:  ${meta.description.slice(0, 140)}${meta.description.length > 140 ? '...' : ''}`);
      console.log(`raw <h1/h2/h3> count:  ${meta.headingCountRaw}`);
      console.log(`headings kept (4-140 chars, deduped): ${meta.headingsKept.length}`);
      meta.headingsKept.slice(0, 10).forEach((h, i) => console.log(`    [${i + 1}] ${h.slice(0, 110)}`));
      console.log(`raw <li> count: ${meta.bulletCountRaw}`);
      console.log(`bullets kept:   ${meta.bulletsKept}`);
      console.log(`<article> + .post/.card/.article elements: ${meta.articleCardCount}`);
      console.log(`<a> wrapping <h2>/<h3>: ${meta.linksWithTitlesCount}`);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }
})();
