# Tracker: Competitive move + Our response — reference (copy for external chats)

Single document describing how the Initiative 1 tracker works for **Competitive move** (gaps table) and **Our response this week** (right panel), including code map, data flow, and operational notes.

---

## 1. End-to-end pipeline

```
Config (products.json, sources URLs)
    → collect.js / runFullCollect
        → data/signals.json (retention window, e.g. 7 days)
            → gapReport.js (clusters signals → gaps)
                → gapInterpretation.js (headline, strategic_why, threat_tag per gap)
            → responseSchema.js (one response row per gap)
                → whatToChange.js (top 1–3 by priority + repo/inventory enrichment)
                    → GET /api/report (reportApi.js)
                        → public/index.html renders table + right panel
```

**Assembly point:** `lib/reportApi.js` → `getReportData(days)` runs `buildGapReport` → `buildResponseSchema` → `getWhatToChange`.

**Important:** Nothing auto-runs “every calendar week.” **Fresh signals** require a **collect** to run (`npm run collect`, `node index.js weekly`, or UI **Refresh data** → `POST /api/collect`). **Reload report** only rebuilds the report from **existing** `signals.json` (no new HTTP fetches).

---

## 2. What “Competitive move” vs “Our response” are (mentally)

| Layer | Meaning |
|-------|---------|
| **L1 — Competitive move (table)** | Rule-based **strategic read** (`interpretation.headline` + `strategic_why` + `threat_tag`) plus **factual** line (`competitor_move` = “Captured”). |
| **L2 — Evidence** | `competitor_signal`, Details drawer, URLs — what the scrape actually contained. |
| **L3 — Our response** | Template playbook from `product-keywords.json`, optionally **grounded** by repo scan + `app-inventory.json`; top 3 gaps only in the UI. |

**Our response** is **not** a bespoke LLM analyst per gap by default; it is **configured voice + rotating angles + clipped factual evidence**, with **optional** code paths when inventory/repo are set.

---

## 3. Files: Competitive move (strategic read + factual line)

| File | Role |
|------|------|
| `tracker/lib/gapReport.js` | Builds each gap: `competitor_move`, `competitor_signal`, clustering, dimension, priority, corroboration, `source_summary`, `corroboration_sources` → passes `factual_competitor_move`, entities, `metric_excerpt`, `source_labels` into interpretation. |
| `tracker/lib/gapInterpretation.js` | **`interpretation.headline`**, **`strategic_why`**, **`threat_tag`**, `factual_line`. Headline rules: short, ≤2 sentences, char cap; `strategic_why` varies with corroboration and `source_labels` for multi-surface gaps. |
| `tracker/lib/intelPillar.js` | Pillar inference / labels used in gap rows. |
| `tracker/config/products.json` | Product + competitors + **source URLs** (empty URL = no data from that lane). |
| `tracker/lib/collect.js` | Fetches/normalizes **signals** (snippet, type, entities, evidence) that become gaps. |
| `tracker/data/signals.json` | Stored signals after collect (local file). |

**UI:** `tracker/public/index.html` — function `renderGapsTable` (~751+). **Competitive move** cell stacks:

- **Strategic read:** `interpretation.headline` (`.move-insight`)
- **Why:** `interpretation.strategic_why` (`.move-why`)
- **Threat:** `interpretation.threat_tag` (`.move-threat`)
- **Captured:** `g.competitor_move` (`.move-factual`)

**Schema docs:** `initiative-1-tracker/gap-report-schema.md`, `initiative-1-tracker/docs/COMPETITIVE-INTEL-PRESENTATION.md`, `initiative-1-tracker/docs/STRATEGIC-INTERPRETATION.md`.

---

## 4. Files: Our response this week

