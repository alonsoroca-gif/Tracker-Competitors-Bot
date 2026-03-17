/**
 * Collect signals from open sources.
 * collect(competitorId, productId, days) → array of { date, source, competitor_id, product_id, type, snippet }
 * Sources: blog RSS, press/news RSS, changelog RSS, pricing page, features page, careers page.
 */

const { loadConfig } = require('./loadConfig');

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
 * Parse RSS or Atom XML into { title, description, date }[].
 * Prefer description/content for snippet (more facts/details than title alone).
 */
function parseRssOrAtom(xml) {
  const items = [];
  const getTag = (block, tag) => {
    const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
    if (!m) return '';
    const raw = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return raw;
  };

  // RSS <item>
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = getTag(block, 'title');
    const description = getTag(block, 'description') || getTag(block, 'content:encoded') || getTag(block, 'content');
    const pubDate = getTag(block, 'pubDate') || getTag(block, 'dc:date');
    const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    items.push({ title: title || '(no title)', description: description || '', date });
  }

  // Atom <entry>
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((m = entryRegex.exec(xml)) !== null) {
      const block = m[1];
      const title = getTag(block, 'title');
      const description = getTag(block, 'summary') || getTag(block, 'content');
      const updated = getTag(block, 'updated') || getTag(block, 'published');
      const date = updated ? new Date(updated).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      items.push({ title: title || '(no title)', description: description || '', date });
    }
  }

  return items;
}

/**
 * Fetch one RSS/Atom feed and return signals with given source and type.
 */
async function collectFromRssFeed(competitorId, productId, feedUrl, sourceLabel, signalType) {
  if (!feedUrl) return [];
  const res = await fetchWithTimeout(feedUrl);
  const xml = await res.text();
  const entries = parseRssOrAtom(xml);
  return entries.map(({ title, description, date }) => {
    const desc = (description || '').trim();
    const useDesc = desc.length > 50 && desc !== (title || '').trim();
    const raw = useDesc ? desc : (title || '(no title)');
    const snippet = raw.length > 600 ? raw.slice(0, 597) + '...' : raw;
    return {
      date,
      source: sourceLabel,
      competitor_id: competitorId,
      product_id: productId,
      type: signalType,
      snippet,
    };
  });
}

/**
 * Prefer sentences that look like facts (numbers, %, $, metrics). Join up to maxLen.
 */
function extractFactLikeSnippet(text, maxLen = 800) {
  if (!text || typeof text !== 'string') return '';
  const factPattern = /\d|%|\$|million|billion|percent|customers|users|reduction|increase|growth|ROI|savings|pricing|tier|plan/i;
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 15 && factPattern.test(s));
  if (sentences.length === 0) return '';
  let out = '';
  for (const s of sentences) {
    if (out.length + s.length + 1 > maxLen) break;
    out += (out ? ' ' : '') + s.trim();
  }
  return out || '';
}

/**
 * Fetch HTML page, strip tags, return one signal with body/fact-like text.
 */
async function collectFromPage(competitorId, productId, pageUrl, sourceLabel, signalType) {
  if (!pageUrl) return [];
  const res = await fetchWithTimeout(pageUrl);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
  const skip = 1200;
  const take = 1200;
  const bodyText = text.length > skip ? text.slice(skip) : text;
  const factLike = extractFactLikeSnippet(bodyText, take);
  const snippet = (factLike || bodyText.slice(0, take).trim() || text.slice(0, 500).trim()).trim() || '(no text)';
  const today = new Date().toISOString().slice(0, 10);
  return [
    {
      date: today,
      source: sourceLabel,
      competitor_id: competitorId,
      product_id: productId,
      type: signalType,
      snippet,
    },
  ];
}

/**
 * Fetch careers page and emit job signal(s). For now one signal with page text summary.
 */
async function collectFromCareers(competitorId, productId, careersUrl) {
  if (!careersUrl) return [];
  const signals = await collectFromPage(competitorId, productId, careersUrl, 'careers', 'job');
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
 * Get source URLs for a competitor from config (sources[competitorId] and env overrides).
 */
function urlOrNull(v) {
  const s = typeof v === 'string' ? v.trim() : v;
  return s ? s : null;
}

function getSourceUrls(config, competitorId) {
  const envId = (competitorId || '').toUpperCase().replace(/-/g, '_');
  const sources = config.sources && config.sources[competitorId] ? config.sources[competitorId] : {};
  return {
    blog: urlOrNull(process.env[`TRACKER_FEED_URL_${envId}`] || sources.blog),
    press: urlOrNull(process.env[`TRACKER_PRESS_URL_${envId}`] || sources.press || sources.news),
    changelog: urlOrNull(process.env[`TRACKER_CHANGELOG_URL_${envId}`] || sources.changelog),
    pricing_url: urlOrNull(sources.pricing_url),
    features_url: urlOrNull(sources.features_url),
    careers_url: urlOrNull(sources.careers_url),
  };
}

/**
 * collect(competitorId, productId, days) → signals[]
 * Aggregates: blog, press, changelog RSS + pricing/features/careers pages from config.sources[competitorId].
 */
async function collect(competitorId, productId, days = 7) {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    return [];
  }
  const urls = getSourceUrls(config, competitorId);
  const allSignals = [];

  try {
    const pushFrom = async (fn) => {
      try {
        const list = await fn();
        allSignals.push(...list);
      } catch (err) {
        console.error(`Collect source failed for ${competitorId}:`, err.message);
      }
    };

    if (urls.blog) await pushFrom(() => collectFromRssFeed(competitorId, productId, urls.blog, 'blog', 'blog'));
    if (urls.press) await pushFrom(() => collectFromRssFeed(competitorId, productId, urls.press, 'press', 'press'));
    if (urls.changelog) await pushFrom(() => collectFromRssFeed(competitorId, productId, urls.changelog, 'changelog', 'changelog'));
    if (urls.pricing_url) await pushFrom(() => collectFromPage(competitorId, productId, urls.pricing_url, 'pricing_page', 'pricing'));
    if (urls.features_url) await pushFrom(() => collectFromPage(competitorId, productId, urls.features_url, 'features_page', 'features'));
    if (urls.careers_url) await pushFrom(() => collectFromCareers(competitorId, productId, urls.careers_url));

    let signals = allSignals;
    if (days) signals = filterLastDays(signals, days);
    return signals;
  } catch (err) {
    console.error(`Collect failed for ${competitorId}:`, err.message);
    return [];
  }
}

module.exports = { collect, filterLastDays, getSourceUrls };
