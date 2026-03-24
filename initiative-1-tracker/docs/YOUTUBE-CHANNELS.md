# YouTube — official channels + third-party signal

We use YouTube in **two ways**. Both belong in this playbook.

| Track | What it is | Why it matters |
|--------|------------|----------------|
| **A — Official competitor channels** | `@Elise_AI`, `@funnelleasing`, etc. | Launches, webinars, positioning straight from the brand. |
| **B — Third-party & practitioner reviews** | Operators, consultants, “hype vs reality” videos | **Often the highest signal:** real multifamily usage, objections, comparisons — not marketing copy. |

**Track A** is wired today: `youtube_rss` per competitor in `config/products.json` (see below).  
**Track B** should run **continuously** via automation (see [Automated discovery](#automated-discovery-no-manual-video-list)); the examples table below is a **reference** for the *kind* of content to match, not a list you maintain by hand.

---

## Automated discovery (no manual video list)

Goal: the bot **keeps looking** for new uploads that look like third-party reviews / practitioner takes (e.g. “EliseAI review”, “Funnel Leasing vs …”), without pasting individual video URLs.

**Practical patterns (can combine):**

| Approach | How it works | Pros / cons |
|----------|----------------|-------------|
| **A. YouTube Data API — `search.list`** | On a schedule (e.g. daily), call Search with queries per competitor + modifiers (`review`, `multifamily`, product name). Store `videoId`, title, description, channel, publishedAt. | **Best for “similar videos anywhere on YouTube.”** Needs Google Cloud project, **API key**, and **quota** (search costs units; plan budget). Compliant, documented. |
| **B. Channel RSS + keyword filter** | Same Atom feed as today, but for **reviewer channels** (e.g. Landlord Profit Skool). Ingest all new entries; **keep** only if title/description matches a **config allowlist** (competitor names, “review”, “honest”, etc.). | **No search API** for those channels; low cost. **Noise** if the channel is broad — filtering is mandatory. Fits existing RSS pipeline in `collect.js` with extra rules. |
| **C. Hybrid** | API search for discovery + RSS for channels you trust. | Covers both “unknown channel said something” and “this channel always worth scanning.” |

**Not recommended as primary:** scraping the YouTube **watch page** or “Related videos” HTML to find similar clips — layout changes often, easy to break, and **Terms of Service** usually favor the official API for automated access.

**Implementation note (future PR):** add something like `youtube_discovery` in config (queries per competitor, optional extra `channel_id` list for RSS) and a small job that merges results into the same `snippet` / DB shape the UI already uses, with `type` / `source` distinguishable from official-channel RSS.

---

## What the bot can “see” in a video (analysis)

**Important:** the tracker **does not** today download or parse video files. It only uses what the **public Atom feed** returns: **title**, **short description/summary**, **link**, **date**.

### Can you “web scrape” a video?

- **The video file (MP4) / stream:** you generally **don’t scrape that for text**. The useful signal is either **metadata** or **speech as text**.
- **Metadata (title + description):** already available from RSS or Search API — **no need** to scrape the watch page for that if you use API or feed.
- **Transcript / captions:** this is how you analyze **what was said**:
  - **YouTube Data API** (`captions` resources): often **restricted** — many auto-captions can’t be downloaded by third parties the same way the owner can; depends on video and Google’s rules.
  - **Community / libraries** that pull caption-like data: exist, but check **YouTube ToS**, **Google’s policies**, and **your legal/compliance** team before relying on them in production.
  - **Audio → speech-to-text:** download **audio only** (e.g. tooling that supports offline/transcript workflows) and run **ASR** (e.g. Whisper-class models). **Heavier** (compute, storage, rate limits) and again subject to **platform rules** and whether you may process that content.

**Practical phased plan:**

1. **Phase 1 (lightweight):** discovery (API search +/or filtered RSS) → store and analyze **title + description** with the same keyword / LLM patterns you use for blog posts. Catches many reviews because creators put the hook in the title.
2. **Phase 2 (deeper):** for videos that pass Phase 1, attempt **transcript** via an **approved** method (API where allowed, or internal tooling your org clears) → run summarization / competitive tagging on **text**, not on raw video.

So: **yes, you can get machine-readable text from videos**, but the path is **captions or ASR on audio**, not “scraping the video” as if it were HTML.

---

## Track B — Gold examples (third-party)

These are the kind of pieces we want on the radar: **precise, practitioner-led, product-in-context** (not random mentions).

| Competitor discussed | Channel | Example (title / intent) | Notes |
|----------------------|---------|---------------------------|--------|
| **EliseAI** | **Landlord Profit Skool** (Mike Simpson) | *EliseAI Review — Hype vs Reality After 7 Months* | Long-form operator take; multifamily PM context; exactly the “what actually happens when you run it” signal we want alongside official `@Elise_AI` uploads. |

**Add rows only when you want to document a canonical example** (e.g. for tuning search queries or filters). Ongoing coverage should come from [Automated discovery](#automated-discovery-no-manual-video-list).

### How to use Track B in practice

1. **Automation first:** scheduled **Search API** queries and/or **RSS + keyword filter** on known practitioner channels — not a manual video checklist.
2. **Analysis first on title + description**; add **transcripts** when you have a compliant pipeline (see [What the bot can “see”](#what-the-bot-can-see-in-a-video-analysis)).
3. **Official + third-party:** **Track A** = first-party narrative; **Track B** = market / practitioner narrative.

**Optional notes field:**

- …

---

## Feeds and noise

- **`youtube_rss`** = `https://www.youtube.com/feeds/videos.xml?channel_id=...` → **all** recent videos from that channel.
- Official competitor channels → usually **low noise** (on-brand only).
- A generalist “landlord education” channel → **higher noise** if we attach RSS globally; fine for manual review + selective table rows until we filter by title/keywords in collect.

---

## Track A — Official channels: manual verification

Use this to **confirm** each channel is the real company (not a fan account) and whether YouTube shows a **verification / official** badge. Then paste **`channel_id`** into `config/products.json` as **`youtube_rss`**.

**Atom feed format (per channel):**

```text
https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID_HERE
```

**Config:** `initiative-1-tracker/tracker/config/products.json` → `sources.<competitor_id>.youtube_rss`  
**Env override:** `TRACKER_YOUTUBE_RSS_<COMPETITOR_ID>` (ID uppercase, hyphens → underscores, e.g. `FUNNEL_LEASING`)

### How to find `channel_id`

1. Open the **@ handle** link below in a browser (while logged in or not — channel should be public).
2. **Channel ID:**  
   - **Share** on the channel page → **Copy channel ID** (if shown), or  
   - View **Page source** (Ctrl/Cmd+U) and search for `"channelId"` / `browse_id` / `externalId`, or  
   - From a video URL: `youtube.com/watch?v=...` → channel link → About → sometimes listed.
3. Optional: open `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>` in the browser — you should see **Atom XML** with recent video entries.

### Verification checklist (you fill in)

For each row: open the link → confirm branding + content match the competitor → note if YouTube shows a **checkmark / official badge** → paste **channel ID** → set **`youtube_rss`** in `products.json`.

| Competitor ID | Company name | Open channel (@ handle) | Verified badge? (you) | Channel ID (you) | In `products.json` |
|---------------|--------------|-------------------------|------------------------|------------------|---------------------|
| `eliseai` | EliseAI | [youtube.com/@Elise_AI](https://www.youtube.com/@Elise_AI) | ☐ Yes ☐ No ☐ N/A | `________________` | `sources.eliseai.youtube_rss` |
| `funnel-leasing` | Funnel Leasing | [youtube.com/@funnelleasing](https://www.youtube.com/@funnelleasing) | ☐ Yes ☐ No ☐ N/A | `________________` | `sources.funnel-leasing.youtube_rss` |
| `leasehawk` | LeaseHawk (ACE) | [youtube.com/@LeaseHawk](https://www.youtube.com/@LeaseHawk) | ☐ Yes ☐ No ☐ N/A | `________________` | `sources.leasehawk.youtube_rss` |
| `anyone-home` | Anyone Home | [youtube.com/@AnyoneHome](https://www.youtube.com/@AnyoneHome) | ☐ Yes ☐ No ☐ N/A | `________________` | `sources.anyone-home.youtube_rss` |
| `jonah-digital` | Jonah Digital Agency | [youtube.com/@JonahDigital](https://www.youtube.com/@JonahDigital) | ☐ Yes ☐ No ☐ N/A | `________________` | `sources.jonah-digital.youtube_rss` |

---

## Example `products.json` snippet (after you verify)

```json
"funnel-leasing": {
  "youtube_rss": "https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxxxxxxxxxxxxxxxx",
  ...
}
```

Leave `youtube_rss` as `""` until the URL is confirmed; empty string skips collect for that source.

---

## Why “verified” wasn’t auto-detected

Channel pages load **badges and metadata mostly via JavaScript**. Automated fetches often only see the HTML `<title>`, not the live UI. **Manual check in the browser** is the reliable step.

---

*Refs: [DATA-SOURCES-BRAINSTORM.md](DATA-SOURCES-BRAINSTORM.md) §6b, [tracker README](../tracker/README.md) config section.*
