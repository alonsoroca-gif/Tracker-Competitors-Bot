# Marketplace — Fit matrix

Table: **Our product / Marketplace capability** — what fits today, what’s missing, what we’d need to build. To be updated after syncing with your coworker.

---

## 1. Tracker Bot

| Capability | Fits today? | Missing / gap | We need to build |
|------------|-------------|----------------|------------------|
| **List Tracker as a product** | [ ] Yes / [ ] Partial / [ ] No | e.g. No “report” listing type | e.g. Custom listing schema or use “workflow” type |
| **User subscribes to weekly report** | [ ] Yes / [ ] Partial / [ ] No | e.g. No subscription billing or no “recurring run” | e.g. Cron + marketplace webhook to record delivery |
| **User triggers “Get latest report”** | [ ] Yes / [ ] Partial / [ ] No | e.g. No “run” action in marketplace | e.g. “Run” button that calls our API and shows result |
| **Report appears in marketplace** | [ ] Yes / [ ] Partial / [ ] No | e.g. No “deliverable” storage or link display | e.g. We host report URL; marketplace shows link |
| **Report also to Slack** | N/A (our side) | — | We keep Slack delivery; marketplace is additional channel |
| **Auth / identity** | [ ] Yes / [ ] Partial / [ ] No | e.g. Marketplace doesn’t pass user to us | e.g. OAuth or API key to map “marketplace user” to Slack/destination |

*Fill “Fits today?” and “Missing / gap” with coworker; then set “We need to build” per row.*

---

## 2. ProspectPortal

| Capability | Fits today? | Missing / gap | We need to build |
|------------|-------------|----------------|------------------|
| **List ProspectPortal as a product** | [ ] Yes / [ ] Partial / [ ] No | e.g. No “one-time deliverable” type | e.g. Use “workflow” or “app” listing |
| **User starts flow (link + 3 questions)** | [ ] Yes / [ ] Partial / [ ] No | e.g. No embedded form or redirect to our UI | e.g. Iframe of our flow or deep link + return URL |
| **Generated site as deliverable** | [ ] Yes / [ ] Partial / [ ] No | e.g. No file/asset upload or preview URL | e.g. We host preview + ZIP; marketplace shows link or stores asset |
| **User downloads or accesses preview** | [ ] Yes / [ ] Partial / [ ] No | e.g. No “download” or “open link” in listing | e.g. Marketplace shows “Preview” and “Download” from our API |
| **Billing for one-off generation** | [ ] Yes / [ ] Partial / [ ] No | e.g. Marketplace only supports subscriptions | e.g. Per-use billing or external payment; document for coworker |

*Fill “Fits today?” and “Missing / gap” with coworker; then set “We need to build” per row.*

---

## 3. Cross-cutting (both products)

| Capability | Fits today? | Missing / gap | We need to build |
|------------|-------------|----------------|------------------|
| **API for “list my products”** | [ ] Yes / [ ] Partial / [ ] No | | |
| **API for “trigger product X”** | [ ] Yes / [ ] Partial / [ ] No | | |
| **API for “deliver result (link/file)”** | [ ] Yes / [ ] Partial / [ ] No | | |
| **Webhooks (marketplace → us)** | [ ] Yes / [ ] Partial / [ ] No | | |
| **Auth (marketplace user → our system)** | [ ] Yes / [ ] Partial / [ ] No | | |

*Fill with coworker; then decide what we build on our side.*

---

## 4. Summary (to update after sync)

- **Best fit today:** [e.g. “Listing both products; Tracker as subscription with link to report.”]
- **Largest gaps:** [e.g. “No on-demand run; no deliverable storage.”]
- **Recommended first integration:** [e.g. “Tracker: list + link to last report; ProspectPortal: list + link to our flow, result via our preview URL.”]

---

*Part of the three initiatives plan. See [ACTION-PLAN.md](../ACTION-PLAN.md).*
