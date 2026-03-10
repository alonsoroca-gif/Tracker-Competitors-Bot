# Mon–Tue sub-task review (today and tomorrow)

Quick review of **today (Mon)** and **tomorrow (Tue)** sub-tasks for both initiatives, plus a check that Initiative 2 (ProspectPortal) has the right product direction.

---

## Initiative 1: Tracker Bot — Mon & Tue

### Today (Mon): Foundation + config + first collect

| Sub-task | Purpose | Order OK? | Notes |
|----------|---------|-----------|--------|
| **T1.1a** | Create project folder, init (npm/pip) | Yes | Do first so you have a place to code. |
| **T1.1b** | Entry point runs and prints “Tracker” | Yes | Confirms runtime and deps work. |
| **T1.1c** | `.env.example` + readme | Yes | So you (or automation) can run later without guessing. |
| **T1.2a** | Config file: product_id + competitor_id + name | Yes | Collect needs to know *who* to track. |
| **T1.2b** | `loadConfig()` used by collect | Yes | Collect step stays config-driven. |
| **T1.3a** | Pick one source, implement fetch | Yes | One URL/source is enough for day one. |
| **T1.3b** | Parse into signals (date, source, competitor_id, product_id, type, snippet) | Yes | Normalized shape for later gap logic. |
| **T1.3c** | Filter “last 7 days”; expose `collect(competitorId, productId, days)` | Yes | Matches PRD “weekly” window. |

**Direction:** Correct. Mon gets you from zero to “we can collect signals from one open source and get a structured list.” No gaps or Slack yet — that’s Tue/Wed.

**Dependency check:** T1.2 before T1.3 (config must exist so collect knows competitor/product). T1.3a before T1.3b (need raw response before parsing). All good.

---

### Tomorrow (Tue): More sources + storage + gap schema

| Sub-task | Purpose | Order OK? | Notes |
|----------|---------|-----------|--------|
| **T1.3d** | Error handling for fetch (timeout, 4xx/5xx) | Yes | Do early so Tue’s new sources don’t break the pipeline. |
| **T1.4a** | Second source, same signal shape | Yes | Combined array from 2 sources. |
| **T1.4b** | Normalize types across sources | Yes | So gap detection sees a single vocabulary. |
| **T1.4c** | Optional third source | Yes | Optional; skip if time is short. |
| **T1.5a** | Storage (JSON/SQLite) + write after collect | Yes | So you don’t lose data between runs. |
| **T1.5b** | `getSignals(productId, periodStart, periodEnd)` | Yes | Gap report (Wed) will call this. |
| **T2.1a** | Gap + GapReport types in code | Yes | Matches gap-report-schema.json. |
| **T2.1b** | Serialize to JSON | Yes | For tests and for API/report payload later. |

**Direction:** Correct. Tue gets you: collect from 2+ sources → store → read back; plus the data structures for gap report. Wed will implement gap detection and response schema using these.

**Dependency check:** T1.5 before T2.1 is not strict (you can define GapReport types without storage), but having `getSignals` ready by end of Tue makes Wed’s `buildGapReport` straightforward. Order is fine.

---

## Initiative 2: ProspectPortal — Mon & Tue

### Product direction check

**Intended direction (from one-pager):** One **reference link** + **3 key questions** (goal, audience, must-haves) → bot **ingests reference** → **generates full website** (structure, copy, CSS) → **preview** and **export**.

**Task flow:**  
Mon: project → **validate & fetch URL** → **parse HTML** (structure, nav).  
Tue: **style hints** → **reference schema** (structure + style) → **Q1, Q2, Q3** (goal, audience, must-haves) + **full flow** (link → Q1 → Q2 → Q3 → Generate).  
Wed: **generate** (section list from goal + must_haves, copy per section, HTML).  
Thu: CSS, preview, export.

