# Tasks for today afternoon + tomorrow (paste into PR or HANDOFF)

**Quick context next session:** In Cursor, say *resume*, *remind me what’s pending*, or *session context* — the agent will re-read this file (see `.cursor/rules/session-context.mdc`). Or run: `node scripts/session-context.js` from the repo root.

Copy the checklist below into your PR description or HANDOFF so the agent (or you) knows what to work on.

---

## Planned: before Thursday

### P1 — Better sources & "What competitor is doing"
- [x] **P1.1** — Prefer RSS description over title (50 chars, max 600)
- [ ] **P1.2** — Fact-like sentences from page body (skip 1200 chars, up to 800, fallback to body slice)
- [ ] **P1.3** — More boilerplate phrases in cleanSnippet (gapReport.js)
- [ ] **P1.4** — README: how to add/find working feed URLs
- [ ] **P1.5** — (Optional) Prefer main/article in page collector

### P2 — Sprint 2: Filter by source
- [ ] **P2.1** — Filter by source in report UI (dropdown/chips)
- [ ] **P2.2** — "Data sources" summary (e.g. "Gaps from: N blog, M pricing_page…")
- [ ] **P2.3** — Source column on each gap row (verify/add)

### P3 — Sprint 3: Fewer collect failures
- [ ] **P3.1** — Validate URL before fetch; log "Skipped invalid URL"
- [ ] **P3.2** — On 404, log competitor + source + URL
- [ ] **P3.3** — README: optional URLs and how to find working ones
- [ ] **P3.4** — (Optional) GET /api/collect-status or last_collected_at

---

## Next session — YouTube discovery + transcripts + automation agent

*Agreed focus when back in office:*

1. **Information sources** — Keep tightening feeds, page snippets, and source quality (aligns with P1 above + `DATA-SOURCES-BRAINSTORM.md` / `YOUTUBE-CHANNELS.md`).
2. **Implement `youtube_discovery` config** — Scheduled discovery (YouTube Data API `search.list` +/or RSS + keyword filter per competitor), merge into collect/snippet pipeline; see `initiative-1-tracker/docs/YOUTUBE-CHANNELS.md` § *Automated discovery*.
3. **Transcripts** — Design + implement path for **spoken content** (captions API where allowed, or org-approved ASR pipeline); Phase 1 remains title/description until transcript fetch is wired.
4. **Automation agent** — Deep pass on the agent loop (e.g. `scripts/agent-get-next-task.js`, related workflow) to keep evolving the app end-to-end.

---

Source: `initiative-1-tracker/TASKS.md` (Priority section). Backup tasks (AS1–AS10, BM1–BM10) after these.
