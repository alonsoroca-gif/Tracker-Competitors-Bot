# Tracker briefs schema (Billy-facing)

Published output lives under `tracker-briefs/`. **tracker-feed** reads only this tree — not raw `tracker-drops/`.

## Layout

```
tracker-briefs/
  latest.json                 # pointer + readiness
  runs-index.json             # past runs for viewer dropdown
  viewer/
    index.html                # Simple Browser — full table + prototypes
  runs/
    <run_id>/
      manifest.json
      signals-table.json
      prototypes.json
      prototypes/*.html
      prds/*.md
```

## latest.json

| Field | Type | Notes |
|-------|------|-------|
| `status` | `ready` \| `publishing` \| `failed` \| `not_ready` | Billy gate |
| `run_id` | string | Matches `tracker-drops/<run_id>` |
| `ready_at` | ISO8601 | Set when publish finishes (~8:00–8:30am MT typical) |
| `net_new_count` | number | Interpreted net-new rows |
| `product_row_count` | number | |
| `prototype_count` | number | |
| `viewer_path` | string | `tracker-briefs/viewer/index.html` |
| `run_dir` | string | `tracker-briefs/runs/<run_id>` |

## manifest.json (per run)

Day summary for viewer + feed header. Includes `day_type`: `pmm_only` | `product` | `mixed`.

## signals-table.json

Array of rows — **source of truth for Billy's chat table**.

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Row # |
| `competitor_id` | yes | |
| `headline` | yes | |
| `classification` | yes | Product, PMM, News, … |
| `classification_detail` | no | e.g. `channel-building` |
| `parity` | yes | L2 final, `—`, or `not_scanned` |
| `parity_l1` | no | Keyword scan |
| `parity_l2` | no | Agent Core search |
| `routing` | yes | Tier / Won't chase |
| `why_routing` | yes | **Emphasis on non-Product days** |
| `source_url` | yes | Citation |
| `prototype_path` | no | When vignette exists |
| `prd_path` | no | Supporting doc |

## prototypes.json

```json
{
  "id": "slug",
  "title": "Human title",
  "competitor_id": "…",
  "signal_id": 1,
  "html_path": "tracker-briefs/runs/…/prototypes/foo.html",
  "prd_path": "…",
  "brief": {
    "what": "One sentence — what the vignette shows",
    "benefits": "Entrata products that benefit (e.g. Prospect Portal · Leasing CRM)",
    "why_build": "Why we should build it — structural competitor gap"
  },
  "roi": {
    "verdict": "pursue | watch | skip",
    "lever": "Primary dollar lever (one line)",
    "summary": "roi-analyst TL;DR — 1-2 sentences",
    "per_unit_annual": "~$X/unit/yr",
    "property_250": "~$X/yr",
    "portfolio_10k": "~$X/yr",
    "confidence": "modeled | measured",
    "numbers": {
      "type": "modeled_approximation | benchmark_chunk | measured",
      "formula": "Raw math one-liner",
      "inputs": ["assumption 1", "assumption 2"],
      "scaling": "How per-unit → 250u → 10k portfolio (chunk language)",
      "disclaimer": "Not a client ROI guarantee unless measured"
    },
    "brief": {
      "advantage": "Our structural advantage (1 sentence)",
      "why_pursue": "Why pursue (1 sentence)"
    }
  }
}
```

Full publish contract + vignette bar: [TRACKER-VIGNETTE-STANDARD.md](./TRACKER-VIGNETTE-STANDARD.md).

Past briefs: each publish adds `runs/<run_id>/` (git-committed). Viewer loads `runs-index.json` (refreshed on `--mark-ready`) to switch between days. **Not** the Product OS prototype gallery — see [TRACKER-PROTOTYPE-TIERS.md](./TRACKER-PROTOTYPE-TIERS.md).

## Scripts

| Script | Role |
|--------|------|
| `publish-preflight.js` | Operator workload estimate |
| `brief-readiness-check.js` | tracker-feed gate (morningbrief ~8:20) |
| `tracker-feed-render.js` | Canonical chat markdown |

## Fixtures

| Run | Purpose |
|-----|---------|
| `2026-06-02T00-10-59Z` | PMM-only day (wired to `latest.json`) |
| `_sample-product-day` | Viewer QA with 2 prototypes |
