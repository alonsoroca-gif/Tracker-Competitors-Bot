# App inventory + structured “What to change this week” (prototype)

## Goal

Move **“What to change”** from a **single paragraph** toward a **structured handoff**:

- **What** the competitor is doing (unchanged: gaps + competitor_move).
- **Our shipped context:** versions read from **your** app repos (via `package.json` paths).
- **Work items:** small **typed** items (product triage, engineering verify, GTM response) the team can track in Jira/Linear without re-typing.

This does **not** auto-edit Entrata code or open PRs — it **grounds** recommendations in **known versions** once you configure paths.

## Config: `config/app-inventory.json`

Per **product id** (same ids as `products.json` → `prospect-portal`, `leasing-ai`, …), list **artifacts**:

```json
"leasing-ai": {
  "artifacts": [
    {
      "label": "Leasing AI web",
      "package_json": "${ENTRATA_MONO_ROOT}/leasing-ai-ui/package.json"
    },
    {
      "label": "Prospect Portal",
      "repo_root": "${ENTRATA_MONO_ROOT}/prospect-portal"
    }
  ]
}
```

- **`label`:** human-readable name in the UI.
- **`package_json`:** path to `package.json` (absolute or CWD-relative).
- **`composer_json`:** path to `composer.json` (PHP apps under `entrata-core/Applications/...`).
- **`repo_root`:** folder; resolves **`package.json`** first, else **`composer.json`**. Exposed for Cursor as the app root.
- **`${ENV_VAR}`:** expanded from `process.env` (e.g. `ENTRATA_MONO_ROOT`).

**Cursor:** add Entrata and this repo in one multi-root workspace — [ENTRATA-CODE-IN-CURSOR.md](./ENTRATA-CODE-IN-CURSOR.md).

Empty `artifacts` → inventory line shows as “configure app-inventory.json”.

## Runtime

- `lib/appInventory.js` → `getAppInventory(productId)`.
- `lib/whatToChange.js` → enriches top 3 recommendations with:
  - `structured.our_app_inventory`
  - `structured.work_items[]` with `kind`, `title`, and hints (`inventory_snapshot`, `use_inventory`, `competitor_move_hint`, …)
- **Report UI** renders `work_items` as a nested list under each “What to change” card.

## Next steps

- Add **git SHA** optional field (`git -C <dir> rev-parse --short HEAD`) when `row.git_root` is set.
- Map **dimension** → suggested **repo** (config map) for smarter “verify in codebase” links.
- Export **JSON** for Slack / ticketing webhooks without changing the human-readable `formatted` string.
