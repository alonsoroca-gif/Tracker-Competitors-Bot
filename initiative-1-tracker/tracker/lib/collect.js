/**
 * Collect signals from public sources using rss-parser + cheerio.
 * Richer snippets, event_type, confidence, entities — compatible with gapReport (type, headline, snippet, evidence_snippet, source_url).
 */

const Parser = require('rss-parser');
const cheerio = require('cheerio');
const { loadConfig } = require('./loadConfig');
const { attachIntelPillarMetadata } = require('./intelPillar');
const { fetchYouTubeCommentThreads } = require('./youtubeComments');
const { searchYouTubeVideos, listVideoDetails } = require('./youtubeDiscovery');
const {
  splitPageSubrows,
  shouldSplitSource,
  CHANGELOG_LOOKBACK_DAYS,
  CHANGELOG_FEED_PIN_COUNT,
  CHANGELOG_ABSOLUTE_MAX_DAYS,
} = require('./splitPageSubrows');

// Browser-like UA. The previous self-identifying "CompetitorTracker/1.0"
// string was triggering Cloudflare/WAF challenges for some hosts (verified by
// comparing demo drop and 2026-05-07 CI drops — both lost the same RSS lanes
// while the same URLs returned 200 with content from a residential laptop).
// `TRACKER_USER_AGENT` env var lets ops override at deploy time without a
// code change (e.g. rotate UAs, add a contact email per RFC 9110 §15).
const DEFAULT_USER_AGENT =
  process.env.TRACKER_USER_AGENT ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Full Chrome-like header set. Cloudflare bot management correlates
// multiple signals (UA + Accept-* + Referer + connection style); a real
// browser sends all of these, an unconfigured `fetch` does not. Adding
// these reduces the bot-fingerprint without any new dependency.
function browserHeaders(extra = {}) {
  return {
    'user-agent': DEFAULT_USER_AGENT,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'gzip, deflate, br',
    referer: 'https://www.google.com/',
    dnt: '1',
    connection: 'keep-alive',
    'upgrade-insecure-requests': '1',
    ...extra,
  };
}

// rss-parser uses Node's http stack, which does NOT decompress Brotli (and
// often mishandles gzip when Accept-Encoding advertises it). Advertising
// `br`/`gzip` produced opaque bytes → "Non-whitespace before first tag" →
// silent empty feeds for all of Funnel's RSS lanes (Jul 2026). Force
// identity so the XML arrives plaintext.
function rssHeaders(extra = {}) {
  return {
    'user-agent': DEFAULT_USER_AGENT,
    accept: 'application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'identity',
    referer: 'https://www.google.com/',
    ...extra,
  };
}

const parser = new Parser({
  timeout: 15000,
  headers: rssHeaders(),
});

const DEFAULT_TIMEOUT_MS = 15000;
// 1 MB cap — generous enough for hydrated SPAs whose serialized DOM can hit
// 300–500 KB (e.g. featuredcustomers.com's testimonial section lives past the
// 200 KB mark). Cheerio parses 1 MB in tens of ms so this is not a hot path
// concern. Smaller caps (200 KB) were silently dropping the content we needed.
const MAX_HTML_CHARS = 1_000_000;
const MAX_SNIPPET = 600;
const MAX_EVIDENCE = 1200;

// Random inter-request delay so consecutive fetches don't look like a
// burst. Disabled in tests via TRACKER_POLITE_DELAY_DISABLED=1 so the
// suite stays fast. Range is env-tunable; sensible defaults below.
const POLITE_DELAY_DISABLED = process.env.TRACKER_POLITE_DELAY_DISABLED === '1';
const POLITE_DELAY_MIN_MS = Number(process.env.TRACKER_POLITE_DELAY_MIN_MS || 800);
const POLITE_DELAY_MAX_MS = Number(process.env.TRACKER_POLITE_DELAY_MAX_MS || 1800);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function politeDelay() {
  if (POLITE_DELAY_DISABLED) return;
  const span = Math.max(0, POLITE_DELAY_MAX_MS - POLITE_DELAY_MIN_MS);
  const ms = POLITE_DELAY_MIN_MS + Math.floor(Math.random() * (span + 1));
  if (ms > 0) await sleep(ms);
}

const JOB_TITLE_PATTERNS = [
  /engineer/i,
  /developer/i,
  /product manager/i,
  /designer/i,
  /sales/i,
  /account executive/i,
  /solutions engineer/i,
  /customer success/i,
  /implementation/i,
  /partnership/i,
  /marketing/i,
  /growth/i,
  /data/i,
  /machine learning/i,
  /\bml\b/i,
  /\bai\b/i,
  /operations/i,
  /revenue/i,
];

const FEATURE_KEYWORDS = [
  'ai',
  'automation',
  'leasing',
  'tour scheduling',
  'lead nurturing',
  'self-guided tours',
  'crm',
  'resident communication',
  'voice ai',
  'sms',
  'email',
  'contact center',
  'lead scoring',
  'application',
  'screening',
  'pricing',
  'integrations',
  'analytics',
  'reporting',
  'chatbot',
  'conversion',
];

const POSITIONING_KEYWORDS = [
  'industry leading',
  'enterprise',
  'multifamily',
  'property management',
  'leasing funnel',
  'conversion',
  'centralized leasing',
  'ai-powered',
  'assistant',
  'platform',
  'end-to-end',
];

const ARTICLE_EVENT_RULES = [
  {
    event_type: 'integration_launch',
    patterns: [/integrat(es|ion|ed)/i, /connected to/i, /now supports/i],
    importance: 0.82,
  },
  {
    event_type: 'feature_launch',
    patterns: [/introducing/i, /launch(es|ed|ing)?/i, /new feature/i, /now available/i],
    importance: 0.85,
  },
  {
    event_type: 'pricing_change',
    patterns: [/pricing/i, /plans/i, /\$\d+/, /starting at/i, /enterprise plan/i],
    importance: 0.9,
  },
  {
    event_type: 'partnership',
    patterns: [/partner(ship|ed)?/i, /strategic alliance/i],
    importance: 0.78,
  },
  {
    event_type: 'positioning_shift',
    patterns: [/ai-powered/i, /reimagining/i, /transform/i, /industry leading/i],
    importance: 0.65,
  },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseDays(days) {
  return Math.min(90, Math.max(1, parseInt(days, 10) || 7));
}

function cutoffISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - parseDays(days));
  return d.toISOString().slice(0, 10);
}

/** Changelog / release feeds keep a longer window so Monday catch-up doesn't bury them. */
function lookbackDaysForSignal(signal, days) {
  const base = parseDays(days);
  if (signal && (signal.type === 'changelog' || signal.source === 'changelog')) {
    return Math.max(base, CHANGELOG_LOOKBACK_DAYS);
  }
  return base;
}

function filterLastDays(signals, days) {
  return (Array.isArray(signals) ? signals : []).filter((s) => {
    if (!s || typeof s.date !== 'string') return false;
    // Changelog items still sitting at the top of the RSS feed (pinned during
    // extract) must survive the final filter even if slightly outside lookback.
    if (s.metadata && s.metadata.feed_pinned) return true;
    return s.date >= cutoffISO(lookbackDaysForSignal(s, days));
  });
}

function envSuffixForCompetitor(competitorId) {
  return String(competitorId || '')
    .trim()
    .replace(/-/g, '_')
    .toUpperCase();
}

