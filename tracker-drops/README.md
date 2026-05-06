# Tracker drops (Git evidence)

Each **run** that passes the relevance gate (see `initiative-1-tracker/docs/TRACKER-FLOW-END-TO-END.md`) creates a subfolder:

- `signals.json` — snapshot of stored signals at drop time (public config only; never commit secrets).
- `SUMMARY.md` — human-first read for Cursor.
- `manifest.json` — run metadata (counts, timestamps).

**Do not** commit API keys, private URLs, or PII. `initiative-1-tracker/tracker/data/` stays gitignored; drops are **copies** intended for the branch story.

Created by `npm run drop` (from `initiative-1-tracker/tracker`) or GitHub Actions **Tracker drop**. See [TRACKER-DROP-CI.md](../initiative-1-tracker/docs/TRACKER-DROP-CI.md).
