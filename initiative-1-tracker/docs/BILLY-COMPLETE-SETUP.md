# Billy — complete Tracker setup (start → finish)

**One document.** Open it in Cursor and let the agent guide you.  
**Time:** ~25–35 minutes one-time.  
**No 5:50am schedule. No overnight laptop.**

---

## Part 0 — Start in Cursor (do this first)

1. Clone the Tracker repo (Part 2a) if you have not already.
2. Open the repo in **Cursor**.
3. Open **this file** in the editor.
4. Paste into **Cursor chat**:

```
Read initiative-1-tracker/docs/BILLY-COMPLETE-SETUP.md and guide me step-by-step through setup (Parts 1–7). Run each verification command for me. When manager:preflight passes, run brief:install-opener and reload Cursor, then npm run billy:demo and explain what I will see each morning on Product signal days.
```

Cursor uses the **billy-tracker-onboard** skill and walks you through every step — clone, workspace, verify, opener, demo, morningbrief blocks.

**You do not need to memorize commands.** The agent runs them with you.

### How the onboarding skill gets into Cursor (no separate install)

Tracker skills **ship inside this repo** under `.cursor/skills/`:

| Skill | Purpose |
|-------|---------|
| `billy-tracker-onboard` | This setup walkthrough |
| `tracker-feed` | ~8:20 daily brief consumer |
| `tracker-publish` | Background factory (morningbrief Step 1) |

**After `git pull`**, open the **Tracker Competitors Bot** folder (or `entrata-plus-tracker` workspace) in Cursor:

1. **File → Open Folder / Open Workspace** — must be this repo root (skills are project-scoped).
2. **Reload window** once if needed: Command Palette → `Developer: Reload Window`.
3. Confirm skills exist on disk: `.cursor/skills/billy-tracker-onboard/SKILL.md` (and `tracker-feed`, `tracker-publish`).
4. Paste the **Part 0** prompt — Cursor loads project skills automatically; you do **not** add them from the Cursor marketplace.

If the agent does not pick up the skill by name, paste explicitly:

```
Use the billy-tracker-onboard skill. Read initiative-1-tracker/docs/BILLY-COMPLETE-SETUP.md and guide me step-by-step.
```

**Personal vs project skills:** These live in the **repo**, not your global `~/.cursor/skills`. Anyone who clones the repo gets them on `main`.

**Out of scope for this doc:** personal morningbrief subskills (Email, Calendar, Slack, Notion, AI news in `~/.cursor/skills/morningbrief-*`). Part 7 below covers **tracker blocks only**.

---

## What you are installing

| Piece | What it does | You run it? |
|-------|----------------|-------------|
| **GitHub Actions (5:45am)** | Collects competitor signals → `tracker-drops/` | Automatic |
| **morningbrief Step 0** | Auto preflight — skills + kickoff files on disk | Agent runs `morningbrief:preflight` |
| **tracker-publish (Step 1 ~8am)** | Interpret → Core parity → PRDs → vignettes → `tracker-briefs/` | Background agent |
| **tracker-feed (~8:20)** | Today's brief in chat + **auto-opens viewer** | End of morningbrief |
| **Tracker Brief Viewer** | Responsive signals table · prototype cards (skim ROI) · PRD PDFs · full detail on **Open prototype** | **Cursor Simple Browser** via `--open` |

**Parity:** Path A — local `entrata-core` clone + `git pull` each publish. No GitHub API token required.

---

## Daily rhythm (after setup)

| Time | What |
|------|------|
| 5:45am | GitHub collects signals (you do nothing) |
| ~8:00am | **morningbrief Step 0** — auto preflight |
| ~8:00am | **morningbrief Step 1** — `tracker-publish` in **background** |
| 8:00–8:20 | Other morningbrief subskills (you are not blocked) |
| ~8:20 | **tracker-feed** — chat table + **viewer in Cursor Simple Browser** |
| Later | Slack DM if brief lands after 8:20 (Alonso wires webhooks) |

**Note:** In a single long chat session, publish may finish before feed — that's OK for testing. Production flow is background publish ~8:00 + feed ~8:20.

---

## Part 1 — Prerequisites (2 min)

| # | Check | If NO |
|---|--------|-------|
| 1 | GitHub access to **Tracker** repo | Ask Alonso (repo is public — clone works with any GitHub account) |
| 2 | GitHub access to **`entrata/core`** | Request from IT / manager |
| 3 | `ssh -T git@github.com` succeeds | [Add SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) |
| 4 | Node.js 18+ (`node -v`) | `brew install node` |
| 5 | VPN (if required) | Connect VPN |

---

## Part 2 — Clone repos (~10–20 min)

