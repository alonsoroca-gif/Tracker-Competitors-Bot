# Surface inventory per competitor (foundation)

**Purpose:** Record **which public surfaces each competitor actually maintains**, how often they update them, and how much you **trust** each surface for **UI / product-feature** signals. This reduces “mock” gaps by aligning `collect` + gap rules with reality—not every competitor ships truth on a changelog.

**Related:** URL fields live in `tracker/config/products.json` under `sources[<competitorId>]`. **Per-lane fetch behavior, signal `source`/`type`, APIs, and a competitor×lane matrix** → [COMPETITOR-DATA-PULL-REFERENCE.md](./COMPETITOR-DATA-PULL-REFERENCE.md) (§2.1–2.3). For the **end-to-end delivery model** (Git drops + Cursor + optional Slack) and **diagrams**, see [TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md).

---

## “Collect after each config pass” — what that means

When you (or PM) **change `products.json`**—new RSS URL, new changelog, different `features_url`—the Tracker **does not** automatically re-download the web on its own unless something runs **collect**.

- **Collect** = the job that **fetches** those URLs and **writes** signals into storage (e.g. `data/signals.json`).
- **Config pass** = you just edited URLs or added a surface.

So: **after every meaningful config change, run collect once** (UI **Refresh data / Collect**, or `npm run collect`), **then** reload the report. Otherwise you are still interpreting **stale** snippets, and Competitive Move / Our Response will look wrong even if Cursor is perfect.

**Rule:** **Edit config → collect → reload report → (then) interpret.**

---

## Trust tier key (UI / feature claims)

| Tier | Meaning |
|------|--------|
| **A** | Structured ship evidence (changelog bullets, versioned release notes, dated “what’s new” in docs). |
| **B** | Credible narrative product content (blog with dates, engineering posts). |
| **C** | Useful sometimes; noisy (pricing page, generic product landing). |
| **D** | Do **not** infer concrete **UI** shipped from this alone (careers, pure hero homepage, empty URL). |

**Cadence** = what you observe in the wild (update quarterly when you review competitors).

**TBD in the Cadence column** means **not yet observed or written down in this doc** — not “unknown forever.” Replace TBD with something concrete after a quick live check (for example: *weekly*, *monthly*, *quarterly*, *sporadic*, *stale since YYYY-MM-DD*) when you next review that URL.

---

## Filled inventory (synced to `products.json` as of last doc edit)

Values below use **current** `sources` URLs. Empty fields in config are marked **n/a**. **PM should re-grade** tiers after spot-checking each live page.

### eliseai

| Surface | URL (from config) | Cadence (observed / TBD) | Trust (UI feature) | Notes |
|---------|---------------------|---------------------------|--------------------|--------|
| Blog | *(empty in config — pending verification)* | n/a | **B** *if added* | EliseAI hosts `https://eliseai.com/blog` but RSS not yet verified. To-do in next verification pass. |
| Press | *(empty in config)* | n/a | **D** | Configure when you have a stable feed/URL. |
| Changelog | *(empty in config)* | n/a | **A** *if added* | No dedicated changelog RSS found; product narrative is mostly **blog** + **Datalog**-style marketing page (see `docs_url`). |
| Docs / product updates page | `https://www.eliseai.com/datalog` (via `docs_url`) | TBD | **B**–**C** | Treated like other marketing/docs scrapes in collect—not a versioned ship log. |
| Pricing page | `https://eliseai.com/pricing/` | TBD | **C** | Plans/tiers; limited UI detail. |
| Features / marketing | `https://eliseai.com/` | TBD | **D** | Homepage-level; hero copy risk. |
| Careers | `https://eliseai.com/careers/` | TBD | **D** | Hiring signal, not UI ship log. |
| YouTube discovery | queries in config; API optional | TBD | **C** | Good for narrative; not a ship log. |
| G2 | `https://www.g2.com/products/eliseai/reviews` | Weekly | **C** | 10 reviews, 4.6/5. Backfilled May 2026 during verification round. |

