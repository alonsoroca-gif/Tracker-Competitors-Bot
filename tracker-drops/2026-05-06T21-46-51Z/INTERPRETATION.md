# Manager interpretation — `2026-05-06T21-46-51Z`

Drop pulled from branch **`agent/P1.1`** (after `git pull origin agent/P1.1`).
Followups checklist applied: [`initiative-1-tracker/docs/FOLLOWUPS-TOMORROW.md`](../../initiative-1-tracker/docs/FOLLOWUPS-TOMORROW.md) §2 (zero-signal lane validation) and §1b (new lane debut).
Pricing rows kept this round because **`pricing_page`** is the new Phase B-2 lane and §A below grades it; future drops can drop to interpretation-only per **TRACKER-EXTERNAL-ONBOARDING.md** Part **4.2**.
**entrata-core** spot-checks **deferred** — this clone (`~/Desktop/Tracker DEMO/`) does not have the multi-root core checkout (`~/Desktop/Core Repo/entrata-core/` from prior interpretation) loaded; rerun §C anchoring in the multi-root workspace.

---

## A) DROP HEALTH — Phase B-2 lane debut

374 signals after prune (253 new this run); **3 pillars touched**: P1=242, P2=88, P3=44 (P4 not collected).
22 unique source URLs across 5 competitors and **10 lanes** (vs. 3 lanes in `2026-05-04T19-37-46Z`).

| Lane | Pillar | Competitors hit | Status | Note |
|------|--------|-----------------|--------|------|
| `features_page` | P1 | all 5 | ✅ | Carries the bulk of marketing claims. |
| `careers` | P2 | eliseai, funnel-leasing | ✅ | Engineering hiring focus on both. |
| `pricing_page` | P2 | leasehawk, anyone-home | ⚠️ packaging-only | Both vendors gate on demo; lane returns homepage **tier language** rather than $ — useful as packaging signal, not price. |
| `case_studies` | P1 | anyone-home (2 URLs), jonah-digital (1) | ⚠️ partial | anyone-home parses 4+3 testimonials cleanly; jonah-digital only returns homepage tagline → **case-study selector tune required** (FOLLOWUPS §1b). |
| `articles_index` | P1 | jonah-digital | ❌ JS-hydrated | "No article cards found in static HTML" — known JS-hydration risk; needs `articles_url` selector revisit or headless rendering. |
| `insights` | P1 | funnel-leasing | ✅ | Forum event recap content present. |
| `media` | P3 | funnel-leasing | ✅ | Tampa Bay Business Journal mention parsed. |
| `g2_reviews` | P3 | eliseai, funnel-leasing | ❌ Cloudflare 403 | Both URLs gated. Matches FOLLOWUPS warning — needs rotating UA / 24h cache. |
| `reviews_other` | P3 | funnel-leasing | ❌ JS-hydrated | featuredcustomers.com returns no review bodies in static HTML. |
| `blog` | P1 | funnel-leasing | ✅ | Two retention/agentic-AI articles parsed. |
| `changelog` (anyone-home) | P1 | — | ❓ no rows this run | `anyonehome-updates.com/feed/` either empty for the window or lane wired but silent — verify on next run. |

**Bottom line for runner:** lanes that return content (`features_page`, `careers`, `pricing_page`, `case_studies` for anyone-home, `insights`, `media`, `blog`) are wired correctly. Three lanes need work before they're trustable: `articles_index`, `reviews_other`, `g2_reviews` (all JS / WAF gates).

---

## B) MAIN MOVE (Prospect / CRM / AI automation + brand)

1. **EliseAI** — datalog now headlines **"Agent by EliseAI: The First Mobile CRM Built for the AI Era"** (P1, 2026-05-04). Same drop confirms careers focus is **engineering automation scale**, and homepage continues "Multiple Channels, One AI Assistant" framing.
2. **Funnel Leasing** — Two new brand/talent moves alongside the existing AI-conversion claim: **Forum event** with **Mia Hamm + Tyler Christiansen** (P1 insights, 2026-05-04) and **Tampa Bay BJ Best Places to Work #11/65** (P3 media, 2026-05-04). Engineering careers page repeats the SKU pillars **"AI + automation • Prospect + resident AI • Voice AI + Insights"**. Developer portal (`developer.funnelleasing.com`) surfaces public **Customer/Partner API** product names — first time this drop captures a public dev surface.
3. **Anyone Home** — `solutions/` page enumerates the SKU stack as a single bundle: **"Self-Guided Tours • Chatbot with Live Chat • Contact Center • Leasing Call Analysis"** plus three audiences (Owners & Managers / Leasing Operators / Marketers). New `case_studies` lane confirms named customers (**Sequoia, TGM, Avanath, Kairoi Residential**) with CRM + Contact Center as the consistent pitch.
4. **LeaseHawk (ACE)** — Single homepage row this drop, repeats prior pillars (**AI Assistant • Leasing Automation • Resident Automation • Call Is Logged in the CRM**). Consistent with the **brand consolidation into Funnel/Fenix** thesis from FOLLOWUPS §4 — revisit in 3–6 months.
5. **Jonah Digital** — `add-ons/` page now in scope (websites + add-on SKUs). Case-studies lane currently only parses the homepage tagline (`builds integrated websites exclusively for multifamily`); the 8 homepage `<blockquote>` testimonials documented in FOLLOWUPS aren't being extracted on this URL — selector regression worth a 30-min fix.

