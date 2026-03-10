# 24-7 development — Summary

One-page summary of the solo + automation approach. Full detail: [24-7-DEVELOPMENT-GUIDE.md](24-7-DEVELOPMENT-GUIDE.md).

---

## Recommendation (automation 24/7 non-stop = main priority)

**Use hosted automation only.** Don’t rely on your computer or Cursor being on.

1. **CI 24/7** — GitHub Actions: build + tests + gaps-check on every push (and optionally on schedule).  
2. **Scheduled jobs 24/7** — GitHub Actions `schedule:`: Tracker weekly report (e.g. Monday 8am), gaps-check nightly; post to Slack. If Tracker needs a DB or long run, use a small always-on service (Railway, Render, or $5 VPS) for the cron.  
3. **Notifications** — Slack (or email) on build failure and optionally when scheduled runs complete.  
4. **Status “Live”** — Script or Action updates STATUS “Live” section (last build, last Tracker run) after each run.

**Result:** Builds, tests, Tracker report, and GAPS run 24/7; you get notified. Your laptop can be closed. Add a VPS + headless agent only if you later want “AI producing code” 24/7. See guide **§1b**.

**Two-mode balance:** When you’re at the computer → use Cursor normally. When your shift ends → run **handoff** (e.g. `./handoff` or `git commit -m "handoff" && git push`). When you come back → run **resume** (e.g. `./resume`: pull latest, run gaps-check, open HANDOFF + STATUS). Handoff = redirect to automation; resume = sync and load context. See guide **§1c** and **§7**.

---

## In one paragraph

You develop **solo** (with school, etc.). **Automation** runs 24/7: CI, scheduled jobs, gaps check, status updates, notifications. **Docs** (STATUS, HANDOFF, GAPS, TASKS per app) keep context so when you come back you: read HANDOFF → STATUS → run gaps check → review GAPS → pick a task. **GAPS is automated** (a script runs tests + smoke checks and writes GAPS.md); you only review it. Nothing runs on memory; everything is in the repo.

---

## Core pieces

| Piece | What it is | Where |
|-------|------------|--------|
| **STATUS.md** | Current state of all three initiatives + real-time block (last build, last run). You update your part; automation can update “Live” section. | Repo root |
| **HANDOFF.md** | Note for yourself: what you did, what’s in progress, what to do next. Read first when you come back. | Repo root |
| **GAPS.md** | **Auto-generated** by gaps-check script (tests + smoke). You run the check and **review** GAPS to see what’s missing or failing. You don’t fill it manually. | Repo root |
| **TASKS.md** | Task list per initiative. Small, testable tasks; you pick from here when you work. | Each initiative folder |
| **Gaps-check script** | Runs tests + smoke/completeness; writes GAPS.md. Run when you come back (or on push/schedule). | e.g. `scripts/gaps-check.sh` |

---

## When you come back (every session)

1. Read **HANDOFF.md** — where you left off.
2. Read **STATUS.md** — phase and “Next” per initiative; real-time block.
3. **Run gaps check** → open **GAPS.md** and review (everything running? fix top items).
4. Pick **one task** from TASKS.md (Tracker or ProspectPortal) and continue.

---

## End of session

1. Update **STATUS.md** (Phase, Done, Next, Blockers).
2. Update **HANDOFF.md** (In progress, Notes).
3. Commit and push.

---

## Automation (24/7 without you)

- **CI** on push (build/tests).
- **Gaps-check** on push or schedule → writes GAPS.md.
- **Script or Action** that updates “Live” section of STATUS (last build, last run).
- **Notifications** (Slack/Discord or email) on build failure (and optionally on success or daily digest).

---

## Initiatives in scope

| Initiative | Status | Task list |
|------------|--------|-----------|
| **Tracker Bot** | Active | [initiative-1-tracker/TASKS.md](initiative-1-tracker/TASKS.md) |
| **ProspectPortal** | Active | [initiative-2-prospectportal/TASKS.md](initiative-2-prospectportal/TASKS.md) |
| **Marketplace** | Standby | [initiative-3-marketplace/TASKS.md](initiative-3-marketplace/TASKS.md) |

---

**Q: Separate repo per app?** Yes, it can be better (clear ownership, independent deploy). See 24-7 guide §10.  
**Q: Does Cursor code 24/7 when my computer is closed?** No. Cursor runs locally. **Q: So for Cursor to produce 24/7 non-stop, do I need my computer on at home?** Yes — either your computer on and open (Cursor running) or a cloud dev machine where Cursor/agent runs 24/7. See 24-7 guide §10.

*See [24-7-DEVELOPMENT-GUIDE.md](24-7-DEVELOPMENT-GUIDE.md) for full detail and [ACTION-PLAN.md](ACTION-PLAN.md) for initiative artifacts. Mon–Tue task review: [MON-TUE-REVIEW.md](MON-TUE-REVIEW.md).*
