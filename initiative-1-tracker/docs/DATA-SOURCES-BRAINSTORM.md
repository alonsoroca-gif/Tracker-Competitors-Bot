# How Report Information Is Gathered — Brainstorm (Public Sources Only)

**Goal:** Feed the Tracker’s gap reports with **publicly available** information only (no logins, no paywalls, no NDA content).

---

## How It Works Today

1. **Collect** runs per (competitor × product). For each competitor it calls `collect(competitorId, productId, days)`.
2. **Signals** are objects: `{ date, source, competitor_id, product_id, type, snippet }`.  
   `type` is used to infer **dimension** (support, pricing/messaging, positioning, features) and compare to **our state** in `config/our-state.json`.
3. **Gap report** = signals that imply something we don’t have (or have marked as “no”) → gaps with priority.
4. **Currently implemented:** Only **competitor blog RSS**. If `config.sources[competitorId].blog` or `TRACKER_FEED_URL_<ID>` is set, we fetch the feed and turn each item into a `type: 'blog'` signal (snippet = title). No URL → no signals for that competitor.

So today, **all report input is from competitor blog RSS** (when configured). Everything below is about **other public sources** we could add.

---

## Public Source Ideas (Brainstorm)

### 1. Competitor blogs & news (RSS / Atom)

- **What:** Blog posts, product updates, press.
- **Public?** Yes — most company blogs have a public feed.
- **How:** Already in place. Per-competitor feed URL in config/env; parse `<item>` → date, title → signal.
- **Extend:** Add per-competitor **multiple feeds** (e.g. blog + press room). Or parse `<description>` for a longer snippet and keep title as fallback.

### 2. Competitor websites (public pages only)

- **What:** Pricing page, features page, “Why us”, careers, product pages.
- **Public?** Yes — marketing and product pages are public.
- **How:** HTTP GET to known URLs (from config, e.g. `competitor.website` + `/pricing`, `/features`). Extract text (no JS required if HTML is server-rendered). Optional: simple HTML parsing (e.g. regex or a small parser) to get headings and first paragraph.
- **Caveats:** ToS and robots.txt; rate-limit (e.g. one request per competitor per run). No auth.

**Homepage, modals, and big announcements:** Many competitors put **rebrands and strategic shifts** on the **main site** — sometimes in a **modal** (e.g. “LeaseHawk is now Fenix”, standalone AI, link to a new domain). When `pricing_url` / `features_url` is the homepage, our HTML fetch can capture that copy **if it’s in the initial HTML** (not injected only by JavaScript after load). Pair with **[COMPETITIVE-KEYWORDS-PLAN.md](COMPETITIVE-KEYWORDS-PLAN.md)** theme **`brand_reorg`** once keyword themes ship. JS-only modals are a known gap (headless browser = later).

### 3. Job boards & careers pages

- **What:** Job titles, locations, departments — signals about strategy (e.g. “VP Product”, “AI team”, “international”).
- **Public?** Yes — job postings are public.
- **How:**  
  - **Option A:** Competitor careers page URL in config; fetch HTML and parse job listings (many use standard markup or predictable structure).  
  - **Option B:** Public job aggregators (e.g. LinkedIn Jobs, Indeed) filtered by company name — if they expose a public RSS or a simple listing URL we can GET (no login).  
- **Signal type:** e.g. `job` (already used in gap report for positioning).

### 4. Press releases & news (aggregators)

- **What:** “Company X launches Y”, funding, partnerships.
- **Public?** Yes — press releases and news articles are public.
- **How:**  
  - **RSS:** Many companies have a “press” or “news” feed; add as second source per competitor.  
  - **News APIs:** Some offer a free tier for public headlines (e.g. Google News RSS, Bing News) search by company name; use only public, no-auth endpoints.  
- **Signal type:** e.g. `press` or `news`; map in gap report to positioning/features.

### 5. Product review / comparison sites

