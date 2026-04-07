# How competitor intelligence is presented

**Purpose:** One shared model so PMs, managers, and engineers know **what each part of the UI/API means** and **how raw signals become copy**. High impact: the table row must be scannable; proof lives one click away; actions stay separate from observation.

**Primary value:** the **strategic interpretation** (`gap.interpretation`) — headline, why, threat tag — is what makes the tracker useful; scrapes alone are not the product. See **[STRATEGIC-INTERPRETATION.md](./STRATEGIC-INTERPRETATION.md)**.

**Code touchpoints:** `tracker/lib/gapReport.js`, `tracker/lib/gapInterpretation.js`, `tracker/lib/whatToChange.js`, `tracker/public/index.html`.

---

## Three layers (read in this order)

| Layer | Name | Audience need | Where it appears | Primary data |
|--------|------|----------------|------------------|--------------|
| **L1 — Summary move** | “What did they do?” (factual, terse) | Scan the week in under a minute | **Gaps** table column **“Competitive move”** | `gap.competitor_move` |
| **L2 — Evidence** | “Prove it” | Validate or share a link | **Details** (expand row): full text, headline, URL | `gap.competitor_signal`, `headline`, `source_url`, `detected_at` |
| **L3 — Response** | “What we do” | Prioritize work and messaging | **Our response this week** (right panel) | `changes[].recommendation`, `structured.work_items`, `structured.repo_touchpoints`, `structured.intel_fence` (caps/redaction flags) |

**Rule:** L1 is **not** a blog title and **not** marketing chrome. Prefer **actions + metrics** (prices, %, scale, launch/partner verbs). Titles and nav phrases belong in L2 or are stripped upstream.

---

## Row metadata (same table, context columns)

These columns **annotate** the competitive move; they do not replace L1.

| Column | Meaning |
|--------|---------|
| **ID** | Stable row id (`gap_id`) for references |
| **Priority** | Triage order (high / medium / low), derived from dimension rules |
| **Dimension** | Lens: features, pricing, messaging, support, positioning |
| **Our state** | Where **we** are on this theme (Starting / In process / Delivered) — not competitor text |
| **Source** | *How* we know (blog, pricing_page, g2_reviews, …) — separate from the move text intentionally |

---

## API / schema mapping (implemented shape)

| UI / concept | JSON field | Notes |
|----------------|------------|--------|
| L1 strategic read | `interpretation.headline`, `strategic_why`, `threat_tag` | Rule-based read; does not invent facts beyond captured text |
| L1 factual trace | `competitor_move` | Scraped/extracted line; shown as **Captured** in UI |
| L2 body | `competitor_signal` | Longer excerpt / concatenated evidence |
| Headline (optional) | `headline` | Shown in Details only when present |
| Link | `source_url` | Public page when available |
| Source type | `source` | Machine label for filter + column |
| Dimension | `dimension` | |
| Our state | `our_gap` | |
| Title (legacy/short) | `title` | Derived; prefer `competitor_move` for display |

Full report envelope: see [gap-report-schema.md](../gap-report-schema.md).

---

## “What to change” panel (L3) — line labels

Exported **formatted** block uses consistent headings:

1. **Competitive move (summary)** — L1 strategic line (`competitor_action` uses **`interpretation.headline`** when present; evidence still cites the factual move).
2. **Our delivery state** — `our_gap`.
3. **Recommended response** — recommendation + priority + timeline; then inventory and work items.

This keeps language aligned with the three-layer model (observation vs us vs action).

---

## Source filter + mix line

- **Source** dropdown filters which gaps are shown (proves *where* intel came from).
- **Gaps from: …** line summarizes counts by `source` so managers judge balance (e.g. too much blog, not enough pricing).

---

## Related docs

- **[STRATEGIC-INTERPRETATION.md](./STRATEGIC-INTERPRETATION.md)** — **core rule:** interpretation is the product; scrapes are inputs.
- [WHAT-COMPETITOR-DOING-NEXT.md](./WHAT-COMPETITOR-DOING-NEXT.md) — refinements to **L1** extraction (metrics-first, dedupe, per-source lines).
- [COMPETITOR-DATA-PULL-REFERENCE.md](./COMPETITOR-DATA-PULL-REFERENCE.md) — how collects become signals before `gapReport`.

---

## Changelog (presentation only)

- **2026-03 (late)** — L1 = **`interpretation`** (headline / why / threat tag) + factual **`competitor_move`**; doc [STRATEGIC-INTERPRETATION.md](./STRATEGIC-INTERPRETATION.md).
- **2026-03** — Documented L1/L2/L3; table column labeled **Competitive move**; panel **Our response this week**; formatted export labels aligned.
