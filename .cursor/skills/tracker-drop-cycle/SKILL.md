---
name: tracker-drop-cycle
description: Runs the end-to-end Tracker competitive-intel cycle for the Tracker-Competitors-Bot repo — smart-detects whether a fresh drop already exists, otherwise collects a new drop and pushes to GitHub with auto-merge into main, then pulls, interprets the drop in chat with citations, and produces counter-positioning prototypes. Use when the user types `/trackerstart`, "do the tracker cycle", "run the tracker cycle", "pull the latest drop and interpret", "competitive intel cycle", or asks to analyze a folder under `tracker-drops/`.
---

# tracker-drop-cycle

End-to-end Tracker competitive-intel workflow for the **`Tracker-Competitors-Bot`** repository. Five phases, one trigger. All output that matters lives **in chat**, not in files.

## Quick start

**Trigger:** `/trackerstart` (or natural-language equivalents like "do the tracker cycle").

The skill runs all 5 phases end-to-end by default. There is no mode flag — the skill **self-detects** whether to skip the collect/push phases (Phases 1–2) when a fresh CI drop already exists.

Copy this checklist and track progress:

```
Tracker drop cycle:
- [ ] Phase 0 — Smart-mode check (skip 1–2 if a fresh drop exists)
- [ ] Phase 1 — Run drop (collect + write tracker-drops/<id>/)
- [ ] Phase 2 — Push (agent/P1.1 → auto-merge into main if non-empty)
- [ ] Phase 3 — Pull (git pull origin main)
- [ ] Phase 4 — Interpret in chat (six blocks, non-skippable)
- [ ] Phase 5 — Prototype in chat (battle cards for Tier-Now gaps)
```

---

## Phase 0 — Smart-mode self-check

Two checks, in order:

1. **Freshness** — is the latest drop <15 min old? (CI cron interval)
2. **Content hash** — does the latest drop's `signals.json` match the prior drop byte-for-byte?

Run from `<repo-root>`. **Always read from `agent/P1.1`** — that's the writer-staging branch where both CI cron and the skill push drops first. `main` is the consumer mirror and may lag by ~30s during auto-merge propagation.

```bash
git fetch origin
git checkout agent/P1.1
git pull --rebase origin agent/P1.1
node -e '
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const fmtAge = (min) => min < 60 ? `${min} min` : min < 1440 ? `${(min/60).toFixed(1)} hrs` : `${Math.round(min/1440)} days`;
const fmtSize = (bytes) => bytes < 1e6 ? `${(bytes/1e3).toFixed(0)} KB` : `${(bytes/1e6).toFixed(1)} MB`;
const id = fs.readFileSync("tracker-drops/.latest-drop-id", "utf8").trim();
const dir = path.join("tracker-drops", id);
const ageMin = Math.round((Date.now() - fs.statSync(dir).mtimeMs) / 60000);
const drops = fs.readdirSync("tracker-drops").filter(f => f.match(/^\d{4}-/)).sort();
const idx = drops.indexOf(id);
const prior = idx > 0 ? drops[idx - 1] : null;
const hash = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const latestPath = path.join(dir, "signals.json");
const latestHash = hash(latestPath);
const latestSize = fs.statSync(latestPath).size;
const priorPath = prior ? path.join("tracker-drops", prior, "signals.json") : null;
const priorHash = priorPath ? hash(priorPath) : null;
const priorAgeMin = prior ? Math.round((Date.now() - fs.statSync(path.join("tracker-drops", prior)).mtimeMs) / 60000) : null;
const lastMeaningfulIdx = (() => {
  for (let i = drops.length - 2; i >= 0; i--) {
    if (hash(path.join("tracker-drops", drops[i+1], "signals.json")) !== hash(path.join("tracker-drops", drops[i], "signals.json"))) return i + 1;
  }
  return -1;
})();
const lastMeaningful = lastMeaningfulIdx >= 0 ? drops[lastMeaningfulIdx] : null;
const lastMeaningfulAgeMin = lastMeaningful ? Math.round((Date.now() - fs.statSync(path.join("tracker-drops", lastMeaningful)).mtimeMs) / 60000) : null;
console.log(`Latest drop:        ${id} (age: ${fmtAge(ageMin)}, signals.json: ${fmtSize(latestSize)})`);
console.log(`Prior drop:         ${prior || "(none)"}${prior ? ` (age: ${fmtAge(priorAgeMin)})` : ""}`);
console.log(`Hash match:         ${latestHash === priorHash ? "YES (no new content)" : "NO (content changed)"}`);
console.log(`Last meaningful:    ${lastMeaningful || "(latest is the only one)"}${lastMeaningful ? ` (age: ${fmtAge(lastMeaningfulAgeMin)})` : ""}`);
process.exit((ageMin < 15 && latestHash !== priorHash) ? 0 : 1);
'
```