- **What:** G2, Capterra, etc. — public review snippets and feature comparisons.
- **Public?** Partially — many listing pages and some comparison tables are public; full reviews sometimes behind signup.
- **How:** Only use **publicly visible** content: listing page, “features” table, or any public RSS/API they document. No scraping behind login. Check robots.txt and ToS.
- **Signal type:** e.g. `review_site` → dimension features or positioning.

### 6. Social (public only)

- **What:** Public Twitter/X, LinkedIn company posts, YouTube channel.
- **Public?** Yes for public accounts — no login required to read public posts.
- **How:**  
  - **RSS bridges:** Some tools expose “Twitter user → RSS” or “LinkedIn company → RSS” (public feeds). If we use such a public feed URL, same pattern as blog (fetch RSS → signals).  
  - **Official APIs:** Twitter/LinkedIn have APIs; free tiers often require auth and have limits. Only consider if we stay within public, documented, no-login-required usage (e.g. public syndication feeds).
- **Signal type:** e.g. `social`; map to messaging/positioning/features as needed.

### 6b. YouTube — official channel Atom feed (**implemented**)

- **What:** Video titles and descriptions from a competitor’s **public** YouTube channel (e.g. “Meet Fenix: Artificial Intelligence by Funnel” — product narrative, CEO updates, launches).
- **Public?** Yes — Google exposes a standard **Atom feed** per channel; no API key required for read.
- **URL format:** `https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>`  
  - Find **channel ID:** open the channel on YouTube → **Share** → **Copy channel ID**, or view page source and search for `channelId` / `browse_id`, or use “About” → “Share channel” on some layouts.
