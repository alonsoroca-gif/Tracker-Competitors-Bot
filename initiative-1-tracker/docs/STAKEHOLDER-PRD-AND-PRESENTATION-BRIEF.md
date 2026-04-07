# Tracker Bot — Stakeholder PRD & presentation brief (for deck generation)

**Audience:** Internal stakeholders (product leadership, engineering leadership, GTM, ops).  
**Intent:** Feed this document to Claude (or another assistant) to produce a **keynote-grade** deck: **minimal on-slide text** + **narrator notes** written like an **Apple-style presentation** (pacing tags, rule of three, mantra, demo theater)—not a standard corporate bullet read-through. See **Part B** and **Part C**.  
**Product name in deck:** **Tracker** or **Competitive Tracker** (pick one and stay consistent).  
**Company context:** Entrata; portfolio includes Lead-to-Lease products (e.g. Prospect Portal, Lead Manager, Message Center); competitors configured include EliseAI, Funnel Leasing, LeaseHawk, Anyone Home, Jonah, etc.

---

## Part A — Product requirements document (source of truth)

### A1. Executive summary (one paragraph)

The **Tracker** is an internal competitive intelligence system that continuously ingests **public** competitor signals (blogs, press, changelogs, product and pricing pages, careers, and optional third-party surfaces), stores them in a **rolling time window**, and produces a **weekly-readable gap report**: what competitors are doing, how confident we should be, where **we** stand, and **what to prioritize**—without requiring an analyst to re-read every feed every Monday. The product output is not raw scrapes; it is **structured interpretation** (headline, why, threat framing) plus **action-oriented response** copy grounded in configurable product voice and optional codebase inventory.

### A2. Problem statement

- Competitive moves are scattered across many sites and formats; manually checking them weekly does not scale.
- Raw snippets and page titles are **noise**—they do not answer “so what?” or “how hard should we react?”
- Product and engineering teams need a **shared, scannable** view: observation (L1), proof (L2), and recommended response (L3) **separated**, so decisions are not confused with evidence.

### A3. Product vision

**One place to see the week in the market**—clear enough for a standup, defensible enough for a roadmap conversation—with proof one click away.

### A4. Goals (measurable directions, not vanity metrics)

| Goal | Description |
|------|-------------|
| **Time-to-orient** | A PM or EM can understand “what moved this week” in **under one minute** scanning the gaps table. |
| **Traceability** | Every row links **interpretation → captured line → full signal → source URL** where available. |
| **Actionability** | Top priorities surface **our delivery state** and **recommended response** with suggested work-item shapes. |
| **Configurability** | Sources, competitors, product voice, and (optionally) repo paths are **data**, not code changes. |

### A5. Non-goals (say explicitly in Q&A)

- Not **spying** or bypassing paywalls/terms; **public URLs only**, respectful User-Agent.
- Not a replacement for **deal-level** competitive intel or **customer** win/loss—this is **market motion** from public signals.
- Not **automatic merging to production**—human review for code changes; optional agent loop proposes PRs separately.
- **LLM-generated** narrative is **optional** / future-facing; core v1 is **rule-based** interpretation and templated responses.

### A6. Primary users & jobs-to-be-done

| Persona | Job |
|---------|-----|
| **Product / PM** | “What did competitors ship or say this week that affects our roadmap?” |
| **Engineering lead** | “Where in our stack should we verify parity or differentiation?” |
| **GTM / marketing** | “What narrative are they pushing—and what’s our counter?” |
| **Leadership** | “Are we seeing **corroboration** across sources (real bet vs one page)?” |

### A7. Core capabilities (what exists today)

1. **Configure** products, competitors, and **per-competitor source URLs** (`products.json`).
2. **Collect** on demand or on schedule (operator habit): merge into `signals.json`, **prune** to retention window (e.g. 7 / 14 / 30 days).
3. **Gap report**: cluster similar signals, assign **dimension** (features, pricing, messaging, support, positioning), **priority**, **intel pillar** (owned vs behavioral vs third party where inferable), **corroboration** (watch vs confirmed when multiple pillars align).
4. **Strategic interpretation** (rule-based): **headline** (short, scannable), **strategic why** (epistemic / multi-surface copy), **threat tag** (low/medium/high framing).
5. **Our state**: per product, **Starting / In process / Delivered** (`our-state.json`).
6. **Our response this week**: top **1–3** gaps by priority; **recommendation** text from **product voice** + templates (`product-keywords.json`); optional **repo touchpoints** when `app-inventory.json` and paths are configured.
7. **Report UI**: period selector, source filter, gaps table, expandable **Details**, right panel for responses, **Refresh data** vs **Reload report**.