function isValidPublicUrl(value) {
  if (value == null || typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  try {
    const url = new URL(v);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function isValidYoutubeVideoId(v) {
  return typeof v === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(v.trim());
}

function parseYoutubeCommentVideoIds(base) {
  const raw = base && base.youtube_comment_video_ids;
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(isValidYoutubeVideoId);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[\s,]+/).map((x) => x.trim()).filter(isValidYoutubeVideoId);
  }
  return [];
}

function parseYoutubeDiscoveryQueries(base) {
  const raw = base && base.youtube_discovery_queries;
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  return [];
}

function youtubeDiscoveryMaxResults(base) {
  const n = parseInt(base && base.youtube_discovery_max_results, 10);
  return Math.min(15, Math.max(1, Number.isFinite(n) ? n : 5));
}

function youtubeDiscoveryMaxQueries(base) {
  const n = parseInt(base && base.youtube_discovery_max_queries, 10);
  return Math.min(8, Math.max(1, Number.isFinite(n) ? n : 4));
}

/**
 * Normalize a config value (string or string[]) plus an optional env override
 * (comma/whitespace separated) into a deduped array of valid http(s) URLs.
 * Used by case_studies_url, articles_url.
 */
function normalizeUrlList(rawValue, envOverride) {
  const fromEnv = (envOverride || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const fromConfig = Array.isArray(rawValue)
    ? rawValue.map((x) => String(x || '').trim()).filter(Boolean)
    : typeof rawValue === 'string' && rawValue.trim()
      ? [rawValue.trim()]
      : [];

  const merged = fromEnv.length ? fromEnv : fromConfig;
  return [...new Set(merged.filter((u) => isValidPublicUrl(u)))];
}


function getSourceUrls(competitorId) {
  const config = loadConfig();
  const base = (config.sources && config.sources[competitorId]) || {};
  const suffix = envSuffixForCompetitor(competitorId);

  const urls = {
    blog: process.env[`TRACKER_FEED_URL_${suffix}`] || base.blog || '',
    press: process.env[`TRACKER_PRESS_URL_${suffix}`] || base.press || base.news || '',
    changelog: process.env[`TRACKER_CHANGELOG_URL_${suffix}`] || base.changelog || '',
    youtube_rss: process.env[`TRACKER_YOUTUBE_RSS_${suffix}`] || base.youtube_rss || base.youtube || '',
    insights_url: process.env[`TRACKER_INSIGHTS_URL_${suffix}`] || base.insights_url || '',
    media_url: process.env[`TRACKER_MEDIA_URL_${suffix}`] || base.media_url || '',
    podcast_url: process.env[`TRACKER_PODCAST_URL_${suffix}`] || base.podcast_url || '',
    reviews_url: process.env[`TRACKER_REVIEWS_URL_${suffix}`] || base.reviews_url || '',
    pricing_url: base.pricing_url || '',
    features_url: base.features_url || '',
    careers_url: base.careers_url || '',
    docs_url: base.docs_url || '',
  };

  const baseUrls = Object.fromEntries(
    Object.entries(urls).map(([k, v]) => [k, isValidPublicUrl(v) ? v : ''])
  );
  const caseStudiesList = normalizeUrlList(
    base.case_studies_url,
    process.env[`TRACKER_CASE_STUDIES_URL_${suffix}`] || ''
  );
  const articlesList = normalizeUrlList(
    base.articles_url,
    process.env[`TRACKER_ARTICLES_URL_${suffix}`] || ''
  );
  return {
    ...baseUrls,
    case_studies_url: caseStudiesList[0] || '',
    case_studies_urls: caseStudiesList,
    articles_url: articlesList[0] || '',
    articles_urls: articlesList,
    youtube_comment_video_ids: parseYoutubeCommentVideoIds(base),
    youtube_discovery_queries: parseYoutubeDiscoveryQueries(base),
    youtube_discovery_max_results: youtubeDiscoveryMaxResults(base),
    youtube_discovery_max_queries: youtubeDiscoveryMaxQueries(base),
  };
}

async function fetchTextOnce(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await politeDelay();
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: browserHeaders({
        accept: 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    const text = await res.text();
    return text.slice(0, MAX_HTML_CHARS);
  } finally {
    clearTimeout(timer);
  }
}

/** Retry once on 403/429 — common WAF blip (Jonah, Cloudflare), not a permanent ban. */
async function fetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fetchTextOnce(url, timeoutMs);
    } catch (err) {
      lastErr = err;
      const msg = String((err && err.message) || err);
      const retryable = /\bHTTP (403|429)\b/.test(msg);
      if (!retryable || attempt >= 2) throw err;
      await sleep(1200 * attempt);
    }
  }
  throw lastErr;
}

// =====================================================================
// Playwright fallback path
// =====================================================================
//
// The static fetchText path above succeeds for ~80% of sources (server-rendered
// marketing pages with usable HTML in the initial response). The remaining ~20%
// are single-page apps (Webflow, custom React/Vue) where the body is hydrated
// client-side — Cheerio sees an empty DOM. Those URLs return parse_ok:false
// stub signals with zero evidence_snippet (drop 2026-05-07T22-19-26Z had three:
// jonahdigital.com/, jonahdigital.com/add-ons/, featuredcustomers.com/...).
//
// fetchRendered launches a shared headless Chromium via Playwright, navigates
// to the URL, waits for the DOM to stabilize, and returns the resulting HTML.
// Lane collectors call fetchTextWithFallback, which tries the static path
// first and only falls through to Playwright when the static body is too thin
// to extract anything useful. The Playwright path is the slow path (~5–15s per
// URL); it must not be triggered on URLs that work statically.
//
// Hard exclusions (PLAYWRIGHT_EXCLUDE_HOSTS):
//   - g2.com  — Cloudflare bot-shield rejects Playwright the same way it
//     rejects undici. G2 needs an API or Apify-style residential proxy,
//     not a local headless browser. See SKILL.md §3 (G2 API path).
//
// Disable via TRACKER_NO_PLAYWRIGHT_FALLBACK=1 (e.g. when debugging selector
// changes — you want to see exactly what the static fetch returns).
// =====================================================================

const PLAYWRIGHT_DISABLED = process.env.TRACKER_NO_PLAYWRIGHT_FALLBACK === '1';
// 15s navigate timeout + 4s post-DOMContentLoaded settle ≈ 19s worst-case per
// rendered URL. networkidle was tried at 30s and routinely never fires on
// marketing pages (analytics + chat widgets keep firing requests indefinitely).
const PLAYWRIGHT_TIMEOUT_MS = Number(process.env.TRACKER_PLAYWRIGHT_TIMEOUT_MS || 15000);
// 6s settle empirically catches sites with lazy review hydration
// (e.g. featuredcustomers.com, which doesn't fill its testimonial divs
// until ~5–6s after DOMContentLoaded). 4s was tested and missed them.
const PLAYWRIGHT_SETTLE_MS = Number(process.env.TRACKER_PLAYWRIGHT_SETTLE_MS || 6000);
const PLAYWRIGHT_MIN_BODY_CHARS = Number(process.env.TRACKER_PLAYWRIGHT_MIN_BODY_CHARS || 200);
const PLAYWRIGHT_EXCLUDE_HOSTS = new Set([
  // Cloudflare-shielded; needs API/proxy, not a local headless browser.
  'www.g2.com',
  'g2.com',
]);

// Hosts that often 403 undici/static fetch from CI (datacenter IP + bot score)
// but succeed in a real Chromium session. Prefer Playwright first.
const FORCE_PLAYWRIGHT_HOSTS = new Set(['jonahdigital.com']);

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function shouldForcePlaywright(url) {
  return FORCE_PLAYWRIGHT_HOSTS.has(hostOf(url));
}

// Resource types we don't need for text extraction. Blocking them at the
// network layer cuts page load from ~10–30s to ~2–5s on most marketing pages.
const PLAYWRIGHT_BLOCK_RESOURCE_TYPES = new Set([
  'image',
  'media',
  'font',
  'stylesheet', // we don't parse CSS-only content
]);
// Hosts whose scripts we don't need (analytics, chat widgets, ad networks).
// Blocking these is the single biggest networkidle accelerator.
const PLAYWRIGHT_BLOCK_HOST_FRAGMENTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'segment.io',
  'segment.com',
  'mixpanel.com',
  'hotjar.com',
  'fullstory.com',
  'intercom.io',
  'intercom.com',
  'drift.com',
  'qualified.com',
  'optimizely.com',
  'newrelic.com',
  'amplitude.com',
];

