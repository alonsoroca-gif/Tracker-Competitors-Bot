# Followups — tomorrow's session

Generated 2026-05-06, end of source-verification + Phase 2 + Phase B-2 push.
Pick up here next session.

---

## 1. Demo clone hygiene (`~/Desktop/Tracker DEMO/Tracker-Competitors-Bot`)

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

## 2. Validate Phase 2 + Phase B-2 in production

Today's live demo drop is the **first run** that exercises every new lane. After
the demo, review the new `tracker-drops/<timestamp>/SUMMARY.md` and check for:

- **Zero-signal lanes** — any of these returning empty means a real bug, not a
  stale URL:
  - `funnel-leasing` insights / media / podcast (RSS)
  - `funnel-leasing` reviews_url (featuredcustomers HTML)
  - `funnel-leasing` second G2 URL (fenix-ai)
  - `anyone-home` case_studies × 2
  - `anyone-home` changelog (anyonehome-updates.com)
  - `jonah-digital` articles_url (`/articles/`)
  - `jonah-digital` case_studies_url (homepage 8 blockquotes)
  - `jonah-digital` features_url (`/add-ons/`)
- **Cloudflare 403 on G2** — known fragile; if both Funnel and EliseAI G2
  pulls return zero, look at `g2Scrape` and consider a rotating UA / 24h cache.
- **HTTP 200 but zero signals** — likely the case-study or article scraper
  selectors don't match a specific site's markup. Tune `collectCaseStudySignals`
  / `collectArticleIndexSignals` in `lib/collect.js`.

---

## 3. Phase B-3 — parked items (from `DATA-SOURCES-BRAINSTORM.md`)

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

## 4. Per-competitor follow-ups

| Competitor | Item |
|------------|------|
| **eliseai** | `blog` is empty (no working RSS found). Re-check periodically — they may publish one. |
| **leasehawk** | Brand deprecating into Funnel/Fenix; revisit in 3–6 months and likely retire the entry once content fully migrates. |
| **funnel-leasing** | The two-G2-URL design is the first real-world array case. Confirm both pages produce distinct, attributable snippets in the next live drop (no dedup loss). |
| **anyone-home** | Verify `anyonehome-updates.com/feed/` (changelog) is still publishing — newer status pages sometimes drop their RSS. |
| **jonah-digital** | The 8 testimonials on the homepage are all `<blockquote>` siblings. If they ever switch to a JS carousel, the scraper will silently zero out. Add an alert on "case_studies signal count drops to 0 from prior run". |

---

## 5. Repo branch hygiene

- `main` and `agent/P1.1` both at `6620178` after today's fast-forward.
- Tomorrow: continue on `agent/P1.1` or open a PR to make the merge explicit
  with reviewer commentary. The single-branch model has been fine so far,
  but as the team grows a PR-per-task flow will help with audit trails.