### funnel-leasing

Verified May 2026; Funnel publishes 8 distinct content streams via WordPress with separate per-category RSS feeds. All eight ingestable lanes are wired in `products.json` after the Phase 2 expansion ([spec](./PHASE-2-LANE-EXPANSION.md)).

| Surface | URL | Cadence | Trust | Notes |
|---------|-----|---------|-------|--------|
| Blog (LLM-tagged feature SEO) | `https://funnelleasing.com/category/llm/feed/` | Daily | **B** | Auto-style "Best/How to/X vs Y" content; **highest features-density** feed for Funnel. 100% of items describe specific product capabilities. |
| Press releases | `https://funnelleasing.com/category/press/feed/` | Weekly–biweekly | **A** | Official launch announcements ("Funnel launches Insights: AI call scoring", etc.). ~70% of items are feature launches. |
| Editorial articles (Insights) | `https://funnelleasing.com/category/insights/feed/` | Daily | **A** | Forum recaps, panel recaps, executive interviews. Mapped to `insights_url` lane (Phase 2). |
| Media coverage | `https://funnelleasing.com/category/media/feed/` | Weekly | **A** | Third-party press *about* Funnel (Forbes, CNBC, GlobeSt., etc.). Mapped to `media_url` lane (Phase 2), P3. |
| Podcast (Multifamily Unpacked) | `https://funnelleasing.com/category/podcast/feed/` | Biweekly | **B** | 60+ episodes; titles + descriptions only (no transcripts). Mapped to `podcast_url` lane (Phase 2). |
| External reviews (FeaturedCustomers) | `https://www.featuredcustomers.com/vendor/funnel-leasing` | Monthly | **B** | 4.8/5 from 595 reference ratings; 26 written reviews. Mapped to `reviews_url` lane (Phase 2). |
| G2 — main CRM | `https://www.g2.com/products/funnel-leasing/reviews` | Weekly | **A** | Funnel's umbrella product reviews. Active in `g2_reviews_url` array. |
| G2 — Fenix AI sub-product | `https://www.g2.com/products/fenix-ai/reviews` | Weekly | **A** | Funnel's standalone AI platform (launched Apr 2025, Sierra-powered). Direct EliseAI head-to-head. Active in `g2_reviews_url` array. |
| Developer docs | `https://developer.funnelleasing.com/` (via `docs_url`) | TBD | **B** | Integration / API truth; not a consumer changelog. |
| Pricing | `https://funnelleasing.com/pricing/` | TBD | **C** | |
| Features / marketing | `https://funnelleasing.com/` | TBD | **D** | |
| Careers | `https://funnelleasing.com/careers/` | TBD | **D** | |
| Case studies | `https://funnelleasing.com/category/cases/` (HTML only — feed empty) | Monthly | **A** | 7 customer success stories. Not yet ingestable; needs HTML article-index lane (Phase B-2). |

### leasehawk

Verified May 2026. Brand is being absorbed into Funnel Leasing within 3–6 months (YouTube channel already migrated). Blog content is HTML-only at `/blog-home` (Webflow CMS, no RSS) and stale (latest post Feb 2025). Most lanes deliberately left empty — content reaches us via Funnel's channels.

