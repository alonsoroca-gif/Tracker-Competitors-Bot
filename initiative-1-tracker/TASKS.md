# Tracker Bot — Task list (Initiative 1)

Small, testable tasks. Check off when done. Refs: [gap-report-schema](gap-report-schema.md), [response-schema](response-schema.md), [TRACKER-FEEDBACK-SPRINTS](docs/TRACKER-FEEDBACK-SPRINTS.md), [DATA-SOURCES-BRAINSTORM](docs/DATA-SOURCES-BRAINSTORM.md).

---

## Priority: Before Thursday (main tasks for automation bot)

**Short mirror for PRs/handoffs:** `docs/PR-TASKS-TODAY-TOMORROW.md` — keep it in sync when you change checkboxes here.

**Focus:** Better sources + better "What competitor is doing" (facts, metrics, PM/manager useful); Sprint 2 (filter by source); Sprint 3 (fewer collect failures). **P1–P3 below are complete**; use *Backup* sections (AS / BM) or `docs/WHAT-COMPETITOR-DOING-NEXT.md` for next work. One task per run when executing the bot; check off when done.

### P1 — Better sources and "What competitor is doing" (fact-rich, tailored)

| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P1.1 | Prefer RSS description over title in collect.js | When feed item has description/content longer than 50 chars, use it as snippet (strip HTML/CDATA); else use title. Snippet max 600 chars. | [x] |
| P1.2 | Extract fact-like sentences from page body in collect.js | For pricing/features/careers pages: skip first 1200 chars, then extract sentences containing digits, %, $, or words like million, percent, ROI, growth; join up to 800 chars as snippet. Fallback to body slice if none. | [x] |
| P1.3 | Add more boilerplate phrases to cleanSnippet in gapReport.js | Strip additional nav/marketing phrases so "What competitor is doing" shows substantive copy only (e.g. "request demo", "schedule a call", "learn more"). | [x] |
| P1.4 | Document how to add/find working feed URLs in README | Short section: where to find competitor blog/press/changelog RSS URLs; how to validate URL returns XML; link to config/products.json sources. | [x] |
| P1.5 | Optional: try content from main/article in page collector | In collectFromPage, if HTML has `<main>` or `<article>`, extract text from that first; else use current body slice. Improves relevance for "What competitor is doing". | [x] |

### P2 — Sprint 2: Filter to prove accuracy of data

| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P2.1 | Add filter by source in report UI | Dropdown or chips: filter gaps by source (blog, press, changelog, pricing_page, features_page, careers). When selected, only gaps from that source are shown. | [x] |
| P2.2 | Add "Data sources" summary above or below Gaps table | One line: "Gaps from: N blog, M pricing_page, …" so users see the mix and can judge accuracy. | [x] |
| P2.3 | Ensure each gap row shows Source column | Source is already in API; verify UI shows it and filter uses it. If missing, add. | [x] |

### P3 — Sprint 3: Fewer collect failures (404 and config)

| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P3.1 | Validate URL before fetch in collect.js | Skip fetch if URL is empty, or not http(s), or invalid; log "Skipped invalid URL: …" per source. | [x] |
| P3.2 | On 404, log competitor id + source + URL | When a source returns HTTP 404, log one line: e.g. "Collect 404: eliseai blog https://…" so config can be fixed. | [x] |
| P3.3 | Document optional URLs and how to find working ones in README | Which sources are optional; how to find blog/press/changelog URLs for a competitor; that 404 means update config. | [x] |
| P3.4 | Optional: add GET /api/collect-status or last_collected_at | Return last collect time and optionally "X signals, Y sources failed" so UI can show health without terminal. | [x] |

---

## Backup: Agent sprint (do if bot runs out of main tasks)

Small tasks for the coding-automation agent. One task per run.

| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| AS1 | Add GET /health endpoint to server.js | Returns 200 with `{ status: "ok" }`; used for uptime checks | [ ] |
| AS2 | Add validateConfig() in loadConfig.js | Checks products and competitors arrays exist and are non-empty; throws clear error if invalid | [ ] |
| AS3 | Add CONTRIBUTING.md in tracker/ | Short doc: "How to add a new data source" with 3–5 steps (pick source, add URL to config, implement fetch in collect) | [ ] |
| AS4 | Add JSDoc to collect.js main export | Function collect() has @param, @returns, @example in JSDoc block | [ ] |
| AS5 | Add last_collected_at to data/signals.json | When collect runs, write `last_collected_at` (ISO timestamp) at top level of JSON | [ ] |
| AS6 | Add --days N flag to collect command | `node index.js collect --days 14` uses 14 instead of 7 for the filter | [ ] |
| AS7 | Add README Troubleshooting section | Covers: "No signals returned" (check env vars), "Config load fails" (check products.json) | [ ] |
| AS8 | Add npm script "health" to package.json | Runs `node -e "require('http').get('http://localhost:3000/health',r=>console.log(r.statusCode))"` or similar quick check | [ ] |
| AS9 | Add smoke test in test/run.js | Asserts loadConfig() returns object with products and competitors; exits 0 on pass | [ ] |
| AS10 | Ensure .gitignore has .env | .env is in .gitignore so secrets are not committed | [ ] |

---

## Backup: medium tasks (after sprint)

Next tasks when AS1–AS10 are done. Medium complexity.

| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| BM1 | Add retry logic to collect fetch | On fetch failure, retry up to 3 times with 2s delay; log each attempt; return empty array if all fail | [ ] |
| BM2 | Add dry-run mode to collect | `node index.js collect --dry-run` logs URLs and competitor IDs that would be fetched, no fetch, no write | [ ] |
| BM3 | Add export-csv command | `node index.js export-csv` writes signals to data/signals.csv with columns: date, source, competitor_id, product_id, type, snippet | [ ] |
| BM4 | Add date range to report API | GET /api/report?periodStart=YYYY-MM-DD&periodEnd=YYYY-MM-DD filters signals by date; default last 7 days | [ ] |
| BM5 | Add env validation at startup | In index.js or loadConfig: check required vars (e.g. TRACKER_FEED_URL_* for configured competitors); warn to console if missing | [ ] |
| BM6 | Add rate limiting to collect | Delay 500ms between competitor fetches to avoid hammering external APIs; configurable via env | [ ] |
| BM7 | Add structured logging to collect | Use timestamps: `[2024-01-15T10:00:00] collect: competitor-x, 3 signals`; log start/end per competitor | [ ] |
| BM8 | Add config validation for sources | Warn if competitor in products.json has no configured sources (blog, press, etc.); list which competitors are skipped | [ ] |
| BM9 | Add getSignals pagination | getSignals(productId, periodStart, periodEnd, { limit, offset }) for large datasets; used by report API | [ ] |
| BM10 | Add "what changed" since last run | After collect, compare new signals with previous; log or return "new: N, unchanged: M" summary | [ ] |

---

## Suggested week (code through Thursday)

| Day | Focus | Tasks |
|-----|--------|--------|
| **Mon** | Foundation + config + first collect | T1.1, T1.2, T1.3a–c |
| **Tue** | More sources + storage + gap schema | T1.3d, T1.4a–c, T1.5a–b, T2.1a–b |
| **Wed** | Gap detection + response schema + “What to change” | T2.2a–b, T2.3a–c, T2.4a–b, T2.5a–b |
| **Thu** | App registry + report payload + Slack + schedule | T3.1a–b, T3.2, T4.1a–b, T4.2a–b, T4.3, T4.4 |

Adjust if you have more or less time per day; each sub-task below is sized so you can complete several in one sitting.

---

## Phase 1: Foundation and data

### T1.1 — Set up Tracker project
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T1.1a | Create project folder (e.g. `tracker/` or under `initiative-1-tracker/`) and init (npm/pip) | `package.json` or `requirements.txt` exists; `npm install` / `pip install` runs | [ ] |
| T1.1b | Add one entry point: `node index.js` or `python run.js` runs and prints “Tracker” or similar | No errors; script exits 0 | [ ] |
| T1.1c | Add `.env.example` and readme with “how to run” | Another dev could clone and run in 2 steps | [ ] |

