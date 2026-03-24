# Task-by-task completion with Cursor (no API key)

This is how you **complete** each task using only Cursor—no OpenAI key.

---

## End-to-end loop

| Step | Who / What | Action |
|------|------------|--------|
| 1. Prepare (automatic or manual) | GitHub Action **or** you | **Automatic:** Workflow runs on schedule, creates branch `agent/P1.2` and `AGENT-NEXT-TASK.md`, opens draft PR. **Or manual:** Run `node scripts/agent-get-next-task.js --write-file` from repo root to create `AGENT-NEXT-TASK.md` on main. |
| 2. Implement (you + Cursor) | You in Cursor | Check out the branch (if the workflow created one) or stay on main. In Cursor, say: **"Run next task"** or **"Complete the task in AGENT-NEXT-TASK.md"**. The agent will implement, run tests, mark the task done in TASKS.md, and push. |
| 3. PR | You | If the workflow already opened a draft PR, just push and it updates. Otherwise open a PR from `agent/<taskId>`. Virtual me runs when you push. |
| 4. Merge | You | Merge when ready. Next run (workflow or "run next task") will pick the next task. |

So **task-by-task completion** = workflow prepares one task → you say **"Run next task"** in Cursor once → agent does the rest → you open/update PR and merge.

---

## What to say in Cursor (you don’t need to type “run next task” every time)

Any of these will run the next task (or start the loop):

- **Short:** **"go"**, **"start"**, **"run"** → run the next task once.
- **Explicit:** **"run next task"**, **"complete the task in AGENT-NEXT-TASK.md"** → same.
- **Full automation in one go:** **"run all tasks"** or **"run all pending tasks"** → run the next task, then the next, and so on (up to 5 in a row). One phrase, no typing between tasks.

The Cursor rule (`.cursor/rules/next-task.mdc`) is always applied, so the agent will run the task without asking for confirmation when you say one of the above. No API key; uses your Cursor session.

---

## If there is no AGENT-NEXT-TASK.md yet

- Run from repo root: `node scripts/agent-get-next-task.js --write-file`  
- Then say in Cursor: **"Run next task"**. The agent will use the file you just created.

Or run the workflow once (Actions → Run agent (next task) → Run workflow); it will create the branch and file, then you check out the branch and say **"Run next task"** in Cursor.