### A8. Three-layer information model (exact product language)

Use these labels on slides—stakeholders should hear them once and remember:

| Layer | Question it answers | Where it shows |
|-------|---------------------|----------------|
| **L1 — Competitive move** | What should we **notice**? | Table: strategic read + **Captured** factual line |
| **L2 — Evidence** | Can we **prove** it? | Details: full signal, URL, date |
| **L3 — Our response** | What do **we** do? | Right panel: recommendation, work items, optional repo paths |

**Key message:** *Scrapes are inputs. Interpretation is the product.*

### A9. Technical architecture (one diagram worth of bullets)

- **Node.js** tracker app: `collect` → **storage** (`signals.json`) → **gapReport** + **gapInterpretation** → **responseSchema** → **whatToChange**.
- **Express** server: `GET /api/report`, `GET /api/config`, `POST /api/collect`, supporting endpoints for collect status and weekly coverage.
- **Static UI** (`public/index.html`): consumes JSON; no separate SPA build required for v1.
- **Config-as-data**: products, competitors, sources, our-state, product-keywords, optional app-inventory, intel-fence caps.

### A10. Trust, safety, and compliance talking points

- Only **configured public** endpoints; no credential stuffing, no private data ingestion.
- **Intel fence** concept: limits snippet size and touchpoint count in responses (reduces accidental over-exposure of internal paths in screenshots).
- Signals can be **encrypted at rest** when enabled (mention as enterprise-ready direction if applicable in your environment).

### A11. Roadmap themes (honest “next” without overpromising)

| Horizon | Themes |
|---------|--------|
| **Near** | Scheduled collect, richer sources (reviews/video prototypes where keys exist), tighter L1 extraction, fewer failed fetches. |
| **Mid** | Deeper **grounding** (inventory + repo terms) across more apps; exports to Slack/ticketing. |
| **Future** | Optional **LLM** layer on top of structured bundles—human-in-the-loop, same L1/L2/L3 separation. |

### A12. Success criteria for the stakeholder meeting

- Stakeholders can **repeat back** the three layers (L1/L2/L3) and why interpretation matters.
- At least one **live or recorded** walkthrough: table → Details → response panel.
- Clear **owner** for: config maintenance, weekly collect cadence, and merging agent PRs (if discussed).

---

## Part B — Presentation brief for Claude (real Apple-keynote energy)

This is **not** a normal stakeholder deck. The **on-slide** design stays minimal; the **speaker notes** should read like a **keynote narrator track**—rhythm, pauses, callbacks, and a live-demo handoff—not like “Slide 3 discusses the problem.”

### B1. Keynote DNA (how Apple talks on stage)

Use these **structural** habits in speaker notes (adapt wording; don’t parody):

| Pattern | What it does | Example shape (rewrite in your voice) |
|---------|----------------|----------------------------------------|
| **Cold open** | One short hook, then **stop** | “Every Monday, the market already moved.” *[pause]* |
| **Problem in one breath** | No setup paragraph—**one sentence**, land it | “The feeds are infinite. The answers aren’t.” |
| **The turn** | Single transition word | “So we asked a different question.” / “Here’s what we built.” |
| **Rule of three** | Audience remembers 3 | “Three layers. Notice. Prove. Act.” *[advance on each word]* |
| **Mantra / refrain** | Repeat the product line **2–3 times** at different moments | “Scrapes are inputs. Interpretation is the product.” |
| **Demo bridge** | Physical or tonal shift | “Let me show you.” / “This is Tracker.” *[move to laptop; slower pace]* |
| **Understatement after peak** | After the coolest reveal, **quiet** line | “Yeah. It’s all right there.” |
| **Recap as chant** | Fast, confident, no new info | “Collect. Report. Decide.” |
| **Close with a door** | Invite them in, not a spreadsheet ask | “We’d love your eyes on this next week.” |

**Forbidden in narrator voice (keep these out of speaker notes):** “As you can see on this slide…”, “The next slide covers…”, “Leverage synergies”, “deep dive” (say “look closer” or “here’s the part that matters”).

