---
name: tracker-drop-cycle
description: Runs the end-to-end Tracker competitive-intel cycle for the Tracker-Competitors-Bot repo — smart-detects whether a fresh drop already exists, otherwise collects a new drop and pushes to GitHub with auto-merge into main, then pulls, interprets the drop in chat with citations, and produces counter-positioning prototypes. Use when the user types `/trackerstart`, "do the tracker cycle", "run the tracker cycle", "pull the latest drop and interpret", "competitive intel cycle", or asks to analyze a folder under `tracker-drops/`.
---

# tracker-drop-cycle

End-to-end Tracker competitive-intel workflow for the **`Tracker-Competitors-Bot`** repository. Five phases, one trigger. Phases 0–4 output lives **in chat**; Phase 5 invokes a chain of subskills that write artifacts (feature-spec, prototype source, design-critique report, video transcript, walkthrough video) to the prototype workspace, with paths surfaced back into chat at every step.

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
- [ ] Phase 4 — Interpret in chat (nine blocks, non-skippable; 4.1b is the carryover-spotlight, 4.2a is the classification gate, 4.2b is the parity gate, 4.7 advances the interpretation pointer)
- [ ] Phase 5 — Subskill chain (feature-spec → grade → prototype → critique → transcript → video for each Tier-Now PRD)
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

**Decision tree (four branches):**

