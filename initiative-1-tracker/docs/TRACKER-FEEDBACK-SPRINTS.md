# Tracker feedback — sprint plan

Three focus areas from user feedback, split into sprints so we can deliver incrementally.

---

## Sprint 1: Dual analysis & clearer gaps / recommendations ✅ (implemented)

**Problem:** Gap titles are raw snippets (page copy, nav text) and don’t explain what the competitor is doing or what we should change. Recommendations feel like “boring titles” and aren’t specific.

**Goal:** Every gap and recommendation should answer:
- **What is the competitor doing?** (short, clear)
- **What do we have today?** (our state)
- **What should we change?** (specific action)

**Scope:**
- **Gap report:** Add per gap: `competitor_move` (cleaned, readable summary of the signal), `our_gap` (our current state for that dimension), and `source` (blog, pricing_page, etc.). Optionally clean snippets (strip boilerplate like “Contact us”, “Login”, “Skip to main”).
- **Response schema / what-to-change:** Use `competitor_move` and `our_gap` to build specific rationale and recommendation text (e.g. “We have email only. Recommendation: add live chat or match competitor messaging.”).
- **UI – Gaps:** Show columns or rows for “What competitor is doing”, “Our state”, and optionally “Source” so the dual analysis is visible.
- **UI – What to change:** Show specific recommendation text (competitor move + our gap + suggested action), not just the raw title.

**Done when:** A reader can understand each gap and each recommendation without guessing; “competitor vs us” and “what to change” are explicit.

---

## Sprint 2: Filter to prove accuracy of data

**Problem:** Need a way to check that the data we pulled is accurate (e.g. filter by source, date, or see where each gap came from).

**Goal:** Let users filter or inspect by data source so they can judge accuracy.

**Scope:**
- **Report API:** Ensure each gap has `source` (and optionally `detected_at`); already planned in Sprint 1.
- **UI:** Add a filter (e.g. dropdown or chips): by **source** (blog, press, pricing_page, features_page, careers), and/or by **date range**. Optionally show “Source: X” on each gap row or card.
- **Optional:** A small “Data sources” summary (e.g. “Gaps from: 3 blog, 5 pricing_page, 2 careers”) so users see the mix.

**Done when:** Users can filter gaps by source (and optionally date) and see source on each gap.

---

## Sprint 3: Fewer collect failures (e.g. HTTP 404)

**Problem:** Collect fails for some URLs (404), which shows up in the terminal and means less data.

**Goal:** Fewer failed requests and clearer handling when a URL is wrong or missing.

**Scope:**
- **Config / URLs:** Document which URLs are optional and how to find working ones (e.g. blog feed, pricing page). Add a note in README or config example.
- **Collect:** (1) Skip or validate URLs before requesting (e.g. non-empty, valid-looking). (2) On 404, log the URL and competitor/source so it’s easy to fix config. (3) Optionally: HEAD request first for page URLs to avoid pulling full HTML on 404; or short timeout. (4) Don’t treat 404 as a fatal error for the whole run (already the case per-source).
- **Optional:** In the UI or API, expose “last collect” summary (e.g. “X signals from Y sources; Z sources failed”) so users see health without looking at the terminal.

**Done when:** 404s are logged clearly with the failing URL; optional improvements (HEAD, timeout, UI summary) in place as agreed.

---

## Order

1. **Sprint 1** — Clarity of gaps and recommendations (dual analysis).
2. **Sprint 2** — Filter by source (and optional date) + show source on gaps.
3. **Sprint 3** — Reduce and better handle collect failures (404 and config).

You can run Sprints 2 and 3 in parallel after Sprint 1 if you prefer.