| Surface | URL | Cadence | Trust | Notes |
|---------|-----|---------|-------|--------|
| Blog | *(empty — Webflow HTML only, no RSS)* | Stale (Feb 2025) | **D** | `/blog-home` exists but content is stale; deferred to Phase B-2 articles_url lane (not worth implementing for a deprecating brand). |
| Press | *(empty — Webflow HTML only, no RSS)* | Stale | **D** | `/resources/media-center` exists but is HTML-only. |
| Changelog | *(empty)* | n/a | **D** | No public changelog. |
| Docs | *(cleared May 2026 — was 404)* | n/a | **D** | Previous `https://www.leasehawk.com/post` returned 404; cleared during verification round. |
| Pricing | `https://leasehawk.com/` | TBD | **C** | No public `/pricing` page; demo-gated. Homepage is best fallback. |
| Features / marketing | `https://leasehawk.com/` | TBD | **D** | Homepage; consider upgrading to `/ace` (real product page, 80KB) when LeaseHawk gets active again. |
| Careers | `https://leasehawk.com/careers/` | TBD | **D** | Light page (416 words); kept for hiring signals. |
| G2 | *(empty — redirects to Fenix AI which is already in `funnel-leasing.g2_reviews_url`)* | n/a | **D** | Adding would duplicate the Fenix G2 collection under a different competitor row. |
| YouTube | *(empty — channel migrated to FunnelLeasing)* | n/a | **D** | LeaseHawk channel deprecated; content now under `funnel-leasing` configuration. |

### anyone-home

Verified May 2026. Anyone Home runs on **WordPress** (auto-discovered RSS). Phase B-2 lane expansion ([spec](./PHASE-B2-HTML-LANES.md)) added `case_studies_url` to capture testimonial pages.

| Surface | URL | Cadence | Trust | Notes |
|---------|-----|---------|-------|--------|
| Blog (RSS) | `https://www.anyonehome.com/feed/` | Monthly–weekly | **B** | WordPress site-wide feed; auto-discovered via `<link rel="alternate" type="application/rss+xml">`. Latest post Mar 27, 2026 ("From Lead to Lease — How Hybrid Intelligence Helps You Convert"). |
| Press | *(empty — `/press/` and `/news/` are 404)* | n/a | **D** | No dedicated press surface on anyonehome.com. |
| Product updates (Changelog) | `https://anyonehome-updates.com/feed/` | Monthly | **A** | Real RSS feed (10 items, latest "28 April 2026 Release"). Dated release notes — strong ship signal. |
| Customer stories (Case studies) | `https://anyonehome.com/customer-stories/` | TBD | **A** | Customer testimonials with names, companies, quotes (Justin Choi @ Sequoia, etc.). Captured via `case_studies_url` lane (Phase B-2). |
| Why Anyone Home (Case studies) | `https://anyonehome.com/why-anyone-home/` | TBD | **B** | Embedded customer quotes with photos (Alana Wagner @ TGM, Kristin Hupfer). Captured via `case_studies_url` lane. |
| Pricing | `https://anyonehome.com/` | TBD | **C** | No public `/pricing` page; homepage is best fallback. |
| Features / marketing | `https://anyonehome.com/solutions/` | TBD | **B** | **Upgraded May 2026** from homepage to `/solutions/`. Lists CRM, Marketing Websites, Self-Guided Tours, Chatbot, Contact Center, Leasing Call Analysis — real feature catalog. |
| Careers | *(cleared May 2026 — was 404)* | n/a | **D** | Previous `/careers/` returned 404. Inhabit (parent) careers page exists but is also Cloudflare-blocked from the bot. |
| Events | `https://anyonehome.com/events/` (HTML, not yet ingested) | TBD | **B** | Active page (May 21 webinar visible). Real-time event detection deferred — see "Future signals" in `TRACKER-DEMO.md`. |
| Inhabit parent feed | `https://inhabit.com/feed/` (HTML, not yet ingested) | TBD | **C** | Parent company feed; multifamily relevance not yet measured (Cloudflare blocked our verification probe). |

### jonah-digital

| Surface | URL | Cadence | Trust | Notes |
|---------|-----|---------|-------|--------|
| Articles / add-ons | `https://jonahdigital.com/articles/` (via `docs_url`) | TBD | **B**–**C** | Agency announcements—not a semver changelog. |
| Pricing | `https://jonahdigital.com/` | TBD | **C** | |
| Features / marketing | `https://jonahdigital.com/` | TBD | **D** | |
| Careers | `https://jonahdigital.com/careers/` | TBD | **D** | |

