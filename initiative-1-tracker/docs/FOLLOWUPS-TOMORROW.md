# Followups — next session

Updated 2026-05-06 after the live demo run and the post-demo bugfix push.

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

## 3. Pages that returned 0 even though the URL is healthy

These produced 0 signals in drop T21 even with the orchestrator working
fine for that drop. They are HTTP 200 with real visible content. The
zero is likely a per-lane scraper issue (selectors not matching the
site's markup, or content being JS-rendered).

| URL | Status | Suspected cause |
|-----|--------|-----------------|
| `https://www.eliseai.com/datalog` (eliseai docs) | 200, 129 KB, "Latest news from EliseAI" | Likely SPA/Webflow rendering — `extractPageSignals` may not find headings/snippets in the static HTML. |
| `https://developer.funnelleasing.com/` (funnel docs) | 200, 48 KB, empty `<title>` | Definitely client-side rendered API portal. Static HTML is shell only. |
| `https://leasehawk.com/careers/` | 200, 30 KB, "Careers \| LeaseHawk" | Worth re-running with fan-out fix; if still zero, scraper selector issue. |

Action: dump the HTML for each, see what `extractPageSignals` actually
extracts, decide whether to (a) tune selectors, (b) clear the URL, or
(c) build a SPA-aware scraper for these (overkill for now).

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
| **eliseai** | `blog` empty + `pricing_url` cleared (404) + `docs_url` (datalog) returns zero. Datalog is the most interesting — investigate why scraper finds no content despite real article list visible. |
| **leasehawk** | Brand deprecating; revisit in 3–6 months. `careers_url` returned zero in T21 drop — re-check after fan-out fix lands. |
| **funnel-leasing** | `pricing_url` cleared (404) + `developer.funnelleasing.com` is a SPA with empty static HTML. Both expected zero. RSS lanes (blog/insights/media) should now work post-fix. |
| **anyone-home** | `blog` cleared (Cloudflare 403). Need a Cloudflare-bypass strategy if we want their blog: try `cloudscraper`-equivalent in Node, or curl with browser-impersonating headers (`curl-impersonate`). Changelog feed (`anyonehome-updates.com`) is on a different host and seems CF-friendlier. |
| **jonah-digital** | Drop T21 captured 33 signals across articles/case_studies/features. Drop T22 captured 0 — confirms the fan-out fix is essential. The 8 testimonials on the homepage are all `<blockquote>` siblings; if they ever switch to a JS carousel, the scraper will silently zero out — consider an alert on "case_studies signal count drops to 0 from prior run". |

---

## 6. Repo branch hygiene

- `main` and `agent/P1.1` both at `6620178` after today's fast-forward.
- Tomorrow: continue on `agent/P1.1` or open a PR to make the merge explicit
  with reviewer commentary. The single-branch model has been fine so far,
  but as the team grows a PR-per-task flow will help with audit trails.