### 2a — Tracker repo

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone git@github.com:alonsoroca-gif/Tracker-Competitors-Bot.git "Tracker Competitors Bot"
cd "Tracker Competitors Bot"
git pull origin main
```

### 2b — entrata-core (required for publish)

```bash
cd ~/Projects
git clone git@github.com:entrata/core.git entrata-core
cd entrata-core
git checkout main
git pull origin main
ls Applications | head
```

Target layout:

```
~/Projects/Tracker Competitors Bot/
~/Projects/entrata-core/
```

| Error | Fix |
|-------|-----|
| `Permission denied (publickey)` | SSH key not on GitHub |
| `Repository not found` | Request `entrata/core` access |
| No `Applications/` | `git checkout main && git pull` |

---

## Part 3 — Cursor workspace (~5 min)

```bash
cd ~/Projects/"Tracker Competitors Bot"
cp entrata-plus-tracker.code-workspace.example entrata-plus-tracker.code-workspace
```

Edit `entrata-plus-tracker.code-workspace` — set Core path to **your** clone:

```json
{
  "folders": [
    { "name": "Tracker Competitors Bot", "path": "." },
    { "name": "Entrata Core Repo", "path": "/Users/YOU/Projects/entrata-core" }
  ]
}
```

**Cursor → File → Open Workspace from File…** → `entrata-plus-tracker.code-workspace`.

---

## Part 4 — Wire Core + verify (~10 min)

**Always run from the tracker package** (not `entrata-core`):

```bash
cd ~/Projects/"Tracker Competitors Bot"/initiative-1-tracker/tracker
npm install
node scripts/core-parity-check.js --save-core ~/Projects/entrata-core
npm run verify:core
npm run test:parity
npm run manager:preflight
```

**Must see:**

```
verify-core-setup: OK
21/21 passed
manager-core-preflight: PASS
```

Optional `~/.zshrc`:

```bash
export ENTRATA_MONO_ROOT=~/Projects/entrata-core
```

---

## Part 5 — Cursor Simple Browser opener (one-time, before first demo)

**Run after Part 4 PASS, before `billy:demo`.** Required so `tracker-feed --open` opens the viewer **inside Cursor**, not Chrome/Safari.

```bash
cd ~/Projects/"Tracker Competitors Bot"/initiative-1-tracker/tracker
npm run brief:install-opener
```

Then **Cmd+Shift+P → Developer: Reload Window**.

**Why:** `open-brief-viewer.js` uses local extension `entrata.tracker-brief-opener` + `cursor --open-url`. Without it, auto-open fails or Cursor shows: _"extension vscode.runCommands cannot be installed."_

**Do not use** `cursor://vscode.runCommands` — Cursor treats that as a marketplace install and errors.

**Manual fallback** if the tab does not appear after reload:

1. Run any open command (URL is copied to clipboard automatically).
2. **Cmd+Shift+P → Simple Browser: Show → Cmd+V**

**Optional:** `open-brief-viewer.js --external` opens Chrome/Safari instead.

---

## Part 6 — First-run demo (Product signal day)

**Run once after Part 5.** Shows fake data — what a meaningful Product morning looks like.

```bash
cd ~/Projects/"Tracker Competitors Bot"/initiative-1-tracker/tracker
npm run billy:demo
```

From repo root (alternative):

```bash
npm run billy:demo --prefix initiative-1-tracker/tracker
```

**Common mistake:** running from `entrata-core` or wrong cwd → command not found or wrong paths.

This will:

1. Print the **tracker-feed** markdown (summary + 6-column table + prototype bullets with ROI + math one-liner) — same shape as ~8:20 chat output.
2. **Auto-open** the Tracker Brief Viewer in **Cursor Simple Browser** with `_sample-product-day`.

**Viewer layout (what you skim each morning):**

| Screen | What Billy sees |
|--------|-----------------|
| **Signals** | Responsive table (no horizontal scroll); card layout on narrow panes. Hard-refresh if stale: **Cmd+Shift+R** (header shows `viewer roi-v9`). |
| **Main grid** | Per prototype: title, competitor, **key ROI metrics only** (PURSUE + 3 stat boxes), vignette preview, Open prototype / PRD |
| **Open prototype** | Full ROI (formula, inputs, scaling, edge, why pursue) + prototype brief + richer vignette UI |

Detail stays behind **Open prototype** so the main screen stays scannable when there are 2–3 signals.

| Demo section | Real morning |
|--------------|--------------|
| Summary `2 net-new · 2 prototypes` | Heavy Product day |
| Parity columns | Layer 2 verdicts from Core scan |
| Prototype cards | Tier 1 vignettes — `/trackerstart` for full Product OS apps |
| PMM-only days | Same table, **0 prototypes** — still review routing |

**Re-run anytime** (from tracker package): `npm run billy:demo`

---

## Part 7 — Morningbrief paste blocks

Paste **tracker blocks** into your morningbrief skill. Align with how the live morningbrief skill numbers steps:

| Morningbrief step | Tracker action |
|-------------------|----------------|
| **Step 0** (auto) | Agent runs `morningbrief:preflight` — Billy does not manually verify skill files |
| **Step 1** (~8:00) | Background **tracker-publish** |
| **Tracker section** (~8:20) | **tracker-feed** + `--open` |

### Step 0 — Auto preflight (agent runs each `/morningbrief`)

```bash
npm run morningbrief:preflight --prefix initiative-1-tracker/tracker -- --json
```

