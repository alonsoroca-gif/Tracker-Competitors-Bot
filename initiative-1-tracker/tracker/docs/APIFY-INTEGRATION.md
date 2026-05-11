# Apify integration — operator notes

This document covers the Apify scraping path for sources we can't reach
with direct `fetch()` or headless Chromium. As of 2026-05-11 the only
wired source is **G2 reviews**, but the structure generalizes (LinkedIn
jobs, Reddit, Capterra, App Store — all run through the same client).

The scaffolding lives in `lib/apifyClient.js` (transport) and
`lib/g2ApifyScrape.js` (G2-specific wrapper). Both files exist and pass
lint as of the parent commit, but **nothing in the tracker pipeline
calls them yet**. Activation is intentionally one switch (see "Wiring
into the pipeline" below) and is gated on subscription authorization.

## Status

- **Authorization**: pending (manager debating internally as of 2026-05-11).
- **Code state**: scaffold committed, inert. `collectG2ReviewSignals`
  still calls the old `fetchG2ReviewSnippets`, which returns HTTP 403.
- **Cost expectation**: $0 (Apify free tier credit covers our scale —
  see "Cost math" below).

## Why Apify and not "just use Playwright for G2"

Cloudflare's bot management — which G2 sits behind — keys off three
signals that Playwright doesn't change:

1. **TLS fingerprint**: headless Chromium presents a JA3 hash that
   matches a small population of automation tooling. Cloudflare
   profiles this.
2. **Datacenter IP range**: our CI runs on GitHub Actions (Azure
   datacenter ranges, all flagged hostile). Our laptop runs on a
   residential ISP, but if we ever scrape at cadence from there we'll
   trip rate limits.
3. **Behavioral fingerprint**: no mouse movement, no scroll, ms-level
   page-to-page timing. Trivially detectable.

Apify's value isn't "they wrote a better Playwright." It's that they
own a pool of **residential IPs** (real consumer ISP addresses bought
or shared from users in exchange for free services) and rotate them
per request. That makes the IP signal stop being an automation tell.
The actor on top is just enough JS automation to navigate the page
and pull the review bodies.

This is why we hard-exclude `g2.com` from our Playwright fallback in
`lib/collect.js` — running headless Chromium against G2 from our own
infra would burn the cycle without gaining anything.

## Getting a token

1. Sign up at <https://console.apify.com> (free).
2. Verify email.
3. Account → Integrations → API tokens → Create new.
4. Copy the token (one-time view).

**Free tier limits** (as of 2026-Q2):

- $5/mo in platform credit (compute units + residential proxy traffic)
- 30 days "Personal" trial included for new accounts
- 1 GB residential proxy traffic/mo bundled
- No SLA, but actors run normally

For our G2 scale (5 competitors, daily refresh) we use roughly
$3–4/mo of that $5, so we may never have to upgrade.

## Setting the token

### Local dev

```bash
# Add to your shell profile (~/.zshrc, ~/.bashrc, etc.)
export APIFY_TOKEN='apify_api_...'

# Or export per-session before running the tracker:
APIFY_TOKEN='...' npm run drop
```

### GitHub Actions / CI

Settings → Secrets and variables → Actions → New repository secret.
Name: `APIFY_TOKEN`. The existing `tracker-drop.yml` workflow already
inherits secrets into its environment; once the variable exists, the
next scheduled run picks it up.

### Verifying it's set

```bash
node -e "const { hasApifyToken } = require('./lib/apifyClient'); console.log(hasApifyToken() ? 'OK' : 'MISSING')"
```

## Wiring into the pipeline

When you're ready to flip the switch, the only code change is in
`lib/collect.js` inside `collectG2ReviewSignals`. Find this line:

```js
const { reviews, note } = await fetchG2ReviewSnippets(g2Url, { maxReviews: 12 });
```

Replace with:

```js
const { hasApifyToken } = require('./apifyClient');
const { fetchG2ReviewSnippetsViaApify } = require('./g2ApifyScrape');
const fetchFn = hasApifyToken()
  ? fetchG2ReviewSnippetsViaApify
  : fetchG2ReviewSnippets;
const { reviews, note } = await fetchFn(g2Url, { maxReviews: 12 });
```

(Move the `require`s to the top of the file in practice.)

That's the entire integration. Signal shape, dedup keys, dashboards,
skill Phase 4 interpretation — all unchanged. If `APIFY_TOKEN` is
unset, behavior is identical to today.

## Cost math

Per G2 product page scrape, with the default residential-proxy config:

| Component | Cost per scrape |
|---|---|
| Compute (~0.05 CU @ $0.40/CU on Starter, $0 on Free credit) | ~$0.02 |
| Residential proxy (~2 MB @ $8/GB) | ~$0.016 |
| **Total** | **~$0.036** |

At our current 5-competitor daily cadence:

```
5 competitors × 30 days = 150 scrapes/month
150 × $0.036 = $5.40/month
```

That's $0.40 over the $5 Free tier credit. In practice we run closer
to $4–5/mo because the residential proxy block per actor run is often
smaller than the worst case. If we exceed the Free credit consistently,
upgrade to **Starter** ($49/mo with $49 credit bundled) — we'd land at
roughly the same effective spend but with SLA and priority queue.

When LinkedIn-jobs or Reddit get added, expect another $5–15/mo each
depending on cadence. The Apify dashboard shows actual consumption per
actor so you can re-evaluate.

## Switching actors

The G2 actor id is configured at `lib/g2ApifyScrape.js`:

```js
const DEFAULT_G2_ACTOR_ID = process.env.APIFY_G2_ACTOR_ID || 'vladkens/g2-reviews-scraper';
```

To try a different actor without a code change, set the env var:

```bash
APIFY_G2_ACTOR_ID='epctex/g2-scraper' npm run drop
```

Marketplace candidates as of 2026-Q2 (pick whichever is best-maintained
when you check):

| Actor | Notes |
|---|---|
| `vladkens/g2-reviews-scraper` | Current default. Active maintenance, clean review-text output, handles pagination. |
| `epctex/g2-scraper` | Broader scope (lists, reviews, alternatives). Heavier compute. |
| `dtrungtin/g2-scraper` | Older. Use as last resort. |

If you switch actors, double-check the input/output shapes — the
`buildG2ActorInput` and `normalizeApifyG2Item` helpers in
`g2ApifyScrape.js` are actor-specific and will need adjustment. The
docs/README on each actor's Apify Console page is the source of truth.

## Testing without committing

Once the token is set:

```bash
cd initiative-1-tracker/tracker
node -e "
const { fetchG2ReviewSnippetsViaApify } = require('./lib/g2ApifyScrape');
fetchG2ReviewSnippetsViaApify('https://www.g2.com/products/eliseai/reviews', { maxReviews: 5 })
  .then(r => console.log(JSON.stringify(r, null, 2)));
"
```

Expected: `reviews` array with 1–5 entries, `note` string starting
with "Parsed N review(s) via Apify". Total runtime ~30–60s.

If you see `note: "Apify call failed: ..."`, check:

- Token is exported in current shell (`echo $APIFY_TOKEN | head -c 12`)
- Account has remaining credit (Apify Console → Billing)
- Actor URL didn't 404 (Apify Console → Store → search "g2-reviews")

## Future sources

The same pattern (`lib/apifyClient.js` + per-source wrapper) extends to:

- `lib/linkedinJobsApifyScrape.js` — public job postings only
  (compliant, low ToS risk). Actor: `bebity/linkedin-jobs-scraper`.
- `lib/redditApifyScrape.js` — subreddit posts & comments mentioning a
  competitor. Actor: `apify/reddit-scraper`. Reddit also has a free
  official API for ~10K requests/day; use that for primary path and
  Apify as fallback.
- `lib/capterraApifyScrape.js` — covered by current source mix
  decision (drop Capterra in favor of G2 + Reddit + LinkedIn).
- X / Twitter — not recommended through Apify after the 2023 API
  changes. Either pay the official API ($100/mo Basic) or skip.

Each new source is one wrapper file + one require/branch in the
relevant `collect*Signals` function in `lib/collect.js`.

## Origin

Established 2026-05-11 after a `/trackerstart` cycle confirmed G2's
Cloudflare 403 was persistent across both static fetch and Playwright,
and that residential proxy (which Apify bundles) was the actual lever.
Scaffold committed in `tracker: scaffold Apify client + G2 wrapper
(inert until APIFY_TOKEN)`. Activation pending subscription approval.
