# GitHub automation runbook (when you’re away)

This document is **only** about **GitHub Actions + optional OpenAI + Cursor handoff**.  
It is **not** the Tracker product. For the competitor app itself, see **`initiative-1-tracker/docs/MANAGER-BRIEF-TRACKER-AND-AUTOMATION.md`**.

---

## What runs

| Workflow | File | When |
|----------|------|------|
| **Run agent (next task)** | `.github/workflows/run-agent.yml` | **Cron:** 09:00 and 15:00 **UTC** daily; **manual:** Actions → Run workflow. |
| **Review agent PRs** | `.github/workflows/review-agent-prs.yml` | On PRs to `main`/`master` from branches starting with `agent/`. |

**Concurrency:** Only **one** “Run agent” job at a time per repo (`concurrency: group: agent-next-task`). A second scheduled run **waits**; it does not cancel the first (avoids half-created PRs).

---

## Manual run (recommended first test)

1. Repo **Settings → Actions** — ensure Actions are enabled.  
2. **Actions → Run agent (next task) → Run workflow**.  
3. **Without** `OPENAI_API_KEY`: expect a **draft PR** + branch `agent/<taskId>` with `AGENT-NEXT-TASK.md`.  
4. Locally: `git fetch && git checkout agent/<taskId>`, implement in Cursor (**go** / **run next task**), push; **Review agent PRs** comments on the PR.

**Safe “dry run” without opening a PR** (local, read-only):

```bash
node scripts/agent-get-next-task.js
# optional: writes initiative-1-tracker/AGENT-NEXT-TASK.md
node scripts/agent-get-next-task.js --write-file
```

---

## Secrets (optional)

| Secret | Effect |
|--------|--------|
| **`OPENAI_API_KEY`** | Workflow runs **`scripts/agent-run-task.js`** and may open a **non-draft** PR with code changes. **Costs money** — set usage caps in OpenAI. |
| *(none)* | **Default:** prepare task file + draft PR only; **you** implement in Cursor. |

Repository variable **`OPENAI_MODEL`** can override the default model if your workflow/script supports it (see `AGENT-LOOP.md`).

---

## Tuning the schedule

Edit **`.github/workflows/run-agent.yml`**:

```yaml
schedule:
  - cron: '0 9 * * *'   # 09:00 UTC
  - cron: '0 15 * * *' # 15:00 UTC
```

Examples:

- **Once daily 7am US Eastern (winter):** `0 12 * * *` (noon UTC ≈ 7am EST).  
- **Weekdays only:** use a single cron and add `if:` on the job comparing `github.event.schedule` — or use two workflows.

Always document the chosen timezone in this file when you change it.

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Workflow succeeds but **no PR** | **No unchecked** rows in `TASKS.md`; or `git add initiative-1-tracker/` had nothing to commit (e.g. `AGENT-NEXT-TASK.md` not created or gitignored); check job logs. |
| **Duplicate PRs** for same task | Merge or close the open `agent/<id>` PR before the next run; verify **concurrency** is present in the workflow. |
| OpenAI path **fails** | Tests failed or secret missing; read job logs. Remove secret to fall back to Cursor path. |
| Wrong task picked | **`TASKS.md`** order: first `[ ]` row wins — reorder sections or mark obsolete rows `[x]`. |

---

## Related docs

- **`docs/AGENT-LOOP.md`** — narrative + OpenAI vs Cursor paths.  
- **`docs/CURSOR-NEXT-TASK.md`** — what to say in Cursor.  
- **`docs/ASYNC-AGENT-REVIEW-WORKFLOW.md`** — approve/reject via PRs.
