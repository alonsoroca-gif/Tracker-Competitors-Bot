# Tracker drop — CI, secrets, and repo layout

Implements **[TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md)** §7: collect → relevance gate → `tracker-drops/<run>/` → commit/push → optional Slack.

## What is `git remote`, and when do you need an extra one?

A **remote** is a **nickname + URL** for a Git server (where you **push** / **pull**). Your clone usually has **`origin`** → the repo you ran `git clone` from.

- **This workflow’s default:** **`git push`** uses **`origin`** and **`GITHUB_TOKEN`** → it pushes to **the same repo** that runs the Action (no extra remote).
- **When you need another remote:** Only if **drops must land in a different GitHub repo** than the tracker code (e.g. Entrata monolith or a **second** “presentation” repo). Then you **`git remote add entrata-drops https://github.com/ORG/other-repo.git`** (or SSH URL), **`git push entrata-drops branch:branch`** using a **PAT** with write access on **that** repo. That PAT is **never** hard-coded — store as **`TRACKER_DROP_REMOTE_PAT`** (or similar) and use **`git push https://x-access-token:${TOKEN}@github.com/...`** in a guarded CI step.

So: **you don’t need a second remote** until drops must live **outside** this repository.

---

## Cadence: “as soon as we know” (polling)

Competitor sites do **not** push to GitHub when they post. The practical pattern is **poll often**: the workflow runs on a **schedule** (default **every 15 minutes** UTC in `tracker-drop.yml`), runs **collect**, and only **commits** if **new signals** were added this run. No commit → no Slack.

If **15 minutes** is too heavy for your **Actions minutes** or org policy, edit the `cron` in **`.github/workflows/tracker-drop.yml`** (e.g. hourly: `0 * * * *`).

---

## What runs

| Piece | Location |
|--------|-----------|
| **Publish script** | `initiative-1-tracker/tracker/scripts/publish-drop.js` |
| **Workflow** | Repo root `.github/workflows/tracker-drop.yml` |
| **Drop folder** | Repo root `tracker-drops/<UTC-run-id>/` |

**Local dry run** (from `initiative-1-tracker/tracker`):

```bash
npm install
npm run drop -- --days 7
# Force a drop even with 0 new signals (debug):
TRACKER_DROP_FORCE=1 npm run drop -- --days 7
```

### End-to-end (visual)

```mermaid
flowchart LR
  subgraph poll["Every 15m (configurable)"]
    T[GitHub Action]
  end
  T --> C[collect + publish-drop]
  C --> G{new signals?}
  G -->|no| X[no commit, no Slack]
  G -->|yes| D[write tracker-drops/run/]
  D --> P[git commit + push]
  P --> S[Slack Incoming Webhook]
  S --> M[managers see summary in channel]
```

---

## GitHub Actions

1. **Actions → Tracker drop → Run workflow** (manual), or rely on the **schedule** (default **every 15 minutes** UTC — edit `cron` in the YAML).
2. Workflow runs **`publish-drop.js`**, which runs **collect** then writes under **`tracker-drops/`** only when **`newCount > 0`** (unless `TRACKER_DROP_FORCE` is set in the workflow env for debugging).
3. If **`git add tracker-drops`** has staged changes, the job **commits and pushes** to the **same branch** the workflow ran on (default branch for `schedule`).

### Branch protection

If **push to `main` is blocked**, either:

- Run **Tracker drop** from a **branch workflow** that is allowed to push, or  
- Use a **bot PAT** with bypass (org policy), or  
- Open a **PR** from a dedicated branch (change the workflow to `git push` to that branch only — follow-up).

## Secrets (repository)

| Secret | Required? | Purpose |
|--------|-----------|---------|
| *(default)* `GITHUB_TOKEN` | Yes (provided) | Checkout + push to **this** repo when `permissions: contents: write` is set. |
| `SLACK_WEBHOOK_URL` | No | Incoming webhook URL; if unset, Slack step is skipped. |

Add **`SLACK_WEBHOOK_URL`** under **Settings → Secrets and variables → Actions** for this repository.

### Finish Slack configuration (checklist)

1. **[api.slack.com/apps](https://api.slack.com/apps)** → **Create New App** → **From scratch** → name (e.g. `Tracker Drops`) → choose workspace (**Entrata**).
2. If you see **“workspace requires apps to be approved by admins”**: still click **Create App**. You will need an **admin to approve** the install when you add the webhook to the workspace (post in **#ask-it-us** or your Slack admin channel with a one-line business reason: *incoming webhook posts competitive-intel drop summaries*).
3. In the app: **Incoming Webhooks** → turn **On** → **Add New Webhook to Workspace** → pick the **channel** managers should watch → **Copy** the `https://hooks.slack.com/services/...` URL.
4. **GitHub** (this repo) → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** → name **`SLACK_WEBHOOK_URL`** → paste URL → save.
5. Merge/deploy workflow, then **Actions** → **Tracker drop** → **Run workflow** (or wait for the next scheduled run after a real **new-signal** collect).
6. **Smoke-test without CI** (optional): from `initiative-1-tracker/tracker` after `TRACKER_DROP_FORCE=1 npm run drop`, run `SLACK_WEBHOOK_URL=... DROP_COMMIT_URL=https://example.com npm run slack-notify`.

**Revoking:** Slack app settings → remove webhook, or rotate URL if leaked.

### What managers see in Slack (Incoming Webhook)

The step runs **`slack-drop-notify.js`** only **after** a successful push. Slack receives **Block Kit** + fallback text, roughly:

| Block | Content |
|--------|--------|
| **Header** | “New competitor tracker drop” |
| **Fields** | Repo name, **new signals this run**, **run id**, **timestamp** |
| **Section** | Link **Open on GitHub** → the commit that added the drop |
| **Section** | **Latest signals (sample)** — up to ~15 short lines: competitor, source, snippet |
| **Context** | Reminder: pull branch → `tracker-drops/` → `SUMMARY.md` + Cursor |

**Notification text** (mobile / notifications) uses a short one-line **fallback** with repo + run id + commit link.

```text
Tracker drop: my-org/tracker-repo · +3 new signals · https://github.com/…/commit/abc1234
```

*(Exact formatting depends on Slack client; blocks render as a card in desktop Slack.)*

**Not included yet:** a full **Slack app bot** with slash commands, threads, or @user — that’s a separate OAuth app (future **P3**). This uses **Incoming Webhooks** only (faster to ship).

## Pushing drops to a *different* repo (e.g. Entrata monorepo)

This workflow **commits to the same repository** that hosts the tracker code. To attach drops to **another** remote (dedicated tracker repo you already created, or a branch inside Entrata):

1. Add a **fine-scoped PAT** (or org-approved app token) with `contents: write` on the **target** repo.  
2. Store it as a secret (e.g. `TRACKER_DROP_REMOTE_PAT`).  
3. Replace the **Commit and push** step with: extra `remote` + `push` to that URL — **do not** commit the PAT; use secrets only.

That wiring is **org-specific**; keep the PAT out of this file and out of git history.

## Related

- [TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md) — full diagram and manager path.  
- [ENTRATA-CODE-IN-CURSOR.md](./ENTRATA-CODE-IN-CURSOR.md) — multi-root Cursor with Entrata code.