---

## C) FEATURE TABLE

Excerpt ≤25 words, dated, citing `source` (lane).

| Competitor | Feature | Citation (`source` · date · excerpt) |
|------------|---------|--------------------------------------|
| EliseAI | **Agent (Mobile CRM, AI-era)** announced in datalog | features_page · 2026-05-04 · "Introducing Agent by EliseAI: The First Mobile CRM Built for the AI Era" |
| EliseAI | One-assistant-many-channels positioning persists | features_page · 2026-05-04 · "Multiple Channels, One AI Assistant" |
| EliseAI | Engineering hiring focus to scale automation | careers · 2026-05-04 · "Built to Automate & Scale Your Operations" |
| Funnel Leasing | Public AI vs non-AI tour conversion stat (still active) | features_page · 2026-05-04 · "conversion for AI-handled prospects, compared to 19% tour conversion for non-AI handled prospects" |
| Funnel Leasing | Public **developer portal** (Customer & Partner APIs) | features_page · 2026-05-04 · "Integrate with Funnel Leasing • Customer API • Partner API" |
| Funnel Leasing | Forum event (Mia Hamm) — leadership/team-building narrative | insights · 2026-05-04 · "Soccer legend Mia Hamm joined Funnel CEO Tyler Christiansen at Forum" |
| Funnel Leasing | Best Places to Work #11/65 (talent brand) | media · 2026-05-04 · "Funnel Leasing was named to the Tampa Bay Business Journal's Best Places to Work list… ranking No. 11 of 65" |
| Funnel Leasing | Engineering careers reaffirms SKU pillars | careers · 2026-05-04 · "AI + automation • Prospect + resident AI • Voice AI + Insights" |
| Anyone Home | Bundled SKU stack on `/solutions/` | features_page · 2026-05-06 · "Self-Guided Tours • Chatbot with Live Chat • Contact Center • Leasing Call Analysis" |
| Anyone Home | Named customer evidence (CRM + Contact Center) | case_studies · 2026-05-06 · "Sequoia… Anyone Home's CRM and Contact Center helps Sequoia lease smarter" |
| Anyone Home | After-hours service automation story | case_studies · 2026-05-06 · "Avanath's system for fielding and addressing after-hours service-related issues was not ideal. See how Anyone Home helped" |
| LeaseHawk | Resident Automation + CRM-logged calls (unchanged) | features_page · 2026-05-04 · "AI Assistant • Leasing Automation • Resident Automation • Call Is Logged in the CRM" |
| Jonah Digital | Add-on website SKU page in scope | features_page · 2026-05-06 · "Multifamily Website Add-Ons" (page title; body extraction empty — see §A) |

---

## § Feature response prototype (skeleton)

Format: **Target / Status / Action** per onboarding Part **4.4**. Entrata-core code anchors **deferred** to the multi-root workspace pass; this prototype is product-level only.

### Row 1 — EliseAI: Agent (Mobile CRM, AI-era)

1. Competitor — **Branded a "mobile-first AI CRM"** as net-new SKU.
2. **Target:** Entrata's existing CRM + mobile leasing surfaces (Prospect Portal, leasing-agent mobile workflows). **Status:** **Needs verification** — Entrata has CRM + mobile, but AI-native packaging story is the gap. **Action:** PMM compare what Agent ships first (chat-only? mobile-first scheduling? prospect routing?) against current Entrata mobile CRM screens; build a side-by-side battle-card in Product OS rather than a Core ticket until the SKU is concretely defined.
3. **Evidence cited:** `signals.json` features_page · 2026-05-04 (`https://www.eliseai.com/datalog`).

### Row 2 — Funnel: Public developer portal

