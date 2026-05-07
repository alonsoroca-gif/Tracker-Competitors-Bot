# Manager interpretation — `2026-05-04T19-37-46Z`

Pricing rows **skipped** per **TRACKER-EXTERNAL-ONBOARDING.md** Part **4.2** manager filter.  
**entrata-core** spot-check path used: **`/Users/alonso.roca/Desktop/Core Repo/entrata-core/`**.

## A) MAIN MOVE (Prospect / CRM / AI automation)

1. **EliseAI** — Blog claims **24/7 live chat**; marketing still centers **one assistant across messaging channels**. Core already exposes **Prospect Portal live-chat guest-card** + **Live Chat module** backed by **`CEntrataChat`** chatrooms (`AssignApplicationModules` → `CEntrataLiveChatController`).
2. **Funnel Leasing** — Homepage marketing cites **AI vs non‑AI tour conversion** and bundles **Prospect/resident AI + Voice AI + applications/fraud**.
3. **LeaseHawk (ACE)** — Positions **AI Assistant + leasing + resident automation**, explicitly **calls logged into CRM**.

## B) FEATURE TABLE

| Competitor | Feature | Citation (`source` · date · excerpt ≤25 words) |
|------------|---------|--------------------------------------------------|
| EliseAI | 24/7 live chat shipped | blog · 2026-05-02 · "Launched 24/7 live chat support." |
| EliseAI | One assistant across channels | features_page · 2026-05-04 · "Multiple Channels, One AI Assistant" |
| EliseAI | Engineering hires around AI automation scale | careers · 2026-05-04 · "Detected hiring focus: engineering… Built to Automate & Scale" |
| Funnel Leasing | Public AI vs non-AI tour conversion stat | features_page · 2026-05-04 · "AI-handled prospects… vs 19% tour conversion for non-AI" |
| Funnel Leasing | Voice AI + Insights line | features_page · 2026-05-04 · "Voice AI + Insights" |
| Funnel Leasing | Applications + fraud in suite | features_page · 2026-05-04 · "Applications + fraud" |
| LeaseHawk (ACE) | AI assistant call auto-logged in CRM | features_page · 2026-05-04 · "Call Is Logged in the CRM" |
| LeaseHawk (ACE) | Resident Automation as separate pillar | features_page · 2026-05-04 · "Resident Automation" |
| Anyone Home | Trade-show AI leasing tech story | features_page · 2026-05-04 · "Apartmentalize… New Leasing Technology AI Innovations" |
| Anyone Home | Tour scheduler + self-guided tours + leasing call analysis | features_page · 2026-05-04 · "Tour Scheduler, Self-Guided Tours… Leasing Call Analysis" |

Jonah Digital has **empty** extracted `features` in this drop — **no row** here.

---

## § Feature response prototype

Each line **2** uses **`Target:`** / **`Status:`** / **`Action:`** per onboarding Part **4.4**.

### Row 1 — EliseAI: 24/7 live chat

1. Competitor — **Prospect/live chat always on**
2. **Target:** Prospect Portal › Live Chat & guest-card (`live_chat_guest_card` → **`CEntrataLiveChatController`**, **`CEntrataChat`**) **`Status:`** Existing in core (**plumbing**, not SLA-proven from code) **`Action:`** Product/implementation verify real “always-on” semantics (staffed vs autonomous bot; routing); refresh external battle‑card wording only after that check.
3. **Evidence cited:** `signals.json` blog · 2026-05-02; core anchors: `Applications/ProspectPortal/Application/CProspectPortalApp.class.php` (**`live_chat_guest_card`**), `…/AssignApplicationModules.php` (**`CEntrataLiveChatController`**), `Libraries/Psi/PsiXmPhp/CEntrataChat.class.php`.

### Row 2 — EliseAI: multi-channel assistant

1. Competitor — **Unified assistant spanning SMS/email/chat/etc.**
2. **Target:** Applications / Prospect CRM › multi-channel ingestion & prefs (`incoming_chat`, `incoming_sms`, email in agent reports; **`CApplicant`** `boolIsLiveChat`/`CHAT`/WhatsApp branching) **`Status:`** **Existing** platform pattern for omnichannel leasing comms **`Action:`** PM/tech‑writing: articulate how **conversation identity** persists across SMS/email/chat vs. competitor “one assistant” slogan—narrow **Gap** only if roadmap lacks **shared conversational context** layer (not surfaced in quick grep—phase with architecture review).
3. **Evidence cited:** signals `features_page` excerpt; core: `Libraries/Psi/Reports/CustomReports/CAgentPerformance1_1Report.class.php` (lead-source columns incl. chat/SMS).

### Row 3 — EliseAI: scaling engineering hires

1. Competitor — **Heavy eng investment in automation**
2. **Target:** (Org capacity / hiring — **no shipped SKU**) **`Status:`** Needs verification **HR/signal-only** **`Action:`** Competitive intel bullet for leadership; **not** a backlog item unless roadmap ties to a labelled release.
3. **Evidence cited:** careers row 2026-05-04.

