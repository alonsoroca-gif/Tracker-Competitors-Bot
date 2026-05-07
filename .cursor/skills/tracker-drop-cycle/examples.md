# tracker-drop-cycle — examples

Worked example of the full Phase 0–5 output using real drops from the repo. Read this before producing your own output if you're new to the skill — every section maps to the templates in `SKILL.md`.

**Source drops used in this walkthrough:**
- Latest: `tracker-drops/2026-05-06T21-46-51Z/` (Wed afternoon — full P3 lane debut)
- Prior: `tracker-drops/2026-05-04T19-37-46Z/` (Mon — P1+P2 only)

Net-new diff: **16 net-new URLs** out of 22 unique (6 carryover). This is the dataset the example walks through.

---

## Phase 0 example — smart-mode output

Three realistic outcomes you'll see in production:

### A. Hash differs + drop is recent → skip collect, go to Phase 3

```
Latest drop: 2026-05-06T22-41-51Z (age: 8 min)
Prior drop:  2026-05-06T21-46-51Z
Hash match:  NO (content changed)
```

Skill announces:

> Latest drop `2026-05-06T22-41-51Z` is 8 min old (likely from CI) and has new content. Skipping collect, jumping to Phase 3.

### B. Hash matches → stop cycle

```
Latest drop: 2026-05-06T22-41-51Z (age: 8 min)
Prior drop:  2026-05-06T21-46-51Z
Hash match:  YES (no new content)
```

Skill announces:

> Latest drop `2026-05-06T22-41-51Z` is byte-identical to prior `2026-05-06T21-46-51Z` — no new signals to interpret. Stopping cycle.

### C. Drop is old or missing → run Phases 1–5

```
Latest drop: 2026-05-04T19-37-46Z (age: 2880 min)
Prior drop:  2026-05-04T15-49-15Z
Hash match:  NO (content changed)
```

Skill proceeds to Phase 1.

---

## Phase 4 preprocessing — the diff in action

For latest = `2026-05-06T21-46-51Z`, prior = `2026-05-04T19-37-46Z`:

```
Latest drop: 2026-05-06T21-46-51Z — 22 unique URLs
Prior drop:  2026-05-04T19-37-46Z — diff base
Net-new (use these for §4.2 onward): 16
Carryover (do not surface unless asked): 6

NET-NEW BY COMPETITOR:
  8  funnel-leasing
  4  anyone-home
  2  eliseai
  2  jonah-digital

NET-NEW BY SOURCE:
  5  features_page
  3  blog
  2  g2_reviews
  2  case_studies
  1  insights
  1  media
  1  reviews_other
  1  articles_index
```

The 6 carryover URLs (e.g. EliseAI homepage, EliseAI careers, LeaseHawk homepage) had byte-identical evidence vs. Monday's drop — they're skipped to keep the manager's attention on what's actually new this week.

---

## Phase 4.1 — Drop health

```
| Lane | Pillar | Status | Cause (if not ✅) |
|---|---|---|---|
| features_page | P1 | ✅ | — |
| careers | P2 | ✅ | — |
| pricing_page | P2 | ⚠️ | packaging-only (no $ — both demo-gated) |
| case_studies | P1 | ⚠️ | jonah selector miss; anyone-home parses 4+3 OK |
| insights | P1 | ✅ | — |
| media | P3 | ✅ | — |
| blog | P1 | ✅ | — |
| g2_reviews | P3 | ❌ | Cloudflare 403 |
| reviews_other | P3 | ❌ | JS-hydrated (featuredcustomers) |
| articles_index | P1 | ❌ | JS-hydrated (jonah) |
| changelog | P1 | ❓ | silent — verify next run |
```

---

## Phase 4.2 — Main moves

3–7 bullets, every claim ends with a citation chip.

