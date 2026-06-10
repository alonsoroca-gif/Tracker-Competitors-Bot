# Tracker handoff plan (Alonso → Billy)

**Attach with** `BILLY-TRACKER-SETUP.md` + `CORE-CLONE-SETUP.md` when `main` is ready.

---

## Locked plan

| Item | Decision |
|------|----------|
| Parity | Path A — local clone + `git pull` each publish |
| Publish trigger | **morningbrief Step 0 @ ~8:00am** (background) |
| Feed | **tracker-feed** @ end of morningbrief (~8:20) |
| API token | Optional upgrade (Path B) — not required |
| VM / 5:50am schedule | Out of scope |

---

## Diagram

```
ALONSO (build)                         BILLY (install + daily)
──────────────                         ───────────────────────
Skills, GHA, scripts, tracker-briefs   git pull prebuilt repo
Test dry-run on your Core              Clone entrata-core + workspace
Merge to main                          Paste MORNINGBRIEF-TRACKER-PROMPT.md
Send setup docs                        ~8:00 morningbrief → publish background
                                       ~8:20 tracker-feed
```

---

## Morning flow

| Time | What |
|------|------|
| 5:45am | GHA collect → `tracker-drops/` |
| 5:35am | Operator preflight Slack |
| 7:45am | GHA readiness — **not ready is normal** |
| ~8:00 | Billy morningbrief **Step 0** → tracker-publish background |
| 8:00–8:20 | Other subskills (publish runs in parallel) |
| ~8:20 | tracker-feed section |
| 8:15am | GHA late-ready ping if brief committed after 7:45 |

---

## Phase checklist — Alonso (before sending Billy)

**Built locally (verify on your machine):**

- [x] `tracker-feed` + `tracker-publish` skills
- [x] `tracker-briefs/` + viewer (`index.html`, `prototype.html`, `prd.html`)
- [x] Scripts + `npm run test:brief` + `publish:dry-run`
- [x] GHA workflow files (collect, preflight, readiness)
- [x] Docs: Billy setup, Core clone, morningbrief prompt, prototype tiers
- [x] Phase A UX validated (feed, viewer, PDF download)

**Still to do before Billy:**

- [ ] **Commit + push** handoff package to `main` (most of the above is not on `main` yet)
- [x] **Phase B scaffold** — `publish:dry-run` + `manager:preflight` PASS (live agent publish on first morningbrief)
- [x] Document **entrata-core** re-clone if `git pull` fails ([CORE-CLONE-SETUP.md](./CORE-CLONE-SETUP.md) troubleshooting)
- [ ] Alonso re-clone Core locally before first live publish (optional; `verify:core` OK on disk today)
- [ ] **Slack secrets** in GitHub: `SLACK_WEBHOOK_URL_OPERATOR`, `SLACK_WEBHOOK_URL_BILLY` (optional alerts)
- [ ] Send Billy — use [HANDOFF-TO-BILLY.md](./HANDOFF-TO-BILLY.md) (links all three setup docs)

**Explicitly later (not blocking handoff):**

- Auto-open viewer from morningbrief
- Richer HTML vignettes
- `create-prototype` inside publish (use `/trackerstart` instead — see [TRACKER-PROTOTYPE-TIERS.md](./TRACKER-PROTOTYPE-TIERS.md))

---

## Phase checklist — Billy (~25–35 min)

1. Clone tracker + entrata-core ([CORE-CLONE-SETUP.md](./CORE-CLONE-SETUP.md))
2. `--save-core` + `verify:core` + `test:parity`
3. Multi-root workspace
4. `manager:preflight` PASS
5. Paste morningbrief Step 0 + tracker section
6. First live morningbrief

---

## Related files

| File | Purpose |
|------|---------|
| `BILLY-TRACKER-SETUP.md` | Install checklist |
| `CORE-CLONE-SETUP.md` | Clone + verify |
| `MORNINGBRIEF-TRACKER-PROMPT.md` | Paste into morningbrief skill |
| `automation/morningbrief/tracker-publish-kickoff.md` | Background agent prompt |
| `TRACKER-AUTOMATION.md` | Architecture |