### Row 4 — Funnel: published conversion uplift

1. Competitor — **Marketing benchmark: AI-assisted tour conversion uplift**
2. **Target:** RevOps / product marketing analytics—**outside** entrata‑core codebase **`Status:`** **Gap** vs. public-ready stat **`Action:`** If policy allows: produce **instrumented** counterpart from production (AI-assisted vs. non-AI tour outcomes) packaged for sales—not a vague dev ticket.
3. **Evidence cited:** signals `features_page` 2026-05-04.

### Row 5 — Funnel: Voice AI + Insights

1. Competitor — **Named Voice AI + Insights SKU**
2. **Target:** VoIP / Telephony › call ingest + **`call_analysis_status_type_id`** analysis states (`CCalls`). **`Status:`** Existing pipeline in core; parity depth **Needs verification** in customer-facing SKU naming. **`Action:`** Packaging: align outbound naming with “Voice AI + Insights” if telephony/analysis is already surfaced in production UI under different labels; open a **narrow** roadmap item only after demo gap review.
3. **Evidence cited:** signals 2026-05-04; core: `Psi/Eos/Voip/CCalls.php` (`fetchCallsByCallAnalysisStatusTypeId` …).

### Row 6 — Funnel: Applications + fraud

1. Competitor — **Application bundle with fraud**
2. **Target:** Applications › Screening / ResidentVerify › **ID & income flows** (**`identity_verification`**, income verification adapters, **`CApplicants`** duplicate detection tooling) **`Status:`** **Existing** primitives for identity / income / duplicate applicants—not guaranteed to mirror “fraud SKU” wording **`Action:`** Inventory what is **sold today** vs. dormant code; roadmap only for **explicit fraud scoring** SKU if genuinely absent commercially.
3. **Evidence cited:** signals 2026-05-04; core glimpses: `Psi/Eos/Entrata/CApplicants.php` (`fetchDuplicateApplicants`), screening / Plaid adapters.

### Row 7 — LeaseHawk: CRM call logging

1. Competitor — **Every AI call writes to CRM**
2. **Target:** VoIP / Telephony › persisted calls + analysis metadata (**`calls`**, `call_analysis_*` enums in **`CCalls`**) and CRM-visible timeline (UI linkage not validated in this pass). **`Status:`** Existing data model / analysis enums; UX mapping **Needs verification**. **`Action:`** Sales/engineering pairing: cite automatic call persistence + analysis in deals; optionally attach UI proof in a follow-up pass.
3. **Evidence cited:** signals 2026-05-04; core: `Psi/Eos/Voip/CCalls.php` (calls + analysis statuses).

### Row 8 — LeaseHawk: Resident Automation track

1. Competitor — **Separate resident automation storyline**
2. **Target:** Leasing/resident workflows (beyond quick search) **`Status:`** Needs verification—is this **marketing packaging** vs. net-new SKU **`Action:`** Map resident lifecycle automations Entrata already sells (**renewals, messaging, portals**) vs. LeaseHawk’s label; prioritize **sales enablement**, not greenfield engineering until mapped.
3. **Evidence cited:** signals 2026-05-04.

### Row 9 — Anyone Home: conference showcase

1. Competitor — **Conference visibility for leasing AI innovations**
2. **Target:** Events / roadmap narrative—non-code **`Status:`** Competitive noise unless tied to SKU **`Action:`** Defer backlog; optional events response.
3. **Evidence cited:** signals 2026-05-04.

### Row 10 — Anyone Home: tour tech + leasing call analysis

1. Competitor — **Tour scheduling + self-guided + call analysis packaged**
2. **Target:** Marketing / Leasing Center widgets › **`SHOW_SELF_GUIDED_TOUR_TYPE` / `SELF_GUIDED_TOUR_*`** (**`CMcbWidget`**, **`CPropertyHelper`**) plus VoIP › **`CCalls`** analysis. **`Status:`** Existing capabilities in codebase; bundled **SKU story** vs. competitor may be **Gap (packaging)**. **`Action:`** PM/marketing collapse tour + self-guided + VoIP analytics into one buyer-facing pillar similar to excerpt—avoid net-new Core work until packaging review says otherwise.
3. **Evidence cited:** signals 2026-05-04; core: `Libraries/Psi/PortalData/CMcbWidget.class.php` (self-guided prefs), VoIP **`CCalls`**.

---

## Prioritization (manager view)

| Tier | Rows | Rationale |
|------|------|-----------|
| **Now** | 1, 4, 7 | Chat parity narrative (verify behaviour), credible numbers for sales defence, VoIP/logging proof |
| **Later** | 2, 5, 6, 8 | Architecture/packaging; deeper fraud story if commercial gap emerges |
| **Won't chase here** | 3, 9 | Signals only (hiring/events) |
