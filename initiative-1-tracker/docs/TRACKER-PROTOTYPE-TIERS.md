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

**Tier 1** gives Billy a **skim-ready brief**: chat table, PRD PDF, **sophisticated static vignette** (ROI + brief + interaction UI) in the Tracker Brief Viewer. Quality bar: [TRACKER-VIGNETTE-STANDARD.md](./TRACKER-VIGNETTE-STANDARD.md).

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

## Tracker Brief Viewer vs Product OS workspace

| | **Tracker Brief Viewer** | **Product OS** (`localhost:5174/prototypes`) |
|--|--------------------------|-----------------------------------------------|
| **Purpose** | Billy's **daily brief** — that morning's signals + vignettes + ROI | Your **prototype lab** — full apps, design critique, branch history |
| **Storage** | `tracker-briefs/runs/<run_id>/` — one folder per publish day, git on `main` | `prototypes/` in PM workspace — auto-discovered, branch-scoped |
| **Past work** | **Run dropdown** in viewer (`runs-index.json`) — every committed brief day | Cards persist per prototype folder; switch branch to see variants |
| **Who** | Billy @ ~8:20 (auto-open) | You on `/trackerstart` deep dives |

**Why not only Product OS for Billy?**

1. **Time** — morning publish must commit static HTML + JSON Billy can open without a dev server.
2. **Separation** — daily competitive intel ≠ long-lived PM prototypes; mixing them clutters Product OS.
3. **Git handoff** — `tracker-briefs/` pushes to GitHub; Billy `git pull`s the brief, not your PM workspace.

**Convergence path (optional later):** Tier 2 `/trackerstart` can symlink or copy a hero prototype into Product OS **and** link from the brief card (`product_os_path`). Not required for handoff.

---

## Related

- [TRACKER-AUTOMATION.md](./TRACKER-AUTOMATION.md)
- [BILLY-TRACKER-SETUP.md](./BILLY-TRACKER-SETUP.md)
- `.cursor/skills/tracker-publish/SKILL.md` — Tier 1
- `.cursor/skills/tracker-drop-cycle/SKILL.md` — Tier 2 (Phase 5)
