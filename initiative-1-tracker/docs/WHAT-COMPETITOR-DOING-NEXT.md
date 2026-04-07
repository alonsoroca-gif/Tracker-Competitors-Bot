# What competitor is doing — done vs next tasks

**Framework:** Table column **Competitive move** is **Layer L1** in [COMPETITIVE-INTEL-PRESENTATION.md](./COMPETITIVE-INTEL-PRESENTATION.md). This doc tracks refinements to that line only; L2/L3 stay as defined there.

## Done (this pass)

- Main gap line is **`Competitor: action + metrics`** (no `Competitor · action · source` triplet; **Source** stays in its own column).
- Dropped **headlines** as the primary row text (`Noted: …` removed); headlines remain under **Details** with full evidence.
- **YouTube (search)** row text uses **discovery queries only** (no channel title in that column).
- **`metricOrFactExcerpt`** prefers sentences with **numbers / $ / % / scale words** or **strong action verbs** before falling back to generic event labels.
- Last-resort copy points users to **Details** instead of vague “Activity on …”.

Code: `tracker/lib/gapReport.js` (`metricOrFactExcerpt`, `specificActionPhrase`, `buildConciseCompetitorMove`).

---

## Next session — task list

1. **Tighten “features / positioning” entity lines**  
   When only `positioning_keywords` exist (no capabilities list), decide if the row should still show them or force **`metricOrFactExcerpt`** first to avoid marketing fluff.

2. **Per-source extractors**  
   Add dedicated one-liners for **blog RSS**, **press**, **changelog** (e.g. first bullet with version + date) instead of long `cleanSnippet` tails.

3. **Deduplicate near-identical rows**  
   Same competitor + same week + very similar `competitor_move` → merge or collapse with a count badge.

4. **Competitor column (optional)**  
   If you add a **Competitor** column, shorten **What competitor is doing** to **insight-only** (drop the `Name:` prefix) to avoid repetition.

5. **Configurable “banned phrases”**  
   Move skip-list phrases (nav, “learn more”, etc.) to **`config/gap-copy-filters.json`** so PMs can tune without code.

6. **LLM or rules for “insight score”**  
   Optional: score candidate sentences; show only above threshold, or sort Details by score.

7. **Tests with real fixtures**  
   Add **`test/fixtures/signals/*.json`** and assert expected **`competitor_move`** strings for regression (pricing page, G2, YouTube, blog).

8. **“What they’re doing” in What to change**  
   `whatToChange` / `responseSchema` still use **`competitor_action`**; align copy with the same rules if you want the sidebar to mirror the table exactly (or show a shorter clip).

9. **Internationalization / encoding**  
   Ensure **`metricOrFactExcerpt`** and **`cleanSnippet`** handle currency symbols beyond `$` (€, £) if you expand regions.

10. **Manager view export**  
    CSV / email digest: include **`competitor_move`**, **`source`**, **`source_url`**, and one **metric column** parsed from text (optional follow-up).

---

*When you resume: run `node scripts/session-context.js` from repo root if you use the session workflow.*