**Decision tree:**

- **Hash match + recent** → STOP, but **never stop silently**. Use the `AskQuestion` tool to present the manager with clickable options (see "Phase 0 stop UX" below). Wait for their response before doing anything else.
- **Hash differs + drop is <15 min old** AND user did **not** say "force" / "fresh" / `--force` → skip Phases 1–2. Announce: "Latest drop `<id>` is `<fmtAge>` old (likely from CI) and has new content. Skipping collect, jumping to Phase 3." Then proceed to Phase 3.
- **Drop is ≥15 min old** OR **missing** OR user requested a fresh collect → proceed to Phase 1.

### Phase 0 stop UX (clickable options)

When stopping due to hash match (no new content), call the `AskQuestion` tool with these options. Pull the human-readable values from the node script's output above (`fmtAge`, file size, etc.) — **never show raw drop IDs without context**.

Example call:

```
AskQuestion:
  prompt: "Latest drop is byte-identical to prior — what now?"
  options:
    - "Stop here (next CI cron is <NEXT_CRON_TIME_MT>)"
    - "Interpret the last drop with new content (<lastMeaningful>, <fmtAge> old, <fmtSize>)"
    - "Force a fresh collect anyway (Phases 1–5)"
    - "Show me what's on the agent branch (no collect)"
```

Where:
- `<NEXT_CRON_TIME_MT>` — the next scheduled cron (8:30am, 12pm, or 5pm MT, whichever is next). Compute from current time, not hardcoded.
- `<lastMeaningful>` — the drop ID returned by the script's `Last meaningful` line (most recent drop with `signals.json` content distinct from its predecessor). Falls back to "no prior content" if every drop is identical.
- `<fmtAge>` — human-readable age (`30 min`, `1.5 hrs`, `2 days`).
- `<fmtSize>` — human-readable size of `signals.json` (`8.9 MB`).

**Map manager response → action:**

| Manager picks | Skill action |
|---|---|
| Stop here | End cycle. Print a one-line confirmation with the next cron time. |
| Interpret last meaningful | Skip Phases 1–2. Override `latest` to use `<lastMeaningful>`. Proceed to Phase 3 with that drop ID. |
| Force fresh collect | Treat as `--force` flag. Run Phases 1–5 in full. |
| Show agent branch | Do `git fetch origin && git log --oneline origin/main..origin/agent/P1.1`. Print the result. Then re-prompt with the same four options. |

**Never** stop without surfacing these options. The "free-text override" approach (asking the manager to type back specific commands) is anti-pattern #1 in this skill — see Anti-patterns section.

---

## Phase 1 — Run drop

**Working directory:** `<repo-root>/initiative-1-tracker/tracker/`

```bash
cd initiative-1-tracker/tracker
npm install   # only if node_modules is missing
npm run drop -- --days 7
```

If the relevance gate skips writing because no new signals landed in the window, **only force a drop if the user explicitly asked for a demo run**:

```bash
TRACKER_DROP_FORCE=1 npm run drop -- --days 7
```

Confirm a new folder appeared under `<repo-root>/tracker-drops/<run-id>/` (run-id is UTC timestamp like `2026-05-06T21-46-51Z`). If no new folder and force was not requested, **stop the cycle and report "no new signals — skipped"**.

---

## Phase 2 — Push (with auto-merge to main)

**Always rebase before pushing** to avoid races with the GitHub Actions cron runner.

```bash
cd <repo-root>
git checkout agent/P1.1
git pull --rebase origin agent/P1.1
git add tracker-drops
git diff --staged --quiet && echo "no changes" && exit 0
git commit -m "tracker: drop <run-id> (<N> new)"
git push origin agent/P1.1
```

