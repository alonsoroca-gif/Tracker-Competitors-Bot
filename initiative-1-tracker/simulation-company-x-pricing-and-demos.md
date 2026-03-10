# Simulation: Company X — Price increase + demo tryouts

**Scenario:** Company X (competitor) has two moves in the same period: (1) **raising their prices**, and (2) **providing demo tryouts** for their products. Below is our **response schema**, **impacted apps**, **proposed changes per app**, and **pre-visualization** of how changes would look — as the Tracker Bot would output them. The bot navigates to our apps, identifies which are impacted, proposes concrete changes, and prepares a preview; **nothing is changed automatically**. See [response-schema](response-schema.md), [impacted-apps-and-previsualization](impacted-apps-and-previsualization.md), and [first-version-demo](first-version-demo.md).

---

## 1. Competitor signals (input)

| Date | Source | Signal |
|------|--------|--------|
| This week | Company X pricing page / announcement | **Price increase:** Plans or tiers went up (e.g. +15–20%). |
| This week | Company X product / marketing | **Demo tryouts:** New offer: prospects can request a live or self-serve product demo before buying. |

---

## 2. Gaps (market vs us)

| Gap ID | Dimension | Title | Description | Priority |
|--------|-----------|-------|-------------|----------|
| gap-x-001 | pricing | Company X price increase | Company X raised prices; we haven’t. Creates a positioning gap (they’re signaling premium; we may look “cheap” or “commodity” if we stay silent). | high |
| gap-x-002 | features / offer | Demo tryouts | Company X now offers demo tryouts; we may not have a comparable low-friction way to try the product. | high |

---

## 3. How we respond (response schema)

| Competitor action | Our response type | Rationale | Actions | Timeline |
|-------------------|-------------------|-----------|---------|----------|
| **Company X raised prices** | **Differentiate** or **Counter** | We don’t automatically match their price increase. We turn it into a **positioning moment**: either (a) **Differentiate** — “We’re the better value; same outcomes, clearer pricing,” or (b) **Counter** — hold our prices and message “No price increase for our customers” / “Price lock for existing customers.” If we were already planning a price change, **Accelerate** and tie it to more value (e.g. new features, support). | 1. **Decide stance:** Match (raise ours), Differentiate (value message), or Counter (freeze + “no increase” message). 2. If Differentiate/Counter: update homepage and pricing copy to stress value, transparency, or price stability. 3. If we have existing customers: consider “price lock” or early communication so we don’t surprise them. 4. Sales/CS talking points: how to answer “Company X raised prices; will you?” | **Within 2 weeks:** Decide and publish internal stance. **Within 4 weeks:** Messaging live (pricing page, sales one-pager). |
| **Company X offering demo tryouts** | **Match** or **Accelerate** | Demos reduce friction and are table stakes in many segments. If we don’t have demos, **Match** (launch a comparable offer). If we already had demos or trials on the roadmap, **Accelerate** and ship (or make them more visible). | 1. **Assess current state:** Do we already offer demos, free trials, or sandbox? If yes, make them more prominent and match their “demo tryout” framing. 2. If no: scope a “demo tryout” (live demo booking and/or self-serve demo environment). 3. Add a clear CTA on pricing and homepage: “Book a demo” or “Try a demo.” 4. Align with Sales: who runs demos, SLA for follow-up. | **Within 2 weeks:** Decide demo format (live vs self-serve). **Within 4–6 weeks:** Demo tryout live and linked from pricing/marketing. |

---

## 4. Impacted apps and proposed changes (with pre-visualization)

The bot **navigates to our apps**, finds which are impacted by each competitor action, **proposes the exact changes** per app, and provides a **pre-visualization** of how it would look. No automatic changes — we review and approve.

### 4.1 Company X raised prices

**Impacted apps (bot-selected):**

| App ID | App name | Why impacted |
|--------|----------|---------------|
| `pricing-page` | Marketing — Pricing | Main surface for price messaging and “price lock” or value copy. |
| `homepage` | Marketing — Homepage | Hero or trust strip may need a “No price increase” or value message. |
| `billing-app` | Product — Billing & subscription | If we ever match with a price change, tiers and amounts live here; pre-visualization can show proposed prices. |
| `sales-one-pager` | Internal — Sales one-pager | Sales needs updated talking points and optional “price lock” slide. |

**Proposed changes per app + pre-visualization:**

