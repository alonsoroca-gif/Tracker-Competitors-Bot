---
name: billy-tracker-onboard
description: Guide Billy through first-time Tracker brief setup using BILLY-COMPLETE-SETUP.md — clone repos, workspace, Core parity, preflight, demo, morningbrief blocks. Use when Billy opens the setup doc in Cursor and says "guide me through setup", "help me install tracker", "walk me through BILLY-COMPLETE-SETUP", or pastes the Part 0 kickoff prompt.
---

# Billy Tracker onboard

Interactive guide for **first-time setup**. Billy opens this repo in Cursor with `BILLY-COMPLETE-SETUP.md` and asks you to walk him through.

**Source of truth:** `initiative-1-tracker/docs/BILLY-COMPLETE-SETUP.md`

**Do not skip verification** — run each gate command and show pass/fail before the next part.

---

## How to run this skill

Billy pastes:

> Read `initiative-1-tracker/docs/BILLY-COMPLETE-SETUP.md` and guide me step-by-step through setup. Run verification commands for me. When preflight passes, run the Product-day demo and explain what I will see each morning.

---

## Guide sequence

### Part 0 — Orient (1 min)

Explain the three moving parts: GHA collect (automatic), tracker-publish @ morningbrief Step 0, tracker-feed @ ~8:20 with **auto-open viewer**.

### Part 1 — Prerequisites

Ask Billy to confirm SSH, `entrata/core` access, Node 18+. Help fix blockers before cloning.

### Part 2 — Clone repos

Run or guide:

```bash
git clone … Tracker Competitors Bot
git clone git@github.com:entrata/core.git entrata-core
ls entrata-core/Applications | head
```

### Part 3 — Workspace

Help copy `entrata-plus-tracker.code-workspace.example` → `entrata-plus-tracker.code-workspace` with **his** Core path. Open workspace in Cursor.

### Part 4 — Wire + verify

```bash
cd initiative-1-tracker/tracker
npm install
node scripts/core-parity-check.js --save-core <HIS_CORE_PATH>
npm run verify:core
npm run test:parity
npm run manager:preflight
```

All must PASS before continuing.

### Part 5 — First-run demo (required)

```bash
npm run billy:demo
```

Explain:

- Chat output = what tracker-feed pastes at ~8:20
- Browser auto-opens viewer with **2 prototypes** (Product day fixture)
- PMM-only days = table only, 0 prototypes

### Part 6 — Morningbrief blocks

Point Billy to Part 5 of the doc (Step 0 kickoff + tracker section with `--open`). Confirm he saved blocks in morningbrief skill.

### Part 7 — Done

Remind: first **live** publish happens tomorrow ~8:00 Step 0. Slack late pings work if Alonso added webhooks (optional).

---

## Rules

| Do | Don't |
|----|-------|
| Run commands in his terminal | Run `/trackerstart` during setup |
| Use his real Core path | Assume Alonso's paths |
| Run `billy:demo` before declaring done | Skip preflight |
| Explain each demo section | Improvise from `tracker-drops/` |

---

## Related

- `initiative-1-tracker/docs/BILLY-COMPLETE-SETUP.md`
- `initiative-1-tracker/docs/SLACK-WEBHOOK-SETUP.md` (Alonso only)