---

## Proposed surfaces — X (Twitter) and LinkedIn

**Status: not yet implemented.** This section is the **target inventory** so the next sprint of `collect.js` can wire it the same way YouTube already is (Track A = official handles, Track B = keyword discovery). See [YOUTUBE-CHANNELS.md](./YOUTUBE-CHANNELS.md) for the pattern this mirrors.

### Why both platforms

| Platform | Why it matters for multifamily / PropTech |
|----------|--------------------------------------------|
| **X (Twitter)** | Fastest signal of **launches, outage griping, founder takes, conference live-posts**, and **third-party** practitioner reactions. Short-form, public, easy to search by keyword. |
| **LinkedIn** | Where competitors’ **GTM, partnerships, hiring, and launch decks** are announced; where customers (property managers, leasing ops) **complain or compare** in long-form posts and comments. |

### Tracks A and B (parallel to YouTube)

| Track | What it ingests | Trust ceiling |
|-------|-----------------|---------------|
| **A — Official competitor profiles** | Posts authored by the competitor’s own X / LinkedIn handle | **B**–**A** for messaging, dates, named integrations (first-party). |
| **B — Third-party / keyword listening** | Posts from **anyone** that match competitor names, sub-product names, handles, and disambiguating modifiers | **B**–**C**: highest *narrative* signal (objections, comparisons), highest *noise* — filtering is mandatory. |

### A — Official handles (one row per competitor; PM fills + verifies)

> **Verify in browser** the same way YouTube’s official-channel checklist does: confirm the handle matches the brand and (if shown) has the platform verification badge.

| Competitor ID | X handle (you fill / verify) | LinkedIn page (you fill / verify) |
|---------------|------------------------------|------------------------------------|
| `eliseai` | `https://x.com/Elise_AI` ☐ | `https://www.linkedin.com/company/eliseai/` ☐ |
| `funnel-leasing` | `https://x.com/funnelleasing` ☐ | `https://www.linkedin.com/company/funnel-leasing/` ☐ |
| `leasehawk` | `https://x.com/LeaseHawk` ☐ | `https://www.linkedin.com/company/leasehawk/` ☐ |
| `anyone-home` | `https://x.com/anyonehome` ☐ | `https://www.linkedin.com/company/anyonehome/` ☐ |
| `jonah-digital` | `https://x.com/jonahdigital` ☐ | `https://www.linkedin.com/company/jonah-digital-agency/` ☐ |

> URLs above are **best-guess starting points**; mark each ☐ as confirmed or replace once the PM has clicked through.

### B — Keyword pack per competitor (for listening / search)

Goal mirrors YouTube’s `youtube_discovery_queries`: give the bot **a wide net** of names users actually type. **Combine** the brand block with at least **one** disambiguator from the modifier block to suppress generic-word collisions.

| Competitor | Brand & variant terms | Sub-products / brand assets | Disambiguators (require co-occurrence) |
|------------|------------------------|------------------------------|-----------------------------------------|
| `eliseai` | `EliseAI`, `Elise AI`, `elise.ai`, `Elise bot`, `Elise leasing AI` | `ChatAI`, `EmailAI`, `VoiceAI`, `EliseCRM` | `multifamily`, `leasing`, `property management`, `review`, `vs` |
| `funnel-leasing` | `Funnel Leasing`, `FunnelLeasing`, `Funnel CRM` | `Fenix` *(Funnel’s AI assistant — needs co-mention with `Funnel`)* | `multifamily`, `leasing`, `Funnel`. **Exclude:** `funnel.io`, `marketing funnel`, `sales funnel`. |
| `leasehawk` | `LeaseHawk`, `Lease Hawk` | `ACE virtual leasing agent`, `ACE` *(only with `LeaseHawk`)* | `leasing`, `multifamily`, `apartment`. **Exclude:** standalone `ACE`. |
| `anyone-home` | `Anyone Home`, `AnyoneHome` | `Anyone Home bot`, `AH AI` | **Required**: `leasing`, `multifamily`, `property management`, `bot`, `AI`, or `assistant` (the bare phrase “anyone home” is too generic). |
| `jonah-digital` | `Jonah Digital`, `Jonah Digital Agency`, `JonahDigital` | `Jonah` *(only with `Digital` or `multifamily`)* | `multifamily`, `agency`, `apartment marketing`. **Exclude:** standalone `Jonah`. |

