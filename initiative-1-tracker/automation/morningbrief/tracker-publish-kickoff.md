# Morningbrief kickoff — tracker-publish (background)

**When:** First step of Billy's **morningbrief** (~8:00am MT). **Do not wait** for completion.

**Skill:** `.cursor/skills/tracker-publish/SKILL.md`

**Setup:** `BILLY-TRACKER-SETUP.md` + `CORE-CLONE-SETUP.md`

---

## How morningbrief uses this

1. **Step 0 (8:00)** — Paste kickoff below → start **background** Cursor agent. Continue other morningbrief subskills immediately.
2. **Tracker section (~8:20–8:30)** — Run **tracker-feed** only. If not ready → skip + Slack when done.

---

## Kickoff prompt (copy below)

You are the **tracker-publish** factory agent on **Billy's Mac**. Run once per weekday when morningbrief starts.

**Path A default** — local `entrata-core` + `git pull` each run. No GitHub API token required.

**Optional upgrade (mention once on first run if preflight passes):** Billy can add `ENTRATA_CORE_GITHUB_TOKEN` later for faster Layer 1 — see `TRACKER-PARITY-GITHUB.md`. Layer 2 still needs local Core.

### Phase 0b — Core gate

```bash
node initiative-1-tracker/tracker/scripts/manager-core-preflight.js
```

If exit ≠ 0: AskQuestion per skill Phase 0b. STOP until PASS.

### Phase 0a — Workload (log only)

```bash
node initiative-1-tracker/tracker/scripts/publish-preflight.js
```

### Phase 1 — Auto-pull tracker + resolve drop

```bash
git pull origin main
```

Read `tracker-drops/.latest-drop-id`. Set `tracker-briefs/latest.json` → `"status": "publishing"`.

### Phase 2 — Interpret

Build `tracker-briefs/runs/<run_id>/signals-table.json`.

### Phase 3 — Parity (Product rows) — Path A

```bash
cd /path/to/entrata-core && git checkout main && git pull origin main
node initiative-1-tracker/tracker/scripts/verify-core-setup.js
echo '[...]' | node initiative-1-tracker/tracker/scripts/core-parity-check.js --stdin --format markdown
```

If `ENTRATA_CORE_GITHUB_TOKEN` is set and `verify-github-core-access.js` passes, use `--github` for Layer 1; still `git pull` Core for Layer 2.

**Layer 2** — agent Read/Grep on local Core in workspace (required). Layer 2 wins.

### Phase 4 — PRDs + prototypes (Tier — Now Product)

Skip if 0 Product rows.

### Phase 5 — Finalize

```bash
node initiative-1-tracker/tracker/scripts/brief-readiness-check.js --mark-ready
node initiative-1-tracker/tracker/scripts/tracker-feed-render.js
```

Commit + push `tracker-briefs/` only. Do NOT run tracker-feed.
