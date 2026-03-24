# Plan: keyword signals for “new moves” (pending manager confirmation)

**Status:** Plan only — **do not treat as approved to expand scraping** until your manager confirms Entrata’s competitive-intel guidelines for your use case.

**Context:** Guidelines indicate **public URLs** are acceptable; still get **explicit sign-off** from your manager before turning on or widening automated page fetches.

**Goal:** After approval, use **keyword / theme detection** on text we already collect (RSS snippets, article body, pricing/features/careers excerpts) to surface **new moves, positioning shifts, expansion, partnerships, pricing, hiring**, etc.—without needing an LLM first.

**Coverage goal:** Prefer a **low miss rate** on real competitor news. That means each theme should include **explicit word variations** (e.g. *price, prices, pricing, priced, reprice, repricing*)—not only the “headline” form of a word—plus **synonyms and short phrases** where they appear in press/blog copy.

---

## 1. What this adds (product)

| Outcome | Description |
|--------|-------------|
| **Themes** | Each signal (or gap) tagged with 0+ themes: e.g. `expansion`, `product_launch`, `partnership`, `pricing`, `ai`, `funding`, `hiring`, **`brand_reorg`** (rebrand / “is now” / new model). |
| **Manager view** | Filter or sort by theme; optional **“Strategic moves this period”** strip (count by theme). |
| **Priority hint** | Optional bump or badge when high-signal themes hit (configurable). |

This complements structured fields (`headline`, `source_url`, `evidence_snippet`) and public-page text—not a replacement.

### Homepage updates, modals, and video (why this matters)

- **Site changes:** Big competitor moves often show up first on the **public homepage** or in a **modal** (“*X is now Y*”, new AI positioning, new domain). Collecting **`pricing_url` / `features_url`** (often the homepage) pulls that HTML text when it’s server-rendered or present in the initial document — high signal for managers.
- **YouTube:** Official channel **Atom feed** (`youtube_rss` in config) adds **video titles and descriptions** (e.g. product launches, executive messaging) without scraping watch pages. See [DATA-SOURCES-BRAINSTORM.md](DATA-SOURCES-BRAINSTORM.md) §6b.

---

## 2. End-to-end flow (once approved)

```
Public URL / RSS (existing)
        ↓
Normalize text (existing: strip boilerplate, main/article, fact-like)
        ↓
[NEW] Theme detector: match configured keywords/phrases → theme tags[]
        ↓
Store on signal: themes: ["expansion", "product_launch"] (and optional theme_scores)
        ↓
Gap report: pass themes to gap; build competitor_move or a second line "Themes: …"
        ↓
UI: chips / filter by theme; optional summary "This period: 3 expansion, 2 AI, …"
```

**Where logic lives (recommended):**

- **`lib/themeDetector.js`** (new) — pure functions: `detectThemes(text, config) → string[]`
- **`config/competitive-themes.json`** (new) — themes + keyword lists (editable by PM)
- **`lib/collect.js` or post-step** — after snippet is finalized, call `detectThemes` and attach to signal
- **`lib/gapReport.js`** — copy `themes` onto each gap
- **`public/index.html`** — filter + display

---

## 3. Variations strategy (low miss rate)

Use **all of the following** in implementation (stack them; they complement each other).

| Layer | Purpose | Example |
|-------|---------|--------|
| **A. Explicit variants in config** | Highest precision; no surprises. List every form you care about. | `price`, `prices`, `pricing`, `priced`, `reprice`, `repricing` |
| **B. Multi-word phrases** | Headlines often use phrases, not lemmas. | `price increase`, `list price`, `per door`, `metered pricing` |
| **C. Normalization (in code)** | Catch trivial variants without exploding the JSON. | Lowercase, Unicode fold (e.g. accents), normalize curly quotes, collapse whitespace |
| **D. Optional light English expansion (in code)** | Reduce misses for regular inflections—**tune carefully** to avoid noise. | Whole-word match on stem + optional suffixes: `-s`, `-es`, `-ed`, `-ing`, `-tion` (e.g. *integrate* → *integrated*, *integration*) |
| **E. Exclusions (later)** | When (D) adds false positives, add block phrases. | `priceless` → exclude or require `price` not followed by `less` |

