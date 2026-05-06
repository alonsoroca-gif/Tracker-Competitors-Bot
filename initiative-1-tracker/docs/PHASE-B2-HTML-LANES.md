# Phase B-2 — HTML lane expansion

Status: **In progress** (May 2026).
Triggered by Anyone Home verification: discovered substantive testimonial pages (`/customer-stories/`, `/why-anyone-home/`) and a blog-style article index that the current schema can't capture because they are HTML-only (no RSS). Same pattern applies to LeaseHawk's `/resources/media-center` and Funnel Leasing's case studies (parked).

This phase mirrors the [Phase 2](./PHASE-2-LANE-EXPANSION.md) playbook: add the lanes, propagate to verified competitors via `products.json` only.

Related:
- [`COMPETITOR-DATA-PULL-REFERENCE.md`](./COMPETITOR-DATA-PULL-REFERENCE.md) — canonical technical reference.
- [`SURFACE-INVENTORY.md`](./SURFACE-INVENTORY.md) — public surface trust ledger.
- [`DATA-SOURCES-BRAINSTORM.md`](./DATA-SOURCES-BRAINSTORM.md) — high-level source ideas roadmap.
- [`PHASE-2-LANE-EXPANSION.md`](./PHASE-2-LANE-EXPANSION.md) — direct precedent (RSS-based lanes).

---

## Goal

Capture two HTML-only content shapes the bot currently misses:

1. **Case-study / testimonial pages** (Anyone Home `/customer-stories/`, `/why-anyone-home/`, future Funnel case studies). Source of truth for own-customer voice describing feature value.
2. **HTML article-index pages** (LeaseHawk `/resources/media-center`, Jonah Digital `/articles/`, future Webflow / custom-CMS competitors). Lists of dated articles or external press links published on the competitor's own surface.

After this phase, applying these lanes to additional competitors is a `products.json` config change only.

---

## Schema changes (`products.json`)

### New keys
| Key | Form | What it captures | Pillar | Inferred dimension |
|---|---|---|---|---|
| `case_studies_url` | `string` OR `string[]` | Customer testimonial / case study HTML pages on the competitor's own domain | 1 (owned) | features |
| `articles_url` | `string` OR `string[]` | HTML article-index pages (blog index, press hub, articles list) without RSS | 1 (owned) | features |

Both keys accept either a single URL or an array, matching the `g2_reviews_url` pattern shipped in Phase 2 (back-compat preserved).

### Env override conventions
- `TRACKER_CASE_STUDIES_URL_<SUFFIX>` (comma/whitespace separated for arrays)
- `TRACKER_ARTICLES_URL_<SUFFIX>` (comma/whitespace separated for arrays)

---

## Code changes (file-by-file)

### `tracker/lib/collect.js`

1. **`getSourceUrls`** — add normalized array fields:
   - `case_studies_urls` (array, canonical)
   - `case_studies_url` (legacy string for back-compat)
   - `articles_urls` (array, canonical)
   - `articles_url` (legacy string for back-compat)
   - Reuse the existing `normalizeG2ReviewsUrls` pattern via a generic `normalizeUrlList(rawValue, envOverride)` helper.

2. **New `collectCaseStudySignals(competitorId, productId, url)`** — HTML scraper for testimonial pages:
   - Selectors target testimonial blocks: `[itemprop="review"]`, `blockquote`, `.testimonial`, `.case-study`, `[class*="customer"]`, `[class*="quote"]`.
   - Extract: customer-name candidates (h3/h4/strong inside or near each quote), company logos (`img[alt]`), short quote text.
   - Output: `source: 'case_studies'`, `type: 'case_study'`, P1 owned.

3. **New `collectArticleIndexSignals(competitorId, productId, url)`** — HTML scraper for article-list pages:
   - Selectors target article cards: `article`, `.post-card`, `[class*="article-card"]`, `[class*="blog-card"]`, `h2 a, h3 a` patterns.
   - Extract: title (anchor text), URL (anchor href, resolved to absolute), date (`time` element or month-day-year regex), short summary (sibling `p`).
   - Output: `source: 'articles_index'`, `type: 'article'`, P1 owned.
   - Cap at 12 items per page to avoid signal flood.

