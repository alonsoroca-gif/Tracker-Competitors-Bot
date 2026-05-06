# Tracker — documentation index (initiative-1)

**Start here (new model):**

| Document | Use |
|----------|-----|
| [TRACKER-EXTERNAL-ONBOARDING.md](../../TRACKER-EXTERNAL-ONBOARDING.md) | **One file for new joiners:** sponsor URL table, open-first-then-clone, architecture, manager/runner, CI/Slack, Entrata, troubleshooting + links to deeper docs. |
| [TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md) | **Single source of truth:** flow + **Mermaid diagrams** + **architecture** (branch, where things run, **Slack/ChatOps**). |
| [TRACKER-DROP-CI.md](./TRACKER-DROP-CI.md) | **CI drops:** `publish-drop.js`, GitHub Action, secrets (`SLACK_WEBHOOK_URL`), cross-repo push notes. |
| [TRACKER-DEMO.md](./TRACKER-DEMO.md) | **Demo walkthrough:** Git-first — collect/drop → commit → **pull in Cursor** → prototype (no localhost report UI). |
| [TRACKER-MANAGER-COMMANDS.md](./TRACKER-MANAGER-COMMANDS.md) | **Cheat sheet:** commands only (full story → **[TRACKER-EXTERNAL-ONBOARDING.md](../../TRACKER-EXTERNAL-ONBOARDING.md)**). |
| [MANAGER-BRIEF-TRACKER-AND-AUTOMATION.md](./MANAGER-BRIEF-TRACKER-AND-AUTOMATION.md) | **One-pager** for managers (points to the doc above). |

---

## Supporting (still current)

| Document | Use |
|----------|-----|
| [COMPETITOR-DATA-PULL-REFERENCE.md](./COMPETITOR-DATA-PULL-REFERENCE.md) | What each URL/feed in `config` does, collect, trust tiers. |
| [SURFACE-INVENTORY.md](./SURFACE-INVENTORY.md) | Per-competitor public surfaces, cadence, TBD / trust. |
| [WEEKLY-INTEL-FLOW.md](./WEEKLY-INTEL-FLOW.md) | Intel pillars, coverage mental model. |
| [YOUTUBE-CHANNELS.md](./YOUTUBE-CHANNELS.md) | YouTube discovery (needs API key in collect path if enabled). |
| [YOUTUBE-REVIEWS-PROTOTYPE.md](./YOUTUBE-REVIEWS-PROTOTYPE.md) | YouTube as a review surface. |
| [G2-REVIEWS-PROTOTYPE.md](./G2-REVIEWS-PROTOTYPE.md) | G2 prototype notes. |
| [COMPETITIVE-KEYWORDS-PLAN.md](./COMPETITIVE-KEYWORDS-PLAN.md) | Human gates before broad keyword collection. |
| [COMPETITIVE-INTEL-PRESENTATION.md](./COMPETITIVE-INTEL-PRESENTATION.md) | How the report reads (L1/L2) — still useful for wording. |
| [ENTRATA-CODE-IN-CURSOR.md](./ENTRATA-CODE-IN-CURSOR.md) | Multi-root workspace, Entrata + tracker. |
| [APP-INVENTORY-AND-STRUCTURED-WHAT-TO-CHANGE.md](./APP-INVENTORY-AND-STRUCTURED-WHAT-TO-CHANGE.md) | App inventory + work items in the **local** tracker UI. |
| [STAKEHOLDER-PRD-AND-PRESENTATION-BRIEF.md](./STAKEHOLDER-PRD-AND-PRESENTATION-BRIEF.md) | Stakeholder / PRD narrative (align narrative with new delivery path over time). |
| [DATA-SOURCES-BRAINSTORM.md](./DATA-SOURCES-BRAINSTORM.md) | Brainstorm; overlaps with data-pull reference — read both if expanding sources. |
| [CONTEXT.md](../CONTEXT.md) (parent) | High-level initiative context. |

## Reference (tied to the **in-repo** tracker app)

| Document | Use |
|----------|-----|
| [STRATEGIC-INTERPRETATION.md](./STRATEGIC-INTERPRETATION.md) | L1/L2, rule-based copy in **code** (or fallback when no LLM key in `gapInterpretation.js`). |
| [TRACKER-COMPETITIVE-MOVE-AND-RESPONSE-REFERENCE.md](./TRACKER-COMPETITIVE-MOVE-AND-RESPONSE-REFERENCE.md) | Field meanings for the report UI. |
| [INTEL-FENCE-MVP.md](./INTEL-FENCE-MVP.md) | Fence behavior for repo snippets in responses. |
| [WHAT-COMPETITOR-DOING-NEXT.md](./WHAT-COMPETITOR-DOING-NEXT.md) | Deeper “so what” framing. |
| [TRACKER-FEEDBACK-SPRINTS.md](./TRACKER-FEEDBACK-SPRINTS.md) | Sprint / feedback org process. |
| [tracker README](../tracker/README.md) | `collect` / `drop` / tests; optional legacy `npm run serve` for debug. |

---

## Archived (superseded by Git + Cursor model)

Moved to [`_archive/`](./_archive/):

| File | Replaced by |
|------|-------------|
| `LLM-GATEWAY-MVP.md` | [TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md) §6 *Relationship to older ideas* (interpretation in Cursor, not a gateway) |
| `CURSOR-FIRST-INTERPRETATION.md` | [TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md) (merged flow + arch) |

See [`_archive/README.md`](./_archive/README.md).

---

## tracker code (this repo)

- **Local app & collect:** `initiative-1-tracker/tracker/`  
- **Tasks / agent:** `initiative-1-tracker/TASKS.md`, `AGENT-NEXT-TASK.md` (repo automation — not the same as Tracker drops, see [MANAGER-BRIEF-TRACKER-AND-AUTOMATION.md](./MANAGER-BRIEF-TRACKER-AND-AUTOMATION.md))