**Modifier set (apply across competitors):** `review`, `honest review`, `vs`, `pricing`, `pilot`, `rollout`, `hype`, `not impressed`, `case study`, `multifamily`, `property management`, `apartment`, `leasing AI`, `chatbot`, `voice AI`.

**Trust grading (apply per row at interpretation time):** Track A official posts → **B**; Track B from **named operators / brokers / agencies** → **B**; Track B from anonymous or low-signal accounts → **C / D**. Do not promote single low-signal posts to “feature shipped” without corroboration in another lane (blog, changelog, docs).

### Access options — full enumeration (X and LinkedIn)

Beyond “paid API or partnership,” there are **categories** of access. Each row is graded so you can pick by trade‑off rather than by ideology.

**Legend.** **Compliance**: 🟢 Approved (vendor’s ToS endorses it) · 🟡 Vendor‑shielded (paid third party assumes responsibility) · 🟠 Gray (not endorsed, not actively litigated) · 🔴 Hostile (against ToS / actively blocked / past lawsuits). **Reliability**: stability over 6+ months. **Coverage**: handles only / keyword search / both.

#### A. Official / approved channels

| # | Option | Platform | Cost | Compliance | Reliability | Coverage | Effort | Verdict for this tracker |
|---|--------|----------|------|------------|-------------|----------|--------|---------------------------|
| 1 | **X API v2 — Basic** | X | ~$200/mo | 🟢 | Stable | Handles + keyword search (~7‑day window) | Low (HTTP + key) | **Best DIY path for X.** Caps fit our 5 competitors. |
| 2 | **X API v2 — Pro** | X | ~$5,000/mo | 🟢 | Stable | + full‑archive search, filtered stream | Low | Overkill unless you go beyond 5 competitors. |
| 3 | **LinkedIn Marketing Developer Platform** | LinkedIn | Free if approved | 🟢 | Stable | Pages **you own** only — **not competitor pages** | Heavy (partner approval) | **Useless for competitor monitoring.** Listed for honesty. |
| 4 | **LinkedIn Pages API** | LinkedIn | Free | 🟢 | Stable | Same — own pages | Low | Same as #3. |

#### B. Licensed social‑listening vendors *(compliance offload)*

You pay them; they handle ToS, legal exposure, and ingestion. Most cover **both** X and LinkedIn (and often blogs, news, Reddit) in one feed.

| # | Vendor | Tier (approx) | Cost | Compliance | LinkedIn coverage? | Verdict |
|---|--------|---------------|------|------------|-------------------|---------|
| 5 | **Brandwatch** | Enterprise | $$$ ($1.5K–10K+/mo) | 🟡 | Yes (licensed) | Best LinkedIn fidelity; overkill for 5 competitors. |
| 6 | **Talkwalker** | Enterprise | $$$ | 🟡 | Yes | Same tier as Brandwatch. |
| 7 | **Meltwater** | Enterprise | $$$ | 🟡 | Yes | News‑heavy bias; LinkedIn is included but not core. |
| 8 | **Sprinklr** | Enterprise | $$$$ | 🟡 | Yes | Engagement‑oriented; expensive. |
| 9 | **Brand24** | SMB | ~$80–250/mo | 🟡 | Partial (mentions, not full feeds) | **Best mid‑market candidate.** Covers X + LinkedIn mentions + blogs in one. |
| 10 | **Mention.com** | SMB | ~$50–180/mo | 🟡 | Partial | Comparable to Brand24. |
| 11 | **Awario** | SMB | ~$30–100/mo | 🟡 | Partial | Cheapest of the SMB three. |
| 12 | **Mentionlytics** | SMB | ~$80–300/mo | 🟡 | Partial | LinkedIn coverage less consistent than Brand24. |

