# Tracker Competitors Bot

Tracker Competitors Bot — start developing here.

> **When you open this repo after a break:** run `node scripts/session-context.js` (or say **resume** in Cursor). → [docs/REMINDER-WHEN-RETURNING.md](docs/REMINDER-WHEN-RETURNING.md)

**Leaving or coming back?** → See [LEAVE-COME-BACK.md](LEAVE-COME-BACK.md) or ask the agent.

---

## Tracker product path (default): Git + Cursor + prototype

**Flow:** collect → **`tracker-drops/`** on a **Git branch** → managers **pull** → interpret in **Cursor** → build a **prototype response** in Product OS (not a localhost browser UI).

- **Architecture & diagrams:** [initiative-1-tracker/docs/TRACKER-FLOW-END-TO-END.md](initiative-1-tracker/docs/TRACKER-FLOW-END-TO-END.md)  
- **CI & drops:** [initiative-1-tracker/docs/TRACKER-DROP-CI.md](initiative-1-tracker/docs/TRACKER-DROP-CI.md)  
- **Demo (no port 3000):** [initiative-1-tracker/docs/TRACKER-DEMO.md](initiative-1-tracker/docs/TRACKER-DEMO.md)  
- **Docs index:** [initiative-1-tracker/docs/README.md](initiative-1-tracker/docs/README.md)

**Share with a colleague:** [TRACKER-EXTERNAL-ONBOARDING.md](TRACKER-EXTERNAL-ONBOARDING.md) — **single file:** sponsor fill-in table, **open this first** then **clone** (Part 0–3), manager/runner, CI/Slack, Entrata pointer, troubleshooting, links to deeper docs inside the clone.

**Entrata code + tracker in one Cursor window:** [initiative-1-tracker/docs/ENTRATA-CODE-IN-CURSOR.md](initiative-1-tracker/docs/ENTRATA-CODE-IN-CURSOR.md) and `entrata-plus-tracker.code-workspace.example`.

### Optional: legacy local report UI (engineering debug only)

The Express app on **port 3000** is **not** part of the manager demo. Use only if you are debugging the old HTML report: `./scripts/serve-tracker.sh` or `cd initiative-1-tracker/tracker && npm run serve`. See [initiative-1-tracker/docs/STRATEGIC-INTERPRETATION.md](initiative-1-tracker/docs/STRATEGIC-INTERPRETATION.md) for in-app interpretation behavior.

---

## Automation loop (agent runs tasks when you're away)

A **scheduled workflow** picks the next unchecked task from `initiative-1-tracker/TASKS.md` and either **prepares it for Cursor** (default) or **implements it via OpenAI** (optional). See [docs/AGENT-LOOP.md](docs/AGENT-LOOP.md).

**Default (no API key):** The workflow creates a branch `agent/<taskId>`, adds `initiative-1-tracker/AGENT-NEXT-TASK.md`, and opens a **draft PR**. In **Cursor**, say **"Run next task"** (or "Complete the task in AGENT-NEXT-TASK.md"); the agent will implement, run tests, mark the task done, and push. See [docs/CURSOR-NEXT-TASK.md](docs/CURSOR-NEXT-TASK.md).

**Optional (with API key):** Add secret **`OPENAI_API_KEY`** in **Settings → Secrets and variables → Actions**. The workflow will then implement the task via the API, run tests, and open a normal PR. No Cursor step needed.

The workflow runs on schedule (9am and 3pm UTC) and via **Actions → Run agent (next task) → Run workflow**.

**Manager brief (Tracker vs repo automation):** [initiative-1-tracker/docs/MANAGER-BRIEF-TRACKER-AND-AUTOMATION.md](initiative-1-tracker/docs/MANAGER-BRIEF-TRACKER-AND-AUTOMATION.md) · **Tune GitHub Actions:** [docs/GITHUB-AUTOMATION-RUNBOOK.md](docs/GITHUB-AUTOMATION-RUNBOOK.md)

---

The Cursor onboarding app stays in the parent repo: `Cursor-Onboarding/`, `docs/`, and the root `index.html` / `push` / `sync` flow.
