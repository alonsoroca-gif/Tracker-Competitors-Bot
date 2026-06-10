# Core clone setup — step-by-step (Billy + Alonso demo)

Use this when wiring **Path A** (local `entrata-core` + `git pull` each publish). No GitHub API token required.

**Handoff default:** Billy clones Core on **his Mac**; parity runs when **morningbrief Step 0** kicks off `tracker-publish` (~8:00am MT).

---

## What you are proving

| Step | Pass signal |
|------|-------------|
| Clone `entrata/core` | `Applications/` folder exists with app dirs (Admin, ProspectPortal, …) |
| Cache path for scripts | `.core-path` written under `initiative-1-tracker/tracker/` |
| Layer 1 script | `verify-core-setup: OK` · `21/21` parity fixtures |
| Layer 2 agent | Multi-root workspace opens Tracker + Core in one Cursor window |
| Full gate | `manager-core-preflight: PASS` |

---

## Before you start — quick checklist

Answer these before cloning:

| # | Question | If NO → |
|---|----------|---------|
| 1 | Do you have **GitHub access** to `entrata/core`? | Request org access from IT / your manager |
| 2 | Is **SSH** set up for GitHub? (`ssh -T git@github.com`) | [GitHub SSH keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) |
| 3 | Is **Node.js 18+** installed? (`node -v`) | Install from nodejs.org or `brew install node` |
| 4 | Is the **Tracker repo** already cloned? | `git clone` tracker first (see `BILLY-TRACKER-SETUP.md` §1) |

---

## Step 1 — Clone entrata-core (~5–15 min)

Pick a parent folder (same level as Tracker is fine):

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone git@github.com:entrata/core.git entrata-core
cd entrata-core
git checkout main
git pull origin main
```

**Verify the clone is real Core:**

```bash
ls Applications | head
```

You should see directories like `Admin`, `ProspectPortal`, `Leasing`, etc. If `Applications` is missing, the clone path or repo is wrong.

**Suggested layout:**

```
~/Projects/Tracker Competitors Bot/
~/Projects/entrata-core/
```

---

## Step 2 — Clone errors (troubleshooting)

| Error | Likely cause | Fix |
|-------|--------------|-----|
| `Permission denied (publickey)` | SSH key not on GitHub | Add SSH key to GitHub account |
| `Repository not found` | No org access to `entrata/core` | Request access; confirm repo URL is `entrata/core` not a fork |
| `Could not read from remote` | VPN / network | Connect Entrata VPN if required |
| Clone hangs / very slow | Large monolith | Normal first clone — wait; shallow clone not recommended for parity |
| `Applications/` empty | Wrong branch | `git checkout main && git pull` |

---

## Step 3 — Wire Core path for tracker scripts (~3 min)

From the **Tracker repo root**:

```bash
cd initiative-1-tracker/tracker
npm install
node scripts/core-parity-check.js --save-core ~/Projects/entrata-core
```

Replace `~/Projects/entrata-core` with your real absolute path.

**Optional but recommended** — add to `~/.zshrc`:

```bash
export ENTRATA_MONO_ROOT=~/Projects/entrata-core
```

Then `source ~/.zshrc`.

---

## Step 4 — Run verification tools (~2 min)

```bash
cd initiative-1-tracker/tracker
npm run verify:core
npm run test:parity
npm run manager:preflight
```

**Expected output:**

```
verify-core-setup: OK — Local Core OK: …/entrata-core (27 apps via …)
21/21 passed
manager-core-preflight: PASS — ready for tracker-publish parity on this machine.
```

Workspace warning is OK until Step 5 is done.

---

## Step 5 — Multi-root Cursor workspace (~3 min)

```bash
cd /path/to/Tracker\ Competitors\ Bot
cp entrata-plus-tracker.code-workspace.example entrata-plus-tracker.code-workspace
```

Edit `entrata-plus-tracker.code-workspace` — set the Core folder `path` to your real clone:

```json
{
  "folders": [
    { "name": "Tracker Competitors Bot", "path": "." },
    { "name": "Entrata Core Repo", "path": "/Users/you/Projects/entrata-core" }
  ]
}
```

**Cursor → File → Open Workspace from File…** → select `entrata-plus-tracker.code-workspace`.

Re-run:

```bash
npm run manager:preflight --prefix initiative-1-tracker/tracker
```

All checks should pass (workspace ✓).

---

## Step 6 — Smoke Layer 1 parity (optional demo)

```bash
echo '[{"id":"demo","competitor_signal":"test","proposed_feature":"lease renewal reminders","product_id":"resident-portal"}]' \
  | node initiative-1-tracker/tracker/scripts/core-parity-check.js --stdin --format markdown
```

You should get a verdict line (`Existing` / `Partial` / `Gap` / …) with Core file paths — not `not_scanned`.

---

## Alonso demo script (run on your Mac before sending Billy)

Use this to confirm the handoff package works end-to-end:

```bash
# 1 — Core already at your path
ls "/Users/alonso.roca/Desktop/Core Repo/entrata-core/Applications" | head

# 2 — From Tracker repo
cd "/Users/alonso.roca/Desktop/Tracker Competitors Bot/initiative-1-tracker/tracker"
npm run verify:core
npm run test:parity
npm run manager:preflight

# 3 — Handoff scaffold
npm run test:brief
npm run publish:dry-run
```

If all PASS, Billy follows **this same doc** with his paths.

---

## After setup — what happens each morning (Path A)

When Billy starts **morningbrief** (~8:00am), **Step 0** kicks off **tracker-publish** in the background:

1. `git pull` Tracker repo
2. `git pull` in `entrata-core` (fresh Core — **no API token**)
3. Parity Layer 1 + Layer 2 + brief write
4. Pushes `tracker-briefs/` to GitHub

Billy continues other subskills. At the **tracker section** (~8:20), **tracker-feed** reads the brief. Core clone is not needed for feed — only for publish.

---

## Troubleshooting — `fatal: bad object HEAD` or `unable to read tree`

**Symptom:** `verify:core` passes but `git pull` in entrata-core fails.

**Safe state:** Files on disk still work for parity scans. Only `git pull` at publish time is broken.

**Fix (one script — VPN on, stable network):**

```bash
cd initiative-1-tracker/tracker
chmod +x scripts/reclone-core.sh
./scripts/reclone-core.sh "/path/to/entrata-core"
```

The script backs up the old clone, fresh-clones, re-wires `.core-path`, and runs verify + preflight.

If clone fails mid-flight (`early EOF`, `Broken pipe`), your backup folder is renamed to `entrata-core.broken-*` — restore it:

```bash
mv entrata-core.broken-YYYYMMDD entrata-core
```

Then retry `./scripts/reclone-core.sh` on a stable connection.

Billy should **always** start from a fresh clone — never copy a corrupted `.git` folder.

---

## Related

- [BILLY-TRACKER-SETUP.md](./BILLY-TRACKER-SETUP.md) — full install checklist
- [TRACKER-HANDOFF-PLAN.md](./TRACKER-HANDOFF-PLAN.md) — who builds what
- [CORE-PARITY-LOCAL-MANAGER.md](./CORE-PARITY-LOCAL-MANAGER.md) — parity layers
