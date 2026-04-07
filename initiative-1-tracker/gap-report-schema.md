# Gap report schema — Tracker Bot (Initiative 1)

Structure for **market vs us** comparison. Use this to store and render gap reports (e.g. in the weekly newsletter or a dedicated Slack section).

**How we present this to users (L1 summary vs evidence vs response):** see [docs/COMPETITIVE-INTEL-PRESENTATION.md](docs/COMPETITIVE-INTEL-PRESENTATION.md).

---

## 1. Dimensions (what we compare)

| Dimension | Description | Example fields |
|-----------|-------------|----------------|
| **Features** | Capabilities each product has | feature_id, name, we_have (bool), competitors_have (list) |
| **Pricing** | Price points, tiers, packaging | tier, our_price, competitor_prices, notes |
| **Messaging** | Positioning, taglines, value props | our_positioning, competitor_positioning, gap_notes |
| **Support** | Support channels, SLAs | channel (chat/email/phone), our_offer, competitor_offer |
| **Positioning** | Market segment, target audience | our_segment, competitor_segment |

*Agree with manager which dimensions to use in v1.*

**Response schema:** For each gap, the bot also produces a **how we respond** entry (response type, actions, timeline). See [response-schema.md](response-schema.md). Our response is high priority; the schema is the main output alongside the gap list.

---

## 2. Gap record (single gap)

Each gap is one comparable item where **market (competitors)** has something we don’t, or we differ in a meaningful way.

| Field | Type | Description |
|-------|------|-------------|
| `gap_id` | string | Unique id (e.g. `gap-2025-02-001`) |
| `product_id` | string | Our product this gap belongs to |
| `dimension` | string | One of: features, pricing, messaging, support, positioning |
| `title` | string | Short label (often derived from `competitor_move`) |
| `description` | string | What the gap is (competitor X has Y; we don’t) |
| `competitor_move` | string | **L1 — table summary:** `CompetitorName: factual move` (actions + metrics; see [COMPETITIVE-INTEL-PRESENTATION.md](docs/COMPETITIVE-INTEL-PRESENTATION.md)) |
| `competitor_signal` | string | **L2 — evidence body** for Details (excerpts, proof text) |
| `headline` | string \| null | Optional feed/page title — Details only, not the L1 line |
| `source` | string \| null | Machine source id (blog, pricing_page, …) |
| `source_url` | string \| null | Public URL when available |
| `our_gap` | string | Our delivery state: Starting \| In process \| Delivered |
| `priority` | string | `high` \| `medium` \| `low` |
| `recommended_action` | string | Optional: "Add feature Z", "Adjust positioning to A" |
| `response_id` | string | Optional: links to the **response schema** entry for *how we respond* to this gap (see [response-schema.md](response-schema.md)) |
| `detected_at` | string (ISO date) | When the gap was identified |

---

## 3. Gap report (full output)

One report per product (or per run).

| Field | Type | Description |
|-------|------|-------------|
| `report_id` | string | e.g. `gap-report-{product_id}-{YYYY-MM-DD}` |
| `product_id` | string | Our product |
| `period_start` | string (ISO date) | Start of analysis window |
| `period_end` | string (ISO date) | End of analysis window |
| `gaps` | array of gap records | List of gaps |
| `summary` | object | Optional: counts by dimension, by priority |
| `generated_at` | string (ISO datetime) | When the report was built |

---

## 4. JSON template (machine-readable)

```json
{
  "report_id": "gap-report-ProductA-2025-02-24",
  "product_id": "ProductA",
  "period_start": "2025-02-17",
  "period_end": "2025-02-24",
  "generated_at": "2025-02-24T08:00:00Z",
  "gaps": [
    {
      "gap_id": "gap-2025-02-001",
      "product_id": "ProductA",
      "dimension": "features",
      "title": "Live chat support",
      "description": "Competitor X launched 24/7 live chat; we only have email.",
      "competitor_signal": "Competitor X blog post 2025-02-20",
      "priority": "high",
      "recommended_action": "Add live chat or set timeline for it.",
      "detected_at": "2025-02-24"
    }
  ],
  "summary": {
    "by_priority": { "high": 1, "medium": 0, "low": 0 },
    "by_dimension": { "features": 1, "pricing": 0, "messaging": 0 }
  }
}
```

---

## 5. Priority rules (for classification)

Use these to set `priority` on each gap (refine with manager):

| Rule | Priority |
|------|----------|
| Competitor launched a major feature we don’t have (and it’s in our roadmap or segment) | high |
| Competitor changed pricing in a way that affects our segment | high |
| Competitor messaging directly targets our audience and we don’t respond | medium |
| Nice-to-have feature or minor positioning difference | low |

---

*Part of the three initiatives plan. See ACTION-PLAN.md.*
