# Billy — Tracker setup checklist

Send this **once** after `tracker-feed` + `tracker-publish` skills are on `main` and GHA workflows are merged (see §0).

**Estimated total time:** **25–35 minutes** one-time.

**Parity:** **Path A** — local Core clone + `git pull` each publish. **Optional later:** GitHub API token (Path B).

---

## §0 — When Alonso sends this doc (prerequisites)

Alonso confirms on `main` before you start:

- [ ] `.cursor/skills/tracker-feed/` and `tracker-publish/` exist
- [ ] `tracker-briefs/` fixture + `npm run brief:feed` works
- [ ] GitHub Actions: collect + readiness workflows merged
- [ ] Kickoff prompt: `initiative-1-tracker/automation/morningbrief/tracker-publish-kickoff.md`

You then do **this checklist in one sitting** — clone Core, workspace, preflight, paste morningbrief blocks.

**Core clone walkthrough:** [CORE-CLONE-SETUP.md](./CORE-CLONE-SETUP.md)

---

## How it works (no 5:50am schedule)

| Time | What |
|------|------|
| 5:45am | GitHub collects competitor signals (automatic) |
| ~8:00am | You run **morningbrief** → **Step 0** starts **tracker-publish** in background |
| 8:00–8:20 | Other morningbrief subskills (publish + parity runs in parallel) |
| ~8:20 | **tracker-feed** shows today's brief (or "not ready" + Slack later) |

**You do not** schedule a 5:50am agent. **You do not** keep your laptop open overnight.

---

## Why Core lives on your Mac

| Question | Answer |
|----------|--------|
| **Why not Alonso's machine?** | No GitHub API approval for `entrata/core`. Product parity needs **Core on disk**. |
| **Why your Mac?** | You have **entrata-core** access. Parity runs when **you** start morningbrief. |
| **What is "publish"?** | Factory: interpret → **parity** → prototypes → `tracker-briefs/`. |
| **What is "feed"?** | End of morningbrief — reads the brief (no parity at feed time). |
| **Simple prototypes in viewer?** | **HTML vignettes** — quick visuals. Full apps via **`/trackerstart`** + `create-prototype` when you need depth ([TRACKER-PROTOTYPE-TIERS.md](./TRACKER-PROTOTYPE-TIERS.md)). |

---

## Two roles

| Role | Core clone? | API token? | Setup time |
|------|-------------|------------|------------|
| **tracker-feed** (end of morningbrief) | No | No | included in §5 |
| **tracker-publish** (Step 0 background) | **Yes** | Optional (Path B) | §1–§4 |

---

## §1 — Clone repos (~10–20 min)

### 1a — Tracker repo

```bash
git clone <tracker-repo-url>
cd "Tracker Competitors Bot"
git pull origin main
```

### 1b — entrata-core (required for publish)

**Before cloning:**

| # | Question | If NO |
|---|----------|-------|
| 1 | GitHub access to `entrata/core`? | Request from IT / manager |
| 2 | `ssh -T git@github.com` succeeds? | [Add SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) |
| 3 | VPN connected (if required)? | Connect VPN, retry |

**Clone:**

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone git@github.com:entrata/core.git entrata-core
cd entrata-core
git checkout main
git pull origin main
ls Applications | head
```

| Error | Fix |
|-------|-----|
| `Permission denied (publickey)` | SSH key not on GitHub |
| `Repository not found` | Request `entrata/core` access |
| No `Applications/` | `git checkout main && git pull` |

```
~/Projects/Tracker Competitors Bot/
~/Projects/entrata-core/
```

Details: [CORE-CLONE-SETUP.md](./CORE-CLONE-SETUP.md)

---

## §2 — Cursor workspace (~5 min)

- [ ] Copy `entrata-plus-tracker.code-workspace.example` → `entrata-plus-tracker.code-workspace`
- [ ] Set Core `path` to your real `entrata-core` path
- [ ] **File → Open Workspace from File…** (use this workspace for morningbrief)

---

## §3 — Wire Core for scripts (~5 min)

```bash
cd initiative-1-tracker/tracker
npm install
node scripts/core-parity-check.js --save-core ~/Projects/entrata-core
npm run verify:core
npm run test:parity
```

- [ ] `verify:core` → **OK**
- [ ] `test:parity` → **21/21 passed**

Optional `~/.zshrc`:

```bash
export ENTRATA_MONO_ROOT=~/Projects/entrata-core
```

---

## §4 — Preflight gate (~5 min)

```bash
npm run manager:preflight --prefix initiative-1-tracker/tracker
```

Must end: **`manager-core-preflight: PASS`**

| # | Question | Answer for handoff |
|---|----------|-------------------|
| 1 | entrata-core on `main` and pulled? | Yes |
| 2 | Core in same workspace as Tracker? | Yes |
| 3 | `manager:preflight` PASS? | Yes |
| 4 | Path A — local + git pull each publish? | **Yes (default)** |
| 5 | API token? | **Skip for now** (optional upgrade — §4b) |

### §4b — Optional API upgrade (later)

If org approves a fine-grained token on `entrata/core` (Contents read), Path B speeds Layer 1. You still keep the local clone for Layer 2. See [TRACKER-PARITY-GITHUB.md](./TRACKER-PARITY-GITHUB.md). First publish may mention this — not required to proceed.

---

## §5 — Morningbrief (~10 min)

Paste **both blocks** from `initiative-1-tracker/docs/MORNINGBRIEF-TRACKER-PROMPT.md`:

- [ ] **Step 0** — kick off tracker-publish at **start** of morningbrief (background)
- [ ] **Tracker section** — tracker-feed near **end** of morningbrief

Smoke test (feed only — publish not required for this):

```bash
npm run brief:readiness --prefix initiative-1-tracker/tracker
npm run brief:feed --prefix initiative-1-tracker/tracker
```

(Feed may say "not ready" until first live morningbrief publish — OK.)

**No scheduled Cursor agent.** No overnight laptop requirement.

---

## §6 — First live morningbrief

1. Open **entrata-plus-tracker** workspace.
2. Run morningbrief @ ~8:00am.
3. Confirm Step 0 started publish in background.
4. At tracker section: brief ready or "skip + Slack later."

---

## Daily habits

| When | Action |
|------|--------|
| ~8:00am | morningbrief Step 0 → publish background |
| ~8:20 | tracker-feed section |
| Monday | Confirm last `tracker-briefs/latest.json` updated |

---

## Related

- [CORE-CLONE-SETUP.md](./CORE-CLONE-SETUP.md)
- [MORNINGBRIEF-TRACKER-PROMPT.md](./MORNINGBRIEF-TRACKER-PROMPT.md)
- [TRACKER-PROTOTYPE-TIERS.md](./TRACKER-PROTOTYPE-TIERS.md) — vignettes vs `/trackerstart` + `create-prototype`
- [TRACKER-HANDOFF-PLAN.md](./TRACKER-HANDOFF-PLAN.md)
- [TRACKER-AUTOMATION.md](./TRACKER-AUTOMATION.md)
