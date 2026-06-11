# Action plan — Three initiatives

This document links to all artifacts produced from the **Three initiatives plan** (Tracker product, ProspectPortal, Marketplace). Use it to navigate deliverables and share with your manager and coworker.

**Running all three on a 24-hour, non-stop basis?** See **[24-7-SUMMARY.md](24-7-SUMMARY.md)** for a one-page summary and **[24-7-DEVELOPMENT-GUIDE.md](24-7-DEVELOPMENT-GUIDE.md)** for the full guide (prerequisites, handoff, status, GAPS, notifications). Task lists: **[initiative-1-tracker/TASKS.md](initiative-1-tracker/TASKS.md)** (Tracker), **ProspectPortal Website** (separate repo — [PROSPECTPORTAL-EXTERNAL.md](PROSPECTPORTAL-EXTERNAL.md)), **Marketplace** (standby — [MARKETPLACE-EXTERNAL.md](MARKETPLACE-EXTERNAL.md)). **Mon–Tue review:** **[MON-TUE-REVIEW.md](MON-TUE-REVIEW.md)**.

---

## Initiative 1: Tracker Bot — from information source to product

**Goal:** Make the Tracker Bot a product (gap analysis + recommended actions), not only a source of information.

| Artifact | Location |
|----------|----------|
| Gap report schema | [initiative-1-tracker/gap-report-schema.md](initiative-1-tracker/gap-report-schema.md) · [initiative-1-tracker/gap-report-schema.json](initiative-1-tracker/gap-report-schema.json) |
| **Response schema (how we respond)** | [initiative-1-tracker/response-schema.md](initiative-1-tracker/response-schema.md) — bot develops schema for *how we respond* to competitor actions (high priority). |
| **Impacted apps + pre-visualization** | [initiative-1-tracker/impacted-apps-and-previsualization.md](initiative-1-tracker/impacted-apps-and-previsualization.md) — bot navigates to our apps, identifies impacted ones per competitor action, proposes changes per app, and shows how the change would look (no auto-changes). |
| “What to change” block | [initiative-1-tracker/what-to-change-block.md](initiative-1-tracker/what-to-change-block.md) |
| First-version demo | [initiative-1-tracker/first-version-demo.md](initiative-1-tracker/first-version-demo.md) |

**Next:** Present first version to manager; iterate on dimensions and priority rules.

---

## Initiative 2: ProspectPortal — compelling bot that creates client websites

**Goal:** A new product: a bot that creates whole websites (with CSS and compelling models) from one link + 3 key questions.

**Repo (separate from Tracker):** `prospectportal-website` — `~/Developer/alonso-workspace/repos/prospectportal-website`. Open via **`~/Developer/alonso-workspace/alonso.code-workspace`**.

| Artifact | Location |
|----------|----------|
| README + tasks | `prospectportal-website/README.md`, `TASKS.md` |
| Cowork sessions | `prospectportal-website/docs/COWORK-SESSIONS.md` |
| React prototype | `prospectportal-website/prototypes/website-draft-pipeline/` (symlinked into Product OS) |

**Next:** Per-template intake forms + Cowork Session S1 demo. See [PROSPECTPORTAL-EXTERNAL.md](PROSPECTPORTAL-EXTERNAL.md).

---

## Initiative 3: Marketplace — flow of our product in the coworker’s marketplace

**Goal:** Investigate how Tracker and/or ProspectPortal can be performed inside the marketplace.

**Status:** **Standby / future.** Separate repo: `~/Developer/alonso-workspace/repos/marketplace-integration` (GitHub: `marketplace-integration`). See [MARKETPLACE-EXTERNAL.md](MARKETPLACE-EXTERNAL.md).

**Next (when resumed):** Sync with marketplace coworker (M1 in marketplace TASKS.md); then minimal “Get latest Tracker report” integration stub.

---

## How the three relate

- **Initiative 1** delivers the Tracker as a product (newsletter + gap + recommendations).
- **Initiative 2** defines ProspectPortal (link + 3 questions → generated website).
- **Initiative 3** investigates how both (or either) can be listed, triggered, or delivered inside the coworker’s marketplace.

See the plan file for the full flow and key information to capture for each initiative.
