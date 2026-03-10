# Marketplace — Key info summary (1–2 pages)

Findings, recommended integration approach, next steps, and owners. Update this after syncing with your coworker and completing the fit matrix and prototype.

---

## 1. Findings

### Marketplace (from overview + coworker sync)

- **Purpose:** [One line: what the marketplace is for.]
- **Users:** [Who uses it: internal, external, both.]
- **Listing types:** [What can be listed: subscription, one-time, workflow, app/embed.]
- **Key actions:** [Discovery → choose → acquire → fulfillment → manage.]
- **APIs / extension points:** [What the marketplace exposes: list product, trigger, deliver, webhooks, auth. Or “TBD.”]
- **Roadmap / timeline:** [e.g. MVP by Q2; which features when.]

### Our products (Tracker, ProspectPortal)

- **Tracker:** Output = weekly report (Slack + optional link). Trigger = schedule or on-demand. Input = product/competitor config (already in our system).
- **ProspectPortal:** Output = generated site (preview URL + download). Trigger = user starts flow. Input = link + 3 questions.

### Fit (from fit matrix)

- **What fits today:** [e.g. We can list both; marketplace can show a link to Tracker report and link to ProspectPortal flow.]
- **What’s missing:** [e.g. No “run” button, no deliverable storage, no per-use billing for ProspectPortal.]
- **What we’d need to build:** [e.g. API for “latest report”; host report URL; ProspectPortal return URL to marketplace after generation.]

---

## 2. Recommended integration approach

### Phase 1 (minimal, recommended first)

- **Tracker:** List “Tracker Competitors Bot – Weekly report” in the marketplace. User can click “Get latest report” and get a link to the last report (we host the report; marketplace shows the link). Optional: “Subscribe” = we add user/org to Slack delivery list.
- **ProspectPortal:** List “ProspectPortal – Generate a site” in the marketplace. User clicks through to our flow (link + 3 questions). After generation, we redirect back to marketplace with preview link and download; marketplace shows “Your site is ready” and link.
- **No billing in phase 1** if marketplace doesn’t support it yet; focus on flow and UX.

### Phase 2 (after marketplace capabilities are clear)

- **Tracker:** On-demand “Run Tracker” from marketplace; report appears as marketplace asset or link. Subscription and billing if marketplace supports it.
- **ProspectPortal:** Embedded flow in marketplace (iframe or native form); generated site stored as marketplace asset; per-use or subscription billing.
- **Auth:** Marketplace passes user/org to us so we can scope reports and associate generated sites.

### Phase 3 (optional)

- **Tracker:** Embedded dashboard or report view inside marketplace.
- **ProspectPortal:** In-marketplace editor for generated site (edit and re-export).

---

## 3. Next steps

| Step | Owner | By when |
|------|--------|---------|
| Sync with coworker: fill [marketplace-overview.md](marketplace-overview.md) and [fit-matrix.md](fit-matrix.md). | [You / coworker] | [Date] |
| Implement minimal prototype: Tracker “Get latest report” (stub API + mock or real marketplace UI). | [Dev / you] | [Date] |
| Demo prototype to manager and coworker; agree on phase 1 scope. | [You] | [Date] |
| Document marketplace API (or get doc from coworker); define our API for “latest report” and ProspectPortal return URL. | [You / coworker] | [Date] |
| If phase 1 approved: implement Tracker report link in real marketplace; then ProspectPortal link + return flow. | [Dev] | [Date] |

*Fill owners and dates.*

---

## 4. Open questions

- Which product(s) go live first in the marketplace: Tracker only, ProspectPortal only, or both?
- Who creates and maintains the listings (us vs marketplace team)?
- Where do deliverables live: our URLs only, or does marketplace store copies (e.g. for compliance or offline access)?
- Legal/compliance: If marketplace is external, any constraints on data, branding, or billing we must meet?

---

## 5. References

- [Marketplace overview](marketplace-overview.md)
- [Our flow in marketplace (diagram)](our-flow-in-marketplace.md)
- [Fit matrix](fit-matrix.md)
- [Minimal integration prototype](minimal-integration-prototype.md)
- [ACTION-PLAN.md](../ACTION-PLAN.md)

---

*Part of the three initiatives plan. See [ACTION-PLAN.md](../ACTION-PLAN.md).*
