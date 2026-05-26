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
- [ ] Phase 4 — Interpret in chat (eight blocks, non-skippable; 4.2a is the classification gate, 4.2b is the parity gate)
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

## Phase 4 — Interpret in chat (eight required blocks)

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

Then produce these **eight** blocks **in this order**. Every block is required — if you cannot produce one, say so explicitly and explain why. Blocks 4.2a (signal classification) and 4.2b (Core parity scan) are the two structural gates that decide which §4.3 rows even get a PRD. They run in order: classification first ("is this a Product signal at all?"), then parity ("if it is, does Core already ship it?").

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
12. **Skipping the §4.2b Core parity scan.** The parity scan is the structural fix for the 2026-05-12 manager review (PRDs proposing features Core already shipped). It is not optional. Producing a §4.3 table without a parity verdict per Product row, or writing §4.4 PRDs for `Existing`-verdict rows, is a rule violation per `.cursor/rules/prds-must-pass-core-parity.mdc`.
13. **Treating `Unknown` parity as `Gap`.** If `ENTRATA_MONO_ROOT` isn't set and the parity script returns `Unknown` for every row, stop and re-prompt the manager. Do not auto-proceed and do not silently treat the unverified set as if it had passed the gate.
14. **Skipping the §4.2a Signal classification gate.** The classification gate is the structural fix for the 2026-05-13 manager review (the bot produced an engineering-shaped Customer Stories Hub PRD from a PMM signal because parity returned Partial). Always-ask `AskQuestion` is non-optional — even when every auto-suggestion is high-confidence, the manager-confirmation table is the cycle's only proof that classification ran. Producing a §4.4 PRD for any row whose final classification is not `Product / capability` is a rule violation per `.cursor/rules/prds-must-pass-signal-classification.mdc`.
15. **Running §4.2b parity on non-Product rows.** Parity is wasted effort on signals that wouldn't produce a PRD even if Core ships nothing — PMM, Pricing, Talent, Funding, Editorial, Strategic-partnership, and Noise rows must skip §4.2b entirely. Only Product-classified rows (including `Operational → Product` promotions) pass the §4.2a filter into §4.2b.

---

## Repo conventions reference

| Item | Value |
|---|---|
| Repo URL | `https://github.com/alonsoroca-gif/Tracker-Competitors-Bot.git` |
| Tracker scripts dir | `initiative-1-tracker/tracker/scripts/` |
| Drop publisher | `scripts/publish-drop.js` (also wired as `npm run drop`) |
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

- For a worked Phase 4 + Phase 5 output on a real drop, see [examples.md](examples.md).
- For deeper config (publish-drop flags, env vars, lane definitions, debugging recipes), see [reference.md](reference.md).