4. **`collect()` orchestrator** — iterate over both arrays:
   ```js
   for (const url of sourceUrls.case_studies_urls) {
     collected.push(...await collectCaseStudySignals(competitorId, productId, url));
   }
   for (const url of sourceUrls.articles_urls) {
     collected.push(...await collectArticleIndexSignals(competitorId, productId, url));
   }
   ```

### `tracker/lib/gapReport.js`

1. **`inferDimension`** — add new types:
   - `case_study` → `{ dimension: 'features', ourKey: 'features' }` — testimonials describe feature value
   - `article` → `{ dimension: 'features', ourKey: 'features' }` — owned articles default to features intel (mirrors `blog`)

2. **`sourceHumanLabel`** — add labels:
   - `case_studies` → `'Case studies'`
   - `articles_index` → `'Articles index'`

3. **`TYPE_ACTION_FALLBACK`** — add fallback strings:
   - `case_study: 'Customer voice on capabilities'`
   - `article: 'Published article (HTML index)'`

### `tracker/lib/intelPillar.js`

1. **`intelPillarFromSourceType`** — add cases:
   - `type === 'case_study'` or `source === 'case_studies'` → P1 owned
   - `type === 'article'` or `source === 'articles_index'` → P1 owned

(Both are own-domain content. Future "third-party-articles" lane can override per signal if/when justified.)

### `tracker/lib/weeklyIntelFlow.js`

1. **`pillarCoverageFromUrls`** — extend P1 detection:
   ```js
   const p1 = !!(
     urls.blog ||
     urls.press ||
     urls.changelog ||
     urls.youtube_rss ||
     urls.features_url ||
     urls.docs_url ||
     urls.insights_url ||
     urls.podcast_url ||
     urls.case_studies_url ||
     (Array.isArray(urls.case_studies_urls) && urls.case_studies_urls.length > 0) ||
     urls.articles_url ||
     (Array.isArray(urls.articles_urls) && urls.articles_urls.length > 0)
   );
   ```
2. Update `missing_hints` text to mention the new keys.

### `tracker/config/products.json`

Apply the verified Anyone Home updates plus the EliseAI G2 backfill discovered during verification:

1. **`eliseai`**: backfill `g2_reviews_url: "https://www.g2.com/products/eliseai/reviews"` (10 reviews, 4.6/5).
2. **`anyone-home`**: replace homepage `features_url` with `/solutions/`, fix broken `careers_url`, add WordPress feed for `blog`, add `case_studies_url` array.

```jsonc
"anyone-home": {
  "blog": "https://www.anyonehome.com/feed/",
  "press": "",
  "changelog": "https://anyonehome-updates.com/feed/",
  "docs_url": "",
  "pricing_url": "https://anyonehome.com/",
  "features_url": "https://anyonehome.com/solutions/",
  "careers_url": "",
  "case_studies_url": [
    "https://anyonehome.com/customer-stories/",
    "https://anyonehome.com/why-anyone-home/"
  ]
}
```

Other competitors keep existing fields. They get the new keys filled in when their verification rounds complete.

---

## Documentation updates (after code lands)

