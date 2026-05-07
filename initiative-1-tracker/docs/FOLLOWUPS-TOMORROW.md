# Followups — next session

Updated 2026-05-07 after reviewing the first batch of post-fix CI drops and
shipping a User-Agent + URL-collision fix.

---

## Resolved 2026-05-07 (round 2 — full headers + polite delays)

After shipping the UA fix and bucket-B cleanup, picked the cheapest
remaining un-tried mitigation from a standard "scrape Cloudflare-fronted
site" playbook: complete the realistic-header set (we'd only swapped UA),
and add a small randomized delay between requests so consecutive fetches
don't read as a burst.

- **`browserHeaders()` helper in `lib/collect.js`** — every fetch now
  sends `accept-language`, `accept-encoding`, `referer: google.com`,
  `dnt`, `connection: keep-alive`, `upgrade-insecure-requests` in
  addition to UA + accept. Cloudflare bot management correlates these;
  before today we were missing all of them.
- **`politeDelay()` between fetches** in `extractFeedSignals` and
  `fetchText`. Random 800–1800 ms by default, env-tunable via
  `TRACKER_POLITE_DELAY_MIN_MS` / `TRACKER_POLITE_DELAY_MAX_MS`. Disabled
  in the test suite via `TRACKER_POLITE_DELAY_DISABLED=1` so all 115
  tests still run in ~0.4s.
- **Stricter G2 settings in `lib/g2Scrape.js`** — same full header set,
  with `g2Delay()` of 1500–3500 ms and `Referer: google.com`. G2 is the
  most aggressive Cloudflare deployment in the inventory.

### Decision tree for the next CI drop after this lands

If Funnel RSS / G2 / anyone-home changelog all start producing signals
→ headers + delays were the issue. Done with this class of problem.

