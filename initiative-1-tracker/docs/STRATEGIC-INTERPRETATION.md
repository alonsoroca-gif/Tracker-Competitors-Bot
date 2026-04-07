# Strategic interpretation — core product rule

**Without strategic interpretation, this bot does not fulfill its purpose.**

Raw competitor scrapes (feeds, pages, reviews) are **inputs**. They answer “what text did we see?” They do **not** answer “what should we believe?” or “how hard should we react?” The tracker exists to **compress** those inputs into **actionable competitive reads** your team can scan weekly.

---

## What “interpretation” is (implemented)

Every gap row includes **`interpretation`** (built in `tracker/lib/gapInterpretation.js`):

| Field | Job |
|--------|-----|
| **`headline`** | One-line **strategic read**: prefers **metrics** and **entities**, then de-fluffed action; avoids repeating hero taglines when possible. |
| **`strategic_why`** | **Epistemic** guidance: corroboration, pillars, multi-surface repetition → e.g. owned-only verification or cross-pillar conviction (no bot-ingestion jargon). |
| **`threat_tag`** | **Triage label** from priority + dimension + corroboration (e.g. capability pressure vs packaging vs watch). |
| **`competitor_move`** | **Factual capture** (unchanged): scraped/extracted line, shown as **Captured:** under the read in the UI. |

Interpretation is **rule-based** (no LLM): it **does not invent** numbers or claims. It **frames** what you already stored using dimension, intel pillars, and corroboration.

### Headline construction (concrete-first)

The **`headline`** is built in priority order:

1. **Metric / proof excerpt** — If `metricOrFactExcerpt` on the representative signal yields a line with numbers, `%`, or `$`, the headline **leads** with that clause (not with generic “product and capabilities” boilerplate).
2. **Structured entities** — Else if `entities` has prices, tiers, integrations, features, keywords, or positioning terms, the headline summarizes those in a short clause.
3. **De-fluffed action** — Else the text after `Competitor:` is split on middle dots (`·`); **hero-style** segments (e.g. “driving the future…”, long title-like lines without facts) are dropped in favor of segments that carry **facts** or concrete nouns.
4. **Honest fallback** — If nothing concrete remains, the headline says the **surface** updated and points readers to **Captured** / **Details** instead of repeating a marketing tagline.

**`strategic_why`** uses plain language about **confidence** and **corroboration**; it does **not** use ingestion jargon (“cluster”, “pickups”, “triage”) for multi-signal rows.

---

## Where it shows up

- **Report UI** — “Competitive move” column: insight on top, **Captured:** below.  
- **`GET /api/report`** — `gaps[].interpretation` + `gaps[].competitor_move`.  
- **Response schema** — `competitor_action` prefers **`interpretation.headline`**; recommendations still cite the **factual** line as evidence.  
- **Minimal model bundle** — `strategic_interpretation` for any future approved model path.

---

## Rules for evolving the bot

1. **Do not weaken interpretation** for the sake of shorter copy — shorten the factual line or Details, not the read.  
2. **Tune templates** in `gapInterpretation.js` when the team’s language or risk posture changes.  
3. **LLM later** (if approved) should **augment or rewrite** `interpretation`, not replace the fence + factual traceability without policy sign-off.

---

## Related

- [COMPETITIVE-INTEL-PRESENTATION.md](./COMPETITIVE-INTEL-PRESENTATION.md) — L1/L2/L3 layout (L1 now = interpretation + captured).  
- [WEEKLY-INTEL-FLOW.md](./WEEKLY-INTEL-FLOW.md) — pillars, corroboration, clustering.  
- [INTEL-FENCE-MVP.md](./INTEL-FENCE-MVP.md) — safe excerpts and storage.