- **EliseAI** announced **"Agent — The First Mobile CRM Built for the AI Era"** in their datalog. [features_page · 2026-05-04 · `"Introducing Agent by EliseAI: The First Mobile CRM Built for the AI Era"`]
- **Funnel Leasing** launched a public **developer portal** at `developer.funnelleasing.com` exposing both Customer and Partner APIs. [features_page · 2026-05-04 · `"Integrate with Funnel Leasing • Customer API • Partner API"`]
- **Funnel Leasing** published a **fraud-detection screening** blog post — first time fraud surfaces as a top-line positioning lane. [blog · 2026-05-04 · `"best-multifamily-renter-screening-software-with-fraud-detection"`]
- **Anyone Home** restructured `/solutions/` into a **bundled SKU stack** (Self-Guided Tours · Live Chat · Contact Center · Leasing Call Analysis) and added named customers. [features_page · 2026-05-06 · `"Self-Guided Tours • Chatbot with Live Chat • Contact Center • Leasing Call Analysis"`]
- **Anyone Home** customer stories now feature **Sequoia, TGM, Avanath, Kairoi Residential** with operational pain narratives (after-hours service, PMS integration). [case_studies · 2026-05-06 · `"Anyone Home's CRM and Contact Center helps Sequoia lease smarter"`]
- **Funnel Leasing** brand: **Forum event with Mia Hamm + CEO Tyler Christiansen** + **Tampa BJ "Best Places to Work" #11/65**. [insights · 2026-05-04 + media · 2026-05-04]
- **Jonah Digital** added `/add-ons/` SKU page to scope (case-study extraction still empty — selector miss). [features_page · 2026-05-06 · `"Multifamily Website Add-Ons"`]

---

## Phase 4.3 — Gaps → Features

```
| # | Competitor signal | Proposed feature | Tier |
|---|---|---|---|
| 1 | EliseAI "Agent" mobile CRM | Mobile-first prospect→tour→app demo flow | Now |
| 2 | Anyone Home bundled stack | "Leasing OS" bundle SKU + landing page | Now |
| 3 | Funnel fraud-screening blog | Fraud-detection sales-ready talking points | Later |
| 4 | Funnel public dev portal | Public Entrata API index page | Later |
| 5 | Anyone Home named-customer stories | Counter-case-study from CSM (after-hours flow) | Later |
| 6 | Funnel Mia Hamm + Best Places brand | (signal-only, no product gap) | Won't chase |
| 7 | Jonah /add-ons/ page | (evidence pending — lane fix needed) | Won't chase |
```

Detail per row (kept off the table to avoid wide cells):

1. **Gap:** No AI-native mobile CRM narrative on entrata.com. **Acceptance:** 90s screen-recording on iPhone; opens on lock screen / SMS notification, not desktop browser; voiceover positions Entrata mobile CRM as shipping today.
2. **Gap:** Entrata sells 4 separate modules (tours, chat, call center, call analytics); Anyone Home pitches one bundle. **Acceptance:** Single price + one landing page at `entrata.com/solutions/leasing-os` + 3-customer logo strip.
3. **Gap:** Funnel publicly positions fraud as a screening differentiator. **Acceptance:** 1-page sales card mapping Entrata's existing screening + identity-verification primitives to "fraud detection" language.
4. **Gap:** Funnel publishes API docs; Entrata API surfaces are partner-gated. **Acceptance:** Policy decision (publish vs not) + landing page if yes.
5. **Gap:** No equivalent Entrata customer-story for after-hours service automation in head-to-head decks. **Acceptance:** CSM nominates 1 reference customer with comparable pain narrative.
6. (Talent/brand signal — forward to People + Comms; not a product backlog item.)
7. Re-pull this URL after the `<blockquote>` selector fix lands in the engine; defer until evidence is real.

---

## Phase 4.4 — PRD draft (Tier-Now only)

```
PRD: Mobile-first prospect→tour→app demo flow

- Problem: EliseAI announced "Agent — The First Mobile CRM Built
  for the AI Era." Implicit framing: incumbents (Entrata, Yardi,
  RealPage) are "pre-AI desktop tools." We have a mobile CRM but
  no demo asset that opens on a phone, so the framing wins by default.

- Target user: PMM (for sales-deck refresh) + sales reps (for
  live demos in customer meetings)

- Scope (in):
  • 90-second screen recording of prospect → tour → application
    on a real iPhone
  • Open shot is the lock screen / SMS notification, not a
    desktop browser
  • Voiceover positions Entrata mobile CRM as "shipping today
    to X% of US units"

- Scope (out):
  • Net-new mobile UI (use existing flows)
  • Marketing copy beyond the voiceover
  • Web landing page (Anyone Home bundle PRD handles that)

- Success metric: video embedded in 5 active sales deals within
  2 weeks of ship; ≥1 sales rep cites it as deal-influencing
  in QBR

- Evidence: tracker-drops/2026-05-06T21-46-51Z/signals.json
  row: eliseai · features_page · 2026-05-04
  ("Introducing Agent by EliseAI: The First Mobile CRM Built
  for the AI Era")

- Effort estimate: S (1 designer-week + 1 PMM-week — no eng work)
```

