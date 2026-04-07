/**
 * Prototype: pull visible review text from a G2 product/reviews HTML page.
 * Many G2 views are JS-rendered; this returns whatever is in the initial HTML.
 * @see ../docs/G2-REVIEWS-PROTOTYPE.md
 */

const cheerio = require('cheerio');

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_HTML = 400000;

async function fetchHtml(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; CompetitorTracker/1.0; +https://example.internal)',
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text.slice(0, MAX_HTML);
  } finally {
    clearTimeout(t);
  }
}

function normalize(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @returns {Promise<{ reviews: Array<{ text: string, hint?: string }>, note: string }>}
 */
async function fetchG2ReviewSnippets(pageUrl, { maxReviews = 15 } = {}) {
  const reviews = [];
  let note = '';

  try {
    const html = await fetchHtml(pageUrl);
    const $ = cheerio.load(html);

    const trySelectors = [
      '[itemprop="reviewBody"]',
      '.paper.paper--white .formatted-text',
      '[data-testid="review-body"]',
      '.review-body',
      'div[class*="ReviewBody"]',
    ];

    for (const sel of trySelectors) {
      $(sel).each((_, el) => {
        if (reviews.length >= maxReviews) return false;
        const text = normalize($(el).text());
        if (text.length >= 25 && text.length < 4000) reviews.push({ text });
        return undefined;
      });
      if (reviews.length >= 3) break;
    }

    if (reviews.length === 0) {
      note =
        'No review bodies found in static HTML. G2 often hydrates reviews in the browser — use Playwright/Puppeteer for production, or G2’s data products if licensed.';
    } else {
      note = `Parsed ${reviews.length} excerpt(s) from server HTML (layout may change).`;
    }
  } catch (e) {
    note = `Fetch/parse failed: ${e.message}`;
  }

  return { reviews: reviews.slice(0, maxReviews), note };
}

module.exports = { fetchG2ReviewSnippets };
