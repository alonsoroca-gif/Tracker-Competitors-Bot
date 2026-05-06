# Phase 2 — Source lane expansion

Status: **In progress** (May 2026).
Triggered by Funnel Leasing verification: discovered 5 dedicated content streams (insights, press, media, podcast, llm) plus a sub-product G2 page (Fenix AI) that the current schema can't represent. This phase adds the lanes needed to cover all of them, then propagates to remaining competitors.

Related:
- [`COMPETITOR-DATA-PULL-REFERENCE.md`](./COMPETITOR-DATA-PULL-REFERENCE.md) — canonical technical reference (will be updated when this phase lands).
- [`SURFACE-INVENTORY.md`](./SURFACE-INVENTORY.md) — public surface trust ledger.
- [`DATA-SOURCES-BRAINSTORM.md`](./DATA-SOURCES-BRAINSTORM.md) — high-level source ideas roadmap.

---

## Goal

Cover **8 of 8** content streams Funnel Leasing publishes (vs. current 2/8) and unlock multi-G2-listing tracking for any competitor. After this phase, applying the new lanes to LeaseHawk / Anyone Home / Jonah Digital / EliseAI is purely a `products.json` config change.

---

## Schema changes (`products.json`)

### New keys (all optional strings, RSS feed URLs)
| Key | What it captures | Pillar | Inferred dimension |
|---|---|---|---|
| `insights_url` | Editorial articles (Forum/panel recaps, executive interviews, customer voice pieces) | 1 (owned) | features |
| `media_url` | Third-party media coverage of the competitor | 3 (third party) | positioning |
| `podcast_url` | Podcast episode metadata (titles, descriptions) | 1 (owned) | positioning |
| `reviews_url` | Non-G2 review aggregators (FeaturedCustomers, FitGap, Revyse, SlashDot) | 3 (third party) | features |

### Schema upgrade
| Key | Before | After |
|---|---|---|
| `g2_reviews_url` | `string` | `string` OR `string[]` (back-compat preserved) |

### Env override conventions (matches existing pattern)
- `TRACKER_INSIGHTS_URL_<SUFFIX>`
- `TRACKER_MEDIA_URL_<SUFFIX>`
- `TRACKER_PODCAST_URL_<SUFFIX>`
- `TRACKER_REVIEWS_URL_<SUFFIX>`
- `TRACKER_G2_REVIEWS_URL_<SUFFIX>` (already implicit; documents existing behavior)

---

## Code changes (file-by-file)

### `tracker/lib/collect.js`
1. **`getSourceUrls`** — add new keys with env overrides; normalize `g2_reviews_url` to a deduped array of valid http(s) URLs.
2. **`feedTasks` array in `collect()`** — add three RSS lanes:
   - `['insights', sourceUrls.insights_url]`
   - `['media', sourceUrls.media_url]`
   - `['podcast', sourceUrls.podcast_url]`
3. **`extractFeedSignals` `typeMap`** — add `insights → insights`, `media → media`, `podcast → podcast`. (Falls back to `blog` if not mapped, which would mistype signals.)
4. **G2 array iteration** — `collectG2ReviewSignals` accepts a single URL today. Update the call site in `collect()` to iterate over the normalized array; pass each URL through individually so each yields its own signal block (deduped by URL via `dedupeSignals`).
5. **New `collectGenericReviewSignals(competitorId, productId, reviewsUrl)`** — generic HTML excerpt extractor for `reviews_url`. Reuses `g2Scrape`-style cheerio approach with broader selectors (since each review aggregator has a different DOM). Outputs `source: 'reviews_other'`, `type: 'review_other'`.

### `tracker/lib/gapReport.js`
1. **`inferDimension`** — add new types:
   - `insights` → `{ dimension: 'features', ourKey: 'features' }` (editorial articles often discuss capabilities)
   - `media` → `{ dimension: 'positioning', ourKey: 'positioning' }` (third-party narrative shapes positioning)
   - `podcast` → `{ dimension: 'positioning', ourKey: 'positioning' }` (their voice / brand narrative)
   - `review_other` → `{ dimension: 'features', ourKey: 'features' }` (user voice on capabilities, mirrors `review_g2`)
2. **`sourceHumanLabel`** — add labels: `insights → 'Editorial articles'`, `media → 'Media coverage'`, `podcast → 'Podcast'`, `reviews_other → 'External reviews'`.
3. **`TYPE_ACTION_FALLBACK`** — add fallback strings for new types (manager-readable one-liners).

### `tracker/lib/intelPillar.js`
1. **`intelPillarFromSourceType`** — add cases:
   - `insights`, `podcast` (type or source) → P1 (owned)
   - `media`, `reviews_other` (type or source) → P3 (third party)

