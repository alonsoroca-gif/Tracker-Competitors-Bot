# Apify integration — design doc

**Status:** Designed; awaiting org approval for Apify Personal plan ($49/mo).
**Owner:** Alonso (PM) + tracker bot maintainer
**Implementation ETA:** ~3 hours of work, starting day approval lands.

---

## Why this exists

The `g2_reviews` lane in the tracker is structurally blocked:
- G2 sits behind Cloudflare with WAF + JS challenge enabled → returns HTTP 403 to plain `fetch()`
- Even when reachable, G2 reviews are loaded via XHR after page boot → cheerio parsing returns 0 review bodies

These are two separate problems that both require the same solution: **a real browser fingerprint with rotating residential IPs**, which Apify provides as a managed service.

This same integration also unblocks future lanes the tracker will eventually need:
- YouTube channel scraping (`streamers/youtube-scraper`)
- YouTube comments (`epctex/youtube-comments-scraper`)
- Twitter/X mentions (`apidojo/tweet-scraper`)
- LinkedIn careers / company posts (`apify/linkedin-company-scraper`)
- Instagram (Anyone Home posts here — `clockworks/free-instagram-scraper`)

So this is "G2 unblocker" in name and **multi-source platform foundation** in practice.

---

## Goals

1. Unblock `g2_reviews` lane (drop health flips ❌ → ✅)
2. Build the abstraction so adding a new lane (YouTube, etc.) is "wire up an actor ID + map its output schema" (~30 min, not a refactor)
3. Zero impact on the manager workflow — drop health just stops showing ❌
4. Hard cost controls so a runaway loop can't burn the monthly budget

## Non-goals (deliberately deferring)

- Multi-vendor abstraction (Apify-only for now; vendor-swap is a future concern)
- Real-time / webhook-driven collection (stays polling-based)
- Implementing YouTube/LinkedIn lanes today — just designing so they fit cleanly later

---

## Architecture

### File layout

```
initiative-1-tracker/tracker/lib/
├── apifyClient.js              ← NEW: thin SDK wrapper
│     exports:
│       - runActor(actorId, input, opts) → Promise<{ items, runId, costCredits }>
│       - validateToken()                → Promise<boolean>
│       - getMonthlyUsage()              → Promise<{ usedCredits, limitCredits }>
│
├── g2Scrape.js                 ← REFACTORED (smaller, cleaner)
│     • If APIFY_TOKEN set → calls apifyClient.runActor('apify/g2-reviews-scraper', { url })
│     • If APIFY_TOKEN unset → falls back to current fetch() path (graceful degradation)
│     • Maps Apify response → existing { reviews: [...], note } interface (unchanged)
│
└── (future: youtubeScrape.js, linkedinScrape.js — same pattern)
```

### Caller-side interface stays identical

```js
const { fetchG2ReviewSnippets } = require('./g2Scrape');
const { reviews, note } = await fetchG2ReviewSnippets(g2Url, { maxReviews: 12 });
```

`collect.js` does not change. Only `g2Scrape.js` internals change. **Zero ripple effects through the rest of the tracker.**

### Why a thin client wrapper instead of inlining `apify-client` calls in `g2Scrape.js`?

1. **Reusability.** `youtubeScrape.js`, `linkedinScrape.js` will all do `runActor(...)` with different actor IDs. The wrapper is one place for retry logic, cost tracking, error handling, dry-run mode.
2. **Testability.** Mock `apifyClient` in unit tests; never call the real API in CI.

---

## Configuration model — Hybrid (chosen)

Token presence flips the global default; per-competitor override is available for safe pilot rollout.

```json
{
  "id": "eliseai",
  "sources": {
    "g2_reviews_url": "https://www.g2.com/products/eliseai/reviews",
    "g2_reviews_method": "apify"   // optional override; default = follows APIFY_TOKEN
  }
}
```

| Configuration | Behavior |
|---|---|
| `APIFY_TOKEN` set, no per-competitor override | Apify (default) |
| `APIFY_TOKEN` set, `g2_reviews_method: "fetch"` | Legacy fetch (forced opt-out) |
| `APIFY_TOKEN` unset, no override | Legacy fetch (default) |
| `APIFY_TOKEN` unset, `g2_reviews_method: "apify"` | Fail-fast at workflow start (clear error) |

This enables the **week-1 pilot**: set `APIFY_TOKEN`, set `g2_reviews_method: "apify"` only on `eliseai`. Other competitors stay on legacy fetch (still failing, but no new behavior to debug).

---

## Cost controls — three layers of defense

