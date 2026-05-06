# Agent loop: how it runs when you're away

The **Run agent (next task)** workflow picks the next task from `initiative-1-tracker/TASKS.md` and either **prepares it for Cursor** (default, no API key) or **implements it via OpenAI** (optional).

**This is not the Tracker competitor product** — it is **engineering automation** for the task list. For a manager-friendly split (purpose, gaps, doc-only pending items), read **`initiative-1-tracker/docs/MANAGER-BRIEF-TRACKER-AND-AUTOMATION.md`**. To tune schedules and concurrency, read **`docs/GITHUB-AUTOMATION-RUNBOOK.md`**.

---

## What runs

### Default: Cursor (no API key)

| Step | What happens |
|------|----------------|
| 1. Trigger | Workflow runs on **schedule** (9am and 3pm UTC) or **Run workflow** in the Actions tab. |
| 2. Get next task | `scripts/agent-get-next-task.js` finds the first unchecked task and writes `initiative-1-tracker/AGENT-NEXT-TASK.md` with the task ID and acceptance criteria. |
| 3. Branch + draft PR | Creates branch `agent/<taskId>`, commits that file, pushes, and opens a **draft PR** with instructions. |
| 4. You in Cursor | Check out the branch, open `AGENT-NEXT-TASK.md`, and ask Cursor to implement the task (uses your Cursor resources). Run tests, mark task done in TASKS.md, commit and push. |
| 5. Virtual me | When you push, **Review agent PRs** runs tests and comments Accept or Deny. You merge when ready. |

### Optional: OpenAI (with API key)

If you add **`OPENAI_API_KEY`** in repo Secrets, the workflow will instead call the API to implement the task, run tests, and open a normal (non-draft) PR. No Cursor step needed.

---

## One-time setup

1. **Enable Actions**  
   Enable GitHub Actions if prompted. The workflow is `.github/workflows/run-agent.yml`. **No secrets required** for the Cursor path.

2. **Optional: OpenAI**  
   To have the workflow implement tasks itself (no Cursor step): **Settings → Secrets and variables → Actions** → add **`OPENAI_API_KEY`**. The script uses `gpt-4o-mini` by default; set `OPENAI_MODEL` to override. A few cents per task; set usage limits in your OpenAI account if you want a cap.

---

## Manual run

- Go to **Actions → Run agent (next task) → Run workflow** and click the green button.  
- Uses latest `main` and the next unchecked task. With no API key you get a draft PR + AGENT-NEXT-TASK.md; implement in Cursor.

---

## If something goes wrong

- **“No unchecked task”** → All tasks are done; add more in TASKS.md.  
- **Draft PR but no time to implement** → Check out the branch when you can, or close the PR and re-run the workflow later.  
- **OpenAI path: “OPENAI_API_KEY is required”** → Add the secret, or remove it to use the Cursor path.  
- **Tests fail** (OpenAI path) → Job fails, no PR. Fix in Cursor or re-run after fixing the task/tests.  
- **PR already exists for this task** → Merge or close it first; the next run picks the next task.

---

## Files

| File | Purpose |
|------|--------|
| `scripts/agent-get-next-task.js` | Parses TASKS.md, outputs first `[ ]` task as JSON. |
| `scripts/agent-run-task.js` | Calls OpenAI, applies edits, marks task done, runs tests. |
| `.github/workflows/run-agent.yml` | Schedule + workflow_dispatch; runs the two scripts then branch + PR. |
| `.github/workflows/review-agent-prs.yml` | On PR from `agent/*`: runs tests, comments Accept/Deny (does not merge). |
