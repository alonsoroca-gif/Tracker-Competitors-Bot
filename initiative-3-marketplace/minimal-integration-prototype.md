# Marketplace — Minimal integration prototype

One end-to-end path to show how our product flow is **performed in the marketplace**. This doc describes the prototype (and can be implemented as mock UI + real or stubbed API).

---

## 1. Chosen path: Tracker report as marketplace deliverable

**Rationale:** Tracker already has a clear output (weekly report + gap + recommendations). The minimal prototype is: **user clicks in marketplace → sees last Tracker report (or requests it) → result appears in marketplace.**

- **Listing:** One marketplace listing: “Tracker Competitors Bot – Weekly report.”
- **User action:** “Get latest report” or “View last report.”
- **Our side:** Tracker runs on schedule (or on-demand via API). We expose a “last report” URL or JSON (e.g. report ID, link to HTML/PDF, summary).
- **Marketplace:** Displays the link or embeds the report (iframe or redirect). No billing in prototype; focus is flow.

---

## 2. Prototype scope

| Component | Implementation (minimal) |
|-----------|--------------------------|
| **Marketplace listing** | Mock: one card “Tracker Competitors Bot” with button “Get latest report.” (Or real listing if coworker provides test env.) |
| **Button / trigger** | “Get latest report” calls our API (or stub). Stub returns a fixed “last report” URL and summary. |
| **Our API (stub)** | `GET /api/tracker/latest-report` returns `{ report_id, report_url, period, summary }`. Real implementation would run Tracker or fetch last run from DB. |
| **Marketplace result** | After “Get latest report,” marketplace shows: “Your report is ready” + link to open report + short summary. Optionally embed report in iframe. |
| **Auth** | Optional in prototype: no auth, or single API key. Real version: marketplace passes user/org; we map to Slack or report access. |

---

## 3. User flow (prototype)

1. User opens marketplace and sees listing **Tracker Competitors Bot – Weekly report**.
2. User clicks **Get latest report**.
3. Marketplace calls our stub: `GET /api/tracker/latest-report`.
4. We return: `{ report_url: "https://...", period: "2025-02-17 to 2025-02-24", summary: "3 gaps; 2 high-priority recommendations." }`.
5. Marketplace shows: “Report ready for 17–24 Feb 2025. [Open report] Summary: 3 gaps; 2 high-priority recommendations.”
6. User clicks **Open report** and sees the report (hosted by us or static HTML for demo).

---

## 4. Stub API contract (for implementer)

**Endpoint:** `GET /api/tracker/latest-report`

**Response (200):**
```json
{
  "report_id": "gap-report-ProductA-2025-02-24",
  "report_url": "https://our-domain/reports/gap-report-ProductA-2025-02-24",
  "period_start": "2025-02-17",
  "period_end": "2025-02-24",
  "summary": "3 gaps (1 high, 1 medium, 1 low); 2 high-priority recommendations.",
  "generated_at": "2025-02-24T08:00:00Z"
}
```

**Optional (later):** Query params `product_id`, `format=html|pdf`; auth header from marketplace.

---

## 5. Mock UI (marketplace side)

If the marketplace is not yet built or we demo standalone:

- **Page 1:** “Marketplace” title + one card: “Tracker Competitors Bot – Weekly report” + “Get latest report” button.
- **Page 2 (after click):** “Your report is ready. Period: 17–24 Feb 2025. Summary: 3 gaps; 2 high-priority recommendations. [Open report] [Back to marketplace].”
- **Open report:** Opens `report_url` in new tab (or iframe). Report can be the sample from [first-version-demo.md](../initiative-1-tracker/first-version-demo.md) as static HTML.

---

## 6. What “done” looks like for this prototype

- [ ] Stub API (or real Tracker endpoint) returns latest report info.
- [ ] Mock marketplace UI (or real marketplace) has one listing and “Get latest report” that calls our API and shows result.
- [ ] User can open the report from the marketplace in one click.
- [ ] Documented in [key-info-summary.md](key-info-summary.md) and shared with coworker.

---

*Part of the three initiatives plan. See [ACTION-PLAN.md](../ACTION-PLAN.md).*