- **Config:** `sources[competitorId].youtube_rss` in `config/products.json`, or env `TRACKER_YOUTUBE_RSS_<COMPETITOR_ID>` (same pattern as blog).
- **Collector:** Reuses the same RSS/Atom parser as blog/press/changelog; `source` = `youtube`, `type` = `youtube`. Gap report maps to **positioning** (strategic messaging / launches).
- **Caveats:** Feed is **metadata only** (title, description, link) — not transcript. For spoken detail, transcripts would be a separate (heavier) step. Rate: one feed fetch per competitor per collect run.
- **Tracker competitors @ handles + manual verification checklist:** [YOUTUBE-CHANNELS.md](YOUTUBE-CHANNELS.md)
- **Third-party / practitioner YouTube** (reviews, “hype vs reality,” operator takes) is **high signal**; ongoing discovery should be **automated** (YouTube Data API search +/or RSS + keyword filter), not a manual video list — see [YOUTUBE-CHANNELS.md — Automated discovery](YOUTUBE-CHANNELS.md#automated-discovery-no-manual-video-list).
- **“Analyzing” video:** not by scraping the video file; use **title/description** first, then **captions/transcript** (API or approved tooling) or **ASR on audio** — see [YOUTUBE-CHANNELS.md — What the bot can see](YOUTUBE-CHANNELS.md#what-the-bot-can-see-in-a-video-analysis).

### 7. Changelog / release notes (public)

- **What:** “What’s new”, changelog, product updates.
- **Public?** Yes — many SaaS companies have public changelog or release pages.
- **How:** If competitor has a changelog URL (or RSS) in config, fetch it like blog; each entry → signal (type e.g. `changelog`).
- **High value:** Direct product/feature signals.

### 8. Public filings (if applicable)

- **What:** SEC, regulatory, or public investor materials.
- **Public?** Yes.
- **How:** Only if relevant (e.g. public companies). URLs or official sources; parse only public docs. Likely lower frequency; useful for positioning/strategy signals.

### 9. Entrata’s own public presence (for “our state” or context)

- **What:** Entrata blog, press, careers, pricing page.
- **Public?** Yes.
- **How:** Same techniques as competitors — RSS, public pages. Could feed a **“our state”** helper (e.g. “what we’ve said publicly”) or just context; our-state today is manual in `config/our-state.json`, so this would be optional enrichment.

---

## Analysis: Which Sources Give Us the Most Information?

Criteria (for our 5 competitors: EliseAI, Funnel Leasing, LeaseHawk, Anyone Home, Jonah):

| Criterion | Meaning |
|-----------|--------|
| **Information value** | How much report-relevant, gap-relevant content (features, pricing, positioning, support)? |
| **Coverage** | Do most/all competitors have this source (blog, press page, careers, etc.)? |
| **Freshness** | How often does it update? (Daily/weekly = high; static page = one-time per run) |
| **Effort** | Implementation cost (reuse RSS vs new fetcher vs parsing messy HTML). |
| **Reliability** | Stable URLs, consistent format, minimal breakage when sites change. |

### Source-by-source analysis

| Source | Information value | Coverage | Freshness | Effort | Reliability | **Score** |
|--------|-------------------|----------|-----------|--------|-------------|-----------|
| **Blog RSS** (current) | High — product updates, positioning | High (4/5 likely have blog) | High (frequent posts) | Done | High (standard RSS) | **Already in place** |
| **Press / news RSS** | High — launches, funding, partnerships → positioning & features | Medium–High (many have /press or /news) | Medium (few posts/month) | **Low** (same RSS pipeline, new type) | High | **Best first add** |
| **Changelog / releases** | **Very high** — direct “what’s new” product signals | Medium (SaaS often have; Jonah less so) | Medium | **Low** (RSS or simple page) | High when RSS | **Best second add** |
| **Pricing / features pages** | **Very high** — pricing tiers, feature lists → gaps | High (all have website) | Low (snapshot; changes occasionally) | Medium (HTML fetch + extract text) | Medium (layouts change) | **Strong third** |
| **Careers / jobs** | Medium — strategy, growth (e.g. “AI team”, “VP Product”) | High (all have careers or About) | Medium (new roles often) | Medium (parse listings or RSS) | Medium (sites vary) | **Good fourth** |
| **Review sites (public)** | Medium — feature checkmarks, positioning | Low–Medium (not all on G2/Capterra) | Low | Medium + ToS check | Medium | Later |
| **YouTube channel feed** | **High** — launches, CEO narrative, product story (title + description) | Medium (need channel ID) | Medium–High (new videos) | **Low** (same RSS pipeline) | High (Google stable feed URL) | **In Tracker** (`youtube_rss`) |
| **Social (RSS bridges)** | Medium — announcements, tone | High | High | Low–Med (find RSS bridge URLs) | Medium (bridges can break) | Later |
| **Public filings** | Low for L2L (strategy only) | Low (only if public cos) | Low | High | High | Skip for now |

**Takeaways:**
- **Press/news RSS** and **changelog** reuse the existing RSS pipeline and add high-value signal types with low effort.
- **Pricing/features pages** give the most “what do they offer” information in one place but need a new fetcher and text extraction; worth doing once RSS expansion is in.
- **Careers** is good for positioning/growth signals; implementation is medium (different page structures).

---

## First Resources to Implement (Selection)

**Phase 1 — Maximize information with minimal new code**

1. **Press / news RSS** (per competitor)  
   - **Why first:** Same collector pattern as blog; add a second feed URL and map `type: 'press'` in gap report. High information value (launches, partnerships), good coverage, low effort.  
   - **Config:** `sources[competitorId].press` or `sources[competitorId].news` (RSS URL).  
   - **Deliverable:** Collect merges press feed into signals; `inferDimension` in gapReport handles `press`/`news` → positioning or features.

2. **Changelog / release notes** (per competitor, where available)  
   - **Why second:** Direct product/feature signals; many SaaS have a changelog RSS or a single “What’s new” page. Reuse RSS if feed exists; otherwise one simple URL fetch later.  
   - **Config:** `sources[competitorId].changelog` (RSS or URL).  
   - **Deliverable:** New signal type `changelog`; map to features (and optionally support) in gap report.

3. **Pricing / features pages** (one URL per competitor, optional)  
   - **Why third:** Highest information density per request — tiers, feature lists, messaging. One GET per competitor per run; extract main text or headings.  
   - **Config:** `sources[competitorId].pricing_url`, optional `sources[competitorId].features_url`.  
   - **Deliverable:** New fetcher `collectFromPage(url)` → strip HTML to text, split into chunks or one snippet per page; type `pricing` or `features`. Requires `inferDimension` updates for these types (already partially there for pricing).

4. **Careers / job listings** (one URL per competitor)  
   - **Why fourth:** Strategy and positioning (hiring, expansion). Medium effort due to varying page structures; can start with “fetch careers URL and extract text” and later refine to job titles if needed.  
   - **Config:** `sources[competitorId].careers_url`.  
   - **Deliverable:** Fetcher for careers page; signal type `job` (already used in gap report for positioning).

**Implementation order:** Press RSS → Changelog RSS → Pricing/features pages → Careers. After 1 and 2 we already have three feed-based sources (blog + press + changelog) with one code path; then add page fetchers for 3 and 4.

---

## Summary Table (public only)

| Source              | Public? | Today | Effort | Signal types      |
|---------------------|--------|-------|--------|-------------------|
| Competitor blog RSS | Yes    | Yes   | Done   | blog              |
| Competitor pricing/features pages | Yes | No  | Medium | pricing, features |
| Careers / job listings | Yes  | No   | Medium | job               |
| Press / news RSS    | Yes    | No   | Low    | press, news       |
| Changelog / releases| Yes    | No   | Low    | changelog         |
| Review sites (public parts) | Partial | No | Medium | review_site       |
| Social (RSS bridges)| Yes    | No   | Low–Med| social            |
| Public filings      | Yes    | No   | High   | positioning       |

---

## Recommended order (for implementation)

1. **RSS expansion** — Add a second RSS per competitor (press/news or changelog) and map new types in `inferDimension` in `gapReport.js`. Still 100% public, minimal new code.
2. **Public website pages** — Add optional URLs in config (e.g. `pricing_url`, `features_url`); fetch once per run, extract text, emit signals. Respect robots.txt and rate limits.
3. **Careers/jobs** — One URL per competitor (careers page or public job feed); parse job titles/departments → `job` signals.
4. **Changelog/release notes** — Where available, add changelog RSS or URL; high signal for product/features.

---

## Constraints to keep

- **No login** — Only GET public URLs or use public APIs/feeds.
- **No paywall** — Don’t use content that requires a subscription.
- **Respect ToS and robots.txt** — Check before adding a new source.
- **Rate limiting** — Don’t hammer domains; one or few requests per competitor per run.
- **Attribution** — Store `source` and optional `url` on each signal so reports stay traceable.

---

## Config shape (for new sources)

Keep one place for “where to get data” per competitor, e.g. in `config/products.json` or a dedicated `config/sources.json`:

```json
{
  "sources": {
    "eliseai": {
      "blog": "https://eliseai.com/blog/feed/",
      "press": "https://eliseai.com/press/feed/",
      "careers_url": "https://eliseai.com/careers/",
      "pricing_url": "https://eliseai.com/pricing/"
    }
  }
}
```

Only add URLs we’re allowed to request (public, no auth). The collect pipeline can then grow new fetchers (e.g. `collectFromPress`, `collectFromCareers`) that return the same signal shape.

---

## Phase 1 implementation checklist

- [x] **1. Press/news RSS** — `sources[competitorId].press` or `.news`; `collect.js` uses same RSS parser, emits `type: 'press'`. `gapReport.js` maps press/news → positioning.
- [x] **2. Changelog RSS** — `sources[competitorId].changelog`; same RSS path, `type: 'changelog'`. Mapped to features in `inferDimension`.
- [x] **3. Pricing/features pages** — `collectFromPage()` fetches HTML, strips tags, first 500 chars; `pricing_url`, `features_url`. Types `pricing` (→ messaging), `features` (→ features).
- [x] **4. Careers** — `careers_url`; same page fetcher, `type: 'job'`, source `careers`. Mapped to positioning.

---

## Phase 2 implementation checklist (May 2026)

Triggered by Funnel Leasing verification — discovered 5 dedicated content streams beyond `blog`+`press` plus a sub-product G2 page (Fenix AI) the schema couldn't represent. See [`PHASE-2-LANE-EXPANSION.md`](./PHASE-2-LANE-EXPANSION.md) for full spec.

- [x] **5. Insights / editorial articles RSS** — `sources[competitorId].insights_url`; `type: 'insights'`, `source: 'insights'`. Mapped to features dimension, P1 (owned).
- [x] **6. Media coverage RSS** — `sources[competitorId].media_url`; `type: 'media'`, `source: 'media'`. Mapped to positioning dimension, P3 (third party).
- [x] **7. Podcast RSS** — `sources[competitorId].podcast_url`; `type: 'podcast'`, `source: 'podcast'`. Mapped to positioning, P1. **Limitation:** captures titles + descriptions only; transcripts require ASR (Whisper / paid).
- [x] **8. Generic review aggregators (non-G2)** — `sources[competitorId].reviews_url`; HTML excerpt extractor with broad cheerio selectors; `type: 'review_other'`, `source: 'reviews_other'`. Mapped to features, P3. Tested against FeaturedCustomers; should also work for FitGap, Revyse, SlashDot.
- [x] **9. G2 reviews accepts array** — `g2_reviews_url` now accepts `string` or `string[]`. Lets us track main product + sub-product G2 pages (e.g. Funnel CRM + Fenix AI). Each URL fetched independently; signals deduped by URL.

## Phase B-2 implementation checklist (May 2026)

Triggered by Anyone Home verification — discovered substantive testimonial pages (`/customer-stories/`, `/why-anyone-home/`) that are HTML-only (no RSS). Same pattern applies to LeaseHawk's `/resources/media-center` and Funnel Leasing's case studies index. See [`PHASE-B2-HTML-LANES.md`](./PHASE-B2-HTML-LANES.md) for full spec.

- [x] **10. Case studies / testimonial pages** — `sources[competitorId].case_studies_url` (string OR string[]); cheerio testimonial-block extractor; `type: 'case_study'`, `source: 'case_studies'`. Mapped to features dimension, P1 (owned). First applied to Anyone Home with `/customer-stories/` + `/why-anyone-home/`.
- [x] **11. HTML article-index lane** — `sources[competitorId].articles_url` (string OR string[]); cheerio article-card extractor for sites without RSS (Webflow / custom-CMS competitors); `type: 'article'`, `source: 'articles_index'`. Mapped to features, P1.

**Phase B-3 (parked, future):**
- [ ] **`events_url` lane** — proactive detection of upcoming webinars / conferences (e.g. Anyone Home's May 21 Hybrid-Intelligence webinar). Currently we rely on the post-event blog / press recap. Documented as a "future signal" in [`TRACKER-DEMO.md`](./TRACKER-DEMO.md). Implementation deferred until a concrete need justifies the parsing work.
- [ ] **Podcast transcript ingestion** (ASR pipeline) — Phase 2 podcast lane captures titles + descriptions only.
- [ ] **X / LinkedIn social listening** — see [`SURFACE-INVENTORY.md`](./SURFACE-INVENTORY.md) "Proposed surfaces".
- [ ] **Domain-aware pillar inference for `articles_url`** — currently assumes own-domain (P1). If we later need a third-party-articles lane (e.g. `/resources/media-center` linking out to BusinessWire / MultiHousingNews), revisit with per-signal pillar override.

*Last updated: Phase B-2 HTML lane expansion (May 2026).*