let _browserPromise = null;

async function getBrowser() {
  if (_browserPromise) return _browserPromise;
  const { chromium } = require('playwright');
  _browserPromise = chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
  return _browserPromise;
}

async function shutdownBrowser() {
  if (!_browserPromise) return;
  try {
    const b = await _browserPromise;
    await b.close();
  } catch (_) {
    // Browser may already be dead; not actionable.
  } finally {
    _browserPromise = null;
  }
}

function isPlaywrightExcluded(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PLAYWRIGHT_EXCLUDE_HOSTS.has(host);
  } catch (_) {
    return true;
  }
}

async function fetchRendered(url, timeoutMs = PLAYWRIGHT_TIMEOUT_MS) {
  if (PLAYWRIGHT_DISABLED) {
    throw new Error('playwright fallback disabled (TRACKER_NO_PLAYWRIGHT_FALLBACK=1)');
  }
  if (isPlaywrightExcluded(url)) {
    throw new Error(`host excluded from playwright fallback: ${url}`);
  }

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 800 },
    javaScriptEnabled: true,
    extraHTTPHeaders: {
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      referer: 'https://www.google.com/',
    },
  });
  try {
    const page = await ctx.newPage();

    // Block resource types and tracker hosts that contribute nothing to text
    // extraction but routinely keep the network busy for 30+ seconds.
    await page.route('**/*', (route) => {
      const req = route.request();
      if (PLAYWRIGHT_BLOCK_RESOURCE_TYPES.has(req.resourceType())) {
        return route.abort();
      }
      const reqHost = (() => {
        try { return new URL(req.url()).hostname.toLowerCase(); } catch (_) { return ''; }
      })();
      if (reqHost && PLAYWRIGHT_BLOCK_HOST_FRAGMENTS.some((f) => reqHost.includes(f))) {
        return route.abort();
      }
      return route.continue();
    });

    // domcontentloaded fires when DOM is parsed (~1–3s). networkidle was tried
    // and routinely never fires on marketing pages because analytics/chat
    // widgets keep firing requests indefinitely. After DOMContentLoaded we
    // give frameworks a small settle window to hydrate, then read the DOM.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(PLAYWRIGHT_SETTLE_MS);
    const html = await page.content();
    return html.slice(0, MAX_HTML_CHARS);
  } finally {
    await ctx.close();
  }
}

/**
 * Static fetch with Playwright fallback when the static body is too thin to be useful.
 *
 * Returns:
 *   { html, renderer, fallbackReason, bodyChars }
 *
 * renderer is 'static' or 'playwright'; lane collectors should stamp this into
 * the resulting signal's metadata so we can audit which lanes leaned on Playwright
 * in a given drop.
 *
 * NOTE: bodyChars-as-trigger is unreliable for SPAs whose static shells return
 * 4–8KB of nav/footer chrome text. Lane-aware retries via fetchStaticOrRendered
 * (below) are the recommended primary path — this function is kept for callers
 * that don't have a per-lane extractor signal.
 */
async function fetchTextWithFallback(url, opts = {}) {
  const { minBodyChars = PLAYWRIGHT_MIN_BODY_CHARS } = opts;
  const forcePw = shouldForcePlaywright(url) && !PLAYWRIGHT_DISABLED && !isPlaywrightExcluded(url);

  if (forcePw) {
    try {
      const rendered = await fetchRendered(url, PLAYWRIGHT_TIMEOUT_MS);
      return {
        html: rendered,
        renderer: 'playwright',
        fallbackReason: 'force_playwright_host',
        bodyChars: rendered.length,
      };
    } catch (renderErr) {
      // Fall through to static retry — better than failing cold.
      pwLog('force-pw-fail', url, renderErr.message);
    }
  }

  let html = '';
  let staticError = null;

  try {
    html = await fetchText(url, DEFAULT_TIMEOUT_MS);
  } catch (err) {
    staticError = err;
  }

  if (!staticError) {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    if (bodyText.length >= minBodyChars) {
      return { html, renderer: 'static', fallbackReason: null, bodyChars: bodyText.length };
    }
    staticError = new Error(`static body too thin (${bodyText.length} chars < ${minBodyChars})`);
  }

  if (PLAYWRIGHT_DISABLED || isPlaywrightExcluded(url)) {
    throw staticError;
  }

  try {
    const rendered = await fetchRendered(url, PLAYWRIGHT_TIMEOUT_MS);
    return {
      html: rendered,
      renderer: 'playwright',
      fallbackReason: String(staticError.message || staticError),
      bodyChars: rendered.length,
    };
  } catch (renderErr) {
    const wrapped = new Error(
      `static failed (${staticError.message}); playwright failed (${renderErr.message})`
    );
    wrapped.cause = renderErr;
    throw wrapped;
  }
}

/**
 * Lane-aware fetch helper. Takes the URL and an `extract` callback. Tries the
 * static fast path first; if the extractor reports the result is empty/thin,
 * retries with the Playwright slow path and re-extracts. Returns the chosen
 * extraction plus a `renderer` marker for metadata stamping.
 *
 * Contract for `extract`:
 *   extract(html, $) => { isEmpty: boolean, ...rest }
 *   - `isEmpty: true` means "static had nothing useful; please try harder"
 *   - any other fields are passed through to the caller untouched
 *
 * This is the primary recommended path for any lane whose extractor has a
 * clear notion of "I found nothing" (e.g. selector-count check, parse_ok flag).
 * It avoids the body-length false-positives that plague fetchTextWithFallback.
 */
const PLAYWRIGHT_DEBUG = process.env.TRACKER_PLAYWRIGHT_DEBUG === '1';
function pwLog(...args) {
  if (PLAYWRIGHT_DEBUG) console.error('[pw]', ...args);
}

async function fetchStaticOrRendered(url, extract) {
  const forcePw = shouldForcePlaywright(url) && !PLAYWRIGHT_DISABLED && !isPlaywrightExcluded(url);
  if (forcePw) {
    pwLog('force-pw-first', url);
    try {
      const rendered = await fetchRendered(url, PLAYWRIGHT_TIMEOUT_MS);
      const $r = cheerio.load(rendered);
      $r('script, style, noscript, svg, iframe').remove();
      const result = extract(rendered, $r);
      if (!result || result.isEmpty !== true) {
        return { ...result, html: rendered, renderer: 'playwright', fallbackReason: 'force_playwright_host' };
      }
    } catch (renderErr) {
      pwLog('force-pw-fail', url, renderErr.message);
    }
  }

  let html = '';
  let staticError = null;

  try {
    html = await fetchText(url, DEFAULT_TIMEOUT_MS);
  } catch (err) {
    staticError = err;
    pwLog('static-fail', url, err.message);
  }

  if (!staticError) {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe').remove();
    const staticResult = extract(html, $);
    pwLog('static-extract', url, 'isEmpty=', staticResult && staticResult.isEmpty);
    if (!staticResult || staticResult.isEmpty !== true) {
      return { ...staticResult, html, renderer: 'static', fallbackReason: null };
    }
  }

  if (PLAYWRIGHT_DISABLED || isPlaywrightExcluded(url)) {
    pwLog('skip-pw', url, 'disabled=', PLAYWRIGHT_DISABLED, 'excluded=', isPlaywrightExcluded(url));
    if (staticError) throw staticError;
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe').remove();
    const staticResult = extract(html, $);
    return { ...staticResult, html, renderer: 'static', fallbackReason: 'fallback disabled or host excluded' };
  }

  pwLog('try-render', url);
  let rendered = '';
  try {
    rendered = await fetchRendered(url, PLAYWRIGHT_TIMEOUT_MS);
    pwLog('render-ok', url, 'html_len=', rendered.length);
  } catch (renderErr) {
    pwLog('render-fail', url, renderErr.message);
    if (staticError) throw staticError;
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe').remove();
    const staticResult = extract(html, $);
    return {
      ...staticResult,
      html,
      renderer: 'static',
      fallbackReason: `render attempted, failed: ${renderErr.message}`,
    };
  }

  const $r = cheerio.load(rendered);
  $r('script, style, noscript, svg, iframe').remove();
  const renderedResult = extract(rendered, $r);
  return {
    ...renderedResult,
    html: rendered,
    renderer: 'playwright',
    fallbackReason: staticError ? `static failed (${staticError.message})` : 'static extraction empty',
  };
}