**Pacing tags** Claude should embed in speaker notes: `[PAUSE 2s]`, `[SLOWER]`, `[BLACK — no talking 1 beat]`, `[CLICK — advance on beat 2]`, `[DEMO]`.

### B2. Visual + slide rules (on-screen)

- **One idea per slide.** Giant type or one image. No bullet walls.
- **Entrata palette:** Use **B9** for colors, logo, and typography so the deck matches company branding (especially for internal stakeholder audiences).
- **Black or near-black** transition slides are allowed between **acts** (Problem → Solution → Demo → Trust → Next)—when using the **dark keynote** theme below, these feel native.
- **Repeat the same diagram** three times if needed—each time **one layer lights up** (L1, then L2, then L3). Keynotes **teach by repetition**, not new decoration every slide.
- Internal file names **never** on hero slides (appendix only).

### B3. Deck arc + theatrical notes per beat

*Claude: For **every** slide, output: (1) on-slide text ≤8 words, (2) **keynote-style speaker notes** with pacing tags, (3) optional “director line” in italics for the presenter only.*

| # | Slide (on-screen idea) | Theater / narrator direction (for notes—not to put on slide) |
|---|------------------------|------------------------------------------------------------------|
| 1 | Title + one line | Open **warm**, not corporate. Say the product name once clearly. `[PAUSE]` Tagline is the **promise**, not a subtitle. |
| 2 | “Too many sources.” *(or one brutal line)* | Stack **two short sentences**. Let the second land in silence. `[BLACK optional]` |
| 3 | Three icons / three words only | “Three things get in the way.” Name them in **three beats**—click or pause between each. **No** explanation yet. |
| 4 | **Tracker** (hero—word only) | This is the **reveal**. Slower. “We call it Tracker.” `[PAUSE 2s]` |
| 5 | One flowing line: signals → gaps → response | Read it **once**, smoothly—like a product sentence, not a process doc. |
| 6 | **Scrapes are inputs.** / **Interpretation is the product.** | This is your **philosophy slide**. Say line one. `[PAUSE]` Say line two. Optional: “That’s the whole idea.” |
| 7 | L1 \| L2 \| L3 (diagram builds) | “There are **three** layers.” Build **one at a time**. After L3: “Notice. Prove. Act.”—same order, **chant once**. |
| 8 | UI: Competitive move column | “This is what you **actually** read Monday morning.” Point to **headline** first—**then** Captured. `[DEMO]` if live. |
| 9 | UI: Details / proof | Tone shift: **matter-of-fact**. “If someone asks ‘prove it’—you’re **one click** from the receipt.” |
| 10 | UI: Our response this week | “And **this** is where we stop observing and start **deciding**.” Tie one row from prior slide to this panel. |
| 11 | Watch vs Confirmed | Keep it **human**: one is “interesting,” one is “harder to ignore.” No jargon in the first sentence. |
| 12 | Four tiles: config | Fast beat. “You own this in **config**—not in a sprint.” |
| 13 | Collect → Report → Decide | Three words on three beats. End with: “That’s the loop.” |
| 14 | Refresh data \| Reload report | **Contrast** as story: “New facts” vs “new read of the facts you already have.” |
| 15 | Trust strip | Quiet confidence. Three promises, **short**. No defensive tone. |
| 16 | Next: Reliability · Coverage · Grounding | “We’re not done. We’re **focused**.” Three pillars—**one breath each**. |
| 17 | The ask | Human: names, cadence, **one** channel—no project-management tone. |
| 18 | Thank you | Simple. Smile beat. “Questions.” |

**Optional “One more thing”** (only if demoing): After thank-you **hold**—then a single slide: weekly coverage or checklist. Notes: “One more thing… *[beat]* …you can see **where** we’re blind, not just **what** we saw.”

### B4. Demo as theater (2–3 minutes, narrator script)

Use this **verbatim shape** in speaker notes; swap in real competitor names if needed.

1. `[DEMO]` “I’m going to show you **one** row. That’s all we need.”  
2. “Up top—**this** is the read.” *(headline)* `[PAUSE]`  
3. “Under it—**why** we’re not overreacting—or why we should pay attention.” *(strategic why)*  
4. “**Captured** is the receipt from the field.” *(factual line—one concrete metaphor; stick to it)*  
5. Open Details. “And if leadership wants the **Receipt**—URL, full text, date.” `[SLOWER]`  
6. Glance right. “**Our response**—same story, but **our** move: state, recommendation, work items.”  
7. Optional: flick source filter. “And you can ask: *where* did this come from—not just *what* did it say.”