- **Hash match + recent** → STOP, but **never stop silently**. Use the `AskQuestion` tool to present the manager with clickable options (see "Phase 0 stop UX" below). Wait for their response before doing anything else.
- **Hash differs + drop is <15 min old** AND user did **not** say "force" / "fresh" / `--force` → skip Phases 1–2. Announce: "Latest drop `<id>` is `<fmtAge>` old (likely from CI) and has new content. Skipping collect, jumping to Phase 3." Then proceed to Phase 3.
- **Hash differs + drop is ≥15 min old + latest is the only unread drop** (i.e., the latest drop has content that has never been interpreted because its content already differed from the prior cycle's source-drop) → surface via `AskQuestion` with two options: *"Skip Phases 1–2, interpret what's there (recommended — this drop has unread new content)"* / *"Force a fresh collect (Phases 1–5)."* Never auto-proceed to Phase 1 in this case; the latest drop probably already carries the intel the manager wants and a fresh collect is likely to re-collect the same signals and skip the commit anyway. Added 2026-05-26 after the live-cycle Gap #1 surfaced this case (1.4-hour-old drop with unread new content was mis-routed to Phase 1 by the prior 3-branch tree).
- **Drop is ≥15 min old + hash-identical to prior** OR **missing entirely** OR user requested a fresh collect → proceed to Phase 1.

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

## Phase 4 — Interpret in chat (eight required blocks)

**Critical:** Output goes to **chat only**. Do not write `INTERPRETATION.md` or any other file. The repo has a legacy `INTERPRETATION.md` pattern in `tracker-drops/2026-05-04T19-37-46Z/` — **ignore it** unless the user explicitly says "save the interpretation".

Before producing the nine blocks, do **two** preprocessing steps on `signals.json`:

1. **Dedupe** by `(competitor_id, source_url)` — keep the row with the highest `importance`. The publish-drop pipeline stores one row per (URL, collect-cycle), so most URLs appear 10–20× in a 7-day window. (Background: the row-fan-out in `runCollectAll.js` tags every scrape with each Entrata `product_id`, which inflates the row count by ~11× without adding signal — see Anti-pattern #27 if a manager asks "why are there 198 rows for 17 URLs?").
2. **Diff against the interpretation base** — only surface signals whose evidence changed since the **last drop the manager closed Phase 4 on**. The base is resolved by `scripts/interpretation-pointer.js base`, which prefers `tracker-drops/.last-interpreted-drop-id` (per-machine pointer, gitignored) and falls back to strict `drops[idx-1]` only on first run. If the same `(competitor_id, source_url, snippet hash)` triple appeared at the base, **drop it from the interpretation** (it's already been reported on). Annotate carryover signals as `[unchanged since <base-id>]` only if the user explicitly asks "show me everything."

**Why the pointer matters:** the cron writes drops 3×/weekday, but human interpretation is intermittent. If the manager skips 5 cron cycles, strict `drops[idx-1]` would only show them 1 cycle's worth of changes — everything that landed during the skipped cycles is suppressed as carryover. The pointer-based base shows the manager **everything that arrived since they last looked**, regardless of how many cron drops happened in between. Coverage rule: `coverage = idx(latest) − idx(pointer)` drops; the larger this is, the more the pointer is doing for you. The §4.1b carryover spotlight remains the safety net for high-importance signals from before the pointer.

Combined dedupe + diff one-liner (run from `<repo-root>`):

```bash
BASE=$(node initiative-1-tracker/tracker/scripts/interpretation-pointer.js base 2>/dev/null || true)
node -e '
const fs = require("fs");
const crypto = require("crypto");
const id = fs.readFileSync("tracker-drops/.latest-drop-id", "utf8").trim();
const base = (process.env.BASE || "").trim() || null;
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
const baseEvs = base ? new Map(dedup(JSON.parse(fs.readFileSync(`tracker-drops/${base}/signals.json`))).map(r => [`${r.competitor_id}::${r.source_url}`, ev(r)])) : new Map();
const netNew = latest.filter(r => baseEvs.get(`${r.competitor_id}::${r.source_url}`) !== ev(r));
console.log(`Latest drop: ${id} — ${latest.length} unique URLs`);
console.log(`Diff base  : ${base || "(none — first run)"}`);
console.log(`Net-new (use these for §4.2 onward): ${netNew.length}`);
console.log(`Carryover (do not surface unless asked): ${latest.length - netNew.length}`);
const by = (k) => Object.entries(netNew.reduce((a,r)=>{const v=k(r)||"<none>";a[v]=(a[v]||0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]);
console.log("\nNET-NEW BY COMPETITOR:"); for (const [k,v] of by(r=>r.competitor_id)) console.log(`  ${v}\t${k}`);
console.log("NET-NEW BY SOURCE:");      for (const [k,v] of by(r=>r.source))         console.log(`  ${v}\t${k}`);
'
```

Use the **net-new** set (not the full dedup'd set) for §4.2 onward. If net-new is empty (`0`) **and** the §4.1b carryover spotlight is also empty, stop the cycle and report: "Latest drop has no content changes vs. interpretation base `<base-id>`, and no high-importance carryover in window. Nothing new to interpret." If net-new is empty but spotlight has rows, **continue** — the spotlight rows are the cycle's deliverable.

Then produce these **nine** blocks **in this order**. Every block is required — if you cannot produce one, say so explicitly and explain why. Block 4.1b (carryover spotlight) is the missed-cycle backstop, and blocks 4.2a (signal classification) and 4.2b (Core parity scan) are the two structural gates that decide which §4.3 rows even get a PRD. They run in order: spotlight first ("did we suppress anything by only diffing vs prior?"), then classification ("is this a Product signal at all?"), then parity ("if it is, does Core already ship it?").

### 4.1 Drop health

Lanes table. One row per `source` lane present in the drop. Keep it narrow (4 columns) so it renders without horizontal scroll in chat.

```markdown
| Lane | Pillar | Status | Cause (if not ✅) |
|---|---|---|---|
| features_page | P1 | ✅ | — |
| g2_reviews | P3 | ❌ | Cloudflare 403 |
```

Status values: `✅` working / `⚠️` partial (selectors return shallow content) / `❌` broken / `❓` silent (zero rows in window — verify next run).

### 4.1b Carryover spotlight (hard-required to invoke; trigger-gated to print)

**Why this exists:** The Phase 4 dedupe + diff (step 1 of this Phase) compares `latest` → `interpretation base` only. With the §4.7 pointer, that base is normally "the last drop the manager closed Phase 4 on" — which means in steady-state daily mode the diff already shows everything new and the spotlight has nothing to add. But three failure modes still warrant a re-surface pass: weekend / holiday / vacation accumulation, sick-day gaps, and first-run-after-clone (no pointer yet). The spotlight is the safety net for exactly those cases. The 2026-06-02 manager review surfaced this — Anyone Home shipped a substantial release (`9 June 2026 Release`, importance 0.82) on 2026-05-29 that had been carried forward for 6 cycles unread.

**Invocation contract:** the bot **must** run the script every cycle. The script itself **decides** whether to print the full table or a one-line "skipped — pointer up-to-date" note. Do not manually skip the script invocation — that breaks the audit trail and silently disables the safety net (anti-pattern #25).

**How:** Run the spotlight script from `<repo-root>`:

```bash
node initiative-1-tracker/tracker/scripts/carryover-spotlight.js
```

**Trigger logic (added 2026-06-08; supersedes the prior unconditional fire):**

The script evaluates four triggers in order and fires the full output if any one is true:

| # | Trigger | Default threshold | What it covers |
|---|---|---|---|
| 1 | **First run** | always (no flag) | Fresh clone, fresh laptop, pointer file absent. The spotlight is the only "what's been happening?" panel. |
| 2 | **Calendar gap** | `--gap-days 2` | `dateOf(latest drop) − dateOf(pointer drop) ≥ 2` UTC calendar days. Captures Friday→Monday weekends, Thursday→Monday holidays, vacation, sick days. Excludes daily Mon→Tue runs. |
| 3 | **High coverage** | `--coverage-threshold 6` | `idx(latest) − idx(pointer) ≥ 6` drops. Backstop for cron-burst cases where calendar math undercounts (clock skew, multiple drops landed in one day while AFK). |
| 4 | **Forced** | `--force` / `--always` | Manual audit / debug — always fires regardless. |

If **none** fire, the script prints a single-line skip message:

```
§4.1b Spotlight: skipped — pointer up-to-date (calendar-gap=1d, coverage=3-drops). No accumulation since you last looked.
```

**Paste this skip line into chat verbatim as block 4.1b** — it is the spotlight in steady-state, not a missing block. If a trigger does fire, the output begins with a `Spotlight fired (...)` header showing which trigger and its values, followed by the markdown table.

**Behavior in steady-state daily-automation mode:** when the parent skill (e.g. a future `morningbrief` invocation that runs `/trackerstart` every morning) advances the pointer correctly via §4.7, calendar-gap is typically 0 or 1 and coverage is typically 1–3. The spotlight skips silently. It only re-engages when the daily run breaks — which is exactly the safety net design.

**Default content filters (unchanged from initial implementation):**

- Window: last **7 days** (matches drop retention)
- Floor: importance **≥ 0.70**
- Lanes excluded: `features_page`, `articles_index`, `careers` (stable boilerplate)
- Output: top **5** candidates, sorted by importance DESC then by age
- "First seen" semantics: earliest drop ever where this `(competitor_id, source_url, evidence_snippet hash)` triple appeared. A signal whose hash existed before the 7-day window is **stale**, not spotlight material — filtered out.

**Paste the full markdown output verbatim into chat.** Do not edit the table; if rows look wrong, fix the script (or the importance scoring upstream), don't curate by hand (anti-pattern #26).

**How spotlight rows feed the rest of Phase 4:**

- Spotlight rows join the `§4.2 main moves` candidate set alongside net-new diff rows. Both are subject to the §4.2a classification gate and (if Product) §4.2b parity gate.
- Annotate spotlight rows in §4.2 with `[carryover · first seen <drop-id>]` after the citation chip.
- If a spotlight row was already classified + processed in a prior cycle, the manager can downgrade it via the §4.2a `AskQuestion` (`Noise / data quality` with note "already-actioned"). Do not silently drop spotlight rows on the bot's own initiative.

**Tunable flags (full set):**

| Flag | Default | When to override |
|---|---|---|
| `--min-importance <0..1>` | `0.7` | Lower to `0.5` once a quarter to audit lower-confidence carryover; raise to `0.85` only if the chat overflows |
| `--window-days <N>` | `7` | Match a longer collect window if `publish-drop` retention changes |
| `--top <N>` | `5` | Raise to `10` for a quarterly review; never exceed `15` (chat width) |
| `--include-net-new` | off | Combined view (carryover + net-new); spotlight defaults to carryover-only since net-new lives in §4.2 |
| `--gap-days <N>` | `2` | Daily-only mode: raise to `7` to suppress until weekly review; tighter `1` to fire on every calendar rollover (noisy) |
| `--coverage-threshold <N>` | `6` | Aligns roughly with Friday→Monday cron accumulation (3 drops/weekday × 2 days) |
| `--force` / `--always` | off | Manual audit ("show me everything regardless"); useful for first-time onboarding walk-throughs |
| `--json` | off | Machine-readable output for downstream tooling (Slack digest, future morningbrief subskill) |
| `--drop-id <id>` | latest | Re-run against an older drop without touching `.latest-drop-id` |

**Empty-but-fired vs skipped — two different outcomes:**

- **Skipped** (no trigger fired): one-line message, no analysis run. Pointer is up-to-date; daily diff already covered everything. Continue to §4.2.
- **Fired but 0 rows** (trigger fired, but no carryover above threshold): full header line + `_No carryover signals…_` italic line. The cycle had a real gap to cover but no high-importance signals accumulated. Continue to §4.2.

Both are first-class outcomes — neither is a skill bug.

**Automation note (hands-off coverage if the manager skips cycles entirely):**

The spotlight script's `--json` output is designed to feed a future GitHub Action that posts the top-5 to `#competitive-intel` Slack daily, so the team has continuous coverage even when nobody runs `/trackerstart`. Not yet wired; tracked separately. Until then, the trigger-gated spotlight on every `/trackerstart` invocation is the safety net.

### 4.2 Main moves

3–7 bullets, one per significant competitor move. Every bullet ends with a citation chip in the format `[<source> · <date> · "<≤25-word excerpt>"]`. No claim without a chip.

### 4.2a Signal classification (hard-required — gates §4.2b)

**Why this exists:** Without this step, the skill is structurally biased toward inventing engineering work for any signal it can find a Core gap for. The 2026-05-13 manager review surfaced this second-order failure mode after Phase 4.2b shipped: a PMM signal (Funnel Leasing's 670 ratings on featuredcustomers.com) was converted into a "Customer Stories Hub" PRD because parity returned `Partial` and the engineering-shaped-PRD rule pushed the bot to find buildable scope. The right answer was "no PRD — route to PMM." The classification gate asks the *prior* question — *is this even a Product signal?* — before parity gets to ask *"does Core have it?"*.

**How:** Classify every §4.2 main move into exactly one **primary bucket** below. Paste the classification table into chat as block 4.2a. Then **always** surface every row via `AskQuestion` for manager confirmation — never auto-classify silently, even when confidence is high. Only rows whose **final** bucket is `Product / capability` (either directly classified, or `Operational / SLA` promoted via the secondary AskQuestion) pass through to §4.2b parity. Every other bucket terminates with `Tier = Won't chase` in §4.3.

#### The 9 buckets

| # | Bucket | Definition | Owner of response | PRD eligible? |
|---|---|---|---|---|
| 1 | **Product / capability** | Competitor shipped or announced a concrete new product feature with describable functionality | Product + Eng → proceeds to §4.2b parity | ✅ Always |
| 2 | **PMM / channel-building** | Investment in marketing channels, social proof, testimonials, listings, aggregator presence | PMM | ❌ Never |
| 3 | **Pricing / positioning** | Tier change, packaging change, pricing-page language change | Commercial / Sales Ops | ❌ Never |
| 4 | **Talent / org** | Hire, departure, reorg, layoff, exec change | Exec context briefing | ❌ Never |
| 5 | **Funding / financial** | Capital raise, acquisition, valuation, IPO, M&A | Exec context | ❌ Never |
| 6 | **Editorial / content** | Blog cadence, thought-leadership, conferences, press | PMM / Content | ❌ Never |
| 7 | **Operational / SLA** | Support model, response-time claim, uptime claim, staffing model | CX / Ops — see "When Operational implies a product gap" below | ⚠️ Conditional |
| 8 | **Strategic / partnership** | Partnership announcement, integration with adjacent platform, channel deal | BD / Partnerships | ❌ Never |
| 9 | **Noise / data quality** | Scraper noise, lane returning empty content, vocabulary drift on a competitor's site | Tracker eng (us — we own the scraper) | ❌ Never |

#### Auto-suggest heuristics (the bot's first pass)

These are *suggestions*, not decisions. The bot pastes the classification table with its auto-suggested bucket per row and the heuristic that fired; the manager always confirms via `AskQuestion` before §4.2b runs.

| Signal pattern | Auto-suggested bucket |
|---|---|
| Lane = `pricing_page`, OR snippet contains `$N/mo`, `tier`, `package` | `Pricing / positioning` |
| Lane = `careers`, OR snippet contains `hire`, `joined`, `appointed`, `CPO`, `CRO`, `VP of` | `Talent / org` |
| Lane = `g2_reviews`, `reviews_other`; OR source domain matches `featuredcustomers.com`/`capterra.com`/`getapp.com`; OR snippet about ratings/testimonials/social proof | `PMM / channel-building` |
| Snippet contains `raised $`, `Series A/B/C`, `valuation`, `acquired by` | `Funding / financial` |
| Lane = `articles_index`, `case_studies`; snippet about content cadence / thought-leadership | `Editorial / content` |
| Snippet contains `partnership`, `integrated with`, `now works with`, `available on` | `Strategic / partnership` |
| Snippet contains `SLA`, `response time`, `uptime`, `staffed 24/7`, `<N>-minute response` | `Operational / SLA` |
| Snippet describes a new feature (`launches`, `introducing`, `new module`, `now you can`, `release notes`) | `Product / capability` |
| Evidence snippet is blank, garbled, or `<30 chars` | `Noise / data quality` |
| Multi-pattern match (e.g. "EliseAI launches Voice Agent v2 at $0.10/call") | Pick the dominant bucket; list secondaries in the table's `Notes` column |

#### Required AskQuestion shape (always, every drop)

```
AskQuestion:
  prompt: "Classify each §4.2 main move. Only Product-classified rows proceed to §4.2b parity."
  questions:
    - id: "row-<n>"
      prompt: "<one-line paraphrase of signal> — bot suggests <bucket> (heuristic: <which pattern fired>)"
      options:
        - "Product / capability"
        - "PMM / channel-building"
        - "Pricing / positioning"
        - "Talent / org"
        - "Funding / financial"
        - "Editorial / content"
        - "Operational / SLA"
        - "Strategic / partnership"
        - "Noise / data quality"
```

The bot **never** skips this AskQuestion, even when every auto-suggestion is high-confidence. The manager seeing the table is the cycle's only proof that classification ran.

#### When Operational implies a product gap

If any row is classified `Operational / SLA` (either by auto-suggest or by manager override), surface a **secondary AskQuestion** per Operational row before proceeding to §4.2b:

```
AskQuestion:
  prompt: "Operational signal: <signal>. Does this require Entrata product to ship a capability we don't have?"
  options:
    - "Yes — promote to Product. Run §4.2b parity on this row."
    - "No — stays Ops. Route to CX / Ops team. No PRD."
```

This secondary prompt is the **only** path by which an Operational signal becomes PRD-eligible. The Product promotion must be recorded in the §4.4 PRD's `Originating signal classification` line as `Operational / SLA → promoted to Product` with the promotion timestamp.

#### What passes through to §4.2b

Only rows whose **final** bucket is `Product / capability`. The bot prints a one-line summary at the end of §4.2a:

```
§4.2a result: <N> moves classified. <M> Product (→ §4.2b parity). <K> Won't-chase (routed: PMM=<n>, Pricing=<n>, Talent=<n>, ...).
```

If `M == 0`, **skip §4.2b entirely** and proceed to §4.3 with every row marked Won't-chase. This is a deliberate first-class outcome (a "PMM-heavy drop" or "talent-news drop"), not a failure mode.

#### Rule binding

This step is anchored to `.cursor/rules/prds-must-pass-signal-classification.mdc`. Producing a §4.4 PRD for a row whose final classification is not `Product / capability` is a rule violation.

### 4.2b Core parity scan (hard-required — gates §4.3)

**Why this exists:** Without this step, the skill recommends features that Entrata Core already ships. The 2026-05-12 manager review surfaced three consecutive PRDs (All-In Pricing, JSON-LD feed, Live-PMS Siteplan) that all proposed building things already in `Applications/Entrata`, `Applications/EntrataLeasingWebsite`, `Applications/ProspectPortal`. The parity check is the structural fix — the skill literally scans Core before it writes the §4.3 table.

**Note:** §4.2b runs only on rows that passed §4.2a classification as `Product / capability` (including `Operational → Product` promotions). Rows classified into the other seven buckets skip parity entirely — they never produce PRDs, so the parity question is moot. If §4.2a classified zero rows as Product, skip §4.2b entirely.

**How:** For each §4.2a-Product row, mentally draft the candidate feature you'd propose (1 sentence). Then run the parity check against all candidates in one batch:

```bash
echo '[
  {"id":"1","competitor_signal":"<short paraphrase of move>","proposed_feature":"<your candidate feature>","product_id":"<best guess: leasing-ai|prospect-portal|...|null>"},
  {"id":"2", ...}
]' | node initiative-1-tracker/tracker/scripts/core-parity-check.js \
    --stdin \
    --format markdown \
    --save-candidate initiative-1-tracker/tracker/test/fixtures-pending
```

The `--save-candidate` flag writes every parity verdict the bot computes to `initiative-1-tracker/tracker/test/fixtures-pending/` as a fixture-ready JSON file. This is **auto-regression mode** (added 2026-05-26) — the regression suite grows naturally from real production runs instead of relying only on hand-written fixtures. The manager reviews + promotes (or discards) candidates after the drop ships:

```bash
node initiative-1-tracker/tracker/scripts/list-fixture-candidates.js                   # see what's pending
node initiative-1-tracker/tracker/scripts/list-fixture-candidates.js show <id>         # inspect one
node initiative-1-tracker/tracker/scripts/list-fixture-candidates.js promote <id> "Partial,Borderline,Gap"   # add to suite
node initiative-1-tracker/tracker/scripts/list-fixture-candidates.js discard <id>      # delete
```

**Candidates are never auto-promoted.** The pipeline saves them; the manager decides what becomes a regression fixture. Use this any time a parity verdict was *interesting* (a hard-fought Borderline manager-promotion, a surprising Existing on a feature you thought was novel, a Gap on something Core probably should have) — promote it as a fixture so the next stoplist or threshold change can't silently regress it.

**No env var, no setup.** The script auto-resolves Entrata Core in this order: `--core <path>` flag → `$ENTRATA_MONO_ROOT` (legacy) → `initiative-1-tracker/tracker/.core-path` cache (auto-written on first discovery) → scan of common locations (`~/Desktop/Core Repo/entrata-core`, `~/Documents/...`, `~/Projects/...`, `~/Code/...`, `~/Core Repo/...`, `~/entrata-core`). The first time the script finds Core, it caches the path so every subsequent run is instant.

#### Candidate drafting rubric (added 2026-05-26 after live-cycle Gaps #2 + #3)

Parity scoring is keyword-density-sensitive — the script computes its keyword blob from `competitor_signal` + `proposed_feature` (see `core-parity-check.js` line 557). Two semantically equivalent candidates can score >100× differently depending on wording. The 2026-05-26 live cycle surfaced this concretely: the same SightMap-siteplan concept scored 3/1/1 (Gap) with lean wording and 540/87/12 (Existing) with rich wording. Neither extreme is honest; the calibrated read landed at Partial.

To minimize wording-drift across cycles when drafting candidate features:

1. **Use the strongest verbatim signal phrasing.** Quote the competitor's exact words where possible (e.g., "Live-PMS Siteplan" if they use it, "interactive siteplan" if they use that, "interactive map" if they use that). Don't paraphrase down to generic vocabulary that strips matchable tokens.
2. **Name the Entrata-domain target app explicitly.** If the candidate fits inside `ProspectPortal`, `EntrataLeasingWebsite`, `Customers`, or any other Core app, name it: *"... in ProspectPortal"*, *"... module in EntrataLeasingWebsite"*. The parity scanner indexes file paths under `Applications/`, so naming the target app gives the score the right scaffold.
3. **Include 2–3 concrete capability nouns.** "Floorplan", "unit availability", "pricing", "appointment", "guest card", "tenant", "commercial lease", "screening" — these are tokens Core actually uses. Generic words like "feature", "system", "module" alone score poorly because Core uses them too sparsely.
4. **Don't keyword-stuff.** If the candidate goes from score 3 (lean) to score 540 (rich), you've over-corrected. Rich wording should produce a Partial-to-Existing range (15–80 typical), not a saturated >300. If you can't naturally fit a token without the candidate reading like a search query, leave it out.

**When in doubt, run the lean+rich double-pass.** Draft a lean version (minimal vocabulary) and a rich version (rubric above), invoke the parity script on both as separate candidates, then compare:

- **Both agree (same verdict bucket)** → use that verdict.
- **Disagree (different bucket)** → treat the row as `Borderline` by definition and surface via the SKILL.md Borderline-resolution AskQuestion to let the manager pick Partial / Gap / Skip. Disagreement between two reasonable wordings is the bot honestly saying *"the scanner can't decide; the human resolves."*

Never silently accept a verdict that contradicts an existing fixture or a known Core capability without running the second pass. The most common failure mode is a `Gap` verdict on a feature Core obviously ships (e.g., tour scheduling); that's almost always lean wording missing the vocab Core uses.

The script reuses the keyword scanner in `lib/repoInsight.js` (with a parity-specific whole-word matcher) and walks every app under `${CORE_ROOT}/Applications/`. It returns one of five verdicts per candidate:

| Verdict | Meaning | Action in §4.3 |
|---|---|---|
| **Existing** | High match density across ≥4 files in multiple apps (score ≥ 40 AND files ≥ 4) — Core already ships this concept | Row gets `Tier = Won't chase — already shipped`; no PRD written |
| **Partial** | Confident foundation exists (score ≥ 15 AND files ≥ 2) but specific concept is incomplete | Row stays at Tier-Now (or Later), but §4.4 PRD scope must be the **delta**, not a rebuild |
| **Borderline** | Low-confidence: single-file dominance, score 8–14, or Existing-grade score with thin file breadth | **Stop. Surface via `AskQuestion` and let the manager promote to Partial or Gap before assigning Tier.** Never auto-promote a Borderline row. |
| **Gap** | No meaningful Core presence (score < 8) | Row proceeds normally to §4.4 |
| **Unknown** | Auto-discovery couldn't find Core (rare — only when Core isn't in any of the standard locations on this machine) | See "When parity is Unknown" below |

**Paste the parity table directly into chat** as block 4.2b — it's the manager-visible proof the bot did the check. Then continue to §4.3.

#### When any row is `Borderline`

Borderline exists because keyword matching is honest about its own uncertainty. Score-noise near a threshold, single-file matches, and Existing-grade scores concentrated in too few files all surface as `Borderline` — the script refuses to guess. Before continuing to §4.3, batch all Borderline rows into a single `AskQuestion`:

```
AskQuestion:
  prompt: "<N> parity verdicts came back Borderline. For each, choose: treat as Partial (delta-shaped PRD), treat as Gap (full PRD), or skip (no PRD)."
  questions:
    - id: "row-<n>"
      prompt: "<proposed feature> — <top Core file path> (<score>/<files>/<apps>)"
      options:
        - "Partial — Core has the foundation; PRD scope is the delta"
        - "Gap — Core hits look incidental; PRD describes the whole feature"
        - "Skip — no PRD this drop; revisit next cycle"
```

Show the top Core file path in each option label so the manager can spot-check whether the match is real or a vocabulary collision. **Do not** silently pick a side for the manager — the whole point of Borderline is "the bot is not confident; show your work to the human."

#### When parity is `Unknown`

If the script exits with code 2 and every row is `Unknown`, Core isn't in any of the standard locations on this machine. The script will have printed the list of paths it tried on stderr. **Do not silently treat Unknown as Gap.** Instead, surface a clickable choice to the manager via `AskQuestion`:

```
AskQuestion:
  prompt: "Couldn't auto-discover Entrata Core. Where is your local checkout?"
  options:
    - "It's at <first stderr path the script tried>"
    - "I'll paste the absolute path"   ← then read the manager's reply and run with --save-core <path>
    - "Proceed without the parity gate (PRDs won't be Core-aware — flag in §4.3)"
    - "Stop the cycle; I'll fix Core access first"
```

If the manager pastes a path, run `node initiative-1-tracker/tracker/scripts/core-parity-check.js --save-core <path>` once — that writes the cache file, and every future drop on this machine auto-resolves. The manager only does this once per machine, ever.

#### Rule binding

This step is anchored to `.cursor/rules/prds-must-pass-core-parity.mdc`. Skipping §4.2b violates that rule and any §4.4 PRDs produced are invalid by definition.

### 4.3 Gaps → Features (hard-required)

This is the deliverable the manager cares about most. Convert every Phase 4.2 main move into one or more rows, **using both the §4.2a classification verdict and the §4.2b parity verdict to set Tier**. Classification runs first and is the dominant gate: non-Product rows are auto-downgraded to `Won't chase` regardless of what Core does or doesn't have.

Use the table when there are ≤4 gaps; switch to a numbered list with bold field labels when there are 5+ gaps so chat doesn't horizontal-scroll. The table now carries a `Classification` column so the manager sees both gates at a glance:

```markdown
| # | Competitor signal | Classification | Proposed feature | Tier |
|---|---|---|---|---|
| 1 | EliseAI "Agent" mobile CRM | Product | Mobile-first prospect→tour→app demo flow | Now |
| 2 | Anyone Home bundled stack | Product | "Leasing OS" bundle SKU + landing page | Now |
| 3 | Jonah FTC "All-In Pricing" framing | Pricing | (route to Commercial) | Won't chase |
| 4 | Funnel — 670 ratings on featuredcustomers.com | PMM | (route to PMM team) | Won't chase |
```

For each row, a sub-bullet immediately below with the full detail (kept off the table to avoid wide cells). Sub-bullets carry both a `Classification` line and a `Core parity` line; the latter is omitted for non-Product rows since parity didn't run on them:

```
1. **Gap:** No AI-native mobile CRM narrative on entrata.com.
   **Classification:** Product / capability (manager-confirmed via §4.2a).
   **Core parity:** Gap — 0 hits across 27 apps; no in-property tour module in Core.
   **Acceptance:** 90s video; opens on phone screen; no desktop screenshots.

3. **Signal:** Jonah positions as FTC pricing-transparency-ready.
   **Classification:** Pricing / positioning (manager-confirmed via §4.2a).
   **Routing:** Commercial / Sales Ops — fold into pricing-page response.
   **Why won't chase:** Not a product capability. Parity did not run.

4. **Signal:** Funnel has 670 ratings @ 4.8/5 on featuredcustomers.com.
   **Classification:** PMM / channel-building (manager-confirmed via §4.2a).
   **Routing:** PMM team — pursue parallel listing.
   **Why won't chase:** Not a product capability. Parity did not run.
```

#### Tier rules (now driven by both classification and parity)

By the time §4.3 runs, every classification has been manager-confirmed in §4.2a, and every Borderline parity verdict from §4.2b has been promoted to Partial / Gap / Skip. Use the **post-promotion** verdicts here.

**Classification dominates parity** — a non-Product classification short-circuits straight to `Won't chase`. Apply this priority:

| Step | Check | Result |
|---|---|---|
| 1 | Is the classification anything other than `Product / capability`? | If yes → `Tier = Won't chase — <classification>` and stop. Parity didn't run; no Tier-Now/Later. |
| 2 | If classification = `Product`, what's the parity verdict? | Continue to the parity table below. |

For Product-classified rows, parity sets the Tier:

| Parity verdict | Mandatory tier | Notes |
|---|---|---|
| **Existing** | Won't chase — already shipped | No PRD. Sub-bullet must cite the top Core file from the parity output. |
| **Partial** | Now or Later (manager judgment) | §4.4 PRD scope must be the **delta**, not a rebuild |
| **Gap** | Now or Later (manager judgment) | §4.4 PRD scope is the whole feature |
| **Borderline** | Should not appear here — promote in §4.2b first | If you see a Borderline row at §4.3, the §4.2b promotion step was skipped. Go back. |
| **Unknown** | Stop. Re-prompt the manager per §4.2b. | Do not assign a tier or write a PRD. |

Every §4.2 main move appears in §4.3 with one row — never silently drop a signal. Non-Product rows show their classification + routing target so the chat history records where each signal went.

**Two non-optional auto-downgrades:**

1. A row with `Classification: <non-Product>` and `Tier: Now` is a skill bug — the §4.2a classification gate exists to prevent gap-chasing PRDs on PMM / Pricing / Talent / etc. signals.
2. A row with `Classification: Product` and `Core parity: Existing` and `Tier: Now` is a skill bug — the §4.2b parity gate exists to prevent re-building features Core already ships.

If you find yourself wanting to override either auto-downgrade, stop and tell the manager why you think the gate is wrong; do not bypass it.

### 4.4 PRD draft

One PRD per **Tier-Now** feature from §4.3. Skip PRDs for Tier-Later and Tier-Won't-chase rows. Two non-optional preconditions:

1. **Never write a PRD for a row with `Classification: <non-Product>`** — that's a §4.2a / §4.3 rule violation; the row should already be `Won't chase` with a named routing target.
2. **Never write a PRD for a row with `Core parity: Existing`** — that's a §4.2b / §4.3 rule violation; the row should already be `Won't chase — already shipped`.

Use this template:

```markdown
#### PRD: <feature name>

- **Originating signal classification:** <one of:>
  - "Product / capability (manager-confirmed via §4.2a)"
  - "Operational / SLA → promoted to Product (manager promotion <timestamp>: <one-line reason>)"
- **Problem:** <1–2 sentences, anchored on the competitor signal>
- **Target user:** <leasing agent / PMM / sales rep / prospect>
- **Existing Entrata implementation:** <one of:>
  - Parity = Gap → "No existing implementation found in Core. Scanned <N> apps under `${ENTRATA_MONO_ROOT}/Applications/`; 0 hits on terms <list>."
  - Parity = Partial → "Foundation exists in `<top Core file path>` (<N> hits on terms <list>). Specifically, Core ships <1-sentence summary of what's there> but not <what's missing>."
- **Delta vs Core:** <what this PRD ships ON TOP OF the existing implementation. For Gap PRDs this is the entire feature. For Partial PRDs this is the surgical addition.>
- **Scope (in):** <bullet list, ≤5 items — each item must be net-new vs what Core already ships>
- **Scope (out):** <what we deliberately don't build>
- **Success metric:** <1 measurable thing, with target if known>
- **Evidence:** `tracker-drops/<run-id>/signals.json` row(s): <competitor_id> · <source> · <date>
- **Effort estimate:** S / M / L (engineering rough cut)
- **Net-new engineering ask:** <bullet list of concrete build work — must be net-new vs the "Existing Entrata implementation" line above>
```

**The four-line gate-trace** — `Originating signal classification` + `Existing Entrata implementation` + `Delta vs Core` + `Net-new engineering ask` — is non-optional. Together they form the classification-aware, parity-aware engineering ask. If you can't fill all four with concrete content, the PRD has failed one of the two gates and §4.3 should have downgraded the row.

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
<div class="meta">Drop: <code><run-id></code> &middot; Tier <span class="pill pill-now">Now</span> &middot; Effort <span class="pill pill-l">L</span> &middot; Classification <span class="pill pill-s">Product</span> &middot; Core parity <span class="pill pill-s">Gap</span> &middot; Triggered by <competitor signal></div>
<h2>Originating signal classification</h2><p><em>Product / capability (manager-confirmed via §4.2a). Or: Operational / SLA → promoted to Product (timestamp, reason).</em></p>
<h2>Problem</h2><p>...</p>
<h2>Target user</h2><p>...</p>
<h2>Existing Entrata implementation</h2><p>Parity verdict: <strong>Gap</strong> (or Partial). <em>What Core already ships — file paths from `core-parity-check.js` output, 1-sentence plain English. If Gap, write "No existing implementation found; scanned N apps under ${ENTRATA_MONO_ROOT}/Applications/."</em></p>
<h2>Delta vs Core</h2><p><em>Surgical addition on top of the existing implementation. For Gap PRDs, the whole feature. For Partial PRDs, the specific gap.</em></p>
<h2>Scope (in)</h2><ul><li>...</li></ul>
<h2>Scope (out)</h2><ul><li>...</li></ul>
<h2>Success metric</h2><p>...</p>
<h2>Evidence</h2><p><code>tracker-drops/<run-id>/signals.json</code> row: ...</p>
<h2>Effort estimate</h2><ul><li>...</li></ul>
<p style="margin-top:8pt"><strong>Net-new engineering ask:</strong> ...</p>
<div class="footer">Generated by tracker-drop-cycle skill · drop <code><run-id></code> · parity-checked against <code>${ENTRATA_MONO_ROOT}</code></div>
</body>
</html>
```

##### Rule binding

This template is anchored to **three** Cursor rules; every PRD must pass all three:

1. **`.cursor/rules/prds-must-pass-signal-classification.mdc`** — the originating §4.2 main move must have classified as `Product / capability` in §4.2a (directly, or via `Operational → Product` promotion). PRDs from any of the other seven buckets are rule violations.
2. **`.cursor/rules/prds-must-pass-core-parity.mdc`** — the `Existing Entrata implementation` + `Delta vs Core` lines must reflect the §4.2b parity verdict, and `Existing` rows must have been downgraded in §4.3 before reaching the PRD stage.
3. **`.cursor/rules/prds-must-be-engineering-shaped.mdc`** — the `Net-new engineering ask` line must contain real build work, not packaging.

A PRD that fails any of the three is not eligible for PDF export. If you find yourself wanting to generate a PDF for a row with `Classification: <non-Product>` or `Core parity: Existing`, stop and go back to §4.3 — one of the two gates was bypassed.

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

### 4.7 Mark drop as interpreted (hard-required — closes the cycle)

After §4.6 prints, write the current drop ID to the interpretation pointer so the **next** `/trackerstart` knows where to start the diff. This is the structural fix for the missed-cycle blind spot — without it, the strict `drops[idx-1]` fallback re-creates the suppression.

```bash
node initiative-1-tracker/tracker/scripts/interpretation-pointer.js mark "$(cat tracker-drops/.latest-drop-id)"
```

The pointer file (`tracker-drops/.last-interpreted-drop-id`) is gitignored and per-machine — that's intentional. Each manager's pointer reflects what *they* have read, not what their teammates have read. Two managers running `/trackerstart` on the same machine share a pointer; on different machines they diverge correctly.

**Print the post-mark status** in chat as the last line of Phase 4, so the manager has visible proof the pointer advanced:

```bash
node initiative-1-tracker/tracker/scripts/interpretation-pointer.js status
```

If §4.4b PDF export was attempted but failed (Chrome timeout, headless permission bubble timed out, etc.), still mark the drop as interpreted — the PDF is a deliverable, not the cycle's gate. The manager can re-render manually via `tracker-decks/render-to-pdf.sh` and the pointer doesn't need to wait for that.

If the manager rejected every PRD via §4.4b `discard`, still mark the drop as interpreted — they saw the signals and chose not to act on them. That's a complete cycle, not a failed one.

The **only** reason not to mark would be the manager explicitly aborting the cycle mid-Phase-4 (e.g., they realize they need to re-run with different parameters). In that case, leave the pointer unchanged and the next `/trackerstart` will re-pick-up where this one left off.

---

## Phase 5 — Subskill chain (per Tier-Now PRD)

For each **Tier-Now** PRD from §4.4 that passed both gates (§4.2a `Classification = Product / capability` AND §4.2b `Core parity ≠ Existing`), run the six-step subskill chain below. Each step has a manager `AskQuestion` gate before the next runs — the manager can always pause, refine, skip downstream, or abort.

This phase replaces the prior "battle cards" Phase 5 (commit 2026-05-26). The shift is from a markdown-only artifact to a working prototype + critique + walkthrough video — the actual deliverables a PM needs to drive a counter-positioning conversation forward.

### The prototype workspace contract

All Phase 5 artifacts land in **`$TRACKER_PROTOTYPE_ROOT/<slug>/`**. The skill resolves the root with this precedence, first hit wins:

1. `$TRACKER_PROTOTYPE_ROOT` environment variable, if set
2. `~/Developer/entrata-product/alonsoroca-gif-workspace/prototypes/` (default for the original author's machine)
3. `~/prototypes/` (last-resort fallback)

If none of the candidate roots exist on the manager's machine, the chain stops at the start of 5.3 (`create-prototype`) with an `AskQuestion` asking the manager to pick a path or set the env var. The skill does not create a workspace silently — that's a setup decision, not a runtime decision.

`<slug>` is `<competitor>-<feature>-<run-id>` kebab-cased (e.g., `eliseai-field-mode-leasing-2026-05-26T1604Z`).

Per-PRD directory layout the chain produces:

```
$TRACKER_PROTOTYPE_ROOT/<slug>/
├── feature-spec.md                 # from 5.1
├── grade-card.md                   # from 5.2
├── (prototype source: index.tsx, components/, data/, types/, etc.)   # from 5.3
├── design-critique-report.md       # from 5.4
└── docs/
    ├── VIDEO-TRANSCRIPT.md         # from 5.5
    └── walkthrough.webm            # from 5.6
```

### 5.1 `feature-spec`

Invoke the workspace-global `feature-spec` skill with the §4.4 PRD as input.

**Output:** `feature-spec.md` with problem, target user, scope (in/out), acceptance criteria, open questions, proposed flow/structure.

**Chat-visible:**

- Full absolute path to `feature-spec.md`
- One-paragraph inline summary of the spec (so the manager doesn't have to open the file to know what got generated)
- Any `> Open question:` lines from the spec, pasted inline as a checklist so they don't get buried — these are the questions that need PM input before engineering can spec further (last cycle surfaced "extra implementation vs. use Entrata's current resources" — that exact framing belongs here every time).

**Gate (AskQuestion):**

```
prompt: "feature-spec for <slug> is ready. Approve as the source spec for the prototype?"
options:
  - "Approve — continue to grade"
  - "Edit first — pause chain, manager edits the .md, then resume"
  - "Skip prototype — this PRD doesn't warrant a prototype this cycle"
```

### 5.2 `grade-spec-handoff`

Invoke `grade-spec-handoff` against the approved `feature-spec.md`.

**Output:** `grade-card.md` (and the verdict inline in chat).

**Chat-visible:**

- The full grade card pasted **inline** in chat verbatim — verdict (`APPROVE` / `NEEDS WORK` / `REJECT`) plus the per-criterion ✅/❌ checklist
- Path to `grade-card.md` for the file copy

**Gate rule (no AskQuestion — verdict-driven):**

- `APPROVE` → chain continues automatically to 5.3
- `NEEDS WORK` or `REJECT` → chain **stops**. Skill paste the fix list and an `AskQuestion`: "Address fixes in feature-spec.md and re-run §5.2, or skip this PRD's prototype this cycle?"

Anti-pattern: do not invoke 5.3 (`create-prototype`) on a non-APPROVE grade. The grade exists to prevent burning prototype build time on a spec the manager already knows is weak.

### 5.3 `create-prototype`

Invoke `create-prototype` against the APPROVE-graded `feature-spec.md`.

**Pre-flight (added 2026-05-26 after the manager's last-cycle notes flagged a workspace-structure mismatch):**

1. Resolve `$TRACKER_PROTOTYPE_ROOT` (precedence above).
2. Check whether the resolved root has the structure `create-prototype` expects (the subskill's own contract — see `~/.cursor/skills/create-prototype/SKILL.md`).
3. If structure missing, **fall back to webpage-mode prototype** AND say so explicitly in chat: "create-prototype workspace does not support native mobile app extensions on this machine; falling back to webpage prototype at <port>." Do not silently downgrade.

**Output:** prototype source in `$TRACKER_PROTOTYPE_ROOT/<slug>/`, dev server running on a free localhost port (e.g., `:5174`, `:6174` — port is dynamic).

**Chat-visible:**

- Exact line: `Prototype is running at http://localhost:<port>` (where `<port>` is whatever the dev server reported)
- **Auto-`open` the URL** via `open http://localhost:<port>` so the prototype appears in the manager's default browser without the manager running any command. This is non-optional — last cycle the chain failed this and the manager had to run commands manually to see the output.
- A one-line "what to look for" hint (e.g., "Field Activity dashboard with live agent statuses; click any row to drill into the unit.")

**Known limitations (inline TODO to revisit):**

- Mobile/native: webpage-only is the current default. Open question for Billy: does Entrata have a Sandbox Mobile option that `create-prototype` should target? (Inherited from 2026-05-22 manager notes.)
- Workspace structure: the subskill assumes a specific layout. Document the requirement here when discovered, so future managers don't hit the same mismatch silently.

**Gate (AskQuestion):**

```
prompt: "Prototype is running at <url>. Does it match the feature-spec?"
options:
  - "Approve — continue to design-critique"
  - "Refine — pause; tell me what to change and I'll re-invoke 5.3"
  - "Skip critique + video — the prototype is enough for this cycle"
```

### 5.4 `design-critique`

Invoke `design-critique` against the running prototype.

**Output:** `design-critique-report.md` with score (0–100), finding count by severity, and per-finding write-ups.

**Chat-visible (the key fix from last cycle — the .md was not opening):**

- The score and finding count **pasted inline** in chat — never rely on the .md being opened
- The top 3–5 findings (by severity) summarized inline
- Path to `design-critique-report.md` as the last line, for managers who want the full read

**Loop behavior:**

After each critique run, `AskQuestion`:

```
prompt: "Critique score = <N>/100 (findings: <high>H / <med>M / <low>L). Re-run after refining, or proceed?"
options:
  - "Re-run 5.3 + 5.4 — I want to refine the prototype and see the score move"
  - "Proceed to video transcript"
  - "Skip video — prototype + critique are enough this cycle"
```

The skill keeps a running ledger of (timestamp, score, finding counts) for the cycle so the manager can see the delta across runs. Re-running 5.3+5.4 in a loop until the manager is satisfied is a first-class flow, not an exception.

### 5.5 `create-video-transcript`

Invoke `create-video-transcript` with the approved prototype + `feature-spec.md`.

**Output:** `docs/VIDEO-TRANSCRIPT.md` with scene-by-scene narration cues.

**Chat-visible:**

- Full absolute path to `VIDEO-TRANSCRIPT.md`
- A one-paragraph inline summary of the walkthrough arc (scenes covered, approximate runtime)

**Gate (AskQuestion):**

```
prompt: "Video transcript is ready. Approve as the narration script for the walkthrough?"
options:
  - "Approve — record the video"
  - "Edit first — pause chain, manager edits the .md, then resume"
  - "Skip video — transcript alone is enough for this cycle"
```

### 5.6 `create-video`

Invoke `create-video` with the approved transcript + running prototype.

**Output:** `docs/walkthrough.webm` (the final muxed video), plus `walkthrough-audio.wav`, `walkthrough-silent.webm`, `intro.{png,webm}`, `outro.{png,webm}`, `scene-audio/`, `scene-durations.json`.

**Per `tracker-drop-cycle` direction (non-optional):**

The `create-video` subskill defaults to uploading the .webm to Jira (step 7) and creating a GH release (step 8). For Tracker cycles, **both are skipped** — Tracker PRDs don't have Jira epic keys, and the cycle's own auto-merge workflow handles repo state. Pass `--skip-jira --skip-release` (or the equivalent flags the subskill exposes) when invoking from this phase.

**Chat-visible:**

- Full absolute path to `walkthrough.webm`
- Duration in seconds
- **Auto-`open` the file** via `open <path>/walkthrough.webm` so the manager sees it without running a command
- A one-paragraph quality note if the recorder logged any warnings (e.g., "Playwright click on `Unit 1204-B` timed out at 00:02:13; the camera stayed on the dashboard for that scene. Re-record with `data-testid` locators if you need the drill-in to land.")

### Phase 5 exit summary

After 5.6 completes (or the chain exits earlier via a Skip path), print one summary block in chat per PRD:

```
Subskill chain for <slug>:
  • feature-spec      → <path>/feature-spec.md
  • grade verdict     → APPROVE
  • prototype URL     → http://localhost:<port> (opened in browser)
  • design-critique   → score=<N>, findings=<HighN>H / <MedN>M / <LowN>L at <path>/design-critique-report.md
  • video transcript  → <path>/docs/VIDEO-TRANSCRIPT.md
  • walkthrough video → <path>/docs/walkthrough.webm (opened in player)
```

If the chain exited early (manager Skip, NEEDS-WORK grade, or pre-flight failure), the summary still prints — with each unfinished line replaced by `→ skipped: <reason>`. The summary is the manager's single proof that the chain ran, what landed, and what didn't.

### Cap on parallelism

One PRD's chain runs at a time. If §4.4 produced multiple Tier-Now PRDs, the skill prompts the manager via `AskQuestion` which PRD to chain first; subsequent PRDs queue and run after the current one's exit summary. Three Tier-Now PRDs in a single cycle is the absolute max — beyond that, defer remaining PRDs to a separate session (same cap as the prior battle-card Phase 5).

### Anti-patterns specific to Phase 5

These extend the global anti-patterns list at the bottom of this file (which covers Phases 0–4). Numbering continues from #15.

16. **Invoking `create-prototype` (5.3) on a `NEEDS WORK` or `REJECT` grade from 5.2.** The grade gate exists to prevent burning prototype build time on a weak spec.
17. **Printing the prototype URL or video path without auto-opening it.** Last cycle's manager notes (2026-05-22) called out that the chain "told me to run some commands" — the entire point of the chain is that the manager sees the artifact appear, not that they hunt for it.
18. **Pasting only the path to `design-critique-report.md` without the score and top findings inline.** The .md file was not opening reliably last cycle; the chat-paste is the load-bearing surface for the critique, not the file.
19. **Silently falling back from native-mobile to webpage prototype in 5.3.** Always name the fallback in chat so the manager knows what they got.
20. **Letting `create-video` upload to Jira or push a GH release.** Tracker cycles disable both via `--skip-jira --skip-release` (or equivalent). Repo state is handled by the auto-merge workflow.

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
10. **Offering PDF export without checking prereqs.** PDF rendering on this repo's machines is currently delegated to `tracker-decks/render-to-pdf.sh`, which uses macOS headless Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` — **pandoc / wkhtmltopdf are NOT required** (updated 2026-05-26 after live-cycle Gap #4). Before exporting at §4.4b, verify the render script exists and the Chrome binary is at that path. If the manager is on Linux/Windows or doesn't have Chrome installed at the expected location, surface that at the §4.4b approval moment, not after silent failure. The HTML-then-Chrome pipeline is the supported path today; if a portable alternative is needed across machines (pandoc, wkhtmltopdf, weasyprint), the render script must be updated to detect available tooling and route accordingly — don't silently substitute. See Phase 4.4b.
11. **Stopping Phase 0 without surfacing options.** When the cycle stops on a hash-match (no new content), the manager must be presented with clickable `AskQuestion` options (stop / interpret last meaningful / force fresh / show agent branch). Never end the message with "stopping cycle" and nothing else, and never ask the manager to type back free-text commands like "interpret 2026-05-08T...". Drop IDs in option labels must be paired with human context (age, size). See Phase 0 stop UX.
12. **Skipping the §4.2b Core parity scan.** The parity scan is the structural fix for the 2026-05-12 manager review (PRDs proposing features Core already shipped). It is not optional. Producing a §4.3 table without a parity verdict per Product row, or writing §4.4 PRDs for `Existing`-verdict rows, is a rule violation per `.cursor/rules/prds-must-pass-core-parity.mdc`.
13. **Treating `Unknown` parity as `Gap`.** If `ENTRATA_MONO_ROOT` isn't set and the parity script returns `Unknown` for every row, stop and re-prompt the manager. Do not auto-proceed and do not silently treat the unverified set as if it had passed the gate.
14. **Skipping the §4.2a Signal classification gate.** The classification gate is the structural fix for the 2026-05-13 manager review (the bot produced an engineering-shaped Customer Stories Hub PRD from a PMM signal because parity returned Partial). Always-ask `AskQuestion` is non-optional — even when every auto-suggestion is high-confidence, the manager-confirmation table is the cycle's only proof that classification ran. Producing a §4.4 PRD for any row whose final classification is not `Product / capability` is a rule violation per `.cursor/rules/prds-must-pass-signal-classification.mdc`.
15. **Running §4.2b parity on non-Product rows.** Parity is wasted effort on signals that wouldn't produce a PRD even if Core ships nothing — PMM, Pricing, Talent, Funding, Editorial, Strategic-partnership, and Noise rows must skip §4.2b entirely. Only Product-classified rows (including `Operational → Product` promotions) pass the §4.2a filter into §4.2b.

21. **Silently accepting a `Gap` parity verdict that contradicts a known Core capability.** Added 2026-05-26 after live-cycle Gap #2/#3. If the parity scanner returns Gap on something Core obviously ships (e.g., tour scheduling, lease workflow, application flow) or contradicts an existing fixture in `parity-fixtures.json`, the bot must NOT proceed to §4.4 with that verdict. Run the lean+rich double-pass per the "Candidate drafting rubric" in §4.2b. If lean+rich disagree, treat as Borderline and use the manager-resolution AskQuestion. The most common cause of false Gaps is lean wording missing Core's actual vocabulary; the second pass usually fixes it.

22. **Producing a richer-vocab parity candidate that scores >300 (saturated Existing).** Added 2026-05-26. The Candidate drafting rubric exists to lift lean-wording false Gaps to honest Partial/Borderline range; rich wording producing scores in the 300–600 range means you keyword-stuffed (e.g., loaded the candidate with "floorplan, unit, pricing, prospect, leasing, available" all at once). Calibrate down: the rich pass should land in the 15–80 score range. If both lean and rich saturate (one near zero, one >300), the honest verdict is Borderline and the row goes to manager resolution.

23. **Using Layer 1 keyword verdict as final tier.** Layer 1 (`core-parity-check.js`) is an anchor generator and a Layer-2-prompt generator, not the gate. The §4.3 tier and §4.4 PRD scope MUST cite the Layer 2 final verdict per Product row. When L1 says Existing on keyword density and L2 finds the relevant module isn't actually there, L2 wins.

24. **Skipping Phase 0b.** Running §4.2b without `verify-core-setup.js` passing is a setup failure. Stop before parity; do not proceed with ungrounded PRDs.

25. **Skipping §4.1b carryover spotlight when net-new is empty.** Added 2026-06-02 after the manager review surfaced the Anyone Home `9 June 2026 Release` had been carryover-suppressed for 6 cycles (importance 0.82). The spotlight is non-skippable — the whole point is to catch cases where the strict net-new diff is empty *and* there are still high-importance signals from earlier in the window. An empty net-new diff plus an empty spotlight is fine; an empty net-new diff with a populated spotlight is exactly what the spotlight exists to surface.

26. **Curating spotlight rows by hand.** Added 2026-06-02. If the spotlight script returns rows that look like noise (stable home pages, low-signal lanes), fix the script's filter or the upstream importance scoring — do not silently drop rows from the chat output. The spotlight's value is its determinism; hand-curating breaks the contract.

27. **Skipping §4.7 mark-interpreted.** Added 2026-06-02. The interpretation pointer is the structural fix for the missed-cycle blind spot — Phase 4's net-new diff is "vs last drop the manager actually closed" only because §4.7 advances the pointer. If you skip §4.7, the next `/trackerstart` falls back to strict `drops[idx-1]` and the spotlight is the only safety net (which is filter-restricted to importance ≥ 0.7 and excludes some lanes). §4.7 must run on every cycle that produced any §4.x output, even when net-new and spotlight are both empty (the manager confirming they read this drop is itself the signal worth marking).

28. **Confusing fan-out with parity comparison.** Added 2026-06-02 after the manager review. The `runCollectAll.js` fan-out (which tags each scrape with all 11 Entrata `product_id`s) is a metadata-tagging mechanism — it inflates `signals.json` row count by ~11× per URL but adds no signal and runs no comparison. The actual "do we already ship this?" comparison is **§4.2b Core parity**, which is a totally separate two-layer step. If a manager asks "why are there 198 rows in signals.json when I'm seeing 1 net-new?" — the answer is fan-out (~17 URLs × ~11 product copies + leftovers), not parity.

---

## Repo conventions reference

| Item | Value |
|---|---|
| Repo URL | `https://github.com/alonsoroca-gif/Tracker-Competitors-Bot.git` |
| Tracker scripts dir | `initiative-1-tracker/tracker/scripts/` |
| Drop publisher | `scripts/publish-drop.js` (also wired as `npm run drop`) |
| Carryover spotlight (§4.1b) | `initiative-1-tracker/tracker/scripts/carryover-spotlight.js` — surfaces high-importance carryover the strict diff would suppress |
| Interpretation pointer (§4.7) | `initiative-1-tracker/tracker/scripts/interpretation-pointer.js` — base/mark/status subcommands; pointer file `tracker-drops/.last-interpreted-drop-id` (gitignored) |
| Core parity check | `initiative-1-tracker/tracker/scripts/core-parity-check.js` (Phase 4.2b gate) |
| Core path resolution | `--core` flag → `$ENTRATA_MONO_ROOT` → `tracker/.core-path` cache → auto-scan of `~/Desktop/Core Repo/entrata-core` etc. First successful resolution is cached. |
| Core path cache (gitignored) | `initiative-1-tracker/tracker/.core-path` (one-time write per machine) |
| App-to-folder mapping | `initiative-1-tracker/tracker/config/app-inventory.json` |
| Drops folder | `tracker-drops/` (root of repo) |
| Latest-drop pointer | `tracker-drops/.latest-drop-id` |
| CI drop workflow | `.github/workflows/tracker-drop.yml` (3× weekday MT — 8:30am/12pm/5pm; pushes to `agent/P1.1`) |
| CI auto-merge workflow | `.github/workflows/auto-merge-agent.yml` (mirrors every push on `agent/P1.1` → `main`, ~30s lag) |
| CI safety-net mirror | `.github/workflows/mirror-main-to-agent.yml` (fast-forwards `agent/P1.1` from `main` if anything bypasses the structure) |
| Force-write env var | `TRACKER_DROP_FORCE=1` |
| Slash command | `.cursor/commands/trackerstart.md` (thin router to this skill) |
| PRD PDF export dir | `~/Desktop/tracker-decks/` (created on demand by Phase 4.4b) |
| PRD Cursor rules | `.cursor/rules/prds-must-pass-signal-classification.mdc` (§4.2a gate) + `.cursor/rules/prds-must-pass-core-parity.mdc` (§4.2b gate) + `.cursor/rules/prds-must-be-engineering-shaped.mdc` (§4.4 shape). Every PRD must pass all three. |

---

## Additional resources

- For a worked Phase 4 output on a real drop, see [examples.md](examples.md). *Note: the Phase 5 walkthrough in `examples.md` reflects the prior "battle cards" Phase 5 and is stale relative to the subskill-chain rewrite (2026-05-26). Phase 5 examples will be regenerated from the next live cycle that runs the chain end-to-end.*
- For deeper config (publish-drop flags, env vars, lane definitions, debugging recipes), see [reference.md](reference.md).