function normalizeWhitespace(str) {
  return String(str || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function truncate(str, max) {
  const s = normalizeWhitespace(str);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function loadHtml(html) {
  const $ = cheerio.load(html || '');
  $('script, style, noscript, svg, iframe').remove();
  return $;
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

  const headings = unique(
    $('h1, h2, h3')
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get()
      .filter((t) => t.length >= 4 && t.length <= 140)
  ).slice(0, 20);

  const bullets = unique(
    $('li')
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get()
      .filter((t) => t.length >= 8 && t.length <= 220)
  ).slice(0, 40);

  const bodyText = normalizeWhitespace($('body').text());

  return {
    pageUrl,
    title: normalizeWhitespace(title),
    description: normalizeWhitespace(description),
    headings,
    bullets,
    bodyText,
  };
}

function extractMoneyValues(text) {
  const matches =
    String(text || '').match(/\$\s?\d[\d,]*(?:\.\d{1,2})?(?:\s*\/\s*(?:mo|month|yr|year))?/gi) || [];
  return unique(matches).slice(0, 20);
}

function detectKeywords(text, keywords) {
  const haystack = String(text || '').toLowerCase();
  return keywords.filter((kw) => haystack.includes(kw.toLowerCase()));
}

function scoreConfidence({ evidenceCount = 0, hasAmounts = false, hasHeadings = false, directPage = false }) {
  let score = 0.45;
  if (directPage) score += 0.15;
  if (evidenceCount >= 2) score += 0.15;
  if (evidenceCount >= 5) score += 0.1;
  if (hasAmounts) score += 0.1;
  if (hasHeadings) score += 0.05;
  return Math.min(0.95, Number(score.toFixed(2)));
}

function buildSignalBase({
  competitorId,
  productId,
  source,
  type,
  event_type,
  headline,
  source_url,
  date,
  snippet,
  evidence_snippet,
  confidence,
  importance,
  entities,
  metadata,
}) {
  return {
    date: date || todayISO(),
    source,
    competitor_id: competitorId,
    product_id: productId,
    type,
    event_type,
    headline: truncate(headline || '', 180),
    snippet: truncate(snippet || '', MAX_SNIPPET),
    evidence_snippet: truncate(evidence_snippet || '', MAX_EVIDENCE),
    source_url,
    confidence: typeof confidence === 'number' ? confidence : 0.6,
    importance: typeof importance === 'number' ? importance : 0.6,
    entities: entities || {},
    metadata: attachIntelPillarMetadata(metadata || {}, source, type),
  };
}

function extractPricingSignals(meta, pageUrl, competitorId, productId) {
  const combined = [meta.title, meta.description, ...meta.headings, ...meta.bullets, meta.bodyText]
    .filter(Boolean)
    .join('\n');

  const prices = extractMoneyValues(combined);
  const tierCandidates = unique(
    [...meta.headings, ...meta.bullets]
      .filter((t) => /plan|tier|starter|pro|premium|enterprise|growth|basic/i.test(t))
      .map((t) => t.replace(/\s+/g, ' ').trim())
  ).slice(0, 10);

  const featureKeywords = detectKeywords(combined, FEATURE_KEYWORDS);
  const evidenceParts = [
    meta.description,
    ...tierCandidates.slice(0, 5),
    ...prices.slice(0, 5),
    ...meta.bullets.slice(0, 5),
  ].filter(Boolean);

  if (!prices.length && !tierCandidates.length && !featureKeywords.length) return [];

  const eventType = prices.length ? 'pricing_change' : 'pricing_positioning';
  const snippet = [
    prices.length ? `Detected pricing values: ${prices.slice(0, 5).join(', ')}` : '',
    tierCandidates.length ? `Tier language: ${tierCandidates.slice(0, 4).join(' | ')}` : '',
    featureKeywords.length ? `Packaging keywords: ${featureKeywords.slice(0, 8).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  return [
    buildSignalBase({
      competitorId,
      productId,
      source: 'pricing_page',
      type: 'pricing',
      event_type: eventType,
      headline: meta.title || 'Pricing page update',
      source_url: pageUrl,
      date: todayISO(),
      snippet,
      evidence_snippet: evidenceParts.join(' • '),
      confidence: scoreConfidence({
        evidenceCount: evidenceParts.length,
        hasAmounts: prices.length > 0,
        hasHeadings: meta.headings.length > 0,
        directPage: true,
      }),
      importance: prices.length ? 0.92 : 0.72,
      entities: {
        prices,
        tiers: tierCandidates,
        keywords: featureKeywords,
      },
      metadata: {
        page_kind: 'pricing',
      },
    }),
  ];
}

function extractFeatureSignals(meta, pageUrl, competitorId, productId) {
  const headings = meta.headings.filter((h) => h.length >= 6);
  const bullets = meta.bullets.filter((b) => b.length >= 10 && b.length <= 200);
  const featureKeywords = detectKeywords(
    [meta.title, meta.description, ...headings, ...bullets, meta.bodyText].join('\n'),
    FEATURE_KEYWORDS
  );
  const positioningKeywords = detectKeywords(
    [meta.title, meta.description, ...headings, ...bullets, meta.bodyText].join('\n'),
    POSITIONING_KEYWORDS
  );

  const featureCandidates = unique(
    [...headings, ...bullets].filter(
      (t) =>
        !/cookie|privacy|login|book a demo|request a demo|contact us|learn more/i.test(t) &&
        (FEATURE_KEYWORDS.some((kw) => t.toLowerCase().includes(kw)) ||
          /ai|automation|leasing|tour|crm|application|analytics|screening|assistant|messaging/i.test(t))
    )
  ).slice(0, 10);

  if (!featureCandidates.length && !positioningKeywords.length) return [];

  const eventType =
    featureCandidates.length >= 3
      ? 'feature_set_update'
      : positioningKeywords.length
        ? 'positioning_shift'
        : 'feature_launch';

  const snippet = [
    featureCandidates.length ? `Detected feature/solution themes: ${featureCandidates.slice(0, 4).join(' | ')}` : '',
    featureKeywords.length ? `Repeated product keywords: ${featureKeywords.slice(0, 8).join(', ')}` : '',
    positioningKeywords.length ? `Positioning cues: ${positioningKeywords.slice(0, 6).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  return [
    buildSignalBase({
      competitorId,
      productId,
      source: 'features_page',
      type: 'features',
      event_type: eventType,
      headline: meta.title || 'Feature page update',
      source_url: pageUrl,
      date: todayISO(),
      snippet,
      evidence_snippet: [...featureCandidates.slice(0, 5), ...meta.bullets.slice(0, 5)].join(' • '),
      confidence: scoreConfidence({
        evidenceCount: featureCandidates.length + positioningKeywords.length,
        hasHeadings: headings.length > 0,
        directPage: true,
      }),
      importance: featureCandidates.length >= 3 ? 0.84 : 0.68,
      entities: {
        features: featureCandidates,
        keywords: featureKeywords,
        positioning_keywords: positioningKeywords,
      },
      metadata: {
        page_kind: 'features',
      },
    }),
  ];
}

function extractCareerSignals(meta, pageUrl, competitorId, productId) {
  const roleCandidates = unique(
    [...meta.headings, ...meta.bullets, ...meta.bodyText.split(/\n|\./)]
      .map((t) => normalizeWhitespace(t))
      .filter((t) => t.length >= 8 && t.length <= 120)
      .filter((t) => JOB_TITLE_PATTERNS.some((rx) => rx.test(t)))
  ).slice(0, 20);

  if (!roleCandidates.length) return [];

  const grouped = {
    engineering: roleCandidates.filter((r) => /engineer|developer|ml|ai|data/i.test(r)),
    sales: roleCandidates.filter((r) => /sales|account executive|revenue/i.test(r)),
    customer: roleCandidates.filter((r) => /customer success|implementation|support/i.test(r)),
    product: roleCandidates.filter((r) => /product manager|designer/i.test(r)),
    partnerships: roleCandidates.filter((r) => /partnership/i.test(r)),
    marketing: roleCandidates.filter((r) => /marketing|growth/i.test(r)),
  };

  const activeGroups = Object.entries(grouped)
    .filter(([, roles]) => roles.length)
    .map(([group]) => group);

  const snippet = [
    `Detected hiring focus: ${activeGroups.join(', ') || 'general hiring'}`,
    `Roles seen: ${roleCandidates.slice(0, 6).join(' | ')}`,
  ].join('. ');

  return [
    buildSignalBase({
      competitorId,
      productId,
      source: 'careers',
      type: 'job',
      event_type: 'hiring_signal',
      headline: meta.title || 'Careers page update',
      source_url: pageUrl,
      date: todayISO(),
      snippet,
      evidence_snippet: roleCandidates.slice(0, 10).join(' • '),
      confidence: scoreConfidence({
        evidenceCount: roleCandidates.length,
        hasHeadings: meta.headings.length > 0,
        directPage: true,
      }),
      importance: grouped.engineering.length || grouped.sales.length ? 0.86 : 0.7,
      entities: {
        roles: roleCandidates,
        role_groups: activeGroups,
      },
      metadata: {
        page_kind: 'careers',
      },
    }),
  ];
}

function inferArticleEventType(title, content) {
  const haystack = `${title}\n${content}`;
  for (const rule of ARTICLE_EVENT_RULES) {
    if (rule.patterns.some((rx) => rx.test(haystack))) {
      return {
        event_type: rule.event_type,
        importance: rule.importance,
      };
    }
  }
  return {
    event_type: 'content_update',
    importance: 0.55,
  };
}

function extractNamedEntities(text) {
  const source = normalizeWhitespace(text);
  const integrations = unique(
    (source.match(/\b(Yardi|RealPage|Entrata|AppFolio|Salesforce|Zapier|HubSpot|MRI|Knock)\b/gi) || []).map((x) =>
      x.trim()
    )
  );
  const aiTerms = unique(
    (source.match(/\b(AI|voice AI|chatbot|assistant|automation|machine learning)\b/gi) || []).map((x) => x.trim())
  );
  return { integrations, ai_terms: aiTerms };
}

async function fetchArticleEvidence(url) {
  if (!isValidPublicUrl(url)) {
    return { title: '', description: '', content: '', html: '', renderer: null };
  }

  try {
    const { html, renderer } = await fetchTextWithFallback(url);
    const $ = loadHtml(html);
    const meta = extractMeta($, url);

    const articleText = unique(
      $('article p, main p, .post p, .entry-content p, .content p, p')
        .map((_, el) => normalizeWhitespace($(el).text()))
        .get()
        .filter((t) => t.length >= 40)
    ).slice(0, 20);

    return {
      title: meta.title,
      description: meta.description,
      content: normalizeWhitespace(articleText.join('\n\n') || meta.bodyText).slice(0, 6000),
      // Keep HTML for multi-subrow split (changelog / release pages).
      html: typeof html === 'string' ? html : '',
      renderer,
    };
  } catch (_) {
    return { title: '', description: '', content: '', html: '', renderer: null };
  }
}

function coerceItemDate(item) {
  const raw = item.isoDate || item.pubDate || item.published || item.updated || '';
  const d = raw ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) return todayISO();
  return d.toISOString().slice(0, 10);
}

function pushLaneResult(session, lane) {
  if (session && Array.isArray(session.laneResults)) {
    session.laneResults.push(lane);
  }
}

/**
 * @returns {Promise<{ signals: object[], lane: object }>}
 */
async function extractFeedSignals(feedUrl, sourceType, competitorId, productId, days) {
  const lane = {
    competitor_id: competitorId,
    lane: sourceType,
    url: feedUrl,
    status: 'ok',
    signal_count: 0,
    error: null,
  };

  if (!isValidPublicUrl(feedUrl)) {
    lane.status = 'skipped_invalid';
    return { signals: [], lane };
  }

  let feed;
  try {
    await politeDelay();
    feed = await parser.parseURL(feedUrl);
  } catch (err) {
    lane.status = 'error';
    lane.error = String((err && err.message) || err);
    return { signals: [], lane };
  }

  // Changelog feeds use a longer lookback so release notes aren't buried before
  // Monday catch-up (Anyone Home Jun 18 → empty_window by early July taught this).
  const laneDays =
    sourceType === 'changelog' ? Math.max(parseDays(days), CHANGELOG_LOOKBACK_DAYS) : parseDays(days);
  const cutoff = cutoffISO(laneDays);
  const absoluteCutoff = cutoffISO(CHANGELOG_ABSOLUTE_MAX_DAYS);
  const items = Array.isArray(feed.items) ? feed.items.slice(0, 20) : [];
  const signals = [];

  const typeMap = {
    blog: 'blog',
    press: 'press',
    changelog: 'changelog',
    youtube: 'youtube',
    insights: 'insights',
    media: 'media',
    podcast: 'podcast',
  };
  const signalType = typeMap[sourceType] || 'blog';

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex];
    const date = coerceItemDate(item);
    const withinWindow = date >= cutoff;
    // Still in the top of the RSS feed? Keep it even if slightly outside the window
    // (pre-dated "21 July Release" posts that sit in the feed for weeks).
    const pinnedInFeed =
      sourceType === 'changelog' &&
      itemIndex < CHANGELOG_FEED_PIN_COUNT &&
      date >= absoluteCutoff;
    if (!withinWindow && !pinnedInFeed) continue;

    const title = normalizeWhitespace(item.title || '');
    const link = item.link || item.guid || feedUrl;
    const rssSnippet = normalizeWhitespace(item.contentSnippet || item.content || item.summary || '');
    const article = await fetchArticleEvidence(link);

    const combined = [title, rssSnippet, article.title, article.description, article.content]
      .filter(Boolean)
      .join('\n\n');

    const { event_type, importance } = inferArticleEventType(title, combined);
    const entities = extractNamedEntities(combined);

    const evidence = [article.description, ...article.content.split('\n\n').slice(0, 3)]
      .filter(Boolean)
      .join(' • ');

    const baseMeta = {
      page_kind: sourceType,
      feed_title: normalizeWhitespace(feed.title || ''),
      feed_pinned: Boolean(pinnedInFeed && !withinWindow),
    };

    // Multi-subrow split: one release page → N capability signals (v1: changelog).
    if (shouldSplitSource(sourceType) && article.html) {
      const { subrows, strategy } = splitPageSubrows(article.html, {
        pageTitle: title || article.title,
        sourceUrl: link,
        competitorId,
      });
      if (subrows.length >= 2) {
        for (const row of subrows) {
          signals.push(
            buildSignalBase({
              competitorId,
              productId,
              source: sourceType,
              type: signalType,
              event_type,
              headline: row.headline,
              source_url: link,
              date,
              snippet: row.blurb,
              evidence_snippet: [row.area, row.heading, row.blurb].filter(Boolean).join(' — '),
              confidence: scoreConfidence({
                evidenceCount: 2,
                hasHeadings: true,
                directPage: true,
              }),
              importance,
              entities,
              metadata: {
                ...baseMeta,
                split_strategy: strategy,
                capability_key: row.capability_key,
                capability_heading: row.heading,
                capability_area: row.area,
                parent_release_title: title || article.title,
              },
            })
          );
        }
        continue;
      }
    }

    signals.push(
      buildSignalBase({
        competitorId,
        productId,
        source: sourceType,
        type: signalType,
        event_type,
        headline: title || article.title || `${sourceType} update`,
        source_url: link,
        date,
        snippet:
          rssSnippet ||
          article.description ||
          article.content.split('\n\n')[0] ||
          title,
        evidence_snippet: evidence,
        confidence: scoreConfidence({
          evidenceCount: evidence ? evidence.split('•').length : 1,
          hasHeadings: Boolean(title),
          directPage: Boolean(article.content),
        }),
        importance,
        entities,
        metadata: baseMeta,
      })
    );
  }

  lane.signal_count = signals.length;
  if (signals.length === 0) {
    // Feed fetched OK; nothing in the retention window — not a failure.
    lane.status = 'empty_window';
  }
  return { signals, lane };
}

async function extractPageSignals(pageUrl, pageKind, competitorId, productId) {
  if (!isValidPublicUrl(pageUrl)) return [];

  const out = await fetchStaticOrRendered(pageUrl, (html, $) => {
    const meta = extractMeta($, pageUrl);
    let signals = [];
    if (pageKind === 'pricing_url') {
      signals = extractPricingSignals(meta, pageUrl, competitorId, productId);
    } else if (pageKind === 'features_url' || pageKind === 'docs_url') {
      signals = extractFeatureSignals(meta, pageUrl, competitorId, productId);
    } else if (pageKind === 'careers_url') {
      signals = extractCareerSignals(meta, pageUrl, competitorId, productId);
    }
    // Empty when no signals were produced OR every signal is "thin" (short
    // evidence_snippet). The thin-check catches SPAs whose static shell has
    // just enough chrome text for the extractor to match one positioning
    // keyword — technically a signal, practically useless.
    const meaningful = signals.filter((s) => (s.evidence_snippet || '').length >= 50);
    const isEmpty = signals.length === 0 || meaningful.length === 0;
    return { signals, isEmpty };
  });

  const signals = out.signals || [];
  for (const s of signals) {
    s.metadata = { ...(s.metadata || {}), renderer: out.renderer };
  }
  return signals;
}

function dedupeSignals(signals) {
  const seen = new Set();
  const out = [];

  for (const s of signals) {
    const capabilityKey =
      (s.metadata && s.metadata.capability_key) || (s.headline || '').slice(0, 80);
    const key = [
      s.date,
      s.competitor_id,
      s.product_id,
      s.type,
      s.event_type,
      s.source_url,
      capabilityKey,
      (s.snippet || '').slice(0, 120),
    ].join('|');

    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }

  return out;
}

async function collectYouTubeDiscoverySignals(
  competitorId,
  productId,
  queries,
  maxResultsPerQuery,
  maxQueriesPerRun,
  days
) {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY || '';
  if (!apiKey || !queries || !queries.length) return [];

  const cutoff = cutoffISO(days);
  const runQueries = queries.slice(0, maxQueriesPerRun);
  const publishedAfterDate = new Date();
  publishedAfterDate.setDate(publishedAfterDate.getDate() - parseDays(days));
  const publishedAfter = publishedAfterDate.toISOString();

  /** @type {Map<string, { videoId: string, title: string, description: string, channelTitle: string, publishedAt: string, queries: string[] }>} */
  const byId = new Map();

  for (const q of runQueries) {
    try {
      const rows = await searchYouTubeVideos(apiKey, q, {
        maxResults: maxResultsPerQuery,
        publishedAfter,
      });
      for (const row of rows) {
        if (!row.publishedAt || row.publishedAt < cutoff) continue;
        if (!byId.has(row.videoId)) {
          byId.set(row.videoId, { ...row, queries: [q] });
        } else {
          const cur = byId.get(row.videoId);
          if (!cur.queries.includes(q)) cur.queries.push(q);
        }
      }
    } catch (_) {
      /* quota or network — skip query */
    }
  }

  if (!byId.size) return [];

  const ids = [...byId.keys()];
  let details = new Map();
  try {
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const part = await listVideoDetails(apiKey, chunk);
      part.forEach((v, k) => details.set(k, v));
    }
  } catch (_) {
    details = new Map();
  }

  const signals = [];
  for (const [videoId, row] of byId) {
    const d = details.get(videoId) || {};
    const combined = [row.title, row.description, row.channelTitle].join('\n');
    const { event_type, importance } = inferArticleEventType(row.title, combined);
    const entities = {
      ...extractNamedEntities(combined),
      video_id: videoId,
      channel_title: row.channelTitle,
      discovery_queries: row.queries,
    };

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const queryNote = `Queries: ${row.queries.join(' | ')}`;
    const statsNote = [d.viewCount ? `${d.viewCount} views` : '', d.duration ? `duration ${d.duration}` : '']
      .filter(Boolean)
      .join(' · ');

    signals.push(
      buildSignalBase({
        competitorId,
        productId,
        source: 'youtube_search',
        type: 'review_youtube',
        event_type,
        headline: row.title || `YouTube video ${videoId}`,
        source_url: watchUrl,
        date: row.publishedAt,
        snippet: `${queryNote}. ${row.description.slice(0, 400)}`,
        evidence_snippet: [row.channelTitle, statsNote, row.description.slice(0, 800)].filter(Boolean).join(' • '),
        confidence: scoreConfidence({
          evidenceCount: 2,
          hasHeadings: Boolean(row.title),
          directPage: Boolean(row.description),
        }),
        importance: Math.min(0.92, (importance || 0.7) + 0.05),
        entities,
        metadata: {
          page_kind: 'youtube_search',
          video_id: videoId,
          channel_title: row.channelTitle,
          view_count: d.viewCount || null,
          duration_iso: d.duration || null,
        },
      })
    );
  }

  return signals;
}

async function collectYouTubeCommentSignals(competitorId, productId, videoIds) {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY || '';
  if (!apiKey || !videoIds || !videoIds.length) return [];

  const signals = [];
  for (const videoId of videoIds) {
    try {
      const comments = await fetchYouTubeCommentThreads(videoId, apiKey, { maxResults: 20 });
      if (!comments.length) continue;

      /* Snapshot date = run day so the row stays inside the report window after collect. */
      const date = todayISO();
      const quotes = comments.slice(0, 8).map((c) => c.text);
      const evidence = comments
        .slice(0, 5)
        .map((c) => (c.author ? `${c.author}: ${c.text}` : c.text))
        .join(' • ');

      const combined = quotes.join('\n');
      const { event_type, importance } = inferArticleEventType('YouTube comments', combined);
      const entities = { ...extractNamedEntities(combined), review_quotes: quotes.slice(0, 5) };

      signals.push(
        buildSignalBase({
          competitorId,
          productId,
          source: 'youtube_comments',
          type: 'review_youtube',
          event_type,
          headline: `YouTube comments (${videoId})`,
          source_url: `https://www.youtube.com/watch?v=${videoId}`,
          date,
          snippet: `Sampled ${comments.length} thread(s). Themes: ${quotes[0].slice(0, 200)}`,
          evidence_snippet: evidence,
          confidence: scoreConfidence({
            evidenceCount: quotes.length,
            hasHeadings: false,
            directPage: true,
          }),
          importance,
          entities,
          metadata: { page_kind: 'youtube_comments', video_id: videoId },
        })
      );
    } catch (_) {
      /* skip video on API error */
    }
  }
  return signals;
}

/**
 * Generic non-G2 review aggregator extractor.
 * Used for FeaturedCustomers, FitGap, Revyse, SlashDot, etc. Each site has a different DOM,
 * so we cast a wide net: pull blockquotes, paragraph text, and itemprop=review markers.
 * Returns one signal block per URL with the best excerpts found.
 */
async function collectGenericReviewSignals(competitorId, productId, reviewsUrl) {
  if (!isValidPublicUrl(reviewsUrl)) return [];

  const REVIEW_SELECTORS = [
    '[itemprop="reviewBody"]',
    '[itemprop="description"]',
    'blockquote',
    '.testimonial, .review, .review-text, .review-body, .quote',
    'div[class*="testimonial"], div[class*="review"], div[class*="quote"]',
  ];

  let result;
  try {
    result = await fetchStaticOrRendered(reviewsUrl, (html, $) => {
      const meta = extractMeta($, reviewsUrl);
      const excerpts = [];
      for (const sel of REVIEW_SELECTORS) {
        $(sel).each((_, el) => {
          if (excerpts.length >= 12) return false;
          const text = normalizeWhitespace($(el).text());
          if (text.length >= 30 && text.length <= 1200) excerpts.push(text);
          return undefined;
        });
        if (excerpts.length >= 4) break;
      }
      const uniqueExcerpts = unique(excerpts).slice(0, 8);
      pwLog('reviews-extract', reviewsUrl, 'html_len=', html.length, 'excerpts=', uniqueExcerpts.length);
      return { meta, uniqueExcerpts, isEmpty: uniqueExcerpts.length === 0 };
    });
  } catch (_) {
    return [];
  }

  const { meta, uniqueExcerpts, renderer } = result;

  if (!uniqueExcerpts.length) {
    return [
      buildSignalBase({
        competitorId,
        productId,
        source: 'reviews_other',
        type: 'review_other',
        event_type: 'content_update',
        headline: meta.title || 'External reviews (no excerpts in static HTML)',
        source_url: reviewsUrl,
        date: todayISO(),
        snippet: 'No review bodies found in static HTML. Site may hydrate via JavaScript.',
        evidence_snippet: meta.description || '',
        confidence: 0.3,
        importance: 0.45,
        entities: { review_quotes: [] },
        metadata: { page_kind: 'reviews_other', parse_ok: false, renderer },
      }),
    ];
  }

  const combined = uniqueExcerpts.join('\n');
  const { event_type, importance } = inferArticleEventType(meta.title || 'External reviews', combined);
  const entities = { ...extractNamedEntities(combined), review_quotes: uniqueExcerpts.slice(0, 6) };

  return [
    buildSignalBase({
      competitorId,
      productId,
      source: 'reviews_other',
      type: 'review_other',
      event_type,
      headline: meta.title || 'External review excerpts',
      source_url: reviewsUrl,
      date: todayISO(),
      snippet: `${uniqueExcerpts.length} excerpt(s) parsed. First: ${uniqueExcerpts[0].slice(0, 220)}`,
      evidence_snippet: uniqueExcerpts.slice(0, 4).join('\n\n'),
      confidence: scoreConfidence({
        evidenceCount: uniqueExcerpts.length,
        hasHeadings: false,
        directPage: true,
      }),
      importance,
      entities,
      metadata: { page_kind: 'reviews_other', parse_ok: true, renderer },
    }),
  ];
}

/**
 * HTML scraper for case-study / testimonial pages on the competitor's own domain.
 * Targets pages like /customer-stories/, /why-<company>/, /case-studies/.
 * Output: P1 owned, type 'case_study', dimension 'features'.
 */
async function collectCaseStudySignals(competitorId, productId, pageUrl) {
  if (!isValidPublicUrl(pageUrl)) return [];

  const TESTIMONIAL_SELECTORS = [
    '[itemprop="review"]',
    '[itemprop="reviewBody"]',
    'blockquote',
    '.testimonial, .case-study, .customer-story, .quote',
    'div[class*="testimonial"], div[class*="customer"], div[class*="quote"], div[class*="case-study"]',
    'section[class*="testimonial"], section[class*="customer"], section[class*="story"]',
  ];

  let result;
  try {
    result = await fetchStaticOrRendered(pageUrl, (html, $) => {
      const meta = extractMeta($, pageUrl);
      const excerpts = [];
      for (const sel of TESTIMONIAL_SELECTORS) {
        $(sel).each((_, el) => {
          if (excerpts.length >= 12) return false;
          const text = normalizeWhitespace($(el).text());
          if (text.length >= 40 && text.length <= 1400) excerpts.push(text);
          return undefined;
        });
        if (excerpts.length >= 6) break;
      }
      const uniqueExcerpts = unique(excerpts).slice(0, 8);
      const companyLogos = unique(
        $('img[alt]')
          .map((_, el) => normalizeWhitespace($(el).attr('alt') || ''))
          .get()
          .filter((t) => t.length >= 2 && t.length <= 60)
          .filter((t) => !/icon|logo only|menu|search|placeholder/i.test(t))
      ).slice(0, 12);
      return { meta, uniqueExcerpts, companyLogos, isEmpty: uniqueExcerpts.length === 0 };
    });
  } catch (_) {
    return [];
  }

  const { meta, uniqueExcerpts, companyLogos, renderer } = result;

  if (!uniqueExcerpts.length) {
    return [
      buildSignalBase({
        competitorId,
        productId,
        source: 'case_studies',
        type: 'case_study',
        event_type: 'content_update',
        headline: meta.title || 'Case studies (no excerpts in static HTML)',
        source_url: pageUrl,
        date: todayISO(),
        snippet: 'No testimonial bodies found in static HTML. Page may hydrate via JavaScript.',
        evidence_snippet: meta.description || '',
        confidence: 0.3,
        importance: 0.5,
        entities: { case_study_quotes: [], customer_logos: companyLogos },
        metadata: { page_kind: 'case_studies', parse_ok: false, renderer },
      }),
    ];
  }

  const combined = uniqueExcerpts.join('\n');
  const { event_type, importance } = inferArticleEventType(meta.title || 'Case studies', combined);
  const entities = {
    ...extractNamedEntities(combined),
    case_study_quotes: uniqueExcerpts.slice(0, 6),
    customer_logos: companyLogos,
  };

  return [
    buildSignalBase({
      competitorId,
      productId,
      source: 'case_studies',
      type: 'case_study',
      event_type,
      headline: meta.title || 'Customer case studies',
      source_url: pageUrl,
      date: todayISO(),
      snippet: `${uniqueExcerpts.length} testimonial(s) parsed. First: ${uniqueExcerpts[0].slice(0, 220)}`,
      evidence_snippet: uniqueExcerpts.slice(0, 4).join('\n\n'),
      confidence: scoreConfidence({
        evidenceCount: uniqueExcerpts.length,
        hasHeadings: meta.headings.length > 0,
        directPage: true,
      }),
      importance: Math.max(importance || 0.6, 0.7),
      entities,
      metadata: { page_kind: 'case_studies', parse_ok: true, renderer },
    }),
  ];
}

/**
 * HTML scraper for article-index pages (blog index, press hub, articles list).
 * Used when a site has rich content but no RSS feed (Webflow, custom CMS).
 * Output: P1 owned, type 'article', dimension 'features'.
 */
async function collectArticleIndexSignals(competitorId, productId, pageUrl) {
  if (!isValidPublicUrl(pageUrl)) return [];

  const cardSelectors = [
    'article',
    '.post-card, .blog-card, .news-card, .article-card',
    'div[class*="article-card"], div[class*="post-card"], div[class*="blog-card"]',
    'li[class*="post"], li[class*="article"]',
  ];

  let pageOrigin;
  try {
    pageOrigin = new URL(pageUrl).origin;
  } catch (_) {
    pageOrigin = '';
  }

  let result;
  try {
    result = await fetchStaticOrRendered(pageUrl, (html, $) => {
      const meta = extractMeta($, pageUrl);
      const cards = [];
      for (const sel of cardSelectors) {
        $(sel).each((_, el) => {
          if (cards.length >= 12) return false;
          const $el = $(el);
          const titleEl = $el.find('h2 a, h3 a, h4 a, a[class*="title"], a[class*="heading"]').first();
          const title = normalizeWhitespace(titleEl.text() || $el.find('h2, h3, h4').first().text());
          let href = titleEl.attr('href') || '';
          if (href && !/^https?:/i.test(href) && pageOrigin) {
            try {
              href = new URL(href, pageOrigin).toString();
            } catch (_) {
              /* leave as-is */
            }
          }
          const dateEl = $el.find('time').first();
          const dateAttr = dateEl.attr('datetime') || normalizeWhitespace(dateEl.text() || '');
          const summary = normalizeWhitespace($el.find('p').first().text());
          if (title && title.length >= 8 && title.length <= 200) {
            cards.push({ title, href, date: dateAttr, summary });
          }
          return undefined;
        });
        if (cards.length >= 6) break;
      }
      const seenTitles = new Set();
      const uniqueCards = cards.filter((c) => {
        const key = c.title.toLowerCase();
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      }).slice(0, 8);
      return { meta, uniqueCards, isEmpty: uniqueCards.length === 0 };
    });
  } catch (_) {
    return [];
  }

  const { meta, uniqueCards, renderer } = result;

  if (!uniqueCards.length) {
    return [
      buildSignalBase({
        competitorId,
        productId,
        source: 'articles_index',
        type: 'article',
        event_type: 'content_update',
        headline: meta.title || 'Articles index (no cards in static HTML)',
        source_url: pageUrl,
        date: todayISO(),
        snippet: 'No article cards found in static HTML. Page may hydrate via JavaScript.',
        evidence_snippet: meta.description || '',
        confidence: 0.3,
        importance: 0.45,
        entities: { article_titles: [] },
        metadata: { page_kind: 'articles_index', parse_ok: false, renderer },
      }),
    ];
  }

  const titles = uniqueCards.map((c) => c.title);
  const summaries = uniqueCards.map((c) => c.summary).filter(Boolean);
  const combined = [...titles, ...summaries].join('\n');
  const { event_type, importance } = inferArticleEventType(titles.join(' '), combined);
  const entities = {
    ...extractNamedEntities(combined),
    article_titles: titles.slice(0, 6),
    article_links: uniqueCards.map((c) => c.href).filter(Boolean).slice(0, 6),
  };

  const evidenceLines = uniqueCards.slice(0, 5).map((c) => {
    const date = c.date ? `[${c.date}] ` : '';
    return `${date}${c.title}${c.summary ? ` — ${c.summary.slice(0, 200)}` : ''}`;
  });

  return [
    buildSignalBase({
      competitorId,
      productId,
      source: 'articles_index',
      type: 'article',
      event_type,
      headline: meta.title || 'Articles index',
      source_url: pageUrl,
      date: todayISO(),
      snippet: `${uniqueCards.length} article(s) parsed. Latest: ${titles[0].slice(0, 220)}`,
      evidence_snippet: evidenceLines.join('\n'),
      confidence: scoreConfidence({
        evidenceCount: uniqueCards.length,
        hasHeadings: titles.length > 0,
        directPage: true,
      }),
      importance: importance || 0.6,
      entities,
      metadata: { page_kind: 'articles_index', parse_ok: true, renderer },
    }),
  ];
}

/**
 * @param {string} competitorId
 * @param {string} productId
 * @param {number} [days=7]
 * @param {{ youtubeDiscovery?: Map<string, object[]>, laneResults?: object[] } | null} [session]
 */
async function collect(competitorId, productId, days = 7, session = null) {
  let sourceUrls;
  try {
    sourceUrls = getSourceUrls(competitorId);
  } catch (_) {
    return [];
  }

  const safeDays = parseDays(days);
  const collected = [];

  // YouTube intentionally out of daily scrape (no API key / not a source we run).
  const feedTasks = [
    ['blog', sourceUrls.blog],
    ['press', sourceUrls.press],
    ['changelog', sourceUrls.changelog],
    ['insights', sourceUrls.insights_url],
    ['media', sourceUrls.media_url],
    ['podcast', sourceUrls.podcast_url],
  ];

  for (const [sourceType, url] of feedTasks) {
    if (!url) continue;
    const { signals, lane } = await extractFeedSignals(
      url,
      sourceType,
      competitorId,
      productId,
      safeDays
    );
    pushLaneResult(session, lane);
    collected.push(...signals);
  }

  const pageTasks = [
    ['pricing_url', sourceUrls.pricing_url],
    ['features_url', sourceUrls.features_url],
    ['careers_url', sourceUrls.careers_url],
    ['docs_url', sourceUrls.docs_url],
  ];

  for (const [pageKind, url] of pageTasks) {
    if (!url) continue;
    try {
      const signals = await extractPageSignals(url, pageKind, competitorId, productId);
      pushLaneResult(session, {
        competitor_id: competitorId,
        lane: pageKind,
        url,
        status: signals.length ? 'ok' : 'empty',
        signal_count: signals.length,
        error: null,
      });
      collected.push(...signals);
    } catch (err) {
      pushLaneResult(session, {
        competitor_id: competitorId,
        lane: pageKind,
        url,
        status: 'error',
        signal_count: 0,
        error: String((err && err.message) || err),
      });
    }
  }

  if (sourceUrls.reviews_url) {
    try {
      const otherReviewSignals = await collectGenericReviewSignals(
        competitorId,
        productId,
        sourceUrls.reviews_url
      );
      pushLaneResult(session, {
        competitor_id: competitorId,
        lane: 'reviews_url',
        url: sourceUrls.reviews_url,
        status: otherReviewSignals.length ? 'ok' : 'empty',
        signal_count: otherReviewSignals.length,
        error: null,
      });
      collected.push(...otherReviewSignals);
    } catch (err) {
      pushLaneResult(session, {
        competitor_id: competitorId,
        lane: 'reviews_url',
        url: sourceUrls.reviews_url,
        status: 'error',
        signal_count: 0,
        error: String((err && err.message) || err),
      });
    }
  }

  const caseStudyUrls = Array.isArray(sourceUrls.case_studies_urls)
    ? sourceUrls.case_studies_urls
    : [];
  for (const url of caseStudyUrls) {
    try {
      const signals = await collectCaseStudySignals(competitorId, productId, url);
      pushLaneResult(session, {
        competitor_id: competitorId,
        lane: 'case_studies',
        url,
        status: signals.length ? 'ok' : 'empty',
        signal_count: signals.length,
        error: null,
      });
      collected.push(...signals);
    } catch (err) {
      pushLaneResult(session, {
        competitor_id: competitorId,
        lane: 'case_studies',
        url,
        status: 'error',
        signal_count: 0,
        error: String((err && err.message) || err),
      });
    }
  }

  const articlesUrls = Array.isArray(sourceUrls.articles_urls) ? sourceUrls.articles_urls : [];
  for (const url of articlesUrls) {
    try {
      const signals = await collectArticleIndexSignals(competitorId, productId, url);
      pushLaneResult(session, {
        competitor_id: competitorId,
        lane: 'articles_index',
        url,
        status: signals.length ? 'ok' : 'empty',
        signal_count: signals.length,
        error: null,
      });
      collected.push(...signals);
    } catch (err) {
      pushLaneResult(session, {
        competitor_id: competitorId,
        lane: 'articles_index',
        url,
        status: 'error',
        signal_count: 0,
        error: String((err && err.message) || err),
      });
    }
  }

  return dedupeSignals(filterLastDays(collected, safeDays));
}

module.exports = {
  collect,
  filterLastDays,
  lookbackDaysForSignal,
  getSourceUrls,
  isValidPublicUrl,
  shutdownBrowser,
  rssHeaders,
  shouldForcePlaywright,
};
