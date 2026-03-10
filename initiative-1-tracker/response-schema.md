# Response schema — Tracker Bot (Initiative 1)

**Priority:** High. The bot doesn’t only find gaps and suggest changes — it **develops a schema for how we respond** to competitor actions. Based on what competitors do, the bot proposes a structured response (type, actions, timeline) so we can act consistently and quickly.

---

## 1. Why a response schema

- **Our response is high priority:** We need to know not just *what* changed but *how we should respond*.
- **Consistency:** A schema turns ad-hoc reactions into repeatable playbooks (e.g. “when they launch feature X, we do Y”).
- **Speed:** Predefined response types and actions reduce debate and get moves out the door faster.

The bot uses competitor actions (and gaps) as **input** and outputs a **response schema**: for each relevant competitor move, *how we respond* (type + concrete actions + timeline).

---

## 2. Response types (schema)

For each competitor action we care about, the bot assigns a **response type** and then fills in the rest of the schema.

| Type | Meaning | When the bot uses it |
|------|---------|----------------------|
| **Match** | We respond by offering something comparable (feature, message, offer). | Competitor has something we don’t; we decide to close the gap. |
| **Differentiate** | We respond by strengthening our difference (positioning, messaging, feature set). | We don’t copy; we double down on what makes us different. |
| **Ignore** | No change; we accept the gap for now. | Low impact or out of scope; document and revisit later. |
| **Accelerate** | We respond by moving an existing plan forward (roadmap, launch, campaign). | We already had it planned; we speed up. |
| **Counter** | We respond with a distinct move (e.g. different feature, guarantee, pricing angle). | We don’t match directly; we counter with our own strength. |

*Refine these with manager; add or rename as needed.*

---

## 3. Response record (per competitor action / gap)

Each “how we respond” entry in the schema has this shape:

| Field | Type | Description |
|-------|------|-------------|
| `response_id` | string | e.g. `resp-2025-02-001` |
| `gap_id` | string | Links to the gap (or competitor action) we’re responding to |
| `competitor_action` | string | Short label of what they did (e.g. "Launched 24/7 live chat") |
| `response_type` | string | One of: match, differentiate, ignore, accelerate, counter |
| `rationale` | string | Why we respond this way (1–2 sentences) |
| `actions` | array of strings | Concrete steps (e.g. "Add live chat to roadmap", "Ship by Q2") |
| `timeline` | string | e.g. "Within 2 weeks", "Q2", "No deadline" |
| `priority` | string | high / medium / low (for our response) |
| `owner` | string | Optional: who drives the response (TBD with manager) |
| `impacted_apps` | array of app_id | Optional: which of our apps are impacted (see [impacted-apps-and-previsualization.md](impacted-apps-and-previsualization.md)) |
| `proposed_changes` | array | Optional: per-app proposed changes + pre-visualization (no auto-apply) |

---

## 4. Full response schema (output)

The bot produces a **response schema** for the period: one record per competitor action we’re responding to, ordered by priority.

| Field | Type | Description |
|-------|------|-------------|
| `schema_id` | string | e.g. `response-schema-ProductA-2025-02-24` |
| `product_id` | string | Our product |
| `period_start` / `period_end` | string (ISO date) | Analysis window |
| `responses` | array of response records | How we respond to each relevant competitor action |
| `generated_at` | string (ISO datetime) | When the schema was built |

The weekly newsletter (and Slack) should include a section **“How we respond”** that renders this schema in plain language (see sample below). For each response, the bot can also identify **impacted apps**, **proposed changes per app**, and **pre-visualization** of how the change would look (no automatic changes). See [impacted-apps-and-previsualization.md](impacted-apps-and-previsualization.md).

---

## 5. How the bot develops the schema

1. **Input:** Competitor actions (from tracking) + gaps (market vs us).
2. **For each high/medium-priority gap (or drastic action):** Bot proposes a response type (match, differentiate, ignore, accelerate, counter) using rules or a simple model (e.g. “new feature we don’t have and is in our segment → consider match or accelerate”).
3. **Bot fills response record:** rationale, 1–3 concrete actions, timeline, priority. Owner can be left blank for manager to assign.
4. **Output:** Response schema (machine-readable) + “How we respond” section in the newsletter/Slack.

Rules for assigning response types and actions can be refined with manager (e.g. “we never match on price, only differentiate or counter”).

---

## 6. Sample “How we respond” (newsletter / Slack)

**How we respond this week**

| Competitor action | Our response | Actions | Timeline |
|-------------------|--------------|---------|----------|
| Competitor X launched 24/7 live chat | **Match** — Close the gap; support is a key differentiator in our segment. | 1. Add live chat to roadmap and size effort. 2. Communicate “coming soon” if we can’t ship soon. | Decide within 2 weeks; ship by Q2 if we match. |
| Competitor X updated pricing page (“no credit card”, “cancel anytime”) | **Match** — Align messaging to reduce signup friction. | 1. Refresh pricing page copy with same guarantees where true. 2. Legal to confirm we can promise “cancel anytime”. | Within 2 weeks. |
| Competitor X hiring VP Product (growth/international) | **Differentiate** — We don’t copy their narrative; strengthen our own story (e.g. depth in [region] or [use case]). | 1. Draft one-paragraph positioning for growth/international. 2. Decide if we publish or keep internal. | Low urgency; review in 1 month. |

---

## 7. Where this appears in the product

- **Gap report:** Each gap can reference a `response_id` or the response schema can reference `gap_id` (so gap and response are linked).
- **Weekly newsletter / Slack:** After “What to change this week”, add **“How we respond”** — the table or list above, so managers see both *what* to change and *how* we’re responding to each competitor move.
- **Bot logic:** Implement response-type rules and action templates so the bot can generate the schema automatically from competitor actions + gaps.
- **Impacted apps + pre-visualization:** Bot navigates to our app registry, identifies impacted apps per competitor action, proposes changes per app, and generates a pre-visualization (how the change would look). Human reviews; nothing is applied automatically. See [impacted-apps-and-previsualization.md](impacted-apps-and-previsualization.md).

---

*Part of the three initiatives plan. See ACTION-PLAN.md.*
