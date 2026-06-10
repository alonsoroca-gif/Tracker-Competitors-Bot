---
name: tracker-publish
description: Morningbrief factory on Billy's Mac — kicks off at 8am in background; interpret, Core parity (Path A local or optional GitHub API), PRDs, prototypes, writes tracker-briefs. Use when morningbrief Step 0 starts publish or user says "tracker publish". Do NOT use for tracker-feed, /trackerstart, or CI collect.
---

# tracker-publish

**Factory skill** — automates what `/trackerstart` does in chat, writing outputs to `tracker-briefs/`. Runs as **background agent** when morningbrief starts (~8:00am MT); Billy continues other subskills in parallel.

`/trackerstart` (**tracker-drop-cycle**) stays **unchanged** — manual lab for judgment and dry-runs.

## Schedule (locked)

| Time (MT) | Action |
|-----------|--------|
| 5:00pm | CI collect |
| 5:45am | CI collect |
| **5:35am** | **Preflight** → operator Slack only |
| **7:45am** | GHA readiness — **not ready is expected** (publish has not started) |
| **~8:00am** | **morningbrief Step 0** → **tracker-publish** background kickoff |
| **~8:20–8:30am** | morningbrief tracker section → **tracker-feed** |

Overnight unattended publish is **out of scope**. Core parity runs when Billy opens morningbrief.

---

## Phase 0a — Workload preflight (operator + log in publish)

```bash
node initiative-1-tracker/tracker/scripts/publish-preflight.js
```

Operator sees estimate via GHA @ 5:35am. Publish agent logs the same at kickoff.

**Estimates:** ~12 min PMM-only · ~20–28 min with 1–2 Product rows · up to ~75 min heavy days.

---

## Phase 0b — Core gate (mandatory)

**Default Path A** — local clone + `git pull` each run. **Optional Path B** — GitHub API token if Billy configures it.

```bash
node initiative-1-tracker/tracker/scripts/manager-core-preflight.js
```

| Exit | Action |
|------|--------|
| **0** | Continue to Phase 1 |
| **2** | **STOP.** Use `AskQuestion` — do not run Product parity until fixed |

### First-run AskQuestion

```
AskQuestion:
  prompt: "Core parity setup — Path A (local clone) is the default. What do you need?"
  options:
    - "Path A — local clone; git-pull each publish (default)"
    - "Path B — I have a GitHub API token for entrata/core"
    - "Help me set Core path (--save-core) first"
    - "Open CORE-CLONE-SETUP.md checklist"
    - "Skip publish today"
```

After first successful publish with Path A, optionally say:

> _Optional upgrade: a GitHub API token on `entrata/core` speeds Layer 1 — see `TRACKER-PARITY-GITHUB.md`. Layer 2 still needs your local clone._

**Checklist:** `initiative-1-tracker/docs/BILLY-TRACKER-SETUP.md`, `CORE-CLONE-SETUP.md`.

---

## Phase 1 — Resolve drop

1. `git pull origin main`
2. Read `tracker-drops/.latest-drop-id`
3. Confirm drop age / hash vs prior (same rules as tracker-drop-cycle Phase 0, but **no AskQuestion** — auto-skip empty hash-match days)

If no net-new interpret rows → still publish PMM-only brief; set `prototype_count: 0`.

---

## Phase 2 — Interpret + classify (automated)

For each **net-new** signal:

1. Classify: Product | PMM | News | …
2. Route: Tier — Now / Later / Won't chase
3. Write rows to `tracker-briefs/runs/<run_id>/signals-table.json`

**Reuse rules** from tracker-drop-cycle Phase 4. **No AskQuestion** — deterministic defaults; `needs_review: true` on ambiguous rows.

---

## Phase 3 — Parity (Product rows only)

**Each run — Path B if token configured, else Path A:**

```bash
# Path B (optional — faster Layer 1 @ main)
node initiative-1-tracker/tracker/scripts/verify-github-core-access.js
echo '[...]' | node initiative-1-tracker/tracker/scripts/core-parity-check.js --stdin --github --format markdown

# Path A (default — git pull first)
cd <entrata-core> && git checkout main && git pull origin main
node initiative-1-tracker/tracker/scripts/verify-core-setup.js
echo '[...]' | node initiative-1-tracker/tracker/scripts/core-parity-check.js --stdin --format markdown
```

**Layer 2 required** — agent Read/Grep on **local** Core in workspace. Layer 2 wins.

Non-Product rows: `parity: "—"`.

---

## Phase 4 — PRDs + prototypes (Product / Tier — Now only)

For each Tier — Now Product row:

1. **PRD** — use `tracker-drop-cycle` §4.4 template (Problem, Target user, Existing Entrata implementation, Delta vs Core, Scope, Net-new engineering ask). Write to `tracker-briefs/runs/<run_id>/prds/<slug>.md`
2. **HTML vignette** (Tier 1 prototype) → `tracker-briefs/runs/<run_id>/prototypes/<slug>.html` — viewer-embeddable static HTML, not `create-prototype`
3. Register in `prototypes.json`

Skip when `product_row_count === 0`.

### Prototype tier — not `create-prototype` here

**This phase does not invoke `create-prototype`.** Reason: morning publish must finish in ~12–45 min and commit static artifacts to `tracker-briefs/` for the viewer. `create-prototype` (React app, dev server, Product OS workspace) lives in **`/trackerstart`** Phase 5 — same signal, **better visual quality**, ~1–3 h per row.

See `initiative-1-tracker/docs/TRACKER-PROTOTYPE-TIERS.md`.

---

## Phase 5 — Write manifest + latest.json

Write manifest, signals-table, prototypes.json, `latest.json` → `status: "ready"`.

```bash
node initiative-1-tracker/tracker/scripts/brief-readiness-check.js --mark-ready
```

Commit + push `tracker-briefs/` to `main`.

---

## Phase 6 — Handoff to tracker-feed

**Do not** run tracker-feed. Morningbrief tracker section consumes output when ready.

If tracker section runs before Phase 5 completes → tracker-feed shows not-ready; Slack DM when `ready`.

---

## Kickoff prompt file

`initiative-1-tracker/automation/morningbrief/tracker-publish-kickoff.md`

---

## Related

- Consumer: `.cursor/skills/tracker-feed/SKILL.md`
- Morningbrief paste: `initiative-1-tracker/docs/MORNINGBRIEF-TRACKER-PROMPT.md`
- Reference lab: `.cursor/skills/tracker-drop-cycle/SKILL.md`
- GitHub parity (optional): `initiative-1-tracker/docs/TRACKER-PARITY-GITHUB.md`
