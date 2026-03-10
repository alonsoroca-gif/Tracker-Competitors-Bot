# ProspectPortal — Tech/UX concept (one page)

How **CSS tools** and **compelling models** plug in to produce a full, polished website from one link + 3 answers.

---

## 1. High-level architecture

```
[Reference URL] + [Q1: goal, Q2: audience, Q3: must-haves]
        ↓
[Ingest] → structure + style hints (HTML/CSS scrape or headless)
        ↓
[Compose] → template selection + section mapping (from goal + must-haves)
        ↓
[Compelling models] → copy, headings, CTAs (LLM or rules)
        ↓
[CSS tools] → layout, typography, spacing, responsive (design tokens + framework)
        ↓
[Output] → HTML + CSS (+ optional assets) → preview + export
```

---

## 2. CSS tools (consistency and polish)

- **Design tokens:** Central palette (colors, type scale, spacing) so all generated pages share a consistent look. Tokens can be derived from the reference site (e.g. primary color from reference) or from a small set of “themes.”
- **Component library:** Reusable blocks (hero, feature grid, pricing table, testimonial, CTA, footer) with pre-built CSS. Each component is responsive and accessible (semantic HTML, focus states, contrast).
- **Layout system:** Simple grid/flex rules so sections stack correctly on mobile and desktop. No one-off pixel tweaks; everything is token- or component-driven.
- **Output:** One or more CSS files (e.g. base + components + page-specific overrides) that the generated HTML references. This keeps the “compelling” bar high without hand-crafting each page.

**V1 scope:** Static CSS; no runtime JS required for the first version (optional later for interactivity like forms).

---

## 3. Compelling models (content and structure)

- **Structure:** Map goal + must-haves to a section order and component set (e.g. “get signups” → hero with CTA, features, social proof, signup form; “portfolio” → hero, project grid, contact). Can be rule-based first (if goal = X and must_haves include Y, use template Z).
- **Copy:** LLM (or curated snippets) generates headlines, subheads, and body copy conditioned on audience and goal. Guardrails: length limits, tone (professional, friendly, etc.), and optional brand keywords.
- **CTAs:** Model suggests CTA text and placement from goal (e.g. “Book a demo,” “Start free trial,” “Get in touch”). CSS tools style the buttons consistently.
- **Optional:** Image placeholders or simple illustrations from a small set (e.g. undraw-style) keyed by section type; no custom image gen in v1 unless scoped.

---

## 4. Ingest (reference link)

- **Fetch:** Server-side fetch or headless browser (Puppeteer/Playwright) to get HTML (and linked CSS if needed). Respect robots.txt and rate limits.
- **Extract:** Parse HTML for sections (header, main, sections by heading level), nav items, and primary CTA if visible. Optionally extract computed colors and font families from the live page.
- **Normalize:** Output a compact “reference schema” (sections, style hints) that the Compose step uses. No need to store full HTML; only structure + palette/font hints.
- **Constraints:** v1 can support public, static or WordPress-style pages; auth-protected or heavy JS SPAs may need a later iteration.

---

## 5. Compose + output

- **Compose:** Merge reference hints + goal + audience + must_haves → select template (or template parts), fill slots with model-generated copy, assign components to sections.
- **Output:** Single HTML document (or multi-page if we scope it) + one or more CSS files. Optional: ZIP for download; or push to a host (e.g. Netlify) for preview URL.
- **Preview:** Serve generated output in an iframe or on a preview subdomain so the user can see the result before exporting.

---

## 6. UX principles

- **Fast:** Ingest + generate in under a minute for v1; show progress so the user isn’t left waiting blindly.
- **Editable:** Export is standard HTML/CSS so any dev or tool can edit; optional “regenerate with same answers” or “tweak one answer and regenerate.”
- **Accessible:** Semantic HTML, contrast, focus states, and responsive layout by default (enforced by CSS tools and component library).
- **Compelling:** “Compelling” = meets the bar above (consistent, readable, on-goal); not “designer-level custom” in v1. Quality bar can be raised with more themes and model tuning.

---

*Part of the three initiatives plan. See [ACTION-PLAN.md](../ACTION-PLAN.md).*
