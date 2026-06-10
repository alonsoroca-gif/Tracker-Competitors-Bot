# Tracker automation

**Master plan:** [TRACKER-HANDOFF-PLAN.md](./TRACKER-HANDOFF-PLAN.md)

## Architecture (locked)

```
GitHub Actions 5:45am     →  tracker-drops/ (collect)
GitHub Actions 5:35am     →  preflight → operator Slack
GitHub Actions 7:45am     →  readiness (not ready = expected)
~8:00am Billy morningbrief Step 0  →  tracker-publish (background)
~8:00–8:20 other subskills         →  publish + Core parity in parallel
~8:20 tracker section              →  tracker-feed
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
| 5:35am | GHA preflight → operator Slack |
| 5:45am | CI collect |
| 7:45am | GHA readiness — informational (not ready OK) |
| **~8:00am** | **morningbrief → tracker-publish kickoff** |
| **~8:20am** | **tracker-feed** |
| 8:15am | GHA late-ready Billy ping (if brief landed) |

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