| App | Location / component | Current (example) | Proposed change | Pre-visualization |
|-----|----------------------|-------------------|------------------|--------------------|
| **Pricing page** | Hero headline | “Plans that scale with you” | Add subhead: “No price increase for existing customers. We’re holding our prices.” Add small badge above CTA: “Price lock guarantee.” | **Preview:** [Pricing page — with “Price lock” subhead and badge]. Mock: hero unchanged; below title, new line: “No price increase for existing customers.” Badge above primary CTA. |
| **Pricing page** | Trust line under CTA | (none or generic) | Add one line: “Cancel anytime. No hidden fees.” (if we counter/differentiate) | **Preview:** Same layout; one extra line under the main CTA. |
| **Homepage** | Hero or strip | Current hero copy | Optional: add a thin strip or one line “Same great product. No price increase.” (if we counter) | **Preview:** [Homepage — with optional strip under hero]. Wireframe: narrow band with short sentence + optional “Learn more” link. |
| **Billing app** | Pricing table (if we match) | Current tiers | *Only if we decide to match:* Proposed new Pro tier at $49/mo (example). Table with old vs new. | **Preview:** [Billing — proposed new Pro tier]. Rendered table: Pro $49/mo, Enterprise custom. “Deep action” preview — no deploy. |
| **Sales one-pager** | Talking points | (existing) | Add bullet: “Company X raised prices; we’re holding ours. Use ‘price lock’ and ‘no increase’ in conversation.” Add optional slide: “Our pricing stance vs Competitor X.” | **Preview:** One-pager PDF or slide mock with new bullet and optional comparison slide. |

---

### 4.2 Company X offering demo tryouts

**Impacted apps (bot-selected):**

| App ID | App name | Why impacted |
|--------|----------|---------------|
| `pricing-page` | Marketing — Pricing | Add “Book a demo” or “Try a demo” CTA next to “Start free trial.” |
| `homepage` | Marketing — Homepage | Primary CTA area: add or promote demo option. |
| `product-signup` | Product — Signup / onboarding | If we add self-serve demo, may need entry point or link from signup flow. |

**Proposed changes per app + pre-visualization:**

| App | Location / component | Current (example) | Proposed change | Pre-visualization |
|-----|----------------------|-------------------|------------------|--------------------|
| **Pricing page** | CTA row | “Start free trial” (primary) | Add secondary button: “Book a demo” (or “Try a demo”). Same row, same style. | **Preview:** [Pricing page — with demo CTA]. Mock: primary “Start free trial”; secondary “Book a demo” next to it. No other layout change. |
| **Homepage** | Hero CTAs | “Get started” / “Sign up” | Add “Or book a 15‑min demo” under primary CTA (link to Calendly or internal booking). | **Preview:** [Homepage — hero with demo link]. Wireframe: primary button unchanged; below it, small text “Or book a 15‑min demo” with link. |
| **Product signup** | Top of signup flow | (e.g. email + plan choice) | Optional: add line “Prefer a guided walkthrough? [Book a demo].” Above or below the form. | **Preview:** [Signup flow — with demo option]. One extra line and link; form unchanged. |

---

**How to read pre-visualization:** Each “[…]” is a link or inline preview the bot would provide (e.g. a generated mock screenshot, a preview URL of a draft page, or a before/after wireframe). Humans review; no automatic deploy to production.

---

## 5. “What to change this week” (Slack / newsletter block)

**How we respond — Company X (price increase + demo tryouts)**  
*Impacted apps and pre-visualization available in report.*

1. **Decide and message our pricing stance** · *Response: Differentiate or Counter*  
   Company X raised prices. We don’t follow by default. Decide: match (raise ours with clear value story), differentiate (stress our value and transparency), or counter (freeze prices and message “no increase”). Then update pricing and sales messaging so we own the narrative.  
   *Source: Company X pricing / announcement* · *Priority: High* · *Timeline: Stance in 2 weeks; messaging in 4 weeks*

2. **Launch or highlight demo tryouts** · *Response: Match or Accelerate*  
   Company X is offering demo tryouts. We respond by having a comparable offer: either launch demos (match) or make existing demos/trials more visible and easy to book (accelerate). Add clear “Book a demo” / “Try a demo” on pricing and homepage.  
   *Source: Company X product / marketing* · *Priority: High* · *Timeline: Format in 2 weeks; live in 4–6 weeks*

---

## 6. Summary (bot-style summary)

- **Company X raised prices** → We **differentiate or counter**: decide our stance (no auto-match), then message value or price stability. High priority; stance in 2 weeks, messaging in 4 weeks.
- **Company X offering demo tryouts** → We **match or accelerate**: ensure we have a visible, comparable demo/tryout offer; ship or promote within 4–6 weeks.

Both responses are high priority because they affect win/loss and positioning in the same buying cycle. The bot attaches: (1) “How we respond” table, (2) “What to change this week” block, and (3) **Impacted apps + proposed changes + pre-visualization** (which of our apps are affected and how each would look if we applied the change). Nothing is changed automatically — the bot is prepared to provide that view for review and approval.

---

*Simulation based on [response-schema.md](response-schema.md), [impacted-apps-and-previsualization.md](impacted-apps-and-previsualization.md), and [first-version-demo.md](first-version-demo.md).*