End demo with: **“That’s Tracker in one pass.”** `[PAUSE 2s]` then sit or step back.

### B5. Sample “Apple notes” block (Claude should match this energy)

*Example of the quality expected for **one** slide—replicate for all slides:*

- **On slide:** `Interpretation is the product.`  
- **Speaker notes:**  
  - “We didn’t build another scraper.” `[PAUSE]`  
  - “We built something simpler: **your** Monday morning—**clarified**.” `[CLICK]`  
  - “Raw text comes in. What you **see** is a decision surface.” `[SLOWER]`  
  - “Scrapes are inputs.” `[PAUSE 1s]` “Interpretation is the product.”  
  - *Director:* Don’t rush the second line. Let the room finish reading.

### B6. Exact on-product strings (for accuracy in script or screenshots)

- UI section: **Our response this week**  
- Table column: **Competitive move**  
- Sub-labels in move stack: strategic read; **Threat tag:**; **Captured:**  
- Buttons/concepts: **Refresh data**, **Reload report**  
- Our state values: **Starting**, **In process**, **Delivered**  
- Corroboration labels: **Watch**, **Confirmed** (explain in voiceover)  
- Dimensions: **features**, **pricing**, **messaging**, **support**, **positioning**

### B7. Stakeholder objections — short answers (appendix or Q&A; keep voice **calm**, not defensive)

| Objection | Answer |
|-----------|--------|
| “Is this legal?” | Public pages only; configured URLs; standard crawling etiquette. |
| “Will it hallucinate?” | Core path is **rule-based** interpretation; facts trace to **Captured** and L2. |
| “Who maintains it?” | Config owners for URLs and **our-state**; engineering for collect reliability. |
| “Is this Entrata-specific?” | **Voice** and **inventory** are configured per our products and repos. |

### B8. Assets Claude should request or assume

- **Logo:** Entrata (user to provide vector/PNG).  
- **Screenshots:** User to paste latest from `http://localhost:3000` after Refresh + Reload—or Claude generates **wireframe** placeholders labeled “UI: Gaps table”.  
- **Duration:** Assume **15–20 minutes** presentation + 10 Q&A unless user specifies otherwise.

### B9. Entrata branding — format, color, and logo (match the company)

**Why:** Stakeholders should feel this is **our** product story, not a generic template. The **Tracker report UI** already uses Entrata-aligned tokens (`tracker/public/index.html`); the deck should **harmonize** with that when you show screenshots.

