# Weekly intel flow — pillars, freshness, and coverage

## Goals

1. **Valuable insights each week** — Prefer signals that span more than one intel pillar (owned + behavioral + third party). The app tags every stored signal with **`metadata.intel_pillar`** (1–3 today; 4 reserved for future structural sources).
2. **Stay up to date each week** — Use the **same retention window** for collect and report (e.g. 7 days in the UI: period buttons + **Refresh data**). That re-fetches configured URLs and **drops signals older than the window**, so the file matches a rolling weekly tracker.

## What to run

| Action | Command / API |
|--------|----------------|
| Full collect + prune + meta | `npm run collect` or `node index.js collect [--days N]` |
| Collect + printed checklist | `node index.js weekly [--days N]` |
| UI | **Refresh data** (uses selected period as `days`) |
| Coverage only (no HTTP) | `GET /api/weekly-coverage` |

After each collect, **`data/collect-meta.json`** includes **`last_run_intel`**: pillar counts for that run, pillars touched, and per-competitor **configured / missing** hints.

## Pillar → source mapping (this repo)

- **P1 — Owned:** blog, press, changelog, YouTube RSS, features page, docs URL.
- **P2 — Behavioral:** pricing page, careers / jobs.
- **P3 — Third party:** G2 reviews URL, YouTube comment video IDs, YouTube discovery (queries + `YOUTUBE_DATA_API_KEY`).
- **P4 — Structural:** Not collected automatically yet (LinkedIn, funding, stack, traffic — manual or future).

## UI

- Gaps table **Pillar** column (tooltip = short label).
- Collect status line: **last run pillars** when meta is present.

## Code

- `lib/intelPillar.js` — assign pillar on ingest.
- `lib/weeklyIntelFlow.js` — coverage checklist + console formatter.
- `lib/runCollectAll.js` — single pipeline used by CLI and server.
- `lib/collectMeta.js` — writes `collect-meta.json`.

## Cross-pillar corroboration (implemented)

Signals are **bucketed** by competitor + inferred **dimension** + **theme** (`event_type` when known, else `type`). Within each bucket, items merge **only if** they pass similarity: same `source_url`, same headline (≥14 chars), overlapping **integrators/prices** from `entities`, or enough **token / Jaccard overlap** on headline+snippet+evidence (stopwords stripped). Otherwise they stay **separate gaps** so unrelated stories are not collapsed together.

- **Confirmed** — two or more distinct intel pillars in the cluster; high priority is preserved.
- **Watch** — one pillar only (or unclassified); **high** priority is capped to **medium**. If several signals merged but all the same pillar, the move line gets `· Watch (same pillar)`.

`GET /api/report` gaps include `corroboration`, `intel_pillars`, `cluster_signal_count`, and `corroboration_sources` for filtering.

**Strategic read (no LLM):** each gap has `interpretation`: `headline`, `strategic_why`, `threat_tag`, plus the factual `competitor_move`. Copy is template-driven from dimension, pillars, and corroboration — it does not invent new facts beyond the scraped line.