> **Practical rec for this tracker:** if you cannot get the X API budget, **one of {Brand24, Mention, Awario}** at ~$50–150/mo gives X + LinkedIn keyword listening with the vendor taking ToS risk — same compliance posture as how every PR team monitors press today.

#### C. Aggregators / RSS bridges

| # | Option | Platform | Cost | Compliance | Reliability | Coverage | Verdict |
|---|--------|----------|------|------------|-------------|----------|---------|
| 13 | **rss.app** | X + LinkedIn (some) | $10–50/mo | 🟠 | **Brittle** (breaks when source changes) | Handles primarily | OK for a single competitor as a stopgap; not for production. |
| 14 | **Feedly Pro+** | X (limited), LinkedIn (rare) | $14/mo | 🟠 | Brittle for X/LinkedIn | Handles | Mostly used for blogs; social is a weak feature. |
| 15 | **Inoreader Pro** | Same as Feedly | $9–15/mo | 🟠 | Brittle | Handles | Same. |
| 16 | **RSS Bridge (self‑host)** | X + LinkedIn modules | Free + hosting | 🟠 | LinkedIn module **breaks frequently** | Handles | Useful for X handles (when paired with Nitter); LinkedIn module rarely stays alive. |
| 17 | **Nitter — public instance** | X | Free | 🟠 (X actively blocks) | **Flaky** (instances die in days/weeks) | Handles + some search | Works **today** for many handles via `https://nitter.<instance>/<user>/rss`. Plan for the instance to die; don’t make it the only path. |
| 18 | **Nitter — self‑hosted** | X | Free + hosting | 🟠 | Flaky (X cookies, IP blocks) | Same as #17 | Slightly more control; same fragility. |

#### D. Search‑engine workarounds *(URLs & headlines, not full posts)*

These don’t give you full post bodies — they give you **discoverable URLs** + meta titles / snippets that your bot can then store as signals (similar to how the YouTube `search.list` lane works today).

| # | Option | Platform | Cost | Compliance | Coverage | Verdict |
|---|--------|----------|------|------------|----------|---------|
| 19 | **Google Programmable Search / Custom Search API** | Both (`site:x.com`, `site:linkedin.com/posts`) | $5/1K queries (free tier limited) | 🟢 | URLs + meta snippets | **Cheap, legal, available now.** Won’t see the full tweet/post text — only what Google indexed. |
| 20 | **SerpAPI / Brave Search API / Bing Search API** | Both | ~$50/mo entry | 🟢 (Brave is privacy‑friendly) | URLs + meta snippets | Same as #19, less rate‑limited. |
| 21 | **Google Alerts** | Both | Free | 🟢 | URLs by email | **Lowest tech bar:** create alerts per competitor name + `site:x.com` / `site:linkedin.com`; pipe inbox to a folder. Latency hours–days; missed posts likely. |
| 22 | **Google News / Bing News** | Press only (some LI) | Free / API tier | 🟢 | URLs | Already covered by the existing `press` RSS lane mentally; news APIs sometimes surface LinkedIn posts. |

> **Hybrid pattern (recommended low‑cost path):** Google Custom Search (URLs) → if a hit looks high‑signal, the **bot opens the URL** and stores `(title, source_url, snippet)` as a `social_search` signal. You miss full post bodies, but you catch 70%+ of launches and reviews discoverable via web search. This is the closest thing to a free Track B.

#### E. Adjacent / cross‑post leakage *(free, often the highest ROI)*

