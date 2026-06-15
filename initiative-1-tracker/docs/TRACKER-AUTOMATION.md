# Tracker automation

**Master plan:** [TRACKER-HANDOFF-PLAN.md](./TRACKER-HANDOFF-PLAN.md)

## Architecture (locked)

```
GitHub Actions 5:45am     →  tracker-drops/ (collect)
GitHub Actions 5:55am     →  preflight → operator Slack (after collect)
GitHub Actions 7:45am     →  readiness (not ready = expected)
~8:00am morningbrief      →  intel publish (sync) OR tracker-publish agent (Product rows)
~8:20 tracker section     →  tracker-feed
```

| Locked | Out of scope |
|--------|--------------|
| Path A Core + git pull each publish | 5:50am scheduled agent |
| Morningbrief kickoff @ 8:00 | VM / overnight unattended host |
| Billy clones Core once | API token required for handoff |

---

## Build on Alonso's Mac → handoff to Billy

| Step | Alonso | Billy |
|------|--------|-------|
| Skills + scripts + GHA | Build, test, merge `main` | `git pull` |
| Dry-run | `publish:dry-run` + local Core | — |
| Core parity | Demo on your Mac | Clone + workspace ([CORE-CLONE-SETUP.md](./CORE-CLONE-SETUP.md)) |
| Morningbrief | — | Paste `MORNINGBRIEF-TRACKER-PROMPT.md` |

---

## Parity — Path A default, Path B optional

| Layer | Path A (handoff) | Path B (optional upgrade) |
|-------|------------------|---------------------------|
| Layer 1 | Script on disk after `git pull` | GitHub API @ `main` |
| Layer 2 | Agent Read/Grep on local clone | Same — local clone required |

Publish runs when Billy starts morningbrief — Core is fresh via `git pull` at kickoff.

---

## Publish duration (wall clock — hidden behind parallel subskills)

| Day type | ~minutes | Usually ready before tracker section? |
|----------|----------|-------------------------------------|
| PMM-only | ~12 | Often yes |
| 1–2 Product | ~20–28 | Sometimes |
| Heavy Product | ~45–75 | Skip section + Slack DM |

---

## Daily clock (MT, weekdays)

| Time | What |
|------|------|
| 5:00pm | CI collect |
| 5:45am | CI collect |
| 5:55am | GHA preflight (after collect) → operator Slack |
| 5:10pm | GHA preflight (after 5pm collect) → operator Slack |
| 7:45am | GHA readiness — informational (not ready OK) |
| **~8:00am** | **morningbrief → tracker-publish kickoff** |
| **~8:20am** | **tracker-feed** |
| 8:15am | GHA late-ready Billy ping (if brief landed) |

### Weekend backup (Sat/Sun)

| Time | What |
|------|------|
| 5:45am Sat/Sun | CI collect (backup — low volume expected) |
| Monday ~8:00am | **Mandatory Monday rule** — every URL from weekend drops since last brief appears in the table (see `.cursor/rules/weekend-intel-mandatory-monday.mdc`) |

No weekend preflight Slack (nobody runs morningbrief Sat/Sun). Monday kickoff + catch-up handles the gap.

---

## Intel loss prevention (publish layer)

Once morningbrief Step 1 runs, these rules prevent signals dying in the brief:

| Rule | What it prevents |
|------|------------------|
| **Intel publish** (replaces empty zero-day) | PMM / News / Press rows dropped when Product count = 0 |
| **Catch-up since last brief** | URLs in weekday drops after last publish but not in published table |
| **Newer-drop bypass** | Kickoff skips republish when brief is “fresh today” but still bound to an older drop |
| **Monday weekend mandatory** | All Sat/Sun collect URLs surfaced on Monday, no published-table filter |
| **Content refresh** | Same URL re-shown only when live page text changed |

**Still required:** someone runs morningbrief Step 1 (no headless auto-publish). **Collect layer** can still flake (e.g. competitor lane → 0 rows); `collectHealth.js` warns but does not fail the workflow.

### Collect lane health (ops only — not product insight)

`collectHealth.js` compares **this drop vs the immediately prior drop** (often hours apart, not week-over-week). It flags only **lane failure**: competitor had **≥5 rows** last collect → **0 rows** this collect (broken scraper, site down, Playwright timeout).

| Use | Not use |
|-----|---------|
| CI log + drop `SUMMARY.md` warning | “Competitor quiet this week” |
| Future: Slack ops alert | Filtering or ranking signals |
| Detect webpage/collect down | Product roadmap decisions |

It does **not** remove or hide signals. Safe to keep as debug; optional to tune threshold or Slack-only later.

---

## Kickoff prompt

`initiative-1-tracker/automation/morningbrief/tracker-publish-kickoff.md`

Legacy `automation/cursor-cloud/` — superseded; do not schedule 5:50am agent.

---

## Before sending Billy `BILLY-TRACKER-SETUP.md`

- [ ] Both skills on `main`
- [ ] `npm run test:brief` + `publish:dry-run` pass on Alonso's Mac
- [ ] `verify:core` + `test:parity` + `manager:preflight` pass
- [ ] GHA workflows merged
- [ ] Kickoff + morningbrief prompt files ready

**Billy setup:** ~25–35 min.

---

## GitHub Actions

| Workflow | Role |
|----------|------|
| `tracker-drop.yml` | Collect |
| `tracker-publish-preflight.yml` | Operator alert @ 5:35am |
| `tracker-brief-readiness.yml` | 7:45 info + 8:15 late ping |

GHA does **not** publish or run parity.

---

## Prototype tiers (vignette vs `create-prototype`)

| Daily brief (`tracker-publish`) | Deep dive (`/trackerstart`) |
|--------------------------------|-----------------------------|
| HTML vignette in viewer | `create-prototype` + critique + video |
| ~minutes per row | ~hours per row |
| Same PRD + parity story | Same story, higher-fidelity UX |

**Time constraint** is why publish uses vignettes. For full-quality prototypes, run **`/trackerstart`** on the same signal. Details: [TRACKER-PROTOTYPE-TIERS.md](./TRACKER-PROTOTYPE-TIERS.md).

---

## Related

- [TRACKER-PROTOTYPE-TIERS.md](./TRACKER-PROTOTYPE-TIERS.md)
- [BILLY-TRACKER-SETUP.md](./BILLY-TRACKER-SETUP.md)
- [CORE-CLONE-SETUP.md](./CORE-CLONE-SETUP.md)
- [MORNINGBRIEF-TRACKER-PROMPT.md](./MORNINGBRIEF-TRACKER-PROMPT.md)