| File | Section | Update |
|---|---|---|
| `COMPETITOR-DATA-PULL-REFERENCE.md` | §2.1 source lanes table | Add 2 new rows (`case_studies_url`, `articles_url`) |
| `COMPETITOR-DATA-PULL-REFERENCE.md` | §2.3 competitor × lane matrix | Add 2 new columns; populate Anyone Home row |
| `COMPETITOR-DATA-PULL-REFERENCE.md` | §3 Env overrides | Document `TRACKER_CASE_STUDIES_URL_*`, `TRACKER_ARTICLES_URL_*` |
| `COMPETITOR-DATA-PULL-REFERENCE.md` | §4 products.json snapshot | Refresh to current state (Anyone Home updated, EliseAI G2 backfilled) |
| `COMPETITOR-DATA-PULL-REFERENCE.md` | §8 inferDimension table | Note `case_study` + `article` routing |
| `SURFACE-INVENTORY.md` | Anyone Home row | Document all 5 ingestible streams; flag testimonial pages as captured |
| `DATA-SOURCES-BRAINSTORM.md` | Phase B-2 section | Mark HTML article-index lane as **DONE**; keep events_url + social listening as parked |
| `TRACKER-DEMO.md` | New "future signals" subsection | Brief note that **events** (e.g. competitor webinars/conferences) are tracked downstream via blog/press recap, not real-time — document the design decision |

---

## Test plan

### Unit (extends `tracker/test/run.js`)

1. `intelPillarFromSourceType('case_studies', 'case_study').pillar === 1`
2. `intelPillarFromSourceType('articles_index', 'article').pillar === 1`
3. `pillarCoverageFromUrls({ case_studies_url: 'https://x.com/cs/' }).p1 === true`
4. `pillarCoverageFromUrls({ case_studies_urls: ['https://x.com/a', 'https://x.com/b'] }).p1 === true`
5. `pillarCoverageFromUrls({ articles_url: 'https://x.com/articles/' }).p1 === true`
6. `pillarCoverageFromUrls({ articles_urls: ['https://x.com/a'] }).p1 === true`
7. `getSourceUrls('anyone-home').case_studies_urls` returns array with 2 URLs
8. `getSourceUrls('anyone-home').case_studies_url` legacy string still populated for back-compat
9. `getSourceUrls('anyone-home').blog === 'https://www.anyonehome.com/feed/'`
10. `getSourceUrls('anyone-home').features_url.includes('/solutions/')`
11. `getSourceUrls('anyone-home').careers_url === ''` (was 404, now cleared)
12. `getSourceUrls('eliseai').g2_reviews_url` non-empty (after backfill)
13. Smoke: `gapReport` module re-loads after edits without error

### Integration smoke
- `node tracker/test/run.js` → 0 failures.
- `node tracker/index.js collect --days 7` against the live Anyone Home config — verify new signals appear with `type: 'case_study'`, `source: 'case_studies'`, `metadata.intel_pillar: 1`.

---

## Migration notes

### Back-compat guarantees
- All new keys are optional. Competitors without them still collect from existing lanes.
- `case_studies_url` and `articles_url` accept both `string` and `string[]` (same as `g2_reviews_url`).
- Env overrides take precedence over config file values (existing pattern).

### Out of scope (next phase or parked)
- **`events_url` lane** — real-time webinar / conference detection. Documented as a "future signal" in `TRACKER-DEMO.md` only. Implementation deferred until a concrete use case justifies the parsing work.
- **X / LinkedIn social listening** — tracked in `SURFACE-INVENTORY.md` "Proposed surfaces" section.
- **Domain-aware pillar inference for `articles_url`** — currently assumes own-domain (P1). If we later add a third-party-articles lane (e.g., media coverage hub linking to external sites), revisit with a per-signal pillar override.
- **Podcast transcript ingestion** — same status as before Phase 2.

---

## Sequencing

1. ✅ Spec (this doc).
2. **Code change (single PR)** — collect.js / gapReport.js / intelPillar.js / weeklyIntelFlow.js + tests.
3. **Config change** — `products.json` updates for `anyone-home` (full lane fillout) + `eliseai` (G2 backfill).
4. **Docs sync** — refresh COMPETITOR-DATA-PULL-REFERENCE.md, SURFACE-INVENTORY.md, DATA-SOURCES-BRAINSTORM.md, TRACKER-DEMO.md.
5. **Verification** — run test suite + a single live collect against anyone-home.
6. **Resume verification round** — apply new lanes to remaining competitors (Jonah Digital, EliseAI) as their rows are verified.
