# YouTube “reviews” — prototype (discovery + comments)

## Status: YouTube Data API — **on standby**

**We are waiting on a YouTube Data API key** (Google Cloud project + quota). Until it is available:

- **Do not block other tracker work** on API setup.
- **Official channel feeds still work without any API key:** configure **`youtube_rss`** (Atom) in `products.json` or `TRACKER_YOUTUBE_RSS_<ID>` — those paths use normal RSS fetch in `collect.js`, not `search.list` / `commentThreads.list`.
- **Parked until the key exists:** third-party **discovery** (`youtube_discovery_queries`) and **comment pulls** (`youtube_comment_video_ids`). Code paths no-op or skip when `YOUTUBE_DATA_API_KEY` is unset (collect continues).

When the key is ready, pick up from **Setup** below and wire `YOUTUBE_DATA_API_KEY` in `.env`.

---

## What we mean by “reviews” on YouTube

| Signal | What it is | Implementation in this repo |
|--------|------------|-----------------------------|
| **Official channel uploads** | Launches, demos, webinars | `youtube_rss` (Atom) in `collect.js` |
| **Third-party review videos** | e.g. *EliseAI Review — Hype vs Reality* | **`youtube_discovery_queries`** → Data API **`search.list`** + **`videos.list`** → `source: youtube_search` |
| **Comments on a known video** | Sentiment under a specific URL | **`youtube_comment_video_ids`** → **`commentThreads.list`** → `source: youtube_comments` |

Scraping watch-page HTML is **not** the default; use the **API** (quota) or public feeds.

---

## Setup

1. **Google Cloud:** project → enable **YouTube Data API v3** → **API key** (restrict by HTTP referrer / IP in production).
2. **Env:** `YOUTUBE_DATA_API_KEY` (see `tracker/.env.example`).

### Quota (no per-call USD in normal use)

- Default **~10,000 units/day** per project (resets midnight Pacific).
- **`search.list`** ≈ **100** units per request.
- **`videos.list`** ≈ **1** unit per request (up to 50 ids).
- **`commentThreads.list`** ≈ **1** unit per request.

Tune **`youtube_discovery_max_queries`** and **`youtube_discovery_max_results`** so daily collects stay within budget.

---

## Config (`config/products.json` → `sources.<competitorId>`)

| Field | Purpose |
|--------|---------|
| `youtube_discovery_queries` | String array — search strings (e.g. `"EliseAI review multifamily"`). |
| `youtube_discovery_max_results` | Max videos **per query** (1–15, default 5). |
| `youtube_discovery_max_queries` | Max queries **per collect** for that competitor (1–8, default 4). |
| `youtube_comment_video_ids` | 11-char video IDs for **comment** sampling. |

**Collect batching:** `index.js` / `server.js` pass a **session** `Map` so **YouTube search runs once per competitor per collect**, then signals are **cloned per product** (same API cost, one search per competitor — not × number of products).

---

## CLI smoke tests (from `initiative-1-tracker/tracker`)

```bash
export YOUTUBE_DATA_API_KEY=...

# Top comments on one video
node index.js prototype-youtube dQw4w9WgXcQ

# Search (review discovery) — optional --days window for publishedAfter
node index.js prototype-youtube-search "EliseAI review multifamily" --days 120
```

---

## Collect output shape

- **Search:** `type: review_youtube`, `source: youtube_search`, `metadata.video_id`, `entities.discovery_queries`, title/description from API, optional view count + duration.
- **Comments:** `type: review_youtube`, `source: youtube_comments`, `entities.review_quotes`.

Gap table shows **YouTube (search)** or **YouTube comments** in the source column.

---

## Next steps

- **Transcripts:** captions API (limited) or ASR on audio — compliance + engineering; see [YOUTUBE-CHANNELS.md](./YOUTUBE-CHANNELS.md).
- **Key takeaways:** run your summarizer / LLM on **title + description + comments** (and transcript text when available).
- **Deduping across products:** today each product gets a copy of the same discovery signal; optional future: single stored row + many product links.