| File | Role |
|------|------|
| `tracker/lib/responseSchema.js` | Per gap: `competitor_action` (prefers **`interpretation.headline`** else factual), `recommendation` (angle from keywords + **Evidence:** / **Counter vs:** + clipped factual), `rationale`, `response_type` (match vs differentiate from dimension), `timeline` from priority. |
| `tracker/lib/productContext.js` | Loads voice + `pickVariantByGapId` for rotating copy. |
| `tracker/config/product-keywords.json` | **`display_name`**, **`match_focus`**, **`differentiate_focus`**, **`repo_terms`**, **`fallback_no_hits`** — main dial for recommendation **tone and substance**. |
| `tracker/lib/whatToChange.js` | Sorts by priority, **top 3**; **`buildRepoAwareRecommendation`** may **replace** base `recommendation`; builds **`formatted`** markdown block; **`structured`**: inventory, `work_items`, `repo_touchpoints`, `intel_fence`, `llm_readiness`. |
| `tracker/lib/repoInsight.js` | **`getRepoInsightsForGap`**: keyword scan under inventory `repo_root`; **`buildRepoAwareRecommendation`**: paths/snippets or “no repo hits” boilerplate. |
| `tracker/lib/appInventory.js` | Reads **`config/app-inventory.json`**, versions, **`buildStructuredWorkItems`**, etc. |
| `tracker/lib/intelFence.js` | Caps/redacts repo snippets in responses. |
| `tracker/lib/modelBundle.js` | `minimal_model_bundle` for export/LLM (includes move + interpretation). |
| `tracker/lib/llmGateway.js` | Gateway status on `structured.llm_readiness`. |
| `tracker/lib/ourState.js` | Reads **`config/our-state.json`** → **`our_gap`** per product keys used in gaps (`Starting` / `In process` / `Delivered`). |

**UI:** `tracker/public/index.html` — heading **“Our response this week”** (`#changesHeading`, `#changesContent`). Renders `changes[].formatted` + optional `structured.work_items` + `structured.repo_touchpoints`.

**Docs:** `initiative-1-tracker/what-to-change-block.md`, `initiative-1-tracker/response-schema.md`, `initiative-1-tracker/docs/APP-INVENTORY-AND-STRUCTURED-WHAT-TO-CHANGE.md`.

---

## 5. API and CLI

| Entry | Role |
|-------|------|
| `tracker/lib/reportApi.js` | `getReportData(days)` → `{ report, changes, product, periodStart, periodEnd, viewer }`. |
| `tracker/server.js` | `GET /api/report?days=N`; collect via `POST /api/collect` (see README). |
| `tracker/index.js` | `node index.js report` / `demo` — same pipeline, prints `changes[].formatted`. |

---

## 6. Field cheat sheet (UI ↔ JSON)

| User-visible | Primary source |
|--------------|----------------|
| Bold line in Competitive move column | `gap.interpretation.headline` |
| Paragraph under it (why) | `gap.interpretation.strategic_why` |
| Threat tag | `gap.interpretation.threat_tag` |
| “Captured:” line | `gap.competitor_move` |
| Full evidence | `gap.competitor_signal` (Details) |
| **Competitive move (summary)** in right panel | `changes[].action` ← `responseSchema.competitor_action` (headline when present) |
| **Recommended response** | `changes[].recommendation` (after `buildRepoAwareRecommendation`) |
| **Our delivery state** | `gap.our_gap` ← `config/our-state.json` |
| Work items / repo paths | `changes[].structured.work_items`, `structured.repo_touchpoints` |

---

## 7. Tests

| File | Notes |
|------|--------|
| `tracker/test/run.js` | Gaps include `interpretation`; `buildGapInterpretation` cases; `getWhatToChange` structured shape (work_items, repo_touchpoints, intel_fence, llm_readiness). |

---

## 8. What to tune for quality next week

1. **Run collect** on a schedule or habit (UI Refresh data or `npm run collect` / `node index.js weekly`) — otherwise signals age out or go stale within the retention window.
2. **Complete `products.json` sources** — missing URLs = blind spots.
3. **`config/our-state.json`** — if everything is “Starting,” every card reads the same urgency.
4. **`config/product-keywords.json`** — main lever for **recommendation** copy and angles.
5. **`config/app-inventory.json` + real `repo_root` paths + `repo_terms`** — reduces generic “confirm ENTRATA_MONO_ROOT…” text; enables **Core repo touchpoints** in UI.
6. **API keys** (YouTube, G2, etc.) only if those source types are configured.
7. **Restart `npm run serve`** after server-side code edits — report is built in Node; old process = old logic.

---

## 9. “Start here” for product/engineering copy

| Goal | Start file |
|------|------------|
| Shorter / clearer **strategic headline** and **why** | `tracker/lib/gapInterpretation.js` |
| **Recommendation** wording and parity/differentiate angles | `tracker/config/product-keywords.json` + `tracker/lib/responseSchema.js` |
| **Concrete file paths** in responses | `tracker/lib/repoInsight.js` + `tracker/config/app-inventory.json` |

---

*Generated for handoff to Claude or other assistants. Repo path: Initiative 1 tracker under `initiative-1-tracker/tracker/`.*
