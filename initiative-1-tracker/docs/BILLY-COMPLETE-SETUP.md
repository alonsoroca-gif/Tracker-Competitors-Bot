# Billy — complete Tracker setup (start → finish)

**One document.** Everything you need from first clone through daily morningbrief.  
**Time:** ~25–35 minutes one-time.  
**No 5:50am schedule. No overnight laptop.**

---

## What you are installing

| Piece | What it does | You run it? |
|-------|----------------|-------------|
| **GitHub Actions (5:45am)** | Collects competitor signals → `tracker-drops/` | Automatic |
| **tracker-publish (Step 0 ~8am)** | Interpret → Core parity → PRDs → vignettes → `tracker-briefs/` | Background agent when you start morningbrief |
| **tracker-feed (~8:20)** | Shows today's brief in chat + opens viewer | End of morningbrief |
| **Tracker Brief Viewer** | Wide table, prototypes, PRD PDFs | Browser / Simple Browser |

**Parity:** Path A — local `entrata-core` clone + `git pull` each publish. No GitHub API token required for handoff.

---

## Daily rhythm (after setup)

| Time | What |
|------|------|
| 5:45am | GitHub collects signals (you do nothing) |
| ~8:00am | Run **morningbrief** → **Step 0** starts publish in **background** |
| 8:00–8:20 | Other morningbrief subskills (publish runs in parallel) |
| ~8:20 | **tracker-feed** section — brief table + auto-open viewer |
| Later | If brief wasn't ready at 8:20, **Slack DM** when it lands (if webhooks configured) |

---

## Part 1 — Prerequisites (2 min)

Before cloning, confirm:

| # | Check | If NO |
|---|--------|-------|
| 1 | GitHub access to **Tracker** repo | Ask Alonso |
| 2 | GitHub access to **`entrata/core`** | Request from IT / manager |
| 3 | `ssh -T git@github.com` succeeds | [Add SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) |
| 4 | Node.js 18+ (`node -v`) | `brew install node` |
| 5 | VPN (if your org requires it for GitHub) | Connect VPN |

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

You should see `Admin`, `ProspectPortal`, `Leasing`, etc.

**Target layout:**

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

**Cursor → File → Open Workspace from File…** → select `entrata-plus-tracker.code-workspace`.

Always use this workspace for morningbrief (publish agent needs both roots).

---

## Part 4 — Wire Core + verify (~10 min)

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

Smoke test (feed only — OK if "not ready" until first publish):

```bash
npm run brief:readiness
npm run brief:feed
```

---

## Part 5 — Morningbrief paste blocks

Paste **both** into your morningbrief skill (or follow each run).

### Step 0 — Kick off publish (first action ~8:00am MT)

**Before any other subskill.** Background only — do **not** wait.

1. Open **entrata-plus-tracker** workspace.
2. Start a **background Cursor agent** with:
   - Prompt file: `initiative-1-tracker/automation/morningbrief/tracker-publish-kickoff.md`
   - Skill: **tracker-publish**
3. Tell yourself in chat: _Tracker publish started in background._
4. **Immediately** continue standup / portfolio / other subskills.

**Do not** run `/trackerstart` here.

---

### Tracker section — Feed (~8:20am MT)

After other subskills:

```bash
node initiative-1-tracker/tracker/scripts/brief-readiness-check.js --json
node initiative-1-tracker/tracker/scripts/tracker-feed-render.js --open
```

The `--open` flag starts a local server (if needed) and opens the **Tracker Brief Viewer**.

**If `ok: false`:**

> **Tracker brief not ready** — publish still running. Skip tracker section. Slack DM when ready.

Do **not** improvise from `tracker-drops/`.

**If ready:** paste full `tracker-feed-render.js` output into chat (summary + table + prototypes).

---

## Part 6 — First live morningbrief

1. Open workspace @ ~8:00am.
2. Step 0 → confirm background publish started.
3. ~8:20 → tracker-feed + viewer opens.
4. Monday habit: confirm `tracker-briefs/latest.json` updated.

---

## Part 7 — Viewer (manual)

```bash
cd ~/Projects/"Tracker Competitors Bot"
npm run brief:open-viewer --prefix initiative-1-tracker/tracker
# or with a specific run:
node initiative-1-tracker/tracker/scripts/open-brief-viewer.js --run _sample-product-day
```

Opens `http://127.0.0.1:8765/tracker-briefs/viewer/index.html`

**Product-day QA fixture:** `?run=_sample-product-day`

---

## Part 8 — Prototypes: vignettes vs deep dive

| Daily brief | Deep dive |
|-------------|-----------|
| HTML **vignettes** in viewer (~minutes) | **`/trackerstart`** + `create-prototype` (~hours) |
| Same PRD + parity story | Same story, **higher-quality** full app |