If they're *still* zero → it's IP-based blocking (GitHub Actions runners
are on Cloudflare's datacenter blocklist). Header tweaks can't solve
that. The next move is bucket C (Playwright). At that point we know
Playwright is justified — we don't make the investment speculatively.

---

## Resolved 2026-05-07 (UA + collision fix + bucket-B audit)

Triggered by reviewing CI drop `2026-05-07T15-14-32Z`: every previously-zero
lane was *still zero*, with **identical per-lane counts** to the demo drop
(198 signals across the same 15 (competitor, source) pairs). That confirmed
the fan-out fix alone wasn't enough — the underlying requests were being
silently challenged by Cloudflare/WAF on broken lanes regardless of how many
times we hit them. Sorted into 4 buckets and acted on three.

### Bucket A — UA challenge (covers all RSS lanes + G2)

- **Bot User-Agent rewritten** in `lib/collect.js` (RSS + HTML) and
  `lib/g2Scrape.js`. Was a self-identifying string
  (`Mozilla/5.0 (compatible; CompetitorTracker/1.0; +https://example.internal)`)
  with a fake URL — exactly the shape Cloudflare bot management flags. Now
  defaults to a real Chrome 120 desktop UA, overridable via
  `TRACKER_USER_AGENT` env var so ops can rotate or add a contact email
  without a code change.

### Bucket D — URL collision (jonah-digital)

- **`jonah-digital.pricing_url` cleared.** It was pointing at the homepage
  (`https://jonahdigital.com/`), which was already wired as
  `case_studies_url`. Same URL hitting two extractors gave us a duplicate
  fetch with zero useful pricing output. Homepage is now owned by
  `case_studies_url` only.

### Bucket B — selector tune (turned out to be misclassification, not selectors)

Wrote `scripts/probe-zero-pages.js` (kept in repo as a documented diagnostic
template) to run the bot's own fetcher + extractMeta against the three
HTML zero-signal URLs. Findings:

- **`eliseai.com/datalog`** redirects to `https://eliseai.com/blog` and is
  a full **article-index page** (47 raw `<h1/h2/h3>`, 81 article-card
  elements, real titles like "Introducing Agent by EliseAI: The First
  Mobile CRM Built for the AI Era"). It was wired as `docs_url` →
  `extractFeatureSignals`, which understandably found no feature keywords
  in article titles. **Fix:** moved to `articles_url` (Phase B-2 lane
  built for exactly this), `docs_url` cleared.
- **`leasehawk.com/careers/`** has only 4 marketing headings and zero job
  titles in the static HTML, no ATS widget (just a Google Tag Manager
  iframe). The extractor was returning 0 *correctly* — there's nothing to
  extract. Combined with brand deprecation, **fix:** cleared
  `careers_url`.
- **`developer.funnelleasing.com`** is a pure JS SPA (48 KB shell, empty
  `<title>`). Static HTML extraction can never work. **Fix:** cleared
  `docs_url`. Real fix lives in bucket C.

### Bucket C — JS-rendered pages (parked)

Untouched today. When we tackle Playwright (see §6 below), it will solve:
- `developer.funnelleasing.com` (now cleared, will re-enable when ready)
- `anyonehome.com/feed/` (Cloudflare 403, also covered by Playwright via
  full Chrome handshake)
- Any future SPA we encounter

### What to watch in the next CI drop

If the UA fix lands cleanly, expect:
- **Funnel RSS** (blog/insights/media at minimum) to start producing
  signals — these are the highest-confidence wins because we proved the
  feeds have items in the last 7 days.
- **eliseai `articles_index`** lane to light up (was completely absent
  before — moved out of the dead docs slot).
- **G2** for funnel-leasing to flip from ~11 to ~22 signals (both
  `funnel-leasing` and `fenix-ai` URLs, no longer rate-limited).

If Funnel RSS is *still* zero after the UA fix, the next move is bucket C
(Playwright) — at that point we know the issue is GitHub Actions runner
IPs being on a Cloudflare datacenter blocklist, which UA games can't
solve.

---

## Resolved in the post-demo bugfix commit

Done immediately after the demo, while looking at drops `2026-05-06T21-46-51Z`
and `2026-05-06T22-41-51Z`:

- **runCollectAll fan-out bug fixed** — `runCollectAll.js` was calling
  `collect()` once per `(competitor × product)` pair, hammering each public
  URL ~11 times per run. Cloudflare/WAF responded by zeroing out RSS feeds
  intermittently (e.g. drop T21 captured 33 jonah-digital signals; drop T22,
  one hour later, captured 0). Now `collect()` runs once per competitor and
  the resulting signals are fanned out across all products in-process.
  10 new test assertions cover the new behavior.
- **Broken URLs cleared in `products.json`**:
  - `eliseai.pricing_url` (`/pricing/`) — 404, cleared.
  - `funnel-leasing.pricing_url` (`/pricing/`) — 404, cleared.
  - `anyone-home.blog` (`www.anyonehome.com/feed/`) — Cloudflare 403 on every
    UA we tried; cleared. Both `/blog/feed/` and `anyonehome.com/feed/`
    variants also 403. Anyone Home's blog is effectively unreachable to bots
    until/unless we add a Cloudflare-bypass strategy. Tracked below.

---

## 1. Demo clone hygiene  (`~/Desktop/Tracker DEMO/Tracker-Competitors-Bot`)

After today's sync, a few things were intentionally left in place to keep the demo
clean. Decide what to do with each.

### 1a. Stash with local docs edits — `stash@{0}`

- Contains: edits to `TRACKER-EXTERNAL-ONBOARDING.md` adding an "At a glance —
  30-second model" section + ~10 other changed blocks.
- Reason it's stashed: the upstream version of the file (now on GitHub) had its
  own changes; ~10 conflict blocks would have blocked the demo.
- **Action**: review with `git stash show -p stash@{0}`, then either:
  - apply selectively into the current `TRACKER-EXTERNAL-ONBOARDING.md` and
    commit, or
  - drop the stash (`git stash drop stash@{0}`) if the content is redundant
    with what's already on GitHub.

### 1b. Untracked files in the demo clone

These are not in the working repo — decide which belong:

| File | Likely fate |
|------|-------------|
| `initiative-1-tracker/docs/INTERPRETATION-GAP-ONLY-TEMPLATE.md` | Move to working repo + commit, OR delete if superseded by `gapInterpretation.js` output. |
| `initiative-1-tracker/docs/SPONSOR-SMOKE-TEST.md` | Move to working repo + commit if still relevant to the sponsor branch flow. |
| `initiative-1-tracker/docs/TRACKER-PROGRAM-ROADMAP.md` | Likely worth keeping — move to working repo + commit. |
| `initiative-1-tracker/tracker/Tracker-Competitors-Bot/` | **Accidental nested clone**. Investigate, then `rm -rf` if confirmed redundant. |
| `tracker-drops/2026-05-04T19-37-46Z/INTERPRETATION.md` | A local interpretation written for last week's CI drop. Decide: commit (canonical record), or keep local-only. |

---

## 2. Validate the fan-out fix in production

The next live drop should show every previously-zeroed lane producing real
signal. Specifically, watch:

- **Funnel Leasing RSS** — blog/insights/media should now produce signals
  (verified to have items in last 7 days on 2026-05-06). press/podcast may
  still be zero because their newest items are 8 / 34 days old (correct
  behavior, not a bug).
- **Anyone Home `case_studies` × 2 URLs** — was already working in T21 drop;
  should remain stable.
- **Jonah Digital** — articles_url, case_studies_url, features_url should
  all produce signals now that the URL won't get hit 11 times in 2 seconds.
- **G2 array (Funnel)** — both `funnel-leasing` and `fenix-ai` reviews
  URLs should produce signals (was returning ~11 instead of ~22 — likely
  because one of the two was Cloudflare-blocked from the rapid retries).

If any of these still come back zero after the next drop, the issue is
inside the per-lane scraper, not the orchestrator.

---

## 3. ~~Pages that returned 0 even though the URL is healthy~~ → resolved 2026-05-07

All three audited via `scripts/probe-zero-pages.js`. See "Bucket B" above.
Summary:
- eliseai datalog → moved to `articles_url`
- leasehawk careers → cleared (no jobs in static HTML, no ATS embed)
- funnel developer portal → cleared (pure SPA, parked for Playwright)

The diagnostic script is intentionally kept in the repo as a template for
future zero-signal investigations. Run it with
`node initiative-1-tracker/tracker/scripts/probe-zero-pages.js`.

---

## 4. Phase B-3 — parked items (from `DATA-SOURCES-BRAINSTORM.md`)

Pull these forward when there's bandwidth:

1. **`events_url` lane** — real-time webinar/conference tracking. Today's
   stance: rely on post-event blog/press recaps. Documented in
   `TRACKER-DEMO.md` §7 as a "future signal".
2. **Podcast transcript ingestion** — currently we capture episode metadata
   from RSS only. Add download + STT to surface in-episode feature mentions.
3. **X / LinkedIn social listening** — both first-party (official handles) and
   third-party umbrella (keyword search across posts + video metadata).
   Captured in `SURFACE-INVENTORY.md`.
4. **Domain-aware pillar inference for `articles_url`** — currently every
   `article` signal is mapped to P1 (owned). When the article-index is hosted
   on the company's own domain that's correct, but if we ever point
   `articles_url` at a media-center or aggregator (external domain), the
   signal should map to P3 instead. Add domain check in `intelPillar.js`.

---

## 5. Per-competitor follow-ups

| Competitor | Item |
|------------|------|
| **eliseai** | `blog` empty (no RSS), `pricing_url` cleared (404), `docs_url` cleared 2026-05-07 (was an article index, moved to `articles_url`). Watch the next CI drop for `eliseai articles_index` lane lighting up. |
| **leasehawk** | Brand deprecating; revisit in 3–6 months. `careers_url` cleared 2026-05-07 (no jobs in static HTML). Now down to features_page + pricing_page only — that's the floor for this competitor. |
| **funnel-leasing** | `pricing_url` cleared (404), `docs_url` cleared 2026-05-07 (developer portal is a SPA; defer to Playwright). RSS lanes (blog/insights/media) should now work post-UA-fix. |
| **anyone-home** | `blog` cleared (Cloudflare 403). Need a Cloudflare-bypass strategy if we want their blog: try `cloudscraper`-equivalent in Node, or curl with browser-impersonating headers (`curl-impersonate`). Changelog feed (`anyonehome-updates.com`) is on a different host and seems CF-friendlier. |
| **jonah-digital** | Drop T21 captured 33 signals across articles/case_studies/features. Drop T22 captured 0 — confirms the fan-out fix is essential. `pricing_url` cleared 2026-05-07 (was the homepage, collided with `case_studies_url`). The 8 testimonials on the homepage are all `<blockquote>` siblings; if they ever switch to a JS carousel, the scraper will silently zero out — consider an alert on "case_studies signal count drops to 0 from prior run". |

---

## 6. Cloudflare-blocked sources — what to do about Anyone Home blog

`anyonehome.com/feed/` (and `www.anyonehome.com/feed/`, `/blog/feed/`) all
return Cloudflare 403 to every UA we tried. Cleared from `products.json`
in the post-demo bugfix. Question for tomorrow: do we want to recover this
content, and if so, how?

Ranked options (effort vs reliability):

| # | Approach | Effort | Reliability | Notes |
|---|----------|--------|-------------|-------|
| 1 | Wayback Machine / archive.today | Tiny | Historical only | Anyone Home is established enough that snapshots exist. Free. Not real-time. |
| 2 | Headless browser (Playwright) | Medium | High | Renders like Chrome. Bulletproof against CF *and* solves the SPA problem (eliseai datalog, funnel developer). One investment, multiple unlocks. |
| 3 | TLS-fingerprint impersonation (`curl-impersonate`, `tls-client`, `cycletls`) | Small–med | Mid | Mimics Chrome's TLS handshake, defeats basic CF challenges. Doesn't help with JS-rendered pages. |
| 4 | Paid scraping API (ScrapingBee, ZenRows, Browserless) | Tiny | High | ~$50–200/mo. CF + JS + proxy rotation in one call. |
| 5 | Google SERP API | Small | Mid | `site:anyonehome.com/blog` finds new posts. We still need to fetch the page, so partial value (title+snippet only). |
| 6 | Direct outreach to Anyone Home | Low effort, slow timeline | Long-tail | Email asking for press/RSS access. |
| 7 | Skip blog, lean on what works | Zero | — | We already have changelog RSS + 2 case_studies pages. Blog is incremental, not critical. |

**Recommended starting point**: combine #7 + #1 (cheap, no infra), then
when we tackle SPA scraping for eliseai datalog and funnel developer
portal in §3, evaluate #2 (Playwright) since the same investment solves
both classes of problem.

If we go with Playwright, drop a `lib/headlessFetch.js` that takes a URL
and returns rendered HTML. Wire it as an optional fallback in
`fetchText()` (in `lib/collect.js`) controlled by an env flag like
`TRACKER_USE_HEADLESS=1` so the lightweight fetch stays the default.

---

## 7. Repo branch hygiene

- `main` and `agent/P1.1` both at `6620178` after today's fast-forward.
- Tomorrow: continue on `agent/P1.1` or open a PR to make the merge explicit
  with reviewer commentary. The single-branch model has been fine so far,
  but as the team grows a PR-per-task flow will help with audit trails.
