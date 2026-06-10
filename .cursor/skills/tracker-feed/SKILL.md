---
name: tracker-feed
description: Billy-facing consumer for published tracker briefs — reads tracker-briefs/latest.json and renders summary + 6-column signals table + prototype pointers. Use when morningbrief invokes tracker intel, the user says "tracker feed", "show Billy the brief", or "tracker brief for today". Do NOT use for collecting drops (CI), publishing (tracker-publish), or full interpret gates (/trackerstart).
---

# tracker-feed

**Consumer skill** — showroom for what `tracker-publish` wrote to `tracker-briefs/`. Runs at the **end** of morningbrief (tracker section), after Step 0 kicked off publish in the background.

## Quick start

**Trigger:** morningbrief **tracker section** (~8:20am, after other subskills), or `/tracker feed`, "show today's tracker brief".

**Not Step 0** — do not invoke tracker-feed at morningbrief start. Step 0 is **tracker-publish** (background).

```
tracker-feed:
- [ ] Step 1 — Readiness (latest.json status === ready)
- [ ] Step 2 — Load run manifest + signals-table + prototypes
- [ ] Step 3 — Emit chat blocks (summary + table + open viewer)
- [ ] Step 4 — Stop (no collect, no publish, no AskQuestion gates)
```

---

## Step 1 — Readiness

From repo root:

```bash
node initiative-1-tracker/tracker/scripts/brief-readiness-check.js --json
```

| `ok` | Action |
|------|--------|
| `true` | Continue |
| `false` | Print not-ready message. **Do not** show yesterday's brief. **Do not** fall back to raw `tracker-drops/`. Stop. |

Optional render check:

```bash
node initiative-1-tracker/tracker/scripts/tracker-feed-render.js --open
```

If render exits non-zero, surface `formatNotReady` text only.

---

## Step 2 — Load artifacts

Paths (relative to repo root):

| File | Purpose |
|------|---------|
| `tracker-briefs/latest.json` | Pointer + `status` + counts |
| `tracker-briefs/runs/<run_id>/manifest.json` | Day summary |
| `tracker-briefs/runs/<run_id>/signals-table.json` | Billy table rows |
| `tracker-briefs/runs/<run_id>/prototypes.json` | Vignette cards |

---

## Step 3 — Chat output (required shape)

Emit **in this order**:

### 3.1 Summary (one block)

- Run id, net-new count, prototype count, ready time
- **PMM-only days:** add line — _0 Product rows — review classification, parity, and routing below._

**Do not** include drop health lane table.

### 3.2 Signals table (6 columns max)

| # | Competitor | Headline | Classification | Parity | Why / routing |

- **Parity column:** Layer 2 final when present; `not_scanned` if Product row skipped scan; `—` for non-Product
- **Non-Product days:** table is the main artifact; emphasize **Why / routing** (Won't chase reasons)

Use `tracker-feed-render.js` output as the canonical formatter, or mirror `lib/briefFeed.js`.

### 3.3 Prototypes (Product days only)

When `prototype_count > 0`:

- Bullet per prototype: title, competitor, path
- Run `npm run brief:open-viewer --prefix initiative-1-tracker/tracker` (or `--run <run_id>`)

### 3.4 Viewer (always)

After chat output, run:

```bash
node initiative-1-tracker/tracker/scripts/open-brief-viewer.js --run <run_id>
```

Or use `tracker-feed-render.js --open` which renders + opens in one step. Falls back to Simple Browser URL if auto-open fails.

---

## Step 4 — Hard stops

| Do | Don't |
|----|-------|
| Read committed `tracker-briefs/` only | Re-run parity, classification gates, or collect |
| Show today's published brief | Link or repeat yesterday's brief |
| Send Slack | tracker-feed does not DM Billy (readiness agent handles late DM) |

### Parity column — read-only by default

Billy **does not need** `entrata-core` on disk or a GitHub token for normal `tracker-feed`. Parity values come from `signals-table.json` (written by `tracker-publish`).

**Optional gap-fill** (only if manager has Core cloned and row shows `parity: not_scanned` on a Product day): run local Layer 2 per `CORE-PARITY-LOCAL-MANAGER.md`, update the row, then re-render feed. Not the default 8am path.

---

## Not-ready UX

```markdown
**Tracker brief not ready** — publish still running or failed.
Check again shortly. Late runs notify via Slack when ready.
```

Never fabricate rows from `signals.json` when brief is not ready.

---

## PMM-only fixture reference

Run `2026-06-02T00-10-59Z` — 1 PMM row, 0 prototypes. Use for dry-run comparison to `/trackerstart` chat output.

## Product-day QA fixture

`tracker-briefs/runs/_sample-product-day/` — open viewer with `?run=_sample-product-day`.

---

## Related

- Factory: `.cursor/skills/tracker-publish/SKILL.md`
- Lab interpret: `.cursor/skills/tracker-drop-cycle/SKILL.md` (unchanged)
- Schema: `initiative-1-tracker/docs/TRACKER-BRIEFS-SCHEMA.md`
- Morningbrief paste block: `initiative-1-tracker/docs/MORNINGBRIEF-TRACKER-PROMPT.md`
