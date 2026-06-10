# Handoff message — copy to Billy

Send after `main` has the tracker-brief handoff merge.

---

**Subject:** Tracker brief factory — your setup (~30 min)

Hi Billy,

Tracker **collect** (5:45am GHA) + **publish** (your morningbrief ~8am) + **feed** (~8:20) are on `main`. You don't need a 5:50am schedule or overnight laptop.

**One-time setup (~25–35 min):**

1. `git pull` on Tracker Competitors Bot
2. Follow **[CORE-CLONE-SETUP.md](./CORE-CLONE-SETUP.md)** — clone `entrata/core`, `verify:core`, `test:parity`
3. Follow **[BILLY-TRACKER-SETUP.md](./BILLY-TRACKER-SETUP.md)** — workspace, preflight, paste morningbrief blocks from **[MORNINGBRIEF-TRACKER-PROMPT.md](./MORNINGBRIEF-TRACKER-PROMPT.md)**

**Daily:** morningbrief Step 0 starts publish in background → tracker-feed at the end.

**Viewer:** `python3 -m http.server 8765` from repo root → `http://localhost:8765/tracker-briefs/viewer/index.html`

**Deep prototypes:** daily brief uses HTML vignettes; for full apps run `/trackerstart` — see **[TRACKER-PROTOTYPE-TIERS.md](./TRACKER-PROTOTYPE-TIERS.md)**.

Full plan: **[TRACKER-HANDOFF-PLAN.md](./TRACKER-HANDOFF-PLAN.md)**.

— Alonso
