# Prototype tiers — morningbrief vs deep dive

Billy’s daily brief and your manual lab produce **the same competitive story** at different **depths**. The split is intentional — mainly **time**, not missing capability.

---

## Two tiers

| | **Tier 1 — `tracker-publish`** (Billy ~8am) | **Tier 2 — `/trackerstart`** (you, manual) |
|--|---------------------------------------------|---------------------------------------------|
| **Trigger** | morningbrief Step 0 (background) | `/trackerstart` in Cursor |
| **Prototype** | **HTML vignette** in `tracker-briefs/viewer/` | **`create-prototype`** — full app in Product OS workspace |
| **PRD** | Full §4.4 markdown + PDF download | Same §4.4 shape + optional Chrome PDF to `tracker-decks/` |
| **Also** | Signals table, parity, routing | + grade-spec, design-critique, walkthrough video |
| **Typical time** | ~12–45 min total publish | ~1–3+ hours per Tier — Now Product row |
| **Why** | Fits Billy’s parallel morning window | Quality + gates when a signal deserves a full counter-position |

---

## Same results, different quality

Both tiers answer:

- What did the competitor signal?
- How do we classify and route it?
- What does Core already ship (parity)?
- What should Entrata build or chase?

**Tier 1** gives Billy a **skim-ready brief**: chat table, PRD PDF, **quick visual vignette** in the Tracker Brief Viewer.

**Tier 2** gives you a **production-style prototype** (design system, dev server, critique, video) for leadership or eng conversations.

The vignette is not a lesser *decision* — it is a **faster visual**. The PRD carries the engineering depth. When the vignette feels too thin, run Tier 2 on the same signal.

---

## When to use which

| Situation | Use |
|-----------|-----|
| Billy’s weekday morningbrief | **Tier 1** only — automatic |
| PMM-only day (0 Product rows) | Tier 1 table — no prototypes |
| One signal needs a demo for execs | **Tier 2** — `/trackerstart` on that row |
| Weekly “hero” counter-position | Tier 1 daily + Tier 2 on the top signal |

---

## How to go deep (`/trackerstart`)

1. Open Tracker + Core workspace.
2. Run **`/trackerstart`** (skill: `tracker-drop-cycle`) on the drop or signal.
3. After §4.4 PRD, Phase 5 runs: `feature-spec` → `create-prototype` → `design-critique` → video (with manager gates).

Tier 1 publish does **not** invoke `create-prototype` — not because the subskill is unavailable, but because it does not fit an unattended ~8am factory (workspace, dev server, runtime, viewer packaging).

---

## Related

- [TRACKER-AUTOMATION.md](./TRACKER-AUTOMATION.md)
- [BILLY-TRACKER-SETUP.md](./BILLY-TRACKER-SETUP.md)
- `.cursor/skills/tracker-publish/SKILL.md` — Tier 1
- `.cursor/skills/tracker-drop-cycle/SKILL.md` — Tier 2 (Phase 5)
