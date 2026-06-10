# Morningbrief — Tracker blocks (paste into Billy's skill)

Two blocks: **Step 0** at the **start** of morningbrief; **Tracker section** near the **end** (after standup / other subskills).

---

## Step 0 — Kick off publish (first action ~8:00am MT)

**Do this before any other morningbrief subskill.** Start publish in the **background** — do **not** wait for it to finish.

1. Open the **Tracker Competitors Bot** workspace (multi-root with entrata-core).
2. Start a **background Cursor agent** with the kickoff prompt:
   - File: `initiative-1-tracker/automation/morningbrief/tracker-publish-kickoff.md`
   - Skill: **tracker-publish**
3. Tell Billy in chat (one line): _Tracker publish started in background — parity + brief will finish while you run the rest of morningbrief._
4. **Immediately continue** to standup / portfolio / other subskills.

**Do not** run `/trackerstart` or collect drops here.

**First-run only:** if `manager:preflight` passes, agent may note that an optional GitHub API token speeds Layer 1 later (`TRACKER-PARITY-GITHUB.md`). Not required for handoff.

---

## Tracker section — Feed (~8:20–8:30am MT)

Run **after** other subskills. By then publish has usually finished (~12 min PMM-only; up to ~45 min on heavy Product days).

1. Invoke **tracker-feed** (or scripts below).
2. **Do not** re-run tracker-publish.
3. **Do not** show yesterday's brief if today is not ready.

```bash
node initiative-1-tracker/tracker/scripts/brief-readiness-check.js --json
node initiative-1-tracker/tracker/scripts/tracker-feed-render.js --open
```

### If `brief-readiness-check` → `ok: false`

Say only:

> **Tracker brief not ready** — publish still running. Skip tracker section for today. You'll get a Slack DM when it's ready.

Do **not** improvise from `tracker-drops/`. Do **not** poll in a loop.

### If ready

Paste the full `tracker-feed-render.js` output into chat:

- Summary line (net-new, prototypes, ready time)
- **6-column signals table** (all classifications)
- Prototype bullets (if any)
- Viewer opens automatically via `--open` (or `npm run brief:open-viewer`)

### Non-Product days

Still show the table. Call out **Why / routing** and parity `—`.

### Product days

Parity column shows **Layer 2** verdict. Prototypes in viewer; PRDs linked as supporting docs.

---

## Parallel timeline (typical)

```
8:00   Step 0 — tracker-publish background starts (git pull Core + parity + brief)
8:00   Other subskills (standup, …) — Billy not blocked
8:20   Tracker section — tracker-feed
       ├─ ready → show brief
       └─ not ready → skip; Slack when publish commits ready brief
```

---

## What Billy does not see

- Drop health / CI lane tables
- Preflight alerts (operator only @ 5:35am)
- AskQuestion classification gates (publish agent handles defaults)
- Raw `signals.json`

---

## Late brief

If publish finishes after the tracker section, **Slack DM** notifies Billy when `latest.json` flips to `ready`. Re-run tracker-feed or wait for next session.