Most B2B SaaS **cross‑post the same content** to multiple places. If you already capture one, you don’t need the social copy.

| # | Where the same content tends to leak | Effort | Verdict |
|---|---------------------------------------|--------|---------|
| 23 | **Competitor blog → mirrored LinkedIn post** | None (already wired via blog RSS) | If `eliseai.com/blog/feed/` is in `products.json`, you already have ~80% of what they say on LinkedIn. |
| 24 | **Press release → news API → LinkedIn announcement** | Already wired (press lane) | Same as #23. |
| 25 | **Newsletter / email subscription** | Trivial (subscribe with a shared inbox) | Many competitors’ social content arrives in their newsletter days later; **forward to a parsed mailbox** is a free, compliant Track A. |
| 26 | **Mastodon cross‑posts** | Trivial | Has open RSS. **Rare** in PropTech today; check anyway. |
| 27 | **Bluesky** | Trivial (open API) | Same: rare for our 5 competitors as of 2026; check. |
| 28 | **Wayback Machine** | Trivial (`http://web.archive.org/web/2*/x.com/<handle>`) | **Historical only.** Useful for reconstructing past launches once. |

#### F. Manual / human‑in‑the‑loop *(unbeatable on compliance and cost; doesn’t scale)*

| # | Option | Cadence | Cost | Verdict |
|---|--------|---------|------|---------|
| 29 | **Weekly manual sweep** by PM | 5–10 min per competitor / week | $0 | **Pair this with any other option** as the floor — guarantees you don’t miss the obvious. Paste highlights into `tracker-drops/` as a manually edited row. |
| 30 | **Operator / customer interview channel** | Ad hoc | $0 | When you talk to operators, they will tell you which competitor posts mattered. Capture as a manual signal. |

#### G. Not recommended *(documented so the team knows why we’re skipping)*

| # | Option | Why we skip |
|---|--------|--------------|
| 31 | **Browser automation (Playwright / Puppeteer logged in)** | 🔴 Against ToS for **both** X and LinkedIn; account‑ban risk *includes* the operator’s personal LinkedIn; brittle; legal exposure for the company. |
| 32 | **Phantombuster, Apify, Bright Data, ScrapingBee — for X / LinkedIn specifically** | 🔴 LinkedIn has actively litigated against scraper vendors (`hiQ Labs v. LinkedIn`); even when vendors offer the lane, the org assumes the legal posture, not them. Keep these vendors for **other** scraping (e.g. competitor career sites) where ToS is permissive. |
| 33 | **Direct HTML scraping of `x.com` / `linkedin.com`** | 🔴 Both platforms now require login for most pages and actively block; brittle and ToS‑hostile. |
| 34 | **LLM “browse the web” one‑off fetches** | Only acceptable for ad‑hoc research, not for monitoring; token cost + non‑deterministic + ToS still applies to the underlying request. |

---

### Decision matrix — which combination to pick

| Constraint you have | Recommended combo |
|---------------------|--------------------|
| **Have ~$200/mo budget for X** | #1 (**X Basic**) + #19/20 (**Google search API**) for LinkedIn URLs + #29 (**manual sweep**) |
| **Have ~$50–150/mo total for both** | #9 (**Brand24** *or* Mention / Awario) covers both — single vendor, single bill |
| **Zero budget, willing to compromise** | #19/21 (**Google Custom Search + Google Alerts**) + #17 (**public Nitter** while it lasts) for X handles + #25 (**newsletter subscribe**) + #29 (**manual weekly sweep**) |
| **Enterprise mandate / legal sensitivity** | #5–8 (**Brandwatch / Talkwalker / Meltwater / Sprinklr**) — single vendor takes the legal posture |
| **Public‑sector / strict compliance** | #1 + #3 (**only approved APIs**) + #29 (manual). Skip everything orange/red. |

