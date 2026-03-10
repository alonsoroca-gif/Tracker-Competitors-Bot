# Impacted apps and pre-visualization — Tracker Bot (Initiative 1)

Beyond suggesting a plan, the bot **navigates to our different apps**, identifies **which ones might be impacted** by a competitor action, **proposes the specific changes** per app, and provides a **pre-visualization** of how those changes would look. **Nothing is changed automatically** — the bot prepares the view; humans review and decide.

---

## 1. Why this matters

- **Concrete, not vague:** Instead of “update pricing copy,” we get “On [Pricing Page app], change hero headline to X and add badge Y.”
- **Impact clarity:** We see exactly which of our surfaces (pricing page, billing UI, homepage, etc.) are affected and what would change on each.
- **Pre-visualization:** Before we touch anything, we see a mock or draft of *how the change would look* (e.g. pricing page with new headline and “Price lock” badge, or demo CTA on homepage). That reduces back-and-forth and speeds approval.
- **No auto-changes:** The bot only **prepares** the view and the proposed diff; a human approves and applies (or delegates to the right team).

---

## 2. Flow (bot behavior)

1. **Competitor action** is detected (e.g. Company X raised prices; Company X launched demo tryouts).
2. **Bot navigates to our apps** — The bot has access to a **registry of our apps** (URLs, app IDs, or internal routes) and can open or query them (read-only): e.g. marketing site, pricing page, billing app, product UI, help center, sales one-pager.
3. **Bot identifies impacted apps** — For this competitor action, which of our apps are relevant? (e.g. “Price increase” → Pricing page, Billing app, Homepage hero; “Demo tryouts” → Pricing page, Homepage, Product signup flow.)
4. **Bot proposes changes per app** — For each impacted app, the bot suggests **concrete changes** (e.g. “Pricing page: add subhead ‘No price increase for existing customers’; add badge ‘Price lock guarantee.’” “Homepage: add CTA ‘Book a demo’ next to ‘Start free trial.’”).
5. **Bot generates pre-visualization** — For each proposed change, the bot produces a **preview of how it would look**: e.g. a mock screenshot, a before/after wireframe, or a rendered draft (new copy + layout hint). Deep actions (e.g. changing prices in the billing app) get a pre-visualization of the billing UI with the proposed new prices or messaging.
6. **Output to human** — Newsletter / Slack / dashboard shows: competitor action → impacted apps → proposed changes per app → **pre-visualization** (link or inline). Human reviews; no automatic deployment.

---

## 3. App registry (what the bot “knows”)

The bot needs a **list of our apps** that it can navigate to and reason about. Each entry might look like:

| Field | Description |
|-------|-------------|
| `app_id` | e.g. `pricing-page`, `billing-app`, `homepage`, `product-signup` |
| `name` | Human-readable name (e.g. "Pricing page", "Billing & subscription") |
| `url_or_route` | Where the app lives (e.g. `https://ourproduct.com/pricing`, or internal path) |
| `surface_type` | e.g. marketing, pricing, product, help, sales-internal |
| `impact_dimensions` | Which competitor dimensions typically affect this app (e.g. pricing, messaging, features) |

When a competitor action is tagged with a dimension (pricing, messaging, features, etc.), the bot uses `impact_dimensions` (or rules) to **select impacted apps** from the registry.

---

## 4. Proposed change (per app)

For each **impacted app** and each **competitor action**, the bot outputs a proposed change record:

| Field | Type | Description |
|-------|------|-------------|
| `change_id` | string | e.g. `ch-pricing-001` |
| `app_id` | string | Which of our apps |
| `competitor_action` / `response_id` | string | Links to the response schema entry |
| `proposed_change` | string | Human-readable: what to change (e.g. "Add headline: 'Price lock for existing customers.' Add badge above CTA.") |
| `location_or_component` | string | Where in the app (e.g. "Hero section", "Pricing table", "Footer CTA") |
| `current_state` | string | Optional: what it says or looks like today (or a snapshot ref) |
| `proposed_state` | string | Optional: exact copy or spec for the new state |
| `pre_visualization` | object or link | See section 5 |

---

## 5. Pre-visualization

For each proposed change, the bot provides a **pre-visualization** so we can see how it would look without applying anything.

| Type | Description | Example |
|------|-------------|---------|
| **Copy draft** | Proposed text only (headline, CTA, body). | "Hero: 'Same great product. No price increase.' Subhead: 'We're holding our prices for existing customers.'" |
| **Wireframe / mock** | Simple layout: where the new element goes (e.g. "Badge above primary CTA"). | ASCII or Mermaid layout, or link to Figma/mock. |
| **Rendered preview** | Bot generates a one-off render (e.g. HTML + CSS or screenshot-style image) of the app with the proposed change applied. | "Pricing page — with new headline and 'Price lock' badge" (link to preview URL or image). |
| **Deep action preview** | For deeper changes (e.g. new price in billing): mock of the billing UI or pricing table with new values. | "Billing app — proposed new Pro tier at $49/mo" (table or screenshot). |

**Implementation note:** Pre-visualization can be: (a) static mocks produced by the bot from templates, (b) a "preview" environment where the bot pushes a branch or draft and the link is shared, or (c) a side-by-side "before (current) vs after (proposed)" view. No automatic merge or deploy.

---

## 6. Full output shape (response + impacted apps + pre-visualization)

For each competitor action, the bot can output:

1. **Response schema** (as today): response type, rationale, actions, timeline.
2. **Impacted apps:** List of `app_id` and app name.
3. **Proposed changes per app:** For each impacted app, one or more proposed changes (location, current vs proposed, link to pre-visualization).
4. **Pre-visualization:** Per change (or per app), a link or inline preview: "How this would look if we applied the change."

**Nothing is applied automatically.** The human (or owner) reviews the pre-visualization and the proposed change, then approves, edits, or rejects. The bot is **prepared to provide that view** on demand (e.g. in the weekly report or when opening a specific competitor action in a dashboard).

---

## 7. Where this appears in the product

- **Weekly newsletter / Slack:** After “How we respond,” add **“Impacted apps & preview”**: for each competitor action, list impacted apps and link to pre-visualization (e.g. “Pricing page — see preview”).
- **Dashboard (future):** Click a competitor action → see impacted apps → click an app → see proposed change + pre-visualization; approve or dismiss.
- **Response record (schema):** Extend with optional `impacted_apps`, `proposed_changes[]`, and `pre_visualization_url` (or embed a small preview).

---

## 8. Summary

| Step | Bot does | Human does |
|------|----------|------------|
| 1 | Detect competitor action | — |
| 2 | Navigate to our app registry; identify impacted apps | — |
| 3 | Propose concrete changes per app (location, current → proposed) | — |
| 4 | Generate pre-visualization (copy draft, mock, or rendered preview) | — |
| 5 | Surface response + impacted apps + proposed changes + pre-visualization in report or dashboard | Review pre-visualization; approve, edit, or reject; apply change in the real app (or delegate). |

**No automatic changes.** The bot prepares the view; we decide what to ship.

---

*Part of the three initiatives plan. See [response-schema.md](response-schema.md) and ACTION-PLAN.md.*
