# Handoff message — copy to Billy

Send after `main` has the tracker-brief handoff merge (viewer + publish skills + `tracker-briefs/` fixture).

---

**Subject:** Tracker brief factory — one doc, ~30 min setup

Hi Billy,

Tracker brief factory is on `main` — ready for your morningbrief.

**One-time setup (~30 min):**

1. Clone **Tracker Competitors Bot** + **entrata/core** (SSH access — ask if you need `entrata/core`)
2. Open repo in **Cursor**
3. Open **`initiative-1-tracker/docs/BILLY-COMPLETE-SETUP.md`**
4. Paste **Part 0** into chat — the **billy-tracker-onboard** skill walks you through workspace, Core parity, and **`npm run billy:demo`** (sample Product day)

**Daily rhythm (after setup):**

- **~8:00** — **Step 0** preflight (auto) → **Step 1** `tracker-publish` in background (do not wait)
- **~8:20** — **tracker-feed** → chat table + viewer auto-opens
- **Product days** — prototype cards with skim ROI; click **Open prototype** for full math + brief + vignette
- **PMM-only days** — same table, 0 prototypes; focus **Why / routing**

No 5:50am schedule. No overnight laptop. Slack late-ready DM is optional (Alonso wires webhooks).

Questions → me.

— Alonso

---

**Alonso sends with the message:** link to repo + confirm `entrata/core` access requested if not already granted.

---

## Update — 2026-06-11 (morningbrief date gate + auto publish)

**Subject:** Tracker update — pull `main` before tomorrow's `/morningbrief`

Hi Billy,

Quick fix shipped on `main` — morningbrief was sometimes showing **yesterday's brief** because we only checked `status: ready`, not the calendar day.

**What changed (you get this on `git pull`):**

1. **Date gate** — brief must be stamped **today MT** or feed says "not ready" (no more stale Jonah table)
2. **Kickoff script** — `/morningbrief` Step 1 now runs `npm run morningbrief:kickoff` (pulls + publishes)
3. **Zero-signal days** — 0 net-new URLs publish instantly + auto-commit/push `tracker-briefs/`
4. **Signal days** — kickoff still starts background `tracker-publish` agent (~12–28 min)

**Your action (5 min, once):**

```bash
cd "Tracker Competitors Bot"
git pull origin main
```

Then ask Alonso to sync your **personal** `~/.cursor/skills/morningbrief/SKILL.md` (Step 1a kickoff block) — or paste tracker blocks from `initiative-1-tracker/docs/MORNINGBRIEF-TRACKER-PROMPT.md`.

**Tomorrow:** run `/morningbrief` as usual — publish should kick off automatically at Step 1. No new setup beyond pull.

Questions → me.

— Alonso