If `ok: false`, fix missing skills/kickoff files before continuing. Billy does not run this by hand in production — the morningbrief agent does.

---

### Step 1 — Kick off publish (~8:00am MT)

**After Step 0 passes.** Background only — do **not** wait for publish to finish.

1. Open **entrata-plus-tracker** workspace.
2. Background Cursor agent:
   - Prompt: `initiative-1-tracker/automation/morningbrief/tracker-publish-kickoff.md`
   - Skill: **tracker-publish**
3. Continue other morningbrief subskills immediately.

**Do not** run `/trackerstart` here (`/trackerstart` stays separate from daily publish).

---

### Tracker section — Feed (~8:20am MT)

```bash
node initiative-1-tracker/tracker/scripts/brief-readiness-check.js --json
node initiative-1-tracker/tracker/scripts/tracker-feed-render.js --open
```

`--open` **auto-starts** the local server (if needed) and **opens the viewer in a Cursor Simple Browser tab** (in-editor). Not Chrome/Safari unless you pass `--external` to `open-brief-viewer.js`.

**If `ok: false`:** skip section; Slack DM when ready (if wired). **Do not** show yesterday's brief.

**If ready:** paste feed output into chat — viewer is already open in Simple Browser.

---

## Part 8 — First live morningbrief

1. Workspace @ ~8:00am.
2. Step 0 → preflight PASS (agent).
3. Step 1 → background publish started.
4. ~8:20 → tracker-feed + viewer in Simple Browser.
5. Confirm `tracker-briefs/latest.json` updated after publish.

---

## Part 9 — Prototypes: vignettes vs deep dive

| Daily brief (`tracker-publish`) | Deep dive (`/trackerstart`) |
|--------------------------------|-----------------------------|
| HTML **vignettes** (~minutes) | **`create-prototype`** (~hours) |
| Same PRD + parity | Higher-quality full app |

Time constraint drives vignettes in daily publish. Hero signals → `/trackerstart`.

---

## Part 10 — Slack (Alonso wires — you receive)

**No API key.** Incoming Webhook URLs only.

| You receive | When |
|-------------|------|
| Late-ready DM | Brief finished after your 8:20 section |

**You configure nothing.** Alonso adds `SLACK_WEBHOOK_URL_BILLY` in GitHub (see `SLACK-WEBHOOK-SETUP.md`). Works without Slack — optional convenience.

---

## Part 11 — Troubleshooting

### `extension vscode.runCommands cannot be installed`

You tried a `cursor://vscode.runCommands` URL. **Don't** — use the bundled opener instead:

```bash
cd initiative-1-tracker/tracker
npm run brief:install-opener
```

Reload Cursor, then re-run `--open`.

### Viewer says opened but nothing visible

1. **Cmd+Shift+P → Simple Browser: Show**
2. **Cmd+V** (URL was copied to clipboard by the script)

### `git pull` fails on entrata-core (`fatal: bad object HEAD`)

Never copy a broken `.git` folder — fresh clone:

```bash
mv ~/Projects/entrata-core ~/Projects/entrata-core.broken-$(date +%Y%m%d)
git clone git@github.com:entrata/core.git ~/Projects/entrata-core
cd ~/Projects/"Tracker Competitors Bot"/initiative-1-tracker/tracker
node scripts/core-parity-check.js --save-core ~/Projects/entrata-core
npm run verify:core && npm run test:parity && npm run manager:preflight
```

### `manager:preflight` fails — no workspace

Part 3 — copy and edit workspace file.

### Viewer blank / 404

```bash
cd initiative-1-tracker/tracker
npm run brief:open-viewer
```

Do not open `index.html` as an editor tab — use the local server URL.

### Feed shows old run / wrong signal count

Publish may still be running. Wait for `tracker-briefs/latest.json` to update (`status: ready`), then:

```bash
npm run brief:feed --prefix initiative-1-tracker/tracker
node initiative-1-tracker/tracker/scripts/tracker-feed-render.js --open
```

### Brief "not ready" at 8:20

Normal on heavy Product days. Skip section; Slack later (if wired).

### `/morningbrief` in chat feels slow

In one long chat, publish may run to completion before feed. **Production:** background publish ~8:00 + feed ~8:20 in parallel with other subskills.

---

## Quick reference

All commands from repo root use `--prefix initiative-1-tracker/tracker` unless you `cd` into that folder first.

| Command | Purpose |
|---------|---------|
| `npm run manager:preflight` | Gate before first publish |
| `npm run morningbrief:preflight` | Gate before first `/morningbrief` (skills + kickoff) |
| `npm run brief:install-opener` | **One-time** — Cursor Simple Browser opener |
| `npm run billy:demo` | First-run Product-day demo |
| `npm run brief:feed` | Today's brief markdown |
| `npm run brief:open-viewer` | Open viewer in Cursor Simple Browser |
| `tracker-feed-render.js --open` | Feed + auto-open (daily) |
| `/trackerstart` | Deep dive prototypes (not daily publish) |

---

**Questions:** Alonso · **Slack setup (Alonso):** `SLACK-WEBHOOK-SETUP.md`
