/**
 * G2 reviews via Apify — drop-in replacement for fetchG2ReviewSnippets
 * in lib/g2Scrape.js for the case where APIFY_TOKEN is available.
 *
 * Why: G2 sits behind Cloudflare bot-management. Direct fetch() from
 * any datacenter IP (our CI, our laptop, GitHub Actions runners) gets
 * a hard 403. Headless Chromium hits the same wall — same TLS
 * fingerprint, same datacenter IP. The actual lever that bypasses
 * Cloudflare here is residential proxy traffic, which Apify
 * provides bundled with their G2 actor.
 *
 * STATUS (2026-05-11): scaffold only. The integration point in
 * lib/collect.js's collectG2ReviewSignals still calls the old
 * fetchG2ReviewSnippets (which returns "HTTP 403"). When the Apify
 * subscription is authorized, wire this in:
 *
 *   // lib/collect.js, collectG2ReviewSignals:
 *   const { hasApifyToken } = require('./apifyClient');
 *   const { fetchG2ReviewSnippetsViaApify } = require('./g2ApifyScrape');
 *   const fetchFn = hasApifyToken()
 *     ? fetchG2ReviewSnippetsViaApify
 *     : fetchG2ReviewSnippets;
 *   const { reviews, note } = await fetchFn(g2Url, { maxReviews: 12 });
 *
 * That swap is the entire integration. Nothing downstream of
 * collectG2ReviewSignals changes — signal shape, dedup keys, dashboards,
 * skill phase 4 interpretation logic are all unaffected.
 */

const { runActorSync } = require('./apifyClient');

/**
 * Default actor. There are several G2-reviews actors on the marketplace;
 * we picked this one because (a) it's actively maintained as of
 * 2026 Q2, (b) it returns the review text body as a top-level field
 * which is what we need, (c) it handles pagination internally so a
 * single run covers all reviews for a product.
 *
 * Switch via APIFY_G2_ACTOR_ID env var without code changes if this
 * one goes unmaintained or the output schema drifts. Candidate
 * replacements documented in docs/APIFY-INTEGRATION.md.
 */
const DEFAULT_G2_ACTOR_ID = process.env.APIFY_G2_ACTOR_ID || 'vladkens/g2-reviews-scraper';

/**
 * Actor input contract. Each G2 actor uses a slightly different input
 * schema, so this mapping lives here (not in apifyClient.js) and gets
 * adjusted if we swap actors.
 *
 * vladkens/g2-reviews-scraper accepts:
 *   {
 *     startUrls: [{ url: "https://www.g2.com/products/<slug>/reviews" }],
 *     maxReviews: 20,
 *     proxy: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] }
 *   }
 *
 * @param {string} pageUrl
 * @param {number} maxReviews
 */
function buildG2ActorInput(pageUrl, maxReviews) {
  return {
    startUrls: [{ url: pageUrl }],
    maxReviews: Math.min(50, Math.max(1, maxReviews)),
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
    },
  };
}

/**
 * Normalize one Apify dataset item into our canonical { text, hint }
 * shape. The actor returns roughly:
 *   {
 *     reviewId, title, content, rating, reviewer: { name, role },
 *     publishedAt, helpfulCount, ...
 *   }
 *
 * We use `content` as the review text and a short tag from reviewer
 * role + rating as the hint, which is what fetchG2ReviewSnippets'
 * direct-fetch path would produce.
 *
 * @param {object} item
 * @returns {{ text: string, hint?: string } | null}
 */
function normalizeApifyG2Item(item) {
  if (!item || typeof item !== 'object') return null;
  const text = String(item.content || item.body || item.reviewBody || '').trim();
  if (text.length < 25 || text.length > 4000) return null;
  const role = item.reviewer && typeof item.reviewer === 'object' ? item.reviewer.role : item.reviewerRole;
  const rating = item.rating || item.stars || item.score;
  const hintParts = [];
  if (role) hintParts.push(String(role).slice(0, 60));
  if (rating != null) hintParts.push(`${rating}/5`);
  return hintParts.length ? { text, hint: hintParts.join(' · ') } : { text };
}

/**
 * Fetch G2 review snippets via Apify. Same return shape as
 * fetchG2ReviewSnippets() in lib/g2Scrape.js so callers can swap freely.
 *
 * @param {string} pageUrl  G2 product reviews URL.
 * @param {{ maxReviews?: number }} [opts]
 * @returns {Promise<{ reviews: Array<{ text: string, hint?: string }>, note: string }>}
 */
async function fetchG2ReviewSnippetsViaApify(pageUrl, opts = {}) {
  const { maxReviews = 15 } = opts;
  const reviews = [];
  let note = '';

  try {
    const items = await runActorSync(
      DEFAULT_G2_ACTOR_ID,
      buildG2ActorInput(pageUrl, maxReviews),
      { timeoutSecs: 180, memoryMbytes: 1024 }
    );

    for (const it of items) {
      const r = normalizeApifyG2Item(it);
      if (!r) continue;
      reviews.push(r);
      if (reviews.length >= maxReviews) break;
    }

    if (!reviews.length) {
      note = `Apify actor ${DEFAULT_G2_ACTOR_ID} ran but returned no reviews. Check actor logs in Apify Console.`;
    } else {
      note = `Parsed ${reviews.length} review(s) via Apify (${DEFAULT_G2_ACTOR_ID}).`;
    }
  } catch (e) {
    if (e.code === 'APIFY_TOKEN_MISSING') {
      note = 'APIFY_TOKEN not set; caller should fall back to direct fetch.';
    } else {
      note = `Apify call failed: ${e.message}`;
    }
  }

  return { reviews: reviews.slice(0, maxReviews), note };
}

module.exports = {
  DEFAULT_G2_ACTOR_ID,
  buildG2ActorInput,
  normalizeApifyG2Item,
  fetchG2ReviewSnippetsViaApify,
};
