# Tracker Bot

Competitor signals → gap report → response schema → Slack. Part of Tracker Competitors Bot (Initiative 1).

## Run

1. Copy `.env.example` to `.env` and set any optional vars.
2. `npm install` — includes **`rss-parser`** (feeds) and **`cheerio`** (HTML structure).
3. **Smoke:** `npm start` → prints `Tracker`.
4. **Collect:** `npm run collect` → collects signals for products/competitors, merges into `data/signals.json`, then **prunes** to the retention window (default 7 days). Use `node index.js collect --days 14` for a 14-day window.
5. **Demo:** `node index.js demo` → seeds demo signals (first-version-demo) and runs a sample gap report + "what to change."
6. **Report:** `node index.js report` → builds gap report from stored signals, prints weekly report and top 3 "what to change."
7. **Report UI (local):** `npm run serve` → open **http://localhost:3000**. **Refresh data** runs full collect via `POST /api/collect?days=N` (same **N** as the selected period: 7 / 14 / 30), then merges + prunes `data/signals.json`. **Reload report** refetches the report only (instant). Code changes to `gapReport.js` / `public/` usually need only a browser refresh, not a server restart.

## Config

- **`config/products.json`** — Defines (1) **our products** the bot analyzes constantly, and (2) **competitors** to track with optional priority.
  - **products**: Array of `{ "id": "ProductA", "name": "Product A" }`. Add every product you want the bot to analyze.
  - **competitors**: Array of `{ "id": "competitor-x", "name": "Competitor X", "priority": "high" }`. `priority` is optional (`high` | `medium` | `low`); default is `medium`. Use it to weight or filter competitor focus.
  - Optional per competitor: `website`, `focus` (short description).
  - **`sources`** (in products.json or separate): Per-competitor URLs for data collection. All optional; empty string = skip.
    - **blog** — RSS/Atom feed (product updates). Env: `TRACKER_FEED_URL_<COMPETITOR_ID>`.
    - **press**, **news** — Press/news RSS. Env: `TRACKER_PRESS_URL_<COMPETITOR_ID>`.
    - **changelog** — Changelog/release notes RSS. Env: `TRACKER_CHANGELOG_URL_<COMPETITOR_ID>`.
    - **youtube_rss** — Official YouTube channel **Atom feed** (public). Format: `https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>` (find ID via channel page → Share → Copy channel ID, or from page source). Env: `TRACKER_YOUTUBE_RSS_<COMPETITOR_ID>`. Parsed like blog RSS; `source` = `youtube`, `type` = `youtube`. Titles/descriptions capture launches (e.g. product videos).
    - **pricing_url**, **features_url** — Public HTML; **cheerio** extracts headings, bullets, meta, and **pricing/feature keywords** into structured signals (`event_type`, `confidence`, `entities`, etc.).
    - **careers_url** — Careers page; **job** signals with hiring-focus grouping when role-like lines match.
    - **docs_url** (optional) — Treated like features (product/docs themes).
- **`config/project-focus.json`** — Project scope and research focus (e.g. Lead-to-Lease funnel stages and intern-project research areas). Shown in the report UI.
- **`config/our-state.json`** — Per-product, per-dimension status: **Starting**, **In process**, or **Delivered** (support, pricing_messaging, positioning, features). Edit when your product changes.
- Env: `TRACKER_FEED_URL_<COMPETITOR_ID>` (e.g. `TRACKER_FEED_URL_COMPETITOR_X=https://blog.example.com/feed.xml`).

### Finding working RSS / Atom feed URLs

1. **Where to look** — Competitor **blog** often has `/feed`, `/rss`, `/atom.xml`, or `?feed=rss2` (WordPress). **Press** or **news** may be under `/press`, `/news`, or a PR tool subdomain. **Changelog** is often `/changelog`, `/releases`, or GitHub releases RSS.
2. **Validate** — Open the URL in a browser or run `curl -sI <url>`; the body should be XML with `<rss>`, `<feed>`, or `<rdf:RDF>`. If you get HTML, it’s not a feed—look for a “Subscribe” or RSS link on the page.
3. **Configure** — Put URLs under `sources` per competitor in **`config/products.json`** (see `sources` object keys: `blog`, `press`, `changelog`, etc.). Env vars override file values (see Config above).

### Optional URLs and 404s

- **All source fields are optional.** Empty string or omitted key = that source is skipped.
- If a source returns no signals, the URL may be wrong, blocked, or empty—check `config/products.json` / env and try the URL in a browser.
- **pricing_url**, **features_url**, **careers_url** are normal HTTPS pages (not RSS). Use the public marketing URL; invalid or non-`http(s)` URLs are skipped with `Skipped invalid URL` in the console.

### Public pages & RSS articles (structured “what they’re doing”)

- Collect uses **only public URLs** you configure. **User-Agent:** `CompetitorTracker/1.0` (see `lib/collect.js`).
- **RSS/Atom:** Parsed with **`rss-parser`**. Up to **20 recent items** per feed; each item may trigger a **follow-up fetch** of the article URL for paragraph text (same cap). **Event types** (e.g. `feature_launch`, `pricing_change`) and **named entities** (integrations, AI terms) are attached when detected.
- **HTML pages:** **`cheerio`** strips scripts/styles and reads meta, headings, and lists for **pricing / features / careers** signals. Extra fields: `event_type`, `confidence`, `importance`, `entities`, `metadata` (gap UI still uses `headline`, `snippet`, `evidence_snippet`, `source_url`).
- Failures on fetch or parse return **empty arrays** for that source (no `Collect 404` console line unless you add logging).
- Respect competitor **terms of use** and **robots.txt** where applicable; keep volume low (timeouts, capped article fetches). This is not legal advice—align with your org’s policy.

## First version

Collect (or `demo`) → storage → gap report → response schema → "what to change." See [first-version-demo.md](../first-version-demo.md).

## Tasks

See [../TASKS.md](../TASKS.md).

## Plans (not yet implemented)

- **[Competitive keywords / themes](../docs/COMPETITIVE-KEYWORDS-PLAN.md)** — detect expansion, launches, AI, hiring, etc. from public text; **wait for manager confirmation** before implementation.

## Competitor data pull (for AI / code review)

- **[COMPETITOR-DATA-PULL-REFERENCE.md](../docs/COMPETITOR-DATA-PULL-REFERENCE.md)** — how config, `collect.js`, storage, and gaps fit together.
- **Export all pull-related source for an external chat:** from repo root, `node scripts/export-competitor-pull-context.js` (prints this doc + `products.json` + `loadConfig.js` + `storage.js` + full `collect.js` + excerpts).

## YouTube

- **[YouTube playbook](../docs/YOUTUBE-CHANNELS.md)** — **Track A:** official @ channels + `youtube_rss`. **Track B:** automated discovery of similar third-party videos (API search / filtered RSS); **analysis:** metadata today, transcripts/ASR as a later phase (doc explains what’s possible vs scraping).
