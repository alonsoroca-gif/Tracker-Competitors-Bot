# Manager brief — Tracker Competitors Bot

**Purpose:** One-page view of what’s in place, how it works, what’s next, and how the automation runs when [Alonso] is not in the office.

**Main focus:** **Tracker Bot** (Initiative 1) — competitor signals → evidence in **Git** (`tracker-drops/`) → managers **pull** and interpret in **Cursor** → **prototype response** (Product OS). The **default demo does not use** a localhost browser UI.

**Demo walkthrough:** [initiative-1-tracker/docs/TRACKER-DEMO.md](../initiative-1-tracker/docs/TRACKER-DEMO.md).

---

## 1. What’s in place

### Tracker Bot (Initiative 1)

| Piece | What it does |
|-------|----------------|
| **Collect** | Fetches competitor data from public sources: blog/press/changelog RSS, pricing/features/careers pages. Writes signals to `data/signals.json`. |
| **Gap report** | Turns signals into “gaps”: what the competitor is doing, our state (Starting / In process / Delivered), and source. Sorted by priority (High → Medium → Low). |
| **What to change** | For each gap: recommendation text (competitor move + our gap + suggested action). |
| **Git drops** | When there is new signal content, a run writes **`tracker-drops/<run-id>/`** (`SUMMARY.md`, `signals.json`, manifest). CI can commit/push; managers **pull** and read in Cursor. |
| **Report UI (optional dev)** | Legacy single-page app on port 3000 for engineering debug only — **not** the manager demo path. |

### Config (all in `initiative-1-tracker/tracker/config/`)

- **products.json** — Our 11 products to analyze; competitors (e.g. EliseAI high, Funnel/LeaseHawk/Anyone Home/Jonah medium); per-competitor **sources** (blog, press, changelog, pricing_url, features_url, careers_url).
- **our-state.json** — Per-product, per-dimension: Starting | In process | Delivered.
- **project-focus.json** — L2L scope and research areas.

### What’s already done (Sprint 1)

- Dual analysis: every gap shows **What competitor is doing**, **Our state**, **Source**.
- “What to change” cards with specific recommendations (not just titles).
- Priority order (High → Medium → Low).
- Details row per gap (full signal, our state, source, date).
- Entrata-branded UI (logo, 24/7 badge, Refresh data / Reload report).

---

## 2. High-level flow

```
[Config] products + competitors + sources + our-state
       ↓
[Collect] RSS + pages → signals (date, source, competitor, snippet) → data/signals.json
       ↓
[Gap report] signals + our-state → gaps (competitor_move, our_gap, source, priority)
       ↓
[What to change] gaps → recommendations (competitor move + our gap + action)
       ↓
[Git drop] Commit `tracker-drops/` when relevant → push → manager pull
       ↓
[Cursor + prototype] Read SUMMARY / signals; interpret; build response artifact
```

**To run the product path:** `npm run collect` / `npm run drop` (or GitHub Actions) → commit **`tracker-drops/`** → **`git pull`** in Cursor → follow [TRACKER-DEMO.md](../initiative-1-tracker/docs/TRACKER-DEMO.md).

---

## 3. Next steps (before Thursday)

Tasks are in **`initiative-1-tracker/TASKS.md`**. The automation bot works through them in order.

| Priority | Focus | Examples |
|----------|--------|----------|
| **P1** | Better sources + better “What competitor is doing” | Use RSS description over title; fact-like sentences from pages; cleaner snippets; README for feed URLs. |
| **P2** | Sprint 2 — Filter to prove accuracy | Filter gaps by source in the UI; “Data sources” summary (e.g. “3 blog, 5 pricing_page”); Source column on each gap. |
| **P3** | Sprint 3 — Fewer collect failures | Validate URLs before fetch; log 404 with competitor + source + URL; README for optional URLs; optional “last collect” summary in UI/API. |

After P1–P3, the bot falls back to **backup tasks** (health endpoint, config validation, CONTRIBUTING, JSDoc, troubleshooting, etc.) so work continues if the main list is done.

---

## 4. How automation works when [Alonso] is not here

The coding agent **never pushes to `main`**. It works on **branches** and opens **PRs**; a “virtual me” step can accept or deny; **only a human merges to main**.

### Step-by-step

| Step | Who / What | Action |
|------|------------|--------|
| **1. End of day** | [Alonso] | Runs handoff (e.g. `./scripts/handoff.sh`). Status + handoff note are committed and pushed to `main`. |
| **2. Overnight / scheduled** | **Run agent (next task)** (GitHub Action) | Runs on a schedule (9am & 3pm UTC) or manually: reads **next unchecked task** from `TASKS.md` → calls OpenAI to implement it → runs tests → creates branch `agent/<taskId>` → pushes → **opens a PR into `main`**. Does **not** merge. Requires **OPENAI_API_KEY** in repo Secrets. See [docs/AGENT-LOOP.md](AGENT-LOOP.md). |
| **3. Gate** | **“Virtual me”** (GitHub Action) | For each PR from `agent/*`: runs tests. Posts “Accept” or “Deny”. **Never merges**; that’s always a human. |
| **4. Next day** | [Alonso] or manager | Open repo: see PRs from the agent. Merge the ones that look good. Run `./scripts/resume.sh` if used; continue. |

### Flow diagram

```
[Alonso leaves]     Overnight                        Next day
       |                 |                               |
       | handoff         | Agent: pull main              |
       | push to main    |        create branch          |
       |-----------------|        get next task (TASKS)  |
       |                 |        AI + apply + test     |
       |                 |        commit, push, open PR  |
       |                 |                              |
       |                 | Virtual me: on PR             |
       |                 |   run tests → Accept or Deny  |
       |                 |   (never merge)               |
       |                 |-------------------------------|
       |                 |                               | Human: review PRs
       |                 |                               | merge to main
       |                 |                               | continue work
```

### Takeaways for the manager

- **Main is protected.** All agent work lands in branches and PRs.
- **Task list drives work.** The bot reads `initiative-1-tracker/TASKS.md` and picks the first unchecked task (P1 → P2 → P3, then backup tasks).
- **No surprise merges.** The “virtual me” only comments Accept/Deny; a person always merges to `main`.
- **To see progress:** Check open PRs from branches like `agent/*` and the checkboxes in `TASKS.md` on those branches.

---

## 5. Where to look

| Need | Location |
|------|----------|
| Task list (what the bot does next) | `initiative-1-tracker/TASKS.md` |
| Sprint plan (Sprint 1 done, 2 & 3 next) | `initiative-1-tracker/docs/TRACKER-FEEDBACK-SPRINTS.md` |
| How automation is designed | `docs/AUTOMATION-SKETCH.md` |
| Tracker app (run + config) | `initiative-1-tracker/tracker/` — `README.md`, `config/` |

---

*Brief last updated: Feb 2025. Main focus: Tracker Bot; automation runs via TASKS.md + branch/PR workflow when [Alonso] is not in the office.*