**Recommendation for v1 (after approval):** implement **A + B + C** first (full explicit lists per theme—see §4). Add **D** only if logs show systematic misses (e.g. always “launched” but list only “launch”). **Priority = miss fewer real items** → prefer slightly longer `keywords` arrays over aggressive stemming.

---

## 4. Theme taxonomy + word / phrase variations (editable)

Use **case-insensitive**, **whole-word** matching for single tokens where possible; phrases can be substring or token-sequence (implementation detail).

**Legend:** *Core* = minimum set; *Variations* = add these to config for coverage.

### expansion
| Core / phrases | Word variations & related |
|----------------|---------------------------|
| expansion, new market, enter market, geographic, nationwide, global rollout | expand, expands, expanded, expanding, internationally, international, worldwide, globally, cross-border, new region, new office, opens office, opened office, office opening, EMEA, APAC, LATAM, multi-family, multifamily, footprint, scaling in |

### product_launch
| Core / phrases | Word variations & related |
|----------------|---------------------------|
| new product, new feature, now available, generally available, go-live | launch, launches, launched, launching, rollout, rolled out, release, releases, released, releasing, ship, ships, shipped, shipping, introduce, introduces, introduced, introducing, introduction, debut, unveiled, unveiling, beta, alpha, GA, generally available, feature flag |

### partnership
| Core / phrases | Word variations & related |
|----------------|---------------------------|
| strategic partnership, technology partnership, integration partnership | partner, partners, partnered, partnering, partnership, partnerships, integrate, integrates, integrated, integrating, integration, integrations, interoperate, interoperability, collaborates, collaboration, alliance, alliances, reseller, resellers, OEM, co-sell, certifies, certified, certification |

### pricing
| Core / phrases | Word variations & related |
|----------------|---------------------------|
| enterprise pricing, list price, price per unit, per door, subscription plan, free trial, discount | price, prices, pricing, priced, reprice, repriced, repricing, costly, cost, costs, fee, fees, bill, bills, billed, billing, tariff, tariffs, rate card, plan, plans, tier, tiers, package, packages, subscription, subscriptions, subscribe, promotional, promotion, promotions, discount, discounts |

### ai
| Core / phrases | Word variations & related |
|----------------|---------------------------|
| artificial intelligence, machine learning, large language model | AI, A.I., ML, LLM, LLMs, generative, gen AI, chatbot, chatbots, copilot, copilots, virtual agent, conversational AI, NLP, natural language, neural, model-powered, AI-powered |

### funding
| Core / phrases | Word variations & related |
|----------------|---------------------------|
| Series A, Series B, Series C, seed round, growth equity | fund, funds, funded, funding, fundraise, fundraising, invest, invests, invested, investing, investment, investments, investor, investors, valuation, IPO, SPAC, acquire, acquires, acquired, acquiring, acquisition, acquisitions, merger, mergers, merged, buyout |

### hiring
| Core / phrases | Word variations & related |
|----------------|---------------------------|
| open roles, open positions, we are hiring, join our team | hire, hires, hiring, hired, recruiter, recruiting, recruitment, careers, career, job opening, job openings, headcount, scaling team, grow the team, VP of, vice president, head of |

### positioning
| Core / phrases | Word variations & related |
|----------------|---------------------------|
| industry leader, market leader, category leader, best-in-class | leading, leader, leaders, first to, only platform, #1, number one, award-winning, award, awards, recognized, recognition |

### compliance_security
| Core / phrases | Word variations & related |
|----------------|---------------------------|
| SOC 2, SOC2, ISO 27001, GDPR, HIPAA, trust center | secure, secures, secured, securing, security, compliant, compliance, certify, certifies, certified, certifying, certification, certifications, pen test, penetration, vulnerability, data protection, privacy |

### brand_reorg (rebrand, spin-out, “is now”, new parent)