**Official reference:** [Entrata brand guidelines](https://www.entrata.com/company/brand-guidelines) — for non-standard or external use, contact **marketing@entrata.com** with a visual mock-up (per Entrata’s page).

#### Primary brand color

| Token | Hex | Use |
|--------|-----|-----|
| **Entrata red** | `#E42127` | Primary accent: CTAs, key word emphasis, diagram highlights, progress indicators, **one** accent per slide max on hero moments |
| **Pantone (print)** | 186 C | If anything goes to print |

**Hover / pressed (UI parity with Tracker):** `#c41d22` — optional for deck “buttons” or shapes only if needed.

**Do not:** Recolor the logo, use an old red, or substitute a different “brand red.”

#### Recommended deck themes (pick **one** and stay consistent)

**A — Dark keynote (recommended if demoing Tracker UI)**  
Aligns with the live app’s dark shell so screenshots don’t look pasted onto a white deck.

| Role | Hex | Notes |
|------|-----|--------|
| Background | `#0d0d0f` | Slide master background |
| Surface / cards | `#16161a` | Bento areas, quote blocks |
| Elevated surface | `#1c1c21` | Slightly lifted panels |
| Border / hairlines | `#2a2a30` | Tables, dividers |
| Primary text | `#f4f4f5` | Headlines, body |
| Secondary text | `#a1a1aa` | Subheads, captions |
| Muted | `#71717a` | Labels, footnotes |

**Accent on dark:** Entrata red `#E42127` for emphasis; use **sparingly** (keynote rule: one focal accent). For “info” highlights where red would feel alarmist, a cool secondary is acceptable: e.g. `#60a5fa` (corroboration / trust slides only)—keep it **minor**, not a second brand color.

**Logo on dark:** **White wordmark** (official asset — see downloads on Entrata brand page; Tracker uses `entrata_white_wordmark.png` from docs.entrata.com in the UI).

**B — Light executive (alternative)**  
White or off-white background (`#FFFFFF` / `#FAFAFA`), **dark charcoal** body text (`#18181b` or `#27272a`), **Entrata red** `#E42127` for accents and **red wordmark** on title slides. Good for rooms with bright projectors; screenshots of the Tracker UI will sit in a **framed device** or **subtle dark inset** so contrast still looks intentional.

#### Typography and layout

- **Headlines:** Bold, large, plenty of letter-spacing if tight—**sans-serif** only (e.g. SF Pro on Mac, Segoe UI on Windows, or your org’s approved corporate font if Entrata mandates one internally).
- **Body / speaker-note font:** Same family; avoid mixing more than **one** sans in the deck.
- **No decorative / playful display fonts** on stakeholder-facing slides.
- **Logo clear space:** Follow Entrata guidelines—don’t crowd the wordmark; don’t stretch or add effects.

#### Diagrams and UI chrome

- Use **Entrata red** for the “active” layer when building L1 → L2 → L3 (e.g. L2 lights up in red, L1/L3 muted neutrals).
- **Priority colors** (optional, only if you show schema): align with Tracker UI for consistency—high `#ef4444`, medium `#f59e0b`, low `#22c55e` / `#4ade80` (see `index.html` variables). Prefer these **only** in product-accurate mockups, not as random deck decoration.

#### Title slide checklist

1. **White wordmark** (dark theme) or **red wordmark** (light theme), correct file from brand guidelines.  
2. **Tracker** product name + tagline—**Entrata red** or white (on red bar), not a third color.  
3. Presenter name / date in **secondary** neutral, small.

#### Export / tooling

- Keynote, Google Slides, or PowerPoint: define **theme colors** once (paste hex values above) so every shape pulls from the palette.
- For Claude: output a **“Theme spec”** table (background, text, accent, logo variant) in addition to slide content so whoever builds the file doesn’t eyeball colors.

---

## Part C — One-block copy for Claude (paste below the line)

```
You are producing a stakeholder slide deck for Entrata’s internal "Tracker" (Competitive Tracker) product.

Use the full markdown document titled "Tracker Bot — Stakeholder PRD & presentation brief" as the only source of product facts.

This is NOT a standard corporate deck. Treat Part B as a **keynote narrator brief** (Apple-style: rhythm, restraint, repetition, demo handoff).

Requirements:
- On-screen: Part B2 rules—one idea per slide, huge type or one image, no bullet walls.
- Speaker notes: MUST follow Part B1 (Keynote DNA)—use pacing tags [PAUSE 2s], [SLOWER], [DEMO], [CLICK], [BLACK], rule-of-three, mantra callbacks, demo bridge lines. Notes must read like a **live keynote script**, not "this slide explains…".
- Include at least one block matching the energy of Part B5 (sample Apple notes) for the philosophy slide and for the L1/L2/L3 build.
- Use exact UI strings from Part B6 where relevant.
- Explain L1/L2/L3 clearly; repeat the mantra "Scrapes are inputs. Interpretation is the product." at least twice in the script (different contexts).
- Include non-goals from A5 in Q&A or appendix—calm, precise, confident (Part B7 tone).
- Do not invent features not described in Part A7/A11; label roadmap items as planned/near-term/future.
- Output: For every slide: title, on-slide text (≤8 words unless diagram labels), keynote-style speaker notes (with pacing tags), optional *Director* line in italics. If the user wants Google Slides / Keynote / PowerPoint, offer a table export or markdown 1:1 to slides.

Optional: one speaker-only analogy max—do not stack metaphors.

Branding (required):
- Apply Part B9 Entrata branding: primary red #E42127 (Pantone 186 C); correct logo variant (white wordmark on dark, red wordmark on light); dark OR light theme from B9—pick one; include a "Theme spec" hex table for the builder.
- Do not recolor the Entrata logo. Cite official guidelines link and marketing@entrata.com for formal questions.
- When describing visuals, note that Tracker UI screenshots match the dark palette in B9 theme A for consistency.
```

---

*Document path in repo: `initiative-1-tracker/docs/STAKEHOLDER-PRD-AND-PRESENTATION-BRIEF.md`*