> **Track A (official handles) tip that survives all budgets:** subscribe by **email** to each competitor’s own newsletter from a shared inbox. That alone, for $0, captures most of what each company chooses to amplify on X / LinkedIn — because they email it too. Pair with the Custom Search API for third‑party signal and you have a working free tier.

### Video posted on X or LinkedIn — how the bot can use it

The honest model is the **same staged pattern** YouTube already uses ([YOUTUBE-CHANNELS.md](./YOUTUBE-CHANNELS.md) §“Radar → triage → transcribe”). The video file itself is **not** scraped as if it were HTML; the bot uses **text artifacts** around the video, then optionally **transcribes** a short list.

| Stage | What the bot reads | X | LinkedIn |
|-------|---------------------|----|----------|
| **1. Radar (cheap)** | **Post text** + **media metadata** (poster, date, link, view count where available) | Returned by the **X API** when `expansions=attachments.media_keys,author_id` is set. | Returned via **partner API** or **licensed listening vendor** (post body, author org, attachment type). Not available via free public scraping. |
| **2. Triage** | Same rule-based filters as YouTube triage (launch / review / pricing language; competitor-owned vs third party; recency; min/max length) | Same | Same |
| **3. Transcribe (only the short list)** | **Spoken text** | **No native transcript API.** Must download the **video / audio** via the API’s media URL and run **ASR** (Whisper-class). Captions are rarely embedded. | LinkedIn videos sometimes carry **uploaded captions** (`.vtt` / `.srt`) — capture if present, else ASR. |

**Bottom line on video:** *post text* and *poster identity* are the cheap, high-coverage signal — capture those first. *Transcripts* are a **second-stage, bounded** spend (same logic as YouTube): triage to a short list, then run ASR on **org-approved** infrastructure. Don’t plan on “the bot watches every video.”

### Suggested config shape (mirror of YouTube discovery)

For when this gets wired into `collect.js` / `config/products.json`:

```json
"eliseai": {
  "x_handle": "Elise_AI",
  "x_keyword_queries": [
    "EliseAI multifamily",
    "Elise AI review property management",
    "EliseCRM",
    "VoiceAI Elise"
  ],
  "x_max_results": 10,
  "linkedin_company_slug": "eliseai",
  "linkedin_keyword_queries": [
    "EliseAI leasing",
    "Elise AI property management"
  ],
  "linkedin_listening_provider": ""
}
```

Lane mapping (extend §2.1 of [COMPETITOR-DATA-PULL-REFERENCE.md](./COMPETITOR-DATA-PULL-REFERENCE.md) when implemented): `source: "x_official" | "x_search" | "linkedin_official" | "linkedin_search"`; `type: "social"` (or split `social_official` / `review_social`).

---

## Gaps this inventory exposes (action items)

1. **Most competitors** only have **C/D** surfaces configured → Competitive Move will stay **generic** until **A-tier** URLs (changelog / docs) are added where they exist.  
2. **LeaseHawk / Anyone Home** use **root site** for both “pricing” and “features” → consider splitting to **dedicated** product or changelog URLs when you find them.  
3. **Social listening (X + LinkedIn) is not yet wired** — proposed surfaces, handles, and keyword packs are above; sequencing: confirm handles, secure API/vendor access, then ship Track A before Track B.  
4. **Video on social** requires the same **triage → transcribe** pipeline as YouTube; do not block Track A / B rollout on transcript coverage.  
5. Re-run **collect** after every URL change (**see section above**).

---

## How this connects to automation and API keys

| Layer | No LLM API key |
|-------|----------------|
| Collect + report | ✅ |
| Git + Cursor handoff (drops on a branch) | See [TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md) |
| In-browser instant model text with **no** human | ❌ Needs server model or Cursor product automation |

---

## One line for stakeholders

**We map where each competitor actually publishes product truth, grade trust, fix URLs, then collect—so interpretation sits on real evidence, not homepage fluff.**