That's it for the skill — the **`auto-merge-agent.yml`** GitHub Action picks it up from there. Every push to `agent/P1.1` (drops, skill edits, manual commits) triggers the workflow, which:

1. Checks out `main`
2. Merges `origin/agent/P1.1` with `--no-ff`
3. Pushes `main`

Typical lag: ~30 seconds. Watch it run in the **Actions** tab on GitHub.

**Never** push to `main` directly. **Never** force-push. **Never** skip the rebase. **Never** disable the auto-merge workflow without telling the manager.

If the auto-merge workflow fails (rare — `tracker-drops/` is append-only and `.cursor/skills/` only we touch), GitHub surfaces the failure in the Actions tab. The skill should also `git fetch origin && git log origin/main..origin/agent/P1.1 --oneline` after Phase 2 to confirm `main` caught up; if it didn't within ~60 seconds, **surface the conflict to the user**. Do not auto-resolve.

---

## Phase 3 — Pull

```bash
cd <repo-root>
git fetch origin
git pull origin main   # or agent/P1.1 if user explicitly requests it
```

Then read `tracker-drops/.latest-drop-id` to get the active run-id, and confirm `tracker-drops/<run-id>/SUMMARY.md` and `signals.json` both exist.

---

## Phase 4 — Interpret in chat (six required blocks)

**Critical:** Output goes to **chat only**. Do not write `INTERPRETATION.md` or any other file. The repo has a legacy `INTERPRETATION.md` pattern in `tracker-drops/2026-05-04T19-37-46Z/` — **ignore it** unless the user explicitly says "save the interpretation".

Before producing the six blocks, do **two** preprocessing steps on `signals.json`:

1. **Dedupe** by `(competitor_id, source_url)` — keep the row with the highest `importance`. The publish-drop pipeline stores one row per (URL, collect-cycle), so most URLs appear 10–20× in a 7-day window.
2. **Diff against the prior drop** — only surface signals whose evidence changed. If the same `(competitor_id, source_url)` appeared in the previous drop with a byte-identical `evidence_snippet`, **drop it from the interpretation** (it's already been reported on). Annotate carryover signals as `[unchanged since <prior-drop-id>]` only if the user explicitly asks "show me everything."

Combined dedupe + diff one-liner (run from `<repo-root>`):

```bash
node -e '
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const id = fs.readFileSync("tracker-drops/.latest-drop-id", "utf8").trim();
const drops = fs.readdirSync("tracker-drops").filter(f => f.match(/^\d{4}-/)).sort();
const idx = drops.indexOf(id);
const prior = idx > 0 ? drops[idx - 1] : null;
const dedup = (rows) => {
  const m = new Map();
  for (const r of rows) {
    const k = `${r.competitor_id}::${r.source_url}`;
    const cur = m.get(k);
    if (!cur || (r.importance||0) > (cur.importance||0)) m.set(k, r);
  }
  return Array.from(m.values());
};
const ev = (r) => crypto.createHash("md5").update(r.evidence_snippet || "").digest("hex");
const latest = dedup(JSON.parse(fs.readFileSync(`tracker-drops/${id}/signals.json`)));
const priorEvs = prior ? new Map(dedup(JSON.parse(fs.readFileSync(`tracker-drops/${prior}/signals.json`))).map(r => [`${r.competitor_id}::${r.source_url}`, ev(r)])) : new Map();
const netNew = latest.filter(r => priorEvs.get(`${r.competitor_id}::${r.source_url}`) !== ev(r));
console.log(`Latest drop: ${id} — ${latest.length} unique URLs`);
console.log(`Prior drop:  ${prior || "(none)"} — diff base`);
console.log(`Net-new (use these for §4.2 onward): ${netNew.length}`);
console.log(`Carryover (do not surface unless asked): ${latest.length - netNew.length}`);
const by = (k) => Object.entries(netNew.reduce((a,r)=>{const v=k(r)||"<none>";a[v]=(a[v]||0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]);
console.log("\nNET-NEW BY COMPETITOR:"); for (const [k,v] of by(r=>r.competitor_id)) console.log(`  ${v}\t${k}`);
console.log("NET-NEW BY SOURCE:");      for (const [k,v] of by(r=>r.source))         console.log(`  ${v}\t${k}`);
'
```

Use the **net-new** set (not the full dedup'd set) for §4.2 onward. If net-new is empty (`0`), stop the cycle and report: "Latest drop has no content changes vs. prior drop `<prior-id>`. Nothing new to interpret."

Then produce these six blocks **in this order**. Every block is required — if you cannot produce one, say so explicitly and explain why.

### 4.1 Drop health

Lanes table. One row per `source` lane present in the drop. Keep it narrow (4 columns) so it renders without horizontal scroll in chat.

```markdown
| Lane | Pillar | Status | Cause (if not ✅) |
|---|---|---|---|
| features_page | P1 | ✅ | — |
| g2_reviews | P3 | ❌ | Cloudflare 403 |
```

Status values: `✅` working / `⚠️` partial (selectors return shallow content) / `❌` broken / `❓` silent (zero rows in window — verify next run).

### 4.2 Main moves

3–7 bullets, one per significant competitor move. Every bullet ends with a citation chip in the format `[<source> · <date> · "<≤25-word excerpt>"]`. No claim without a chip.

### 4.3 Gaps → Features (hard-required)

This is the deliverable the manager cares about most. Convert every Phase 4.2 main move into one or more rows.

Use the table when there are ≤4 gaps; switch to a numbered list with bold field labels when there are 5+ gaps so chat doesn't horizontal-scroll:

```markdown
| # | Competitor signal | Proposed feature | Tier |
|---|---|---|---|
| 1 | EliseAI "Agent" mobile CRM | Mobile-first prospect→tour→app demo flow | Now |
| 2 | Anyone Home bundled stack | "Leasing OS" bundle SKU + landing page | Now |
```

For each row, a sub-bullet immediately below with the full detail (kept off the table to avoid wide cells):

```
1. **Gap:** No AI-native mobile CRM narrative on entrata.com.
   **Acceptance:** 90s video; opens on phone screen; no desktop screenshots.
```

Tier values: **Now** (act this cycle) / **Later** (next 1–2 cycles) / **Won't chase** (signal-only, no action).

If a move maps to no gap (e.g. talent/brand signals), still add the row with `Tier = Won't chase` and note "(signal-only, no product gap)" in the sub-bullet. Never silently drop a Phase 4.2 move from this section.

### 4.4 PRD draft

One PRD per **Tier-Now** feature from §4.3. Use this template:

```markdown
#### PRD: <feature name>

- **Problem:** <1–2 sentences, anchored on the competitor signal>
- **Target user:** <leasing agent / PMM / sales rep / prospect>
- **Scope (in):** <bullet list, ≤5 items>
- **Scope (out):** <what we deliberately don't build>
- **Success metric:** <1 measurable thing, with target if known>
- **Evidence:** `tracker-drops/<run-id>/signals.json` row(s): <competitor_id> · <source> · <date>
- **Effort estimate:** S / M / L (engineering rough cut)
```

Skip PRDs for Tier-Later and Tier-Won't-chase rows.

#### 4.4b PRD confirmation + optional PDF export

After producing each PRD, ask the manager **two questions in chat** (use the `AskQuestion` tool when available):

1. **"Does this PRD look right?"** — options: `approve` / `edit` / `discard`
2. If approved, **"Want a downloadable PDF copy of this PRD?"** — options: `Yes — export PDF to ~/Desktop/tracker-decks/` / `No — chat-only is fine`

If the manager says "edit," apply their edits inline in chat and re-ask the two questions before exporting.

If the manager says "discard," drop the row from §4.6 prioritization and continue with the next PRD.

##### Render approach — HTML + Chrome headless (use this; pandoc is deprecated for this skill)

Earlier versions of this skill called for `pandoc --pdf-engine=wkhtmltopdf`. **Don't.** Both binaries are not installed on a stock macOS dev machine, `wkhtmltopdf` was removed from Homebrew core (deprecated upstream), and asking the manager to `brew install` mid-cycle breaks flow. The reliable path is to render the PRD as HTML and let Chrome headless print it to PDF. Chrome is always installed.

Slug convention: `PRD-<competitor>-<short-feature-name>-<run-id>.pdf`.

**Step 1 — write the PRD as standalone HTML** to `tracker-decks/<slug>.html` inside the workspace. This folder is committed alongside the drop so the manager can re-render manually later. Use the embedded-CSS template at the bottom of this section so every PRD has consistent typography.

**Step 2 — render to PDF via Chrome headless.** This command **must** be issued with `required_permissions: ["all"]` because Chrome will not start under the macOS seatbelt sandbox (it `SIGABRT`s on launch regardless of `--no-sandbox`):

```bash
mkdir -p ~/Desktop/tracker-decks
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --disable-gpu \
  --no-pdf-header-footer \
  --print-to-pdf="$HOME/Desktop/tracker-decks/PRD-<slug>.pdf" \
  "file://$PWD/tracker-decks/PRD-<slug>.html"
```

A successful run prints `<N> bytes written to file ...` and the PDF lands in `~/Desktop/tracker-decks/` (~100 KB per single-page PRD). Verify with `ls -la ~/Desktop/tracker-decks/`.

**Step 3 — also drop a `render-to-pdf.sh` companion script** alongside the HTML files (workspace `tracker-decks/`) so the manager can re-render manually from a normal terminal if the Cursor permission prompt fails to surface. Single source of truth, two ways to invoke.

**If the `["all"]` permission bubble times out** (Cursor UI bug: "Failed to find tool call context: Timeout waiting for bubble creation"), retry the same command once. If it times out twice, fall back: leave the `.html` files + `render-to-pdf.sh` in `tracker-decks/` and tell the manager to run `bash tracker-decks/render-to-pdf.sh` from a normal terminal. Do **not** silently degrade to writing `.md` files — the manager has been clear they want the PDF.

##### HTML template (paste verbatim, then fill the body)

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PRD — <feature name></title>
<style>
  @page { size: Letter; margin: 0.75in; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; max-width: 7in; }
  h1 { font-size: 18pt; margin: 0 0 4pt 0; border-bottom: 2px solid #1a1a1a; padding-bottom: 4pt; }
  .meta { font-size: 9pt; color: #666; margin-bottom: 14pt; }
  h2 { font-size: 12pt; margin: 14pt 0 4pt 0; color: #c0392b; }
  ul { margin: 4pt 0 4pt 18pt; padding: 0; } li { margin-bottom: 3pt; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 9.5pt; background: #f4f4f4; padding: 1pt 3pt; border-radius: 2pt; }
  .pill { display: inline-block; padding: 1pt 6pt; border-radius: 8pt; font-size: 9pt; font-weight: 600; color: white; }
  .pill-l { background: #c0392b; } .pill-m { background: #d35400; } .pill-s { background: #16a085; } .pill-now { background: #27ae60; }
  .footer { margin-top: 18pt; padding-top: 6pt; border-top: 1px solid #ccc; font-size: 8.5pt; color: #888; }
</style>
</head>
<body>
<h1>PRD: <feature name></h1>
<div class="meta">Drop: <code><run-id></code> &middot; Tier <span class="pill pill-now">Now</span> &middot; Effort <span class="pill pill-l">L</span> &middot; Triggered by <competitor signal></div>
<h2>Problem</h2><p>...</p>
<h2>Target user</h2><p>...</p>
<h2>Scope (in)</h2><ul><li>...</li></ul>
<h2>Scope (out)</h2><ul><li>...</li></ul>
<h2>Success metric</h2><p>...</p>
<h2>Evidence</h2><p><code>tracker-drops/<run-id>/signals.json</code> row: ...</p>
<h2>Effort estimate</h2><ul><li>...</li></ul>
<p style="margin-top:8pt"><strong>Engineering ask:</strong> ...</p>
<div class="footer">Generated by tracker-drop-cycle skill · drop <code><run-id></code></div>
</body>
</html>
```

##### Rule binding

This template is anchored to the **engineering-shaped PRD rule** at `.cursor/rules/prds-must-be-engineering-shaped.mdc`. The `Engineering ask` block at the bottom of the template is **non-optional** — if you cannot fill it with real build work, the PRD does not pass and should be downgraded per §4.3 to `Tier = Won't chase`. Do not generate the PDF for a PRD that fails this check.

### 4.5 Slack message (chat-paste)

A copy-pasteable block, **≤8 lines**, ready for the manager to paste into `#competitive-intel`. Format:

```
:tracker: New tracker drop: <run-id> (<N> new signals, <K> unique URLs)
Top moves this drop:
• <competitor>: <one-line summary> [<source · date>]
• <competitor>: <one-line summary> [<source · date>]
Gaps converted to PRDs: <count> Now · <count> Later
Drop: https://github.com/alonsoroca-gif/Tracker-Competitors-Bot/tree/main/tracker-drops/<run-id>
```

Today this output stays in chat. **Do not** call any Slack webhook unless the user explicitly says `--slack` or "post to slack" AND `SLACK_WEBHOOK_URL` is set.

### 4.6 Prioritization summary

A 3-row table grouping §4.3 rows by tier:

```markdown
| Tier | Rows | Rationale |
|---|---|---|
| Now | 1, 2 | <why these can't wait> |
| Later | 3, 5 | <why deferred> |
| Won't chase | 4 | <why signal-only> |
```

---

## Phase 5 — Prototype in chat

For each **Tier-Now** PRD from §4.4, produce one battle card. Template:

```markdown
### Battle card — <competitor> <feature/move>

**Trigger:** <citation chip from §4.2>

**What they're claiming**
- <bullet>
- <bullet>

**What we actually know vs. don't know**
- Known: <bullet>
- Unknown (track in next drop): <bullet>

**Entrata response (3 plays)**

| Play | Owner | Time |
|---|---|---|
| <short play> | PMM / PM / Sales / Eng | S/M/L |

(Risk-if-skip detail in a sub-bullet under each play to keep the table narrow.)

**Concrete artifact for Product OS**
- File: `entrata-product-os/battlecards/<slug>.md` (or `prototypes/<slug>.md` for UX work)
- Sections: <list 3–5 sections>
- Acceptance: <single sentence — what makes it shippable>

**Net-new engineering ask:** <yes + brief / none — packaging-only / blocked on X>
```

Aim for 1–2 battle cards per drop. Three is the absolute max in chat — beyond that, defer to a separate session.

---

## Coordination rules

**Branch model (single-writer architecture):**

- `agent/P1.1` — **writer-staging branch.** Both writers land drops here:
  - This skill (manual via `/trackerstart`)
  - GitHub Actions cron at `.github/workflows/tracker-drop.yml` (3× weekday: 8:30am / 12pm / 5pm MT)
- `main` — **consumer mirror.** Auto-promoted from `agent/P1.1` by `.github/workflows/auto-merge-agent.yml` within ~30s.

**Two safety-net workflows keep the branches in sync:**

| Workflow | Direction | Trigger | Purpose |
|---|---|---|---|
| `auto-merge-agent.yml` | `agent/P1.1` → `main` | Every push to `agent/P1.1` | Promote new drops to consumer view |
| `mirror-main-to-agent.yml` | `main` → `agent/P1.1` | Every push to `main` | Catch any rogue push to main; fast-forward agent/P1.1 |

Together they form a closed loop. Divergence on the `.latest-drop-id` pointer file is **structurally impossible** under normal operation, and **operationally caught** within ~30s if a human bypasses the structure.

The Phase 0 freshness + hash check prevents the skill from racing the cron or re-interpreting unchanged signals.

| Scenario | Behavior |
|---|---|
| CI dropped <15 min ago, content changed | Skip 1–2 → straight to Phase 3 |
| Latest drop hash == prior drop hash | Stop cycle ("no new content") |
| Last drop is older OR missing | Run Phases 1–5 in full |
| Both runners fire same minute (rare) | Loser's `git push` fails → skill retries with `git pull --rebase` then re-runs Phase 1 |
| Skill files edited (this `SKILL.md`, `examples.md`, `trackerstart.md`) | Commit to `agent/P1.1` → auto-merge workflow mirrors to `main` automatically |

**The rebase in Phase 2 is non-negotiable.** Always rebase `agent/P1.1` and `main` before pushing.

---

## Branch model

| Branch | Purpose |
|---|---|
| `agent/P1.1` | Where drops land first. CI workflow + this skill both target it. |
| `main` | Always-fresh canonical. Auto-merged from `agent/P1.1` after each non-empty drop. |

Manager pulls from `main` by default. Only pull `agent/P1.1` if the user explicitly asks ("show me the agent branch") or if `main` has not yet been merged with the latest drop (rare race).

---

## Anti-patterns

These are easy to do and wrong:

1. **Writing `INTERPRETATION.md`.** Phase 4 is chat-only. The legacy file in `tracker-drops/2026-05-04T19-37-46Z/INTERPRETATION.md` is a one-off, not a pattern.
2. **Skipping the dedupe step.** `signals.json` has ~17× duplication per URL. Quoting raw counts gives a wrong picture of competitor activity.
3. **Producing §4.3 (Gaps → Features) without §4.4 (PRD) for Tier-Now rows.** The PRD is what makes the gap actionable. If §4.3 has Tier-Now rows, §4.4 must have matching PRDs.
4. **Wide tables in chat.** Chat width is narrow — tables with >4 columns or long cell text horizontal-scroll. Cap at 4 columns; push detail into sub-bullets.
5. **Inventing entrata-core code anchors.** Entrata core lives at `~/Desktop/Core Repo/entrata-core/` and is *not* loaded in the demo clone. Cite core anchors only if the user is in the multi-root workspace and the code is searchable. Otherwise note "core anchors deferred" in the PRD.
6. **Posting to Slack without explicit consent.** `--slack` flag + `SLACK_WEBHOOK_URL` env var both required. Default = chat-paste only.
7. **Force-pushing or skipping the auto-merge step.** The manager pulls `main`; if `main` is stale, the manager sees a stale drop and assumes no new activity.
8. **Skipping Phase 0.** Without the freshness + hash check, the skill races the CI cron and may re-interpret unchanged signals.
9. **Surfacing carryover signals as if they were new.** §4.2 onward must use the **net-new** set from the diff step, not the full dedup'd set. Repeating last drop's "main moves" wastes the manager's time.
10. **Offering PDF export without checking prereqs.** If `pandoc` or `wkhtmltopdf` is missing, the manager must be told the install command (`brew install pandoc wkhtmltopdf`) at the moment they're asked about PDF, not after a silent failure. See Phase 4.4b.
11. **Stopping Phase 0 without surfacing options.** When the cycle stops on a hash-match (no new content), the manager must be presented with clickable `AskQuestion` options (stop / interpret last meaningful / force fresh / show agent branch). Never end the message with "stopping cycle" and nothing else, and never ask the manager to type back free-text commands like "interpret 2026-05-08T...". Drop IDs in option labels must be paired with human context (age, size). See Phase 0 stop UX.

---

## Repo conventions reference

| Item | Value |
|---|---|
| Repo URL | `https://github.com/alonsoroca-gif/Tracker-Competitors-Bot.git` |
| Tracker scripts dir | `initiative-1-tracker/tracker/scripts/` |
| Drop publisher | `scripts/publish-drop.js` (also wired as `npm run drop`) |
| Drops folder | `tracker-drops/` (root of repo) |
| Latest-drop pointer | `tracker-drops/.latest-drop-id` |
| CI drop workflow | `.github/workflows/tracker-drop.yml` (3× weekday MT — 8:30am/12pm/5pm; pushes to `agent/P1.1`) |
| CI auto-merge workflow | `.github/workflows/auto-merge-agent.yml` (mirrors every push on `agent/P1.1` → `main`, ~30s lag) |
| CI safety-net mirror | `.github/workflows/mirror-main-to-agent.yml` (fast-forwards `agent/P1.1` from `main` if anything bypasses the structure) |
| Force-write env var | `TRACKER_DROP_FORCE=1` |
| Slash command | `.cursor/commands/trackerstart.md` (thin router to this skill) |
| PRD PDF export dir | `~/Desktop/tracker-decks/` (created on demand by Phase 4.4b) |

---

## Additional resources

- For a worked Phase 4 + Phase 5 output on a real drop, see [examples.md](examples.md).
- For deeper config (publish-drop flags, env vars, lane definitions, debugging recipes), see [reference.md](reference.md).
