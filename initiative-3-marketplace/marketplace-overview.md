# Marketplace — Overview

Short doc: purpose, users, listing types, key actions. **Source:** To be filled and validated with your coworker building the marketplace. This is a template so you can align and document.

---

## 1. Purpose

- **What is the marketplace?** A place where [internal teams / external buyers / both] can discover, acquire, or run [products / services / reports / workflows].
- **Why does it exist?** [e.g. centralize internal tools, monetize offerings, reduce friction to adopt Tracker or ProspectPortal.]
- **One-line:** [e.g. “Internal marketplace for our product suite and partner offerings.”]

*To complete: sync with coworker.*

---

## 2. Users

| Role | Who | Main action |
|------|-----|-------------|
| **Buyer / consumer** | [e.g. internal PMs, external clients] | Discover and use products (subscribe, run, download). |
| **Seller / provider** | [e.g. product teams, partners] | List and fulfill products. |
| **Admin** | [e.g. platform owner] | Configure catalog, access, billing. |

*To complete: sync with coworker.*

---

## 3. Listing types

How is a “product” defined in the marketplace?

| Type | Description | Example |
|------|-------------|---------|
| **Subscription** | Recurring access (e.g. weekly Tracker report). | Tracker Competitors Bot — weekly report. |
| **One-time deliverable** | Single artifact (e.g. one report, one generated site). | ProspectPortal — one generated site. |
| **Workflow / action** | User triggers a run (e.g. “Run Tracker now,” “Generate site”). | Click to run Tracker; result appears in marketplace or Slack. |
| **App / embed** | Product runs inside the marketplace UI (iframe or embedded experience). | Tracker dashboard embedded in marketplace. |

*To complete: which of these (or others) does the coworker’s marketplace support?*

---

## 4. Key actions (user journey)

| Step | Action | Notes |
|------|--------|-------|
| **Discovery** | Browse or search listings. | By product name, category, or use case. |
| **Choose** | Select a product (e.g. Tracker weekly report, ProspectPortal). | May see pricing, description, SLA. |
| **Acquire** | Subscribe, purchase, or “Run.” | Depends on listing type. |
| **Fulfillment** | Receive output. | E.g. report in Slack, link in marketplace, download, or embedded view. |
| **Manage** | Cancel, change plan, or run again. | For subscriptions or repeat workflows. |

*To complete: sync with coworker on actual flows (e.g. approval, billing).*

---

## 5. Technical touchpoints (to clarify with coworker)

- **APIs:** Does the marketplace expose APIs for listing, triggering, or delivering results? (e.g. “Create listing,” “Trigger product X,” “Upload deliverable.”)
- **Webhooks:** Can our products (Tracker, ProspectPortal) receive events from the marketplace? (e.g. “User requested report.”)
- **Auth:** How do users authenticate? Can our products verify “marketplace user” and pass through identity?
- **Hosting:** Where does the marketplace run (internal URL, public)? Where do deliverables live (marketplace storage, our URLs, Slack)?

*To complete: gather from coworker and add links or specs.*

---

## 6. Open questions

- Is the marketplace internal-only, external, or both?
- What is the roadmap timeline (e.g. MVP by when, which listing types first)?
- Who owns listing creation for Tracker and ProspectPortal (us vs marketplace team)?

---

*Part of the three initiatives plan. See [ACTION-PLAN.md](../ACTION-PLAN.md).*
