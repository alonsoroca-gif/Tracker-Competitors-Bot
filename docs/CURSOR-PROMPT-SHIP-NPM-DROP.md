# Copy this prompt (ship `npm run drop` to GitHub)

Use in **Chat** or **Composer** with the **Tracker Competitors Bot** repo root open (`README.md` at workspace root is ideal). Paste everything below the `---` line.

---

## Prompt (copy from here)

**Context:** Clones from GitHub (`git clone` + `checkout agent/P1.1`) show `npm run` **without** `drop` or `demo` because **`initiative-1-tracker/tracker/package.json`** on the remote branch does not define those scripts, and **`initiative-1-tracker/tracker/scripts/publish-drop.js`** (and related files) are not on the remote. This workspace **does** have a working local drop setup (see `package.json` scripts and `tracker/scripts/`).

**Goal:** Make **`npm run drop`** and **`npm run demo`** work for anyone who clones from **`origin`** — same as in this folder — by **committing and pushing** all required files. Do not change product behavior beyond what’s needed to ship the scripts.

**Do this:**

1. **Inventory:** List what this repo has locally that **`git status`** / **`git ls-files`** shows as **untracked or modified** for:
   - `initiative-1-tracker/tracker/package.json`
   - `initiative-1-tracker/tracker/scripts/publish-drop.js`
   - `initiative-1-tracker/tracker/scripts/slack-drop-notify.js`
   - Any modules **`publish-drop.js`** requires (e.g. under `lib/`, `config/`)
   - `.github/workflows/tracker-drop.yml` if it exists and should run in CI

2. **Sanity check:** From `initiative-1-tracker/tracker`, confirm **`npm run`** lists **`drop`** and **`demo`**, then run **`npm run drop -- --days 1`** (or a minimal window) locally; fix any missing imports or paths if the script errors.

3. **Git:** On branch **`agent/P1.1`** (or the branch we use for the stakeholder release), **`git add`** only the files needed for drop/demo/CI. **`git commit`** with a clear message, e.g. `tracker: ship npm run drop + publish-drop scripts for clones`. **`git push origin <that-branch>`**.

4. **Verify:** In a **fresh** clone simulation, run **`git show origin/<branch>:initiative-1-tracker/tracker/package.json`** and confirm **`"drop"`** and **`"demo"`** appear under **`scripts`**.

5. **Short note:** Add one bullet to **`TRACKER-EXTERNAL-ONBOARDING.md`** Part 5 saying that **`npm run drop`** requires the branch that includes **`publish-drop.js`** (point to this commit or branch name) if **`drop`** is missing after **`npm run`**.

**Constraints:** Do not commit secrets. Do not rewrite unrelated docs. Minimal diff focused on shipping **`drop`** for clones.

---

## After push (human check)

From a test folder:

```bash
git clone https://github.com/alonsoroca-gif/Tracker-Competitors-Bot.git
cd Tracker-Competitors-Bot
git checkout agent/P1.1
git pull
cd initiative-1-tracker/tracker
npm install
npm run
```

You should see **`drop`** and **`demo`** in the script list.