```
PRD: "Leasing OS" bundle SKU + landing page

- Problem: Anyone Home pitches Self-Guided Tours + Live Chat +
  Contact Center + Leasing Call Analysis as one bundle on a
  single page. Entrata sells the same primitives as 4 separate
  modules with 4 setup flows. Buyer cognitive-load loses.

- Target user: PMM + Pricing (for SKU bundle) + Marketing Web
  (for landing page)

- Scope (in):
  • One bundle SKU at a single price point
  • Landing page at entrata.com/solutions/leasing-os
  • 3-customer logo strip on the page (TBD with CSM)
  • Stack diagram showing the 4 existing modules under one
    bundle wrapper (no new boxes)

- Scope (out):
  • Net-new engineering (modules already exist)
  • Unified setup wizard (deferred to v2)
  • Counter-case-study (handled by separate PRD)

- Success metric: bundle SKU mentioned in ≥30% of net-new
  Leasing Operator deals in the quarter following launch

- Evidence: tracker-drops/2026-05-06T21-46-51Z/signals.json
  rows: anyone-home · features_page · 2026-05-06 (/solutions/)
  + anyone-home · case_studies · 2026-05-06 (named customers)

- Effort estimate: M (2 PMM-weeks + 1 Pricing-week + 2 Marketing
  Web-weeks; no Core engineering)
```

---

## Phase 4.4b — PRD confirmation + PDF export flow

After each PRD, the skill asks two questions in chat. Realistic exchange:

> **Skill:** Does this PRD look right?
> Options: Approve · Edit · Discard
>
> **Manager:** Approve.
>
> **Skill:** Want a downloadable PDF copy of this PRD?
> Options: Yes · No
>
> **Manager:** Yes.
>
> **Skill:** Saved → `~/Desktop/tracker-decks/PRD-eliseai-mobile-crm-2026-05-06T21-46-51Z.pdf`

If pandoc is missing, the skill announces:

> **Skill:** pandoc not installed. Saved as markdown instead → `~/Desktop/tracker-decks/PRD-eliseai-mobile-crm-2026-05-06T21-46-51Z.md`. Run `brew install pandoc wkhtmltopdf` to enable PDF export, then ask me to "re-export PRDs."

If the manager says "Edit," the skill applies the edits inline in chat and re-asks both questions before saving.

---

## Phase 4.5 — Slack message (chat-paste)

```
:tracker: New tracker drop: 2026-05-06T21-46-51Z (16 net-new of 22 unique URLs)
Top moves this drop:
• EliseAI: announced "Agent" — first Mobile CRM Built for the AI Era [features_page · 2026-05-04]
• Funnel Leasing: launched public developer portal (Customer + Partner APIs) [features_page · 2026-05-04]
• Anyone Home: bundled SKU stack on /solutions/ + named customers (Sequoia, TGM, Avanath) [features_page · 2026-05-06]
Gaps converted to PRDs: 2 Now · 3 Later
Drop: https://github.com/alonsoroca-gif/Tracker-Competitors-Bot/tree/main/tracker-drops/2026-05-06T21-46-51Z
```

7 lines. Top-of-funnel: a manager scanning Slack sees it in 10 seconds and decides whether to open Cursor and dig in.

---

## Phase 4.6 — Prioritization summary

```
| Tier | Rows | Rationale |
|---|---|---|
| Now | 1, 2 | Most concrete competitive surfaces; both narrative/packaging gaps, no eng |
| Later | 3, 4, 5 | Sales-enablement and policy items — important but not this cycle |
| Won't chase | 6, 7 | Talent/brand signal-only (6); evidence pending on lane fix (7) |
```