**Verdict:** Direction is correct. The reference link is the first input; the 3 questions are collected before generate; generate uses reference + goal + audience + must_haves. One small fix: P2.4b says “call ingest (if not already done) then generate” — that’s right: ingest runs on the link, then generate runs with reference + 3 answers. No change needed.

**Optional clarification:** In P1.5b “persist … so generate step can use it” — generate step should receive **reference schema** (structure + style hints) plus **goal, audience, must_haves**. The tasks already say that; keep it as is.

---

### Today (Mon): Project + URL fetch + parse structure

| Sub-task | Purpose | Order OK? | Notes |
|----------|---------|-----------|--------|
| **P1.1a** | Project folder, init | Yes | First. |
| **P1.1b** | HTTP server or CLI runs | Yes | You need something that can later accept link + 3 questions. |
| **P1.1c** | `.env.example` + README | Yes | Same as Tracker. |
| **P1.2a** | Validate URL | Yes | Before fetch; fail fast on bad input. |
| **P1.2b** | Fetch HTML with timeout | Yes | Core of “ingest reference.” |
| **P1.2c** | Handle 4xx/5xx and network errors | Yes | So one bad site doesn’t crash the app. |
| **P1.3a** | Parser (cheerio/jsdom/BeautifulSoup), load DOM | Yes | Need DOM to extract structure. |
| **P1.3b** | Extract sections (tag + text), order preserved | Yes | “Structure” from the reference. |
| **P1.3c** | Extract nav (href + text) | Yes | Optional but useful for later layout/nav. |

**Direction:** Correct. Mon gets you from zero to “we have structure (sections + nav) from a URL.” No questions or generate yet.

**Dependency check:** P1.2 before P1.3 (need HTML before parsing). P1.1 before P1.2 (need a running app). All good.

---

### Tomorrow (Tue): Style hints + reference schema + Q1–Q3 + flow

| Sub-task | Purpose | Order OK? | Notes |
|----------|---------|-----------|--------|
| **P1.4a** | Primary color from HTML/CSS | Yes | Improves “compelling” output later. |
| **P1.4b** | Font from body/main | Yes | Same. |
| **P1.5a** | `ingestReference(url)` → `{ structure, nav, styleHints }` | Yes | Single entry point for “reference” for generate. |
| **P1.5b** | Persist reference by session/request id | Yes | So generate can use it after user answers Q1–Q3. |
| **P2.1a–b** | Q1 (goal) input + store | Yes | First of the 3 questions. |
| **P2.2a–b** | Q2 (audience) input + store | Yes | Second. |
| **P2.3a–b** | Q3 (must-haves, 1–3 items) input + store | Yes | Third. |
| **P2.4a** | Wire flow: link → Q1 → Q2 → Q3 → “Generate” | Yes | User journey matches one-pager. |
| **P2.4b** | On Generate: ingest then generate with reference + goal + audience + must_haves | Yes | Pipeline matches product direction. |

**Direction:** Correct. Tue gets you: reference schema (with optional style hints) + all 3 questions + full flow so that when the user clicks Generate, you have the four inputs (reference, goal, audience, must_haves) for Wed’s generate step.

**Dependency check:** P1.5 before P2.4b (generate needs reference). P2.1–P2.3 before P2.4 (need inputs to wire). All good.

---

## Summary

- **Tracker Mon–Tue:** Order and direction are correct. Today = runnable collect from one source with config; tomorrow = more sources, storage, and gap report data structures.
- **ProspectPortal Mon–Tue:** Order and direction are correct. Today = runnable ingest (URL → structure + nav); tomorrow = reference schema + 3 questions + full flow so generate (Wed) has all inputs.
- **Initiative 2 direction:** Matches the one-pager (one link + 3 answers → full site); no task changes needed. Just keep P2.4b as “ingest then generate with reference + goal + audience + must_haves.”

Use this as a quick check before starting Mon and Tue; if you slip a sub-task, the “Order OK?” column should still hold.
