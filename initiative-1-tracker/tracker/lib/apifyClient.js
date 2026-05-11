/**
 * Thin client for the Apify REST API.
 *
 * Why this exists separately from the G2 wrapper: Apify is a generic
 * scraping platform — once we're paying for a subscription, the same
 * client will drive LinkedIn-jobs, Reddit, Capterra, App Store, etc.
 * Keeping the HTTP/auth/retry layer in one file means each source-
 * specific wrapper (g2ApifyScrape.js, future linkedinApifyScrape.js)
 * just maps actor input/output and lets this file handle plumbing.
 *
 * No npm dependency on `apify-client` — we use plain fetch() against
 * Apify's REST endpoints. The SDK is nice but every minor version
 * bumps the Node minimum, and we'd rather not gate the tracker on
 * SDK upgrades. The REST surface we use here is stable since 2019.
 *
 * Auth: APIFY_TOKEN env var. Get one at
 *   https://console.apify.com/account/integrations
 *
 * STATUS (2026-05-11): scaffold only. No caller in the tracker pipeline
 * invokes this yet — that wiring lands in a follow-up commit once the
 * Apify subscription is authorized. Calling runActorSync without a
 * token throws an actionable error; that is intentional, not a bug.
 */

const APIFY_API_BASE = 'https://api.apify.com/v2';
const DEFAULT_RUN_TIMEOUT_S = Number(process.env.APIFY_RUN_TIMEOUT_S || 180);
const DEFAULT_HTTP_TIMEOUT_MS = Number(process.env.APIFY_HTTP_TIMEOUT_MS || 200_000);

function getToken() {
  const token = (process.env.APIFY_TOKEN || '').trim();
  if (!token) {
    const err = new Error(
      'APIFY_TOKEN is not set. Generate a token at ' +
        'https://console.apify.com/account/integrations and export it in your shell ' +
        '(local dev) or add it as a GitHub Actions secret (CI).'
    );
    err.code = 'APIFY_TOKEN_MISSING';
    throw err;
  }
  return token;
}

/**
 * Returns true when an Apify token is configured. Callers can branch
 * on this to decide whether to use Apify or fall back to direct fetch.
 *
 * @returns {boolean}
 */
function hasApifyToken() {
  return Boolean((process.env.APIFY_TOKEN || '').trim());
}

/**
 * Run an Apify actor synchronously and return its dataset items.
 *
 * Uses Apify's run-sync-get-dataset-items endpoint, which blocks until
 * the actor finishes (or hits `timeoutSecs`) and streams the resulting
 * dataset back in the response body. For our use case (a single G2 URL,
 * ~30s actor runtime) this is the right shape — no polling needed.
 *
 * For longer-running actors (e.g. scraping 1000s of URLs in one run),
 * switch to runs API + polling. We don't need that yet.
 *
 * @param {string} actorId         Apify actor id, e.g. "vladkens/g2-reviews-scraper".
 *                                 The "username/actor-name" form is canonical;
 *                                 hash-style ids also work.
 * @param {object} input           JSON passed to the actor as input. Shape is
 *                                 actor-specific — see the actor's README.
 * @param {object} [opts]
 * @param {number} [opts.timeoutSecs]   Per-run cap. Default 180s. The actor
 *                                       itself may have shorter internal limits.
 * @param {number} [opts.memoryMbytes]  Actor memory. Default 1024. Higher =
 *                                       faster but more compute units.
 * @returns {Promise<object[]>}   Dataset items the actor produced.
 *                                Empty array if the actor ran but emitted nothing.
 */
async function runActorSync(actorId, input, opts = {}) {
  const token = getToken();
  const timeoutSecs = opts.timeoutSecs || DEFAULT_RUN_TIMEOUT_S;
  const memoryMbytes = opts.memoryMbytes || 1024;

  if (!actorId || typeof actorId !== 'string') {
    throw new Error(`runActorSync: actorId required, got ${typeof actorId}`);
  }

  // Apify expects actor ids URL-encoded with "/" as "~" in the path
  // (so vladkens/g2-reviews-scraper becomes vladkens~g2-reviews-scraper).
  const encodedActorId = actorId.replace('/', '~');

  const url = new URL(`${APIFY_API_BASE}/acts/${encodedActorId}/run-sync-get-dataset-items`);
  url.searchParams.set('token', token);
  url.searchParams.set('timeout', String(timeoutSecs));
  url.searchParams.set('memory', String(memoryMbytes));
  // We want JSON back, not the (default) JSONL stream — easier to parse.
  url.searchParams.set('format', 'json');

  const controller = new AbortController();
  const httpTimer = setTimeout(() => controller.abort(), DEFAULT_HTTP_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input || {}),
    });

    if (!res.ok) {
      // Apify returns useful JSON error bodies for 4xx (bad input, auth, etc).
      // Surface as much as we can so callers see what went wrong.
      let detail = '';
      try {
        const j = await res.json();
        detail = j && j.error && j.error.message ? j.error.message : JSON.stringify(j);
      } catch (_) {
        detail = await res.text().catch(() => '');
      }
      const err = new Error(
        `Apify ${res.status} for actor ${actorId}: ${detail || res.statusText}`
      );
      err.status = res.status;
      err.actorId = actorId;
      throw err;
    }

    const items = await res.json();
    if (!Array.isArray(items)) {
      throw new Error(`Apify actor ${actorId} returned non-array response`);
    }
    return items;
  } finally {
    clearTimeout(httpTimer);
  }
}

module.exports = {
  hasApifyToken,
  runActorSync,
};
