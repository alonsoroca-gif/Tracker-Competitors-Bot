# ProspectPortal — Discovery questions (v1)

Final list of the **3 key questions** that prospect what the client wants from the final product, and why each matters for generation.

---

## The 3 questions (v1)

### Q1. What is the main goal of the site?

**Example phrasing:** “What’s the single most important thing you want visitors to do or feel when they land on this site?”

**Why it matters:** Drives information hierarchy, CTA placement, and tone. A “get signups” goal favors signup forms and social proof; a “learn about us” goal favors narrative and team/product sections. The bot uses this to choose layout and copy emphasis.

**Example answers:** “Get demo signups.” / “Explain our product to enterprise buyers.” / “Show portfolio and get project inquiries.”

---

### Q2. Who is the primary audience?

**Example phrasing:** “Who are you trying to reach first? (e.g. job title, industry, or type of visitor)”

**Why it matters:** Shapes tone, vocabulary, and content depth. B2B vs B2C, technical vs non-technical, and segment (e.g. “CTOs” vs “small business owners”) inform structure and wording. The bot uses this to tailor sections and copy.

**Example answers:** “CTOs at mid-market companies.” / “Freelancers and small agencies.” / “Consumers looking for quick comparisons.”

---

### Q3. What are 3 must-haves for the first version?

**Example phrasing:** “List up to 3 things that must be on the site in the first version (e.g. pricing, testimonials, contact form, blog).”

**Why it matters:** Ensures the generated site includes the non-negotiable elements. The bot maps answers to sections/components (e.g. “pricing” → pricing table block, “testimonials” → testimonial section, “contact form” → form + contact block). Missing must-haves would make the first draft unusable.

**Example answers:** “Pricing, contact form, and one case study.” / “Hero, feature list, and signup CTA.” / “About us, services, and FAQ.”

---

## How they’re used in the flow

1. **After the user pastes the reference link** — Bot ingests the link (structure, style hints).
2. **Bot asks Q1, Q2, Q3** — Conversational or form; answers are stored.
3. **Generate** — Goal (Q1) + audience (Q2) + must-haves (Q3) + reference link are passed to the “compelling models” and CSS tools to produce the full site.
4. **Deliver** — Preview and/or export; client can request changes (e.g. “add a second case study” or “tone down the CTA”).

---

## Optional follow-ups (future)

- “Any colors or fonts we must use or avoid?”
- “Do you have existing copy (e.g. headlines) to paste in?”
- “Single-page or multi-page for v1?”

For v1, the three questions above are the core; follow-ups can be added once the main flow is validated.

---

*Part of the three initiatives plan. See [ACTION-PLAN.md](../ACTION-PLAN.md).*