| Core / phrases | Word variations & related |
|----------------|---------------------------|
| is now, now part of, introducing our new name, new brand, rebranding, rebrand, rebranded, renamed, name change, formerly known as, dba, doing business as | under new ownership, combined with, merger of brands, unified as, welcome to the new, meet our new, same team new name, new chapter, new era, standalone, spin-off, spinoff, carve-out, new operating model, business transformation, strategic transformation |

**AI / product rename (often with rebrand):** standalone AI, AI-first, powered by, brought to you by, subsidiary of, division of, part of the family.

**Competitor-specific tokens (add to config when you see them):** e.g. *Fenix*, *Fenixai*, *Funnel* (when tied to rename narrative), *LeaseHawk* + *Fenix* in same snippet — near-zero false positives when names are unique.

*Real-world pattern:* public homepage modal + press/video (“Meet Fenix…”) — **homepage HTML** + **YouTube feed** + **brand_reorg** keywords together surface the story for managers.*

*Add competitor-specific product names and acronyms as you see them in feeds (e.g. product codenames)—those catch high-signal mentions with near-zero false positives.*

---

## 5. Configuration shape (draft)

Flat **`keywords`** array per theme is fine: **merge** “core + phrases + all variations” into one list for v1 (simplest to test). Alternatively split for readability:

```json
{
  "version": 1,
  "themes": {
    "pricing": {
      "label": "Pricing & packaging",
      "keywords": [
        "price", "prices", "pricing", "priced", "reprice", "repriced", "repricing",
        "plan", "plans", "tier", "tiers", "subscription", "subscriptions",
        "per door", "per unit", "list price", "discount", "discounts", "promotion"
      ],
      "phrases": ["enterprise pricing", "free trial", "rate card"]
    }
  },
  "matching": {
    "caseInsensitive": true,
    "wordBoundary": true,
    "lightEnglishSuffixes": false
  },
  "options": {
    "minTextLength": 40,
    "maxThemesPerSignal": 6
  }
}
```

- **`keywords`**: single tokens and short compounds you match with word boundaries.  
- **`phrases`**: multi-word strings (match as substring or ordered tokens—define in `themeDetector.js`).  
- **`lightEnglishSuffixes`**: when `true`, optionally expand each keyword with safe suffix rules (documented in code + tests).

Optional later: **regex** per theme, **locale**, **exclusions** (“not hiring”, “priceless”).

---

## 6. Implementation phases (execute after confirmation)

| Phase | Work | Outcome |
|-------|------|--------|
| **A** | Add `competitive-themes.json` (full **keywords + phrases** from §4) + `themeDetector.js` + unit tests | Themes from static text; regression tests for variant forms (e.g. *priced*, *launched*) |
| **B** | Attach `themes[]` in collect (or single merge step before `writeSignals`) | Signals carry themes |
| **C** | Gap report + API: `gap.themes` | Report JSON ready for UI |
| **D** | UI: theme chips on row + filter + optional “Summary by theme” | Manager-ready view |
| **E** (optional) | Priority rules: e.g. `funding` + `product_launch` → highlight | Tuning |

---

## 7. Guardrails (align with Entrata + your manager)

- Only text from **configured public URLs** (existing behavior).
- **403/401:** no retry; no escalation (already logged).
- **Rate / volume:** keep caps on article fetches; keywords do not add new URLs by themselves.
- **Human review:** themes are **heuristic**—copy should still show **source link** so managers can verify.

---

## 8. Checklist before implementation

- [ ] Manager written/email confirmation for automated collection from public competitor URLs (this initiative).
- [ ] Legal/comms tick if required by your org.
- [ ] Freeze v1 theme list with PM (you + manager): which themes matter for L2L?
- [ ] Run Phase A–D in order; ship behind nothing extra if you want—all additive.
- [ ] After first month of data, review **missed** headlines and add any missing **variants/phrases** to `competitive-themes.json` (keep miss rate low).

---

*Last updated: plan for post-confirmation implementation. No code change required to “activate” this doc—implementation starts when you get the green light.*
