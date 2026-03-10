/**
 * Collect signals from open sources.
 * collect(competitorId, productId, days) → array of { date, source, competitor_id, product_id, type, snippet }
 */

const { loadConfig } = require('./loadConfig');

const DEFAULT_SOURCE = 'blog';
const TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}) {
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = setTimeout(() => ac && ac.abort(), options.timeout || TIMEOUT_MS);
  try {
    const res = await fetch(url, ac ? { signal: ac.signal, ...options } : options);
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/**
 * Fetch one RSS feed and parse into signals (date, source, competitor_id, product_id, type, snippet).
 * Uses native fetch; for RSS we parse XML manually for minimal deps, or return mock if URL not set.
 */
async function collectFromBlog(competitorId, productId, feedUrl) {
  if (!feedUrl) return [];
  const res = await fetchWithTimeout(feedUrl);
  const xml = await res.text();
  const signals = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const getTag = (xml, tag) => {
    const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
    return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
  };
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = getTag(block, 'title');
    const pubDate = getTag(block, 'pubDate');
    const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    signals.push({
      date,
      source: DEFAULT_SOURCE,
      competitor_id: competitorId,
      product_id: productId,
      type: 'blog',
      snippet: title || '(no title)',
    });
  }
  return signals;
}

/**
 * Filter signals to last N days (by date string YYYY-MM-DD).
 */
function filterLastDays(signals, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return signals.filter((s) => s.date >= cutoffStr);
}

/**
 * collect(competitorId, productId, days) → signals[]
 * Uses config for feed URL; env TRACKER_FEED_URL_<COMPETITOR_ID> or config.sources[competitorId].blog
 */
async function collect(competitorId, productId, days = 7) {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    return [];
  }
  const competitor = config.competitors.find((c) => c.id === competitorId);
  const feedUrl =
    process.env[`TRACKER_FEED_URL_${(competitorId || '').toUpperCase().replace(/-/g, '_')}`] ||
    (config.sources && config.sources[competitorId] && config.sources[competitorId].blog) ||
    null;

  try {
    let signals = await collectFromBlog(competitorId, productId, feedUrl);
    if (days) signals = filterLastDays(signals, days);
    return signals;
  } catch (err) {
    console.error(`Collect failed for ${competitorId}:`, err.message);
    return [];
  }
}

module.exports = { collect, filterLastDays };