| Layer | Where | What it does |
|---|---|---|
| **Per-actor-run timeout** | `apifyClient.runActor()` opts | Kill any actor run that exceeds 90s |
| **Per-drop-cycle credit cap** | `apifyClient.runActor()` running tally | If cumulative spend in a single `publish-drop.js` invocation exceeds **$1**, refuse further actor calls. Cycle continues with remaining lanes (just no Apify) |
| **Per-month account cap** | Apify dashboard setting (`max-monthly-usage = 30 USD`) | Apify itself refuses to start actors once monthly cap hit. Hard limit, can't be bypassed by code bug |

### Dry-run mode for development & CI

```bash
APIFY_DRY_RUN=1 npm run drop -- --days 7
```

`apifyClient.runActor()` returns canned fixture data instead of calling the API. **Zero credits consumed.** Used by:
- Local dev (no risk to real budget)
- CI smoke tests on every PR

---

## Error handling matrix

| Failure mode | Behavior | User-visible result |
|---|---|---|
| `APIFY_TOKEN` missing (and method=apify forced) | Fail-fast at workflow start with clear error | Drop fails to publish; CI Action red; manager pinged via failure email |
| Token invalid / expired | Same as above (validate at workflow start, not per-actor) | Same |
| Actor doesn't exist or was renamed | Catch error, log, mark lane ❌ in drop health, continue | Lane ❌ with note "actor not found"; other lanes still publish |
| Actor returns 0 results (G2 page changed) | Same as today: emit placeholder signal with `parse_ok: false` | Lane ⚠️; not a hard failure |
| Per-cycle cost cap exceeded | Skip remaining Apify calls; log warning | Some Apify lanes ❌ (skipped); other lanes still publish |
| Per-month cap exceeded (Apify rejects) | Catch 402-style error, log, mark lane ❌ | Lane ❌ with note "monthly budget exhausted" |
| Network timeout to Apify | Retry once with backoff; if second try fails, mark ❌ | Lane ❌ |

**Invariant: Apify failures NEVER prevent the rest of the drop from publishing.** Other lanes (homepage, features_page, changelog, articles_url) keep working independently.

---

## Testing strategy

### Layer 1 — Unit tests (no real API calls)

```js
// test/run.js — append section
test('apifyClient.runActor maps response correctly', ...);   // mock fetch
test('g2Scrape falls back to legacy when APIFY_TOKEN unset', ...);
test('apifyClient enforces per-cycle cost cap', ...);
```

### Layer 2 — Dry-run integration test (zero credits)

```bash
APIFY_DRY_RUN=1 node scripts/publish-drop.js --days 7
```

Verifies the drop pipeline doesn't crash with Apify wired in. Runs in CI on every PR.

### Layer 3 — Pilot with eliseai (real credits, ~$0.50)

Week 1: `APIFY_TOKEN` set, `g2_reviews_method: "apify"` ONLY on `eliseai`. Run 3 cron cycles (Mon 8:30am, 12pm, 5pm MT). Verify:
- Drop health for `eliseai` g2_reviews flips to ✅
- Reviews appear in `signals.json` with non-empty `evidence_snippet`
- Total Apify spend < $2 for the week

If pilot is clean → flip remaining 4 competitors to `apify` method (Phase 3).

---

## Migration plan

| Phase | When | What | Cost | Risk |
|---|---|---|---|---|
| **0** | Now (pre-approval) | Lock the design (this doc) | $0 | None |
| **1** | Day approval lands | Implement `apifyClient.js` + refactor `g2Scrape.js` + dry-run test in CI | $0 (dry-run only) | Low — no live calls |
| **2** | Day approval +1 | Set `APIFY_TOKEN` GH Actions secret + flip `eliseai` only | ~$0.50 / week | Low — single competitor |
| **3** | Day approval +7 (if pilot clean) | Flip remaining 4 competitors to `apify` method | ~$2 / week | Medium — full rollout |
| **4** | Day approval +37 (after 30 days stable) | Deprecate legacy `fetch` fallback; keep code for rollback | $0 | Low |

---

## Skill / docs changes (when shipped)

| File | Change |
|---|---|
| `.cursor/skills/tracker-drop-cycle/SKILL.md` Repo conventions | Add row: `Apify token \| GH Actions secret APIFY_TOKEN, scoped to tracker-drop.yml` |
| Same file, drop health Status values | Add transitional status: `❌ Cloudflare-blocked (managed-scrape required)` — only relevant during transition |
| `.github/workflows/tracker-drop.yml` | Add `env: APIFY_TOKEN: ${{ secrets.APIFY_TOKEN }}` on the publish step |
| `initiative-1-tracker/docs/G2-REVIEWS-PROTOTYPE.md` | Append "Production solution" section pointing at Apify wrapper |
| New: `initiative-1-tracker/docs/APIFY-INTEGRATION.md` | Operations doc: actor IDs we use, cost monitoring, how to add a new actor |

