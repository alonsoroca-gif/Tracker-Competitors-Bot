# Tracker Bot — Task list (Initiative 1)

Small, testable tasks. Check off when done. **Suggested Mon–Thu:** Phase 1 Mon–Tue AM; Phase 2 Tue PM–Wed; Phase 3–4 Thu (or spill to next week). Refs: [gap-report-schema](gap-report-schema.md), [response-schema](response-schema.md), [PRD](../../PRD.md).

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