---

## Phase 5 — Battle card (one full example)

For Tier-Now Row 1:

```
### Battle card — EliseAI Agent (Mobile CRM, AI-era)

**Trigger:** [features_page · 2026-05-04 · "Introducing Agent by EliseAI: The First Mobile CRM Built for the AI Era"]

**What they're claiming**
- A net-new SKU positioned as the *first* AI-native mobile CRM for property management
- Implicit jab: incumbent CRMs (Entrata, Yardi, RealPage) are "pre-AI desktop tools"

**What we actually know vs. don't know**
- Known: announcement is slogan-only — no screenshots, no pricing, no shipped customer logos visible from the datalog row
- Unknown (track in next drop): tour-scheduling on mobile? leasing-agent inbox? prospect routing? offline mode? App Store presence?

**Entrata response (3 plays)**

| Play | Owner | Time |
|---|---|---|
| Public counter-narrative: "Entrata's mobile CRM is already where 1-in-X US units lease" | PMM | S |
| Demo refresh: 90-second mobile-CRM walkthrough opening on phone, not desktop | PM + Design | M |
| Watch-list: track EliseAI Agent for shipped artifacts every drop | Tracker runner | Ongoing |

- Risk if we skip play 1: EliseAI defines the "AI-era CRM" category before we do
- Risk if we skip play 2: sales decks still lead with desktop screens → reinforces EliseAI's "pre-AI" framing
- Risk if we skip play 3: we respond to slogans and look reactive

**Concrete artifact for Product OS**
- File: `entrata-product-os/battlecards/eliseai-agent.md`
- Sections:
  - Their claim (1 paragraph + citation)
  - Our reality (3 bullets pointing to existing mobile surfaces)
  - Sales objection-handlers (3 Q→A pairs)
  - Demo script (5-step click-path on existing mobile UX)
- Acceptance: sales rep can hand the card to a peer mid-call without a PMM in the loop

**Net-new engineering ask:** none until EliseAI ships visible artifacts. This is a narrative gap, not a capability gap.
```

---

## Edge cases observed in real runs

### Thin diff — only 2 net-new

For latest = `2026-05-06T22-41-51Z`, prior = `2026-05-06T21-46-51Z` (drops 55 minutes apart):

```
Net-new: 2 (carryover: 17)
- funnel-leasing  features_page  https://funnelleasing.com/      (false positive — see below)
- anyone-home     pricing_page   https://anyonehome.com/         (real homepage rewrite)
```

In this case, the skill should:
- Drop §4.3 to a single Tier-Now row (Anyone Home homepage rewrite)
- Skip §4.4 PRD if the change is too small to warrant one (positioning shift, not a new SKU)
- Output a 4-line Slack message instead of 7
- Skip §5 if no Tier-Now PRD was produced

### False positives from whitespace/ordering nondeterminism

Some scrapers (notably `features_page` for Funnel) produce non-deterministic ordering of phrases in `evidence_snippet`. The MD5 hash differs even though the content is visually identical.

Mitigation options for the engine team (not the skill):
- Sort phrases alphabetically before joining (kills both real and false ordering signal — only safe for unordered content)
- Normalize whitespace + collapse repeated punctuation before hashing
- Use a token-set hash (Jaccard >0.95 = "same") instead of byte-exact MD5

For now, **the skill should call this out in §4.1 Drop health when it detects a `features_page` row in net-new but the evidence diff is <10 character changes**. Annotate as `⚠️ likely false positive — evidence text reordered, not changed`.

### Engine bugfix on `2026-05-06` (commit `8307e31`)

After commit `8307e31 tracker: post-demo bugfix — collect-once-per-competitor + clear broken URLs`, the publish-drop pipeline writes one row per (URL, run) instead of one per (URL, collect-cycle). For drops produced after that commit:

- The runtime dedupe one-liner in §4 is a no-op (still safe, just redundant)
- The diff one-liner is unaffected
- Drop sizes shrink ~10–20× for the same content

Once 2 weeks of post-bugfix drops accumulate, the runtime dedupe step in `SKILL.md` §4 can be removed for clarity. Until then, leave it in (defensive).
