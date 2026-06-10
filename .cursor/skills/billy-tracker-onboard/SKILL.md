---
name: billy-tracker-onboard
description: Guide Billy through first-time Tracker brief setup using BILLY-COMPLETE-SETUP.md — clone repos, workspace, Core parity, preflight, demo, morningbrief blocks. Use when Billy opens the setup doc in Cursor and says "guide me through setup", "help me install tracker", "walk me through BILLY-COMPLETE-SETUP", or pastes the Part 0 kickoff prompt.
---

# Billy Tracker onboard

Interactive guide for **first-time setup**. Billy opens this repo in Cursor with `BILLY-COMPLETE-SETUP.md` and asks you to walk him through.

**Source of truth:** `initiative-1-tracker/docs/BILLY-COMPLETE-SETUP.md`

**Do not skip verification** — run each gate command and show pass/fail before the next part.

---

## How Billy gets this skill (no marketplace install)

Skills are **bundled in the repo** at `.cursor/skills/billy-tracker-onboard/`. After Billy clones and opens this repo (or `entrata-plus-tracker` workspace) in Cursor, project skills load automatically. If not, **Developer: Reload Window**.

Verify path exists: `.cursor/skills/billy-tracker-onboard/SKILL.md`.

## How to run this skill

Billy pastes:

> Read `initiative-1-tracker/docs/BILLY-COMPLETE-SETUP.md` and guide me step-by-step through setup. Run verification commands for me. When preflight passes, run brief:install-opener and reload Cursor, then billy:demo and explain what I will see each morning.

Or:

> Use the billy-tracker-onboard skill and walk me through BILLY-COMPLETE-SETUP.md

---

## Guide sequence

### Part 0 — Orient (1 min)

Explain: GHA collect (automatic), morningbrief **Step 0** preflight, **Step 1** tracker-publish (background), tracker-feed @ ~8:20 opens viewer in **Cursor Simple Browser**.

### Part 1 — Prerequisites

Ask Billy to confirm SSH, `entrata/core` access, Node 18+. Help fix blockers before cloning.

### Part 2 — Clone repos

Run or guide clone Tracker + entrata-core. Verify `Applications/` exists.

### Part 3 — Workspace

Copy `entrata-plus-tracker.code-workspace.example` with **his** Core path. Open workspace in Cursor.

### Part 4 — Wire + verify

```bash
cd initiative-1-tracker/tracker
npm install
node scripts/core-parity-check.js --save-core <HIS_CORE_PATH>
npm run verify:core
npm run test:parity
npm run manager:preflight
```

All must PASS before Part 5.

### Part 5 — Cursor opener (one-time)

```bash
cd initiative-1-tracker/tracker
npm run brief:install-opener
```

Then **Developer: Reload Window**. Explain: no `cursor://vscode.runCommands`; bundled `entrata.tracker-brief-opener` extension.

### Part 6 — First-run demo (required)

```bash
cd initiative-1-tracker/tracker
npm run billy:demo
```

Walk through:

1. **Chat block** — summary + 6-column table + prototype bullets (What, ROI, Math line)
2. **Viewer in Simple Browser** — responsive table + skim ROI cards + **Open prototype** for full detail
3. **PMM-only contrast** — same table, 0 prototypes

### Part 7 — Morningbrief blocks

Point to doc Part 7: Step 0 `morningbrief:preflight`, Step 1 tracker-publish kickoff, ~8:20 tracker-feed `--open`.

### Part 8 — Done

First live morningbrief: Step 0 preflight → Step 1 publish → ~8:20 feed. Slack optional.

---

## Rules

| Do | Don't |
|----|-------|
| Run commands from `initiative-1-tracker/tracker` | Run from `entrata-core` cwd |
| Run `brief:install-opener` before demo | Skip opener (auto-open fails) |
| Run `billy:demo` before declaring done | Skip preflight |
| Explain Simple Browser vs Chrome | Use `vscode.runCommands` URLs |

---

## Related

- `initiative-1-tracker/docs/BILLY-COMPLETE-SETUP.md`
- `initiative-1-tracker/docs/SLACK-WEBHOOK-SETUP.md` (Alonso only)
