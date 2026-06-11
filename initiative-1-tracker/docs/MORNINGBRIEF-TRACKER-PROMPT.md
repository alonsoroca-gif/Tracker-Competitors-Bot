# Morningbrief — Tracker blocks (paste into Billy's skill)

Align with live morningbrief numbering: **Step 0** = auto preflight · **Step 1** = publish · **Tracker section** ~8:20 = feed.

---

## Step 0 — Auto preflight (agent runs each `/morningbrief`)

**Before tracker-publish.** Agent verifies skills + kickoff files — Billy does not manually check paths.

```bash
npm run morningbrief:preflight --prefix initiative-1-tracker/tracker -- --json
```

If `ok: false`, fix items in output before Step 1.

**One-time setup (not each morning):** `npm run brief:install-opener --prefix initiative-1-tracker/tracker` then reload Cursor — required for `--open` in Simple Browser.

---

## Step 1 — Kick off publish (~8:00am MT)

**After Step 0 passes.** Agent runs the kickoff gate — Billy does not decide manually.

```bash
npm run morningbrief:kickoff --prefix initiative-1-tracker/tracker -- --json
```

| `action` | Agent |
|----------|--------|
| `skip_already_fresh` | Skip — today's brief already ready |
| `published_zero_day` | Skip agent — 0 net-new day stamped synchronously |
| `kickoff_agent_required` | Start **background Cursor agent** (tracker-publish + kickoff prompt) |

Then tell Billy: _Tracker publish started in background (~12–28 min)._ Continue other subskills immediately.

**Never** skip because yesterday's `latest.json` still says `ready`.

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

**Cursor agent:** run `--open` with Shell **`required_permissions: ["all"]`** — default sandbox blocks `cursor --open-url` and Simple Browser will not open.

### If `brief-readiness-check` → `ok: false`

Say only:

> **Tracker brief not ready** — publish still running. Skip tracker section for today. You'll get a Slack DM when it's ready.

Do **not** improvise from `tracker-drops/`. Do **not** poll in a loop.

### If ready

Paste the full `tracker-feed-render.js` output into chat:

- Summary line (net-new, prototypes, ready time)
- **6-column signals table** (all classifications)
- Prototype bullets (if any) — What, ROI verdict + scale, formula one-liner
- Viewer opens in **Cursor Simple Browser** via `--open` — skim ROI on cards; **Open prototype** for full detail

**Fallback:** Cmd+Shift+P → Simple Browser: Show → Cmd+V (URL in clipboard). **Do not** use `cursor://vscode.runCommands`.

### Non-Product days

Still show the table. Call out **Why / routing** and parity `—`.

### Product days

Parity column shows **Layer 2** verdict. Prototypes in viewer; PRDs linked as supporting docs.

---

## Parallel timeline (typical)

```
8:00   Step 0 — morningbrief-preflight (auto)
8:00   Step 1 — tracker-publish background starts
8:00   Other subskills (standup, …) — Billy not blocked
8:20   Tracker section — tracker-feed + Simple Browser
       ├─ ready → show brief
       └─ not ready → skip; Slack when publish commits ready brief
```

**Chat test note:** In one long `/morningbrief` chat, publish may finish before feed — production uses parallel ~8:00 + ~8:20 timing.

---

## What Billy does not see

- Drop health / CI lane tables
- Preflight alerts (operator only @ 5:35am)
- AskQuestion classification gates (publish agent handles defaults)

---

## Related

- `initiative-1-tracker/docs/BILLY-COMPLETE-SETUP.md` Part 7
- Factory: `.cursor/skills/tracker-publish/SKILL.md`
- Consumer: `.cursor/skills/tracker-feed/SKILL.md`