---

## Locked design decisions

These are what we'll implement unless changed before approval lands:

| # | Decision | Locked value | Why |
|---|---|---|---|
| 1 | Config model | **Hybrid** (token-driven default + per-competitor override) | Enables safe pilot |
| 2 | SDK vs hand-rolled fetch | **Use Apify SDK** (`apify-client` npm package, ~50 KB) | Handles retries, polling, types — saves us from re-implementing |
| 3 | G2 actor choice | **Decide at implementation time** — evaluate `apify/g2-reviews-scraper` (official) and 1 community actor with ~$1 of test runs | Lock-in cost is low; pick the one with better data quality |
| 4 | Per-drop-cycle cost cap | **$1 per cycle** | Conservative; catches runaway loops fast; well below per-cycle expected spend (~$0.30) |
| 5 | Pilot competitor | **eliseai** | Most G2 reviews → best signal density to evaluate quality |

---

## Risk profile (for org approval doc)

| Risk | Mitigation |
|---|---|
| **Vendor lock-in** | Wrap Apify behind `lib/apifyClient.js`. Swap to another vendor (Bright Data, in-house Playwright) = change one file. ~2-day swap. |
| **Vendor outage / actor breakage** | Drop health flags lane as ❌ same as today. Cycle continues with other lanes. Not single-source-dependent. |
| **Compliance / ToS** | Apify shifts compliance posture from "we're scraping" to "we're a customer of a managed-scraping vendor." Standard B2B SaaS. Legal team reviews Apify ToS once. |
| **Data quality** | Pilot with 1 competitor for 1 week before going broad. If actor returns junk, we know in 1 week / $1 spent. |
| **Cost overrun** | Three layers of defense above. Hard-capped at $30/mo via Apify dashboard — can't accidentally burn more. |

---

## Approval-request copy (ready to send)

> **Subject:** Approval request — Apify ($49/mo) for competitive-intel tracker
>
> **What:** Apify Personal plan, $49/month
>
> **Why:** Our competitive tracker (Tracker-Competitors-Bot) hits G2 reviews and YouTube channels for buyer-voice and product-update signals. Both sources block direct HTTP scraping (Cloudflare, JS hydration). Apify provides managed scraping for both, plus Twitter/LinkedIn/Instagram coverage we'll add over the next quarter.
>
> **Cost:** $49/mo flat. Estimated usage: ~$12/mo from the included $49 credit pool. Hard-capped at $30/mo to prevent runaway.
>
> **Vendor:** Apify s.r.o. (Prague, Czech Republic). SOC 2 Type 2, GDPR, CCPA compliant. Customers include TripAdvisor, Microsoft, MIT.
>
> **Alternatives considered:** Bright Data residential proxy ($150–500/mo, much higher cost, doesn't solve JS hydration alone), in-house Playwright (works locally, breaks on CI Linux IPs, ongoing maintenance), Capterra/TrustRadius pivot (rejected — review coverage too thin).
>
> **Compliance:** Tracker scrapes only public competitor pages; no PII collection; data stays in our private GitHub repo. Apify's role is managed-scraping infrastructure, similar to Stripe for payments or Twilio for SMS.
>
> **Decision needed by:** [date]
>
> **Design doc:** [link to this file in GitHub once committed]

---

## Implementation checklist (use this when approval lands)

- [ ] Create Apify account; generate API token; set Apify dashboard monthly cap to $30
- [ ] Add `APIFY_TOKEN` to GH Actions repo secrets
- [ ] `npm install apify-client` in `initiative-1-tracker/tracker/`
- [ ] Implement `lib/apifyClient.js` per design above
- [ ] Refactor `lib/g2Scrape.js` to call `apifyClient` when token set
- [ ] Add unit tests in `test/run.js` for both modules
- [ ] Add `APIFY_DRY_RUN=1` to CI smoke step (no real credits in CI)
- [ ] Wire `APIFY_TOKEN: ${{ secrets.APIFY_TOKEN }}` into `tracker-drop.yml`
- [ ] Set `g2_reviews_method: "apify"` on `eliseai` only in `products.json`
- [ ] Trigger workflow_dispatch run; verify eliseai g2_reviews lane → ✅
- [ ] Watch 3 cron cycles over week 1; verify cost <$2 and data quality
- [ ] If pilot clean: flip remaining 4 competitors
- [ ] Update SKILL.md + create operations doc per "Skill / docs changes" section
- [ ] After 30 days stable: deprecate legacy `fetch` path