### T1.2 — Config for products and competitors
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T1.2a | Add config file (e.g. `config/products.json` or `.env`) with at least one product_id and one competitor_id + name | Code can `require`/load config and read product + competitor list | [ ] |
| T1.2b | Add a small `loadConfig()` (or equivalent) used by collect step | Collect step receives product_ids and competitor_ids from config | [ ] |

### T1.3 — Collect from one open source
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T1.3a | Pick one source (e.g. competitor blog RSS, or a public “company updates” API). Implement fetch (e.g. `axios.get` / `requests.get`) | Script returns raw response for one URL | [ ] |
| T1.3b | Parse response into “signals”: each has date, source name, competitor_id, product_id, type (e.g. “blog”), title or text snippet | At least 1 signal object with the fields above | [ ] |
| T1.3c | Filter to “last 7 days” (by date if available, or assume all) | Function `collect(competitorId, productId, days)` returns array of signals | [ ] |
| T1.3d | Add error handling (timeout, 4xx/5xx) and log or return empty array on failure | No uncaught throw when URL fails | [ ] |

### T1.4 — Add 1–2 more data sources
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T1.4a | Add second source (e.g. jobs page scrape, or pricing page). Same shape: date, source, competitor_id, product_id, type, snippet | `collect()` can call source 1 and source 2; returns combined array | [ ] |
| T1.4b | Normalize types (e.g. “blog” | “job” | “pricing”) across sources | Each signal has a single `type` from a fixed set | [ ] |
| T1.4c | Optional: third source. Document in CONTEXT or README which sources are used | Collect step aggregates 2–3 sources | [ ] |

### T1.5 — Store collected signals
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T1.5a | Define storage: JSON file (e.g. `data/signals.json`) or SQLite/DB. Schema: date, source, competitor_id, product_id, type, raw text/link | After collect, signals are written to storage | [ ] |
| T1.5b | Add `getSignals(productId, periodStart, periodEnd)` that reads from storage and returns array | Used by gap report step | [ ] |

---

## Phase 2: Gap report and response schema

### T2.1 — Gap report schema in code
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T2.1a | Add types/classes or interfaces for Gap and GapReport (see gap-report-schema.json): report_id, product_id, period_start, period_end, gaps[], generated_at | Code creates one GapReport object with at least one Gap | [ ] |
| T2.1b | Serialize to JSON (and optionally load from JSON) for tests or API | `JSON.stringify(gapReport)` produces valid JSON matching schema | [ ] |

### T2.2 — “Our product” snapshot
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T2.2a | Add “our state” per product: from config or a static file (e.g. features[], pricing_tier, messaging_one_liner) | Function `getOurState(productId)` returns object with at least 2 dimensions | [ ] |
| T2.2b | Document in config or CONTEXT how to edit “our state” when product changes | Clear for you or manager to update | [ ] |

### T2.3 — Gap detection
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T2.3a | Implement rules: e.g. “competitor has signal type X we don’t have in our state” → one gap. Use dimensions: features, pricing, messaging (see gap-report-schema) | Given signals + our state, output at least one gap with dimension, title, priority | [ ] |
| T2.3b | Assign priority (high/medium/low) from rules in gap-report-schema.md (e.g. major feature we don’t have → high) | Each gap has priority | [ ] |
| T2.3c | Build full GapReport: report_id, product_id, period, gaps[], generated_at | One function `buildGapReport(productId, periodStart, periodEnd)` returns GapReport | [ ] |

### T2.4 — Response schema
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T2.4a | For each gap, assign response_type (match | differentiate | ignore | accelerate | counter) from simple rules (e.g. feature gap → match) | Each gap has a response record with type, rationale, actions[], timeline | [ ] |
| T2.4b | Add `buildResponseSchema(gapReport)` that returns list of response records (see response-schema.md) | Used by “What to change” block | [ ] |

