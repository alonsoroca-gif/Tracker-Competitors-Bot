# Tracker Competitors Bot

Tracker Competitors Bot — start developing here.

> **When you open this repo after a break:** run `node scripts/session-context.js` (or say **resume** in Cursor). → [docs/REMINDER-WHEN-RETURNING.md](docs/REMINDER-WHEN-RETURNING.md)

**Leaving or coming back?** → See [LEAVE-COME-BACK.md](LEAVE-COME-BACK.md) or ask the agent.

---

## Run Tracker UI locally (Competitor report)

From the **repo root**:

```bash
./scripts/serve-tracker.sh
```

Or manually:

```bash
cd initiative-1-tracker/tracker
npm install
npm run serve
```

Then open **http://localhost:3000** (use **Refresh data** / **Reload report** in the page). **Stop the server:** focus the terminal and press **Ctrl+C**.

**Port already in use (`EADDRINUSE`):** something else is using 3000. Either quit that app or run on another port:

```bash
cd initiative-1-tracker/tracker
PORT=3001 npm run serve
```

Then open **http://localhost:3001**.

---

## Automation loop (agent runs tasks when you're away)

A **scheduled workflow** picks the next unchecked task from `initiative-1-tracker/TASKS.md` and either **prepares it for Cursor** (default) or **implements it via OpenAI** (optional). See [docs/AGENT-LOOP.md](docs/AGENT-LOOP.md).

**Default (no API key):** The workflow creates a branch `agent/<taskId>`, adds `initiative-1-tracker/AGENT-NEXT-TASK.md`, and opens a **draft PR**. In **Cursor**, say **"Run next task"** (or "Complete the task in AGENT-NEXT-TASK.md"); the agent will implement, run tests, mark the task done, and push. See [docs/CURSOR-NEXT-TASK.md](docs/CURSOR-NEXT-TASK.md).

**Optional (with API key):** Add secret **`OPENAI_API_KEY`** in **Settings → Secrets and variables → Actions**. The workflow will then implement the task via the API, run tests, and open a normal PR. No Cursor step needed.

The workflow runs on schedule (9am and 3pm UTC) and via **Actions → Run agent (next task) → Run workflow**.

---

The Cursor onboarding app stays in the parent repo: `Cursor-Onboarding/`, `docs/`, and the root `index.html` / `push` / `sync` flow.