1. Competitor — **Customer + Partner APIs publicly documented** at `developer.funnelleasing.com`.
2. **Target:** Entrata's API surfaces (existing internal/partner APIs not publicly documented in the same form). **Status:** **Gap (packaging)** — Entrata has integration partners but doesn't surface a public dev-portal landing in the same way. **Action:** PM/marketing consider whether to publish a dev-portal index page; if API gating is policy, document the gating rationale for sales objection-handling. Not a Core engineering ask.
3. **Evidence cited:** features_page · 2026-05-04 (`https://developer.funnelleasing.com/`).

### Row 3 — Funnel: Talent / brand events

1. Competitor — **Forum event + Best Places to Work** = HR/recruiting moat play.
2. **Target:** Entrata employer-brand / talent narrative. **Status:** **Signal-only** (HR + brand, no SKU). **Action:** Forward to People + Comms; not a product backlog item.
3. **Evidence cited:** insights · 2026-05-04 + media · 2026-05-04.

### Row 4 — Anyone Home: Bundled SKU stack

1. Competitor — **Single bundle**: Self-Guided + Live Chat + Contact Center + Leasing Call Analysis.
2. **Target:** Entrata Marketing/Leasing Center widgets + VoIP analytics (the same primitives surfaced in the prior `2026-05-04T19-37-46Z` interpretation, Row 10). **Status:** **Gap (packaging)** — Entrata has the parts; the bundle story is the buyer-facing miss. **Action:** PM/marketing collapse tour + self-guided + chat + call-analytics into one narrative pillar. **No** Core change required first; revisit only if packaging review surfaces a missing SKU.
3. **Evidence cited:** features_page · 2026-05-06 (`/solutions/`), case_studies · 2026-05-06 (Sequoia, Avanath).

### Row 5 — Anyone Home: After-hours service automation (Avanath story)

1. Competitor — **Concrete operational pain story**: after-hours service-issue handling.
2. **Target:** Entrata resident services / messaging / after-hours flows. **Status:** **Needs verification** (sales reference vs. SKU parity in Core). **Action:** Sales enablement: surface the equivalent customer reference if one exists in CSM. If absent, request CSM nominate one for a counter-case-study.
3. **Evidence cited:** case_studies · 2026-05-06 (`/customer-stories/`).

### Row 6 — LeaseHawk: status check (no movement)

1. Competitor — **No new claim this drop** (only pillar restatement).
2. **Target / Status:** No-op. **Action:** Keep the brand-deprecation watch from FOLLOWUPS §4; no work this cycle.
3. **Evidence cited:** features_page · 2026-05-04 (single row).

### Row 7 — Jonah Digital: add-ons SKU page surfaced

1. Competitor — **`/add-ons/` SKU listing** now indexed (body extraction is currently empty — see §A).
2. **Target:** Entrata's website-add-on equivalents (PMS-integrated marketing widgets). **Status:** **Needs evidence** — re-pull this URL after selector tune. **Action:** Engineering — tune `collectFeatureSignals` for `jonah-digital` add-ons body extraction; PMM defer until evidence is real.
3. **Evidence cited:** features_page · 2026-05-06 (`/add-ons/`).

---

## § Engineering / lane-bug handoff (from §A)

These are blockers for trusting the next drop's interpretation; route to FOLLOWUPS §2 work:

1. **G2 (eliseai + funnel-leasing)** — both 403 (Cloudflare). Implement rotating UA + 24h cache as planned in FOLLOWUPS §2.
2. **`reviews_other` (funnel-leasing / featuredcustomers.com)** — JS-hydrated; either headless render or move to JSON-LD/API extraction.
3. **`articles_index` (jonah-digital)** — same JS-hydration class; consider RSS fallback if it exists, otherwise headless.
4. **`case_studies` (jonah-digital)** — currently scraping homepage tagline; tune selector to extract the 8 `<blockquote>` testimonials (FOLLOWUPS §4 explicitly calls this out as a silent-zero risk).
5. **`changelog` (anyone-home)** — zero rows this run; verify `anyonehome-updates.com/feed/` is still publishing.

---

## Prioritization (manager view)

| Tier | Rows | Rationale |
|------|------|-----------|
| **Now** | 1, 4 | EliseAI Agent SKU is the clearest competitive surface this drop; Anyone Home bundle story is the most actionable PMM gap. |
| **Later** | 2, 5 | Funnel dev-portal is a good packaging precedent; Anyone Home after-hours story is sales-enablement, not roadmap. |
| **Won't chase here** | 3, 6, 7 | Talent/brand signals only (3); LeaseHawk no movement (6); Jonah evidence pending lane fix (7). |

---

## Next step (per `TRACKER-DEMO.md` §5)

Take **Row 1 (EliseAI Agent)** and **Row 4 (Anyone Home bundle)** into Entrata Product OS / `/create-prototype` to draft the counter-positioning artifact. No localhost required.