### T2.5 — “What to change this week” block
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T2.5a | From gap report + response schema, pick top 1–3 (by priority). Format: action, response type, why, source, priority, timeline | One function returns array of 1–3 “recommendation” objects | [ ] |
| T2.5b | Return as plain text or Slack-friendly blocks (e.g. markdown string per item) | Can be pasted into Slack or newsletter | [ ] |

---

## Phase 3: App registry and impacted apps

### T3.1 — App registry
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T3.1a | Create `config/app-registry.json` (or equivalent): at least 3 apps with app_id, name, url_or_route, impact_dimensions (e.g. pricing, messaging) | Code loads registry; each app has impact_dimensions array | [ ] |
| T3.1b | Add `getImpactedApps(dimension)` that returns app_ids whose impact_dimensions include dimension | Used when building “impacted apps” for a competitor action | [ ] |

### T3.2 — Proposed change per app
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T3.2 | For one competitor action (or gap), output proposed_change[]: app_id, location, current_state (optional), proposed_state (copy or spec) | At least one proposed change per impacted app; can be template text for v1 | [ ] |

### T3.3 — Pre-visualization (optional for Thu)
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T3.3 | For one proposed change, generate copy draft or 1–2 lines of HTML (e.g. “Headline: …”) and attach to change object | Report payload can include a “preview” string or link for one change | [ ] |

---

## Phase 4: Newsletter and Slack

### T4.1 — Weekly report payload
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T4.1a | Build object: KPIs (e.g. count of signals by type), highlights (top 3–5 signals), gap summary (count + list), “What to change” block, optional impacted apps + proposed changes | One function `buildWeeklyReport(productId, periodStart, periodEnd)` returns this object | [ ] |
| T4.1b | Use real data from storage (signals + gap report + response schema); fallback to mock if no data | Report is not empty when signals exist | [ ] |

### T4.2 — Slack integration
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T4.2a | Add Slack app or incoming webhook; store webhook URL in env | Sending a test message to channel works | [ ] |
| T4.2b | Function `sendReportToSlack(reportPayload)`: format report as Slack message (text or blocks) and POST to webhook | One weekly report appears in Slack when called | [ ] |

### T4.3 — Big-move channel
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T4.3 | When a signal or gap is “drastic” (e.g. priority high + type “pricing” or “launch”), post a short alert to a second webhook/channel | Second channel receives alert; content includes competitor action and link or summary | [ ] |

### T4.4 — Schedule weekly run
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| T4.4 | Add cron job or GitHub Action (or script in README): “every Monday 8am run collect → build report → send to Slack” | Either cron runs locally or Action runs on schedule; report is sent | [ ] |

---

## Phase 5: Forecasting (optional; after Thu)
| ID | Task | Acceptance criteria | Done |
|----|------|---------------------|------|
| T5.1 | Add “likely next moves” from rules (e.g. job posting → “possible push into X”) | Report includes “What to watch” with 1–3 bullets | [ ] |

---

## Phase 6: Automation (can do Thu PM or next week)
| ID | Task | Acceptance criteria | Done |
|----|------|---------------------|------|
| T6.1 | Add 2+ tests (e.g. buildGapReport returns correct shape; buildResponseSchema has type + actions) | `npm test` / `pytest` passes | [ ] |
| T6.2 | Smoke: run collect → build report → assert report has required fields | Fails if report is empty or missing fields | [ ] |
| T6.3 | CONTEXT.md or README: how to run locally, env vars, how to trigger weekly job | Another person could run Tracker in < 10 min | [ ] |

---

## Next (pick from here)

- **Mon:** T1.1a–c, T1.2a–b, T1.3a–c.
- **Tue:** T1.3d, T1.4a–c, T1.5a–b, T2.1a–b.
- **Wed:** T2.2a–b through T2.5b.
- **Thu:** T3.1a–b, T3.2, T4.1a–b, T4.2a–b, T4.3, T4.4.

*Part of [ACTION-PLAN.md](../../ACTION-PLAN.md).*
