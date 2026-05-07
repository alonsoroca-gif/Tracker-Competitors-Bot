# Tracker start

Run the **tracker-drop-cycle** skill end-to-end on the `Tracker-Competitors-Bot` repo.

When this command is invoked:

1. Attach and follow the project skill at `.cursor/skills/tracker-drop-cycle/SKILL.md`. Use it as the source of truth for the workflow.
2. Execute all phases in order, starting with **Phase 0 — Smart-mode self-check**:
   - If a fresh drop (<15 min old) already exists in `tracker-drops/` AND its content hash differs from the prior drop, skip Phases 1–2 and start at Phase 3.
   - If the latest drop is byte-identical to the prior drop, stop the cycle ("no new content").
   - Otherwise, run Phases 1–5 in full.
3. Produce **all six required output blocks** in Phase 4 (drop health, main moves, gaps→features, PRDs for Tier-Now items, Slack message, prioritization). Skipping any block is a bug.
4. After each PRD, ask the manager whether to approve and whether to export it as a PDF (Phase 4.4b). Save approved PDFs to `~/Desktop/tracker-decks/`.
5. Produce 1–2 battle cards in Phase 5 for Tier-Now PRDs.
6. **Output goes to chat.** Do not write `INTERPRETATION.md` or any other file unless the user explicitly says "save the interpretation".

## Argument handling (informal)

If the user's message includes any of these phrases, override Phase 0 and force a fresh collect:

- `--force`
- `force`
- `fresh`
- `re-collect`

If the user's message includes `--slack` or "post to slack" AND the env var `SLACK_WEBHOOK_URL` is set, also post the Phase 4.5 Slack block to the webhook. Otherwise keep it chat-paste only.

## What this command does NOT do

- It does not modify the engine code in `initiative-1-tracker/tracker/`.
- It does not write files to `tracker-drops/<id>/` beyond what `publish-drop.js` writes.
- It does not push to `main` directly (only to `agent/P1.1` first, then auto-merges).
- It does not force-push or rewrite history.

## Reference

- Skill: `.cursor/skills/tracker-drop-cycle/SKILL.md`
- Demo doc: `initiative-1-tracker/docs/TRACKER-DEMO.md`
- Manager cheat sheet: `initiative-1-tracker/docs/TRACKER-MANAGER-COMMANDS.md`
