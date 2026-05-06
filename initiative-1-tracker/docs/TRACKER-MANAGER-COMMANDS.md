# Tracker — command cheat sheet (runner vs manager)

> **New joiners:** the **full** onboarding (architecture + clone + CI + this cheat sheet) is merged into **[TRACKER-EXTERNAL-ONBOARDING.md](../../TRACKER-EXTERNAL-ONBOARDING.md)** at the repo root — share that file first.

One page of **what to type** for the Git-first demo. Narrative and prereqs: [TRACKER-DEMO.md](./TRACKER-DEMO.md).

---

## Roles

| Role | Responsibility |
|------|------------------|
| **Runner** (bot or engineer) | Produce **`tracker-drops/`** on the branch GitHub Actions (or humans) push to. |
| **Manager / worker** | **`git pull`**, read the latest drop in **Cursor**, then **prototype** (Product OS / your skill). |

---

## Runner — get evidence **into** Git

### Option A — GitHub Actions (default “bot”)

1. Ensure workflow **Tracker drop** exists on the branch Actions runs from (usually `main`) and **Actions are enabled** for the repo.
2. **Manual run:** GitHub → **Actions** → **Tracker drop** → **Run workflow**.
3. **Scheduled:** same workflow runs on cron (see [.github/workflows/tracker-drop.yml](../../.github/workflows/tracker-drop.yml)); a commit appears only when **`tracker-drops/`** actually changed.

Secrets / behavior: [TRACKER-DROP-CI.md](./TRACKER-DROP-CI.md).

### Option B — Laptop (manual push)

From **repo root** (adjust path):

```bash
cd initiative-1-tracker/tracker
npm install   # once
npm run drop -- --days 7
```

If the relevance gate skipped writing (no new signals) and you need a **demo folder** anyway:

```bash
TRACKER_DROP_FORCE=1 npm run drop -- --days 7
```

Then commit from **repo root**:

```bash
cd /path/to/Tracker-Competitors-Bot
git add tracker-drops
git status
git commit -m "tracker drop: manual run"
git push origin HEAD
```

Use your real branch name instead of `HEAD` if policy requires (e.g. `main` or `agent/demo`).

### Sanity check (no Git write)

```bash
cd initiative-1-tracker/tracker
npm run demo
```

Prints a sample gap-style report; does **not** replace drops.

---

## Manager — **pull**, **analyze**, **prototype**

### 1. Pull

```bash
cd /path/to/Tracker-Competitors-Bot
git fetch origin
git pull origin <your-branch>
```

`<your-branch>` = branch where drops land (often `main`).

### 2. Find the latest drop

- Open **`tracker-drops/`** in Cursor, or  
- Read **`tracker-drops/.latest-drop-id`** → open that folder under **`tracker-drops/<run-id>/`**.

Files that matter first: **`SUMMARY.md`**, then **`signals.json`**.

### 3. Analyze (Cursor)

- Open **`SUMMARY.md`** (and **`signals.json`** if you need evidence URLs/snippets).  
- In **Chat / Composer**, ask for interpretation **grounded only in those files** (and your org rules), e.g. *“Summarize competitor moves in this drop, cite file paths and dates, and list gaps vs our products.”*  
- Architecture reminder: [TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md) §4.

**Multi-root with Entrata code:** [ENTRATA-CODE-IN-CURSOR.md](./ENTRATA-CODE-IN-CURSOR.md).

### 4. Prototype (response to competitors)

After analysis, produce the **counter-positioning / UX** artifact where your team expects it (e.g. Product OS workspace, **`/create-prototype`**, or internal doc template). There is **no** required localhost URL for this step.

---

## Quick troubleshooting

| Symptom | What to try |
|---------|-------------|
| **No new folder** after `npm run drop` | Normal if **no new signals**; use `TRACKER_DROP_FORCE=1` for a demo layout, or widen `--days`. |
| **Actions never commits** | No change under `tracker-drops/`; or workflow disabled; or wrong branch. See [TRACKER-DROP-CI.md](./TRACKER-DROP-CI.md). |
| **`npm run drop` errors** | `npm install` in `initiative-1-tracker/tracker`; Node 18+. |
