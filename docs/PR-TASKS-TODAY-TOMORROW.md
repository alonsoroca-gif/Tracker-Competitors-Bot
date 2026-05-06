# Tasks for today afternoon + tomorrow (paste into PR or HANDOFF)

**Quick context next session:** In Cursor, say *resume*, *remind me what’s pending*, or *session context* — the agent will re-read this file (see `.cursor/rules/session-context.mdc`). Or run: `node scripts/session-context.js` from the repo root.

**Planning source of truth:** The detailed checklist with acceptance criteria lives in **`initiative-1-tracker/TASKS.md`** (Priority + Backup sections). **This file mirrors the Priority sprint checkboxes** so PRs/handoffs stay short—when you add or complete scope, update **both** files together.

**Doc-only pending items** (manager/legal gates, not in `TASKS.md`): see **`initiative-1-tracker/docs/COMPETITIVE-KEYWORDS-PLAN.md`** and **`initiative-1-tracker/docs/README.md`** (index).

Copy the checklist below into your PR description or HANDOFF so the agent (or you) knows what to work on.

---

## Priority sprint P1–P3 (mirrors TASKS.md)

**Status:** **Complete** — see `initiative-1-tracker/TASKS.md` § *Priority: Before Thursday* for full criteria.

### P1 — Better sources & "What competitor is doing"
- [x] **P1.1** — Prefer RSS description over title (50 chars, max 600)
- [x] **P1.2** — Fact-like sentences from page body (skip 1200 chars, up to 800, fallback to body slice)
- [x] **P1.3** — More boilerplate phrases in cleanSnippet (gapReport.js)
- [x] **P1.4** — README: how to add/find working feed URLs
- [x] **P1.5** — (Optional) Prefer main/article in page collector

### P2 — Sprint 2: Filter by source
- [x] **P2.1** — Filter by source in report UI (dropdown/chips)
- [x] **P2.2** — "Data sources" summary (e.g. "Gaps from: N blog, M pricing_page…")
- [x] **P2.3** — Source column on each gap row (verify/add)

### P3 — Sprint 3: Fewer collect failures
- [x] **P3.1** — Validate URL before fetch; log "Skipped invalid URL"
- [x] **P3.2** — On 404, log competitor + source + URL
- [x] **P3.3** — README: optional URLs and how to find working ones
- [x] **P3.4** — (Optional) GET /api/collect-status or last_collected_at

---

## Next up (after P1–P3)

Pick one track and record it in your PR/handoff:

1. **Presentation + copy** — `initiative-1-tracker/docs/COMPETITIVE-INTEL-PRESENTATION.md` (L1/L2/L3 model). **Gap line refinements:** `initiative-1-tracker/docs/WHAT-COMPETITOR-DOING-NEXT.md`.
2. **Agent sprint (small)** — `initiative-1-tracker/TASKS.md` § *Backup: Agent sprint* (AS1–AS10).
3. **Medium backlog** — same file § *Backup: medium tasks* (BM1–BM10).

---

## Next session — YouTube discovery + transcripts + automation agent

**YouTube Data API key:** **On standby** (pending org / Cloud access). Until `YOUTUBE_DATA_API_KEY` is set, rely on **`youtube_rss`** (Atom) for official channel uploads — no API key required. See `initiative-1-tracker/docs/YOUTUBE-REVIEWS-PROTOTYPE.md` § *Status: on standby*.

*Agreed focus when back in office:*

1. **Information sources** — Keep tightening feeds, page snippets, and source quality (`DATA-SOURCES-BRAINSTORM.md` / `YOUTUBE-CHANNELS.md`; related copy in **WHAT-COMPETITOR-DOING-NEXT.md**).
2. **`youtube_discovery` (when API key lands)** — Scheduled discovery (YouTube Data API `search.list` +/or RSS + keyword filter per competitor), merge into collect/snippet pipeline; see `initiative-1-tracker/docs/YOUTUBE-CHANNELS.md` § *Automated discovery*. **Defer heavy implementation until the key is available**; optional prep: config shape + docs only.
3. **Transcripts** — Design + implement path for **spoken content** (captions API where allowed, or org-approved ASR pipeline); Phase 1 remains title/description until transcript fetch is wired.
4. **Automation agent** — Deep pass on the agent loop (e.g. `scripts/agent-get-next-task.js`, related workflow) to keep evolving the app end-to-end.

---

Full task tables, acceptance criteria, and legacy phase tasks: **`initiative-1-tracker/TASKS.md`**. Backup tasks (AS1–AS10, BM1–BM10) are defined there.