Daily publish uses vignettes because of **time** — not missing capability. When a signal needs a demo-quality prototype, run **`/trackerstart`** on that row in the Tracker workspace.

---

## Part 9 — Slack notifications (optional)

**No API key.** Slack uses **Incoming Webhooks** — a URL that posts to a channel when our GitHub Action or script hits it.

### Who sets this up?

| Person | What |
|--------|------|
| **Alonso (or IT)** | Creates Slack Incoming Webhooks + adds secrets to **GitHub repo** |
| **Billy** | Does **not** need to build anything for Slack — optional convenience |

### Three webhook slots

| GitHub secret | Who gets notified | When |
|---------------|-------------------|------|
| `SLACK_WEBHOOK_URL` | Drop channel (existing) | After nightly collect push |
| `SLACK_WEBHOOK_URL_OPERATOR` | **Alonso** (you) | 5:35am preflight, 7:45am "not ready" (normal before 8am) |
| `SLACK_WEBHOOK_URL_BILLY` | **Billy** | Brief became ready **after** his 8:20 tracker section |

If secrets are unset, workflows **skip Slack silently** — everything still works.

### How Alonso creates a webhook (5 min)

1. Slack → **Apps** → **Incoming Webhooks** → Add to workspace → pick channel (e.g. `#tracker-ops` for operator, DM channel for Billy).
2. Copy webhook URL (`https://hooks.slack.com/services/...`).
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
4. Name exactly `SLACK_WEBHOOK_URL_OPERATOR` or `SLACK_WEBHOOK_URL_BILLY`, paste URL, save.

No OAuth app, no bot token, no Billy-side code.

---

## Part 10 — Troubleshooting

### `git pull` fails on entrata-core (`fatal: bad object HEAD`)

**Billy:** start fresh — never copy a broken `.git` folder.

```bash
mv ~/Projects/entrata-core ~/Projects/entrata-core.broken-$(date +%Y%m%d)
git clone git@github.com:entrata/core.git ~/Projects/entrata-core
cd ~/Projects/"Tracker Competitors Bot"/initiative-1-tracker/tracker
node scripts/core-parity-check.js --save-core ~/Projects/entrata-core
npm run verify:core && npm run test:parity && npm run manager:preflight
```

### `manager:preflight` fails — no workspace

Copy and edit `entrata-plus-tracker.code-workspace` (Part 3).

### Viewer 404 / blank

Run server from **repo root**:

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/tracker-briefs/viewer/index.html` — not the editor file tab.

### Brief "not ready" at 8:20

Normal on heavy Product days (~45 min). Skip section; check Slack later or re-run:

```bash
npm run brief:feed --prefix initiative-1-tracker/tracker
npm run brief:open-viewer --prefix initiative-1-tracker/tracker
```

---

## Appendix — For Alonso (not Billy)

### Corrupt Core clone on Alonso's Mac

**Symptom:** `verify:core` passes but `git pull` in entrata-core fails with `bad object HEAD`.

**Why it matters:** `tracker-publish` runs `git pull` on Core each morning to refresh parity. Broken git metadata breaks that step even though files on disk still scan.

**What Alonso should do (once, ~15 min):**

1. Read cached path: `cat initiative-1-tracker/tracker/.core-path`
2. Rename broken clone (backup):  
   `mv "/Users/alonso.roca/Desktop/Core Repo/entrata-core" "/Users/alonso.roca/Desktop/Core Repo/entrata-core.broken-$(date +%Y%m%d)"`
3. Fresh clone to the **same path** the workspace expects.
4. Re-wire: `node scripts/core-parity-check.js --save-core <new-path>`
5. `npm run verify:core && npm run test:parity && npm run manager:preflight`
6. Update `entrata-plus-tracker.code-workspace` if path changed.

**Billy is unaffected** if he clones fresh per Part 2b.

### Optional API upgrade (later)

Fine-grained GitHub token on `entrata/core` speeds Layer 1 only. Layer 2 still needs local clone. See `TRACKER-PARITY-GITHUB.md`.

---

## Quick reference

| Command | Purpose |
|---------|---------|
| `npm run manager:preflight` | Gate before first publish |
| `npm run publish:dry-run` | Scaffold test (no agent) |
| `npm run brief:feed` | Render today's brief markdown |
| `npm run brief:open-viewer` | Open viewer in browser |
| `/trackerstart` | Deep dive — full prototypes |

---

## Related (split docs — same content lives here)

- `TRACKER-AUTOMATION.md` — architecture diagram
- `TRACKER-PROTOTYPE-TIERS.md` — vignette vs create-prototype detail
- `TRACKER-HANDOFF-PLAN.md` — Alonso build checklist

**Questions:** Alonso.
