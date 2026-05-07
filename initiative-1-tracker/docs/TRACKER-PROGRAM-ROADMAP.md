# Tracker program roadmap (intel)

Short internal view of **what we already shipped** vs **what comes next** for **richer drops**.

_Last refreshed: 2026-05-07 (after the post-demo bugfix push, commit `714b194`)._

## Shipped (process + templates)

| Item | Where |
|------|--------|
| **`entrata-core` gate** + demo clarity | `TRACKER-EXTERNAL-ONBOARDING.md` — top callout, **Part 4.4**, **§3.3** |
| Sponsor **clone / smoke test** (runnable) | `initiative-1-tracker/docs/SPONSOR-SMOKE-TEST.md` |
| **Gap-only** interpretation template | `initiative-1-tracker/docs/INTERPRETATION-GAP-ONLY-TEMPLATE.md` |
| **§4.5 feature lens + prototype loop** (PRD-A primary; B/C/D/spike support) | `TRACKER-EXTERNAL-ONBOARDING.md` — **§4.5** |

## Shipped (data sources / collect pipeline)

This is where the bulk of work has landed since this doc was first drafted.

| Item | Where |
|------|--------|
| **Phase 2 lane expansion** — `insights_url`, `media_url`, `podcast_url` (RSS); `reviews_url` (third-party HTML); `g2_reviews_url` array support for multi-page G2 (e.g. funnel-leasing + fenix-ai) | `lib/collect.js`, `config/products.json`; spec in `PHASE-2-LANE-EXPANSION.md` |
| **Phase B-2 HTML lanes** — `case_studies_url` (testimonial pages, accepts string \| string[]), `articles_url` (HTML article-index pages where no RSS exists) | `lib/collect.js`, `config/products.json`; spec in `PHASE-B2-HTML-LANES.md` |
| **Source-verification round across all 5 competitors** — broken URLs cleared (eliseai pricing 404, funnel pricing 404, anyone-home blog Cloudflare 403); `/articles/` adopted for jonah-digital; case_studies wired for anyone-home + jonah | `config/products.json`, `SURFACE-INVENTORY.md` |
| **Post-demo `runCollectAll` fan-out fix** — `collect()` now runs once per competitor and signals fan out across products in-process. Was triggering Cloudflare/WAF rate-limits because each URL got hit ~11 times per run | `lib/runCollectAll.js`; root cause analysis in `FOLLOWUPS-TOMORROW.md` (top of file) |
| **Test coverage** — 109 assertions, 0 failures, including unit test that asserts `collect()` is called exactly `competitorCount` times (not `competitors × products`) | `tracker/test/run.js` |

## Status snapshot (drop `2026-05-06T21-46-51Z`, the demo drop)

Numbers will go stale; pull the latest drop's `SUMMARY.md` for current state.

- **374 signals after prune (253 new this run)**
- **3 pillars touched**: P1=242, P2=88, P3=44 (P4 not collected)
- **22 unique source URLs across 5 competitors and 10 lanes** (vs. 3 lanes in `2026-05-04T19-37-46Z` two days earlier)
- **Pillar 3 (third-party)** went from 0 → 44 signals once Phase 2 / B-2 work landed (`g2_reviews`, `reviews_other`, `media`)

Per-lane health from the demo drop is documented in
`tracker-drops/2026-05-06T21-46-51Z/INTERPRETATION.md` §A. Lanes that
returned content cleanly: `features_page`, `careers`, `pricing_page`,
`case_studies` (anyone-home), `insights`, `media`, `blog` (funnel-leasing).

## Now — selector / scraper hardening (in progress)

**Goal:** make the lanes we already wired return reliable content for all 5
competitors, not just the well-formed sites.

**Concrete work** (tracked in `FOLLOWUPS-TOMORROW.md` §3):

1. **Pages that return 200 but the scraper finds nothing** — `eliseai.com/datalog` (Webflow), `developer.funnelleasing.com` (SPA), `leasehawk.com/careers/`. Either tune `extractPageSignals` selectors, clear the URL, or build a SPA-aware path.
2. **`articles_index` for `jonah-digital`** — JS-hydrated; static HTML returns "No article cards found". Same class of problem.
3. **`reviews_other` for `funnel-leasing`** (`featuredcustomers.com`) — JS-hydrated review bodies; either headless render or move to JSON-LD/API extraction.
4. **`case_studies` selector for `jonah-digital` homepage** — currently extracts the homepage tagline rather than the 8 `<blockquote>` testimonials.
5. **G2 Cloudflare 403** — both `eliseai` and `funnel-leasing` G2 lanes hit by CF in the demo drop. The fan-out fix should help (one request per URL per run instead of 11), but a rotating UA + 24h cache is the planned harder fix.

## Next — Pillar 3 expansion + headless rendering

**Goal:** unlock the JS/CF-gated content classes that selector tuning alone
can't fix.

**Concrete work** (parked, see `FOLLOWUPS-TOMORROW.md` §6):

1. **Headless browser fallback (Playwright)** — wraps `fetchText()` with a `TRACKER_USE_HEADLESS=1` opt-in path that renders the page in real Chrome. One investment unlocks `eliseai.com/datalog`, `developer.funnelleasing.com`, jonah `articles_index`, `featuredcustomers.com`, and the anyone-home blog (Cloudflare).
2. **YouTube discovery** — `youtube_discovery_queries` + `commentThreads.list` paths in `collect.js` are wired but no-op without `YOUTUBE_DATA_API_KEY`. Configure key + tune `youtube_discovery_max_*` against the 10k units/day default quota.
3. **Wayback Machine fallback** for Cloudflare-blocked feeds (anyone-home blog) — backfill historical posts even if real-time is gated.

## Later (parked)

Tracked under "Phase B-3" in `DATA-SOURCES-BRAINSTORM.md` and
`FOLLOWUPS-TOMORROW.md` §4:

- **`events_url` lane** — real-time webinar/conference tracking (current stance: rely on post-event blog/press recaps).
- **Podcast transcript ingestion** — RSS gives episode metadata only; download + STT to surface in-episode feature mentions.
- **X / LinkedIn social listening** — both first-party (official handles) and third-party (keyword search) for posts and embedded video.
- **Domain-aware pillar inference for `articles_url`** — own-domain → P1, external aggregator → P3.
- **Stop collecting `pricing_page`** — currently 22% of rows but §4.2 of the manager filter throws them out anyway. Small `collect.js` change.
- **Slack / Actions alerting** when a new source class starts (or stops) contributing.

When this file or templates move, update **`TRACKER-EXTERNAL-ONBOARDING.md`**
**Part 8** links.