### `tracker/lib/weeklyIntelFlow.js`
1. **`pillarCoverageFromUrls`** — extend P1 detection to include `urls.insights_url || urls.podcast_url`; extend P3 detection to include `urls.media_url || urls.reviews_url`.

### `tracker/config/products.json`
1. Add new lane keys for `funnel-leasing` with verified URLs:
   - `insights_url: "https://funnelleasing.com/category/insights/feed/"`
   - `media_url: "https://funnelleasing.com/category/media/feed/"`
   - `podcast_url: "https://funnelleasing.com/category/podcast/feed/"`
   - `reviews_url: "https://www.featuredcustomers.com/vendor/funnel-leasing"`
2. Convert `g2_reviews_url` to array form for `funnel-leasing`:
   ```json
   "g2_reviews_url": [
     "https://www.g2.com/products/funnel-leasing/reviews",
     "https://www.g2.com/products/fenix-ai/reviews"
   ]
   ```
3. Other competitors keep their existing string form (back-compat). They get the new keys filled in when their verification rounds are complete.

---

## Documentation updates (after code lands)

| File | Section | Update |
|---|---|---|
| `COMPETITOR-DATA-PULL-REFERENCE.md` | §2.1 source lanes table | Add 4 new rows (`insights_url`, `media_url`, `podcast_url`, `reviews_url`) and update `g2_reviews_url` row to note array support |
| `COMPETITOR-DATA-PULL-REFERENCE.md` | §2.3 competitor × lane matrix | Add 4 new columns + 1 G2-array column |
| `COMPETITOR-DATA-PULL-REFERENCE.md` | §4 products.json snapshot | Refresh to current state (Funnel Leasing fully populated) |
| `COMPETITOR-DATA-PULL-REFERENCE.md` | §8 gapReport.js dimension table | Note new dimension routings |
| `SURFACE-INVENTORY.md` | Funnel Leasing row | Note all 8 streams now ingestable |
| `DATA-SOURCES-BRAINSTORM.md` | Phase B section | Mark insights/media/podcast/reviews lanes as **DONE** |

---

## Test plan

### Unit (extends `tracker/test/run.js`)
1. `intelPillarFromSourceType('insights', 'insights').pillar === 1`
2. `intelPillarFromSourceType('media', 'media').pillar === 3`
3. `intelPillarFromSourceType('podcast', 'podcast').pillar === 1`
4. `intelPillarFromSourceType('reviews_other', 'review_other').pillar === 3`
5. `pillarCoverageFromUrls({ insights_url: 'X', podcast_url: 'Y' })` → `p1: true`
6. `pillarCoverageFromUrls({ media_url: 'X' })` → `p3: true`
7. `pillarCoverageFromUrls({ reviews_url: 'X' })` → `p3: true`
8. `getSourceUrls('funnel-leasing').g2_reviews_url` returns array with both URLs (after products.json update)
9. `getSourceUrls('eliseai').g2_reviews_url` still returns single URL (back-compat)
10. `inferDimension({ type: 'insights' }).dimension === 'features'`
11. `inferDimension({ type: 'media' }).dimension === 'positioning'`

### Integration smoke
- Run `node tracker/test/run.js` — must show 0 failures.
- Run `node tracker/index.js collect --days 7` against the live Funnel Leasing config — verify new signals appear with correct `type`, `source`, `metadata.intel_pillar`.

---

## Migration notes

### Back-compat guarantees
- `g2_reviews_url` as a string keeps working unchanged. Only `funnel-leasing` switches to array form in this phase.
- All new keys are optional. Competitors without them still collect from existing lanes.
- Env overrides take precedence over config file values (existing behavior preserved).

### Out of scope (next phase)
- **HTML article-index lane** for sites without RSS (EliseAI's blog/newsroom, Funnel's case studies). Tracked separately in `DATA-SOURCES-BRAINSTORM.md` Phase B-2.
- **Podcast transcript ingestion** — current podcast lane captures titles + descriptions; full transcripts require ASR (Whisper / paid service).
- **X / LinkedIn social listening** — tracked in `SURFACE-INVENTORY.md` "Proposed surfaces" section.

---

## Sequencing

1. ✅ Spec (this doc).
2. **Code change (single PR)** — all collect.js / gapReport.js / intelPillar.js / weeklyIntelFlow.js edits + tests.
3. **Config change** — `products.json` updates for funnel-leasing.
4. **Docs sync** — refresh COMPETITOR-DATA-PULL-REFERENCE.md, SURFACE-INVENTORY.md, DATA-SOURCES-BRAINSTORM.md.
5. **Verification** — run test suite + a single live collect against funnel-leasing.
6. **Resume verification round** — apply new lanes to LeaseHawk → Anyone Home → Jonah Digital → EliseAI as their rows are verified.
