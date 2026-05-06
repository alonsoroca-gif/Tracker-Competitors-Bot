# Initiative 1 — Tracker: context

**Org delivery model (current):** evidence is **committed to a dedicated Entrata branch**; **interpretation** happens in **Cursor** (and optional **Slack** when a drop lands). See [docs/TRACKER-FLOW-END-TO-END.md](docs/TRACKER-FLOW-END-TO-END.md) and [docs/README.md](docs/README.md).

---

## How to run the Tracker

- **Repo path:** `initiative-1-tracker/tracker/`
- **Smoke:** `npm start` or `node index.js` → prints `Tracker`
- **Collect:** `npm run collect` or `node index.js collect` → reads `config/products.json`, optional `config.sources[competitorId].blog` or env `TRACKER_FEED_URL_<COMPETITOR_ID>`, returns signals (last 7 days)
- **Tests:** `node test/run.js`
- **Config:** Edit `config/products.json` (products, competitors, optional `sources`). See `tracker/README.md`.

## Dependencies

- Node 18+ (native `fetch`). No npm deps required for smoke/collect.

## Next (from TASKS.md)

Phase 1 done: project, config, collect from one source. Next: more sources, gap report schema, response schema, Slack.
