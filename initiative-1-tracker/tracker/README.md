# Tracker Bot

Competitor signals → gap report → response schema → Slack. Part of Tracker Competitors Bot (Initiative 1).

## Run

1. Copy `.env.example` to `.env` and set any optional vars.
2. `npm install` (no extra deps required for basic run).
3. **Smoke:** `npm start` → prints `Tracker`.
4. **Collect:** `npm run collect` → collects signals for products/competitors in `config/products.json`. Set a feed URL in config or env (see below) to get real data.

## Config

- `config/products.json` — products and competitors. Optional: `sources[competitorId].blog` = RSS feed URL.
- Env: `TRACKER_FEED_URL_<COMPETITOR_ID>` (e.g. `TRACKER_FEED_URL_COMPETITOR_X=https://blog.example.com/feed.xml`).

## Tasks

See [../TASKS.md](../TASKS.md).
