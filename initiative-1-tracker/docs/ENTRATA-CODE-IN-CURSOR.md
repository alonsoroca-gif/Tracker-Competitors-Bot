# Entrata app code in Cursor (ground the tracker in real repos)

YouTube / G2 stay **external** signals. This doc is how to give Cursor (and the tracker) access to **your shipped apps** so answers and “what to change” are tied to **real code**, not guesses.

## Principles

1. **Do not copy proprietary Entrata source into this tracker repo** if this repo is shared or public — keep Entrata code in its **normal git home** and **open both trees in Cursor**.
2. **Wire paths** via `ENTRATA_MONO_ROOT` (or similar) + `tracker/config/app-inventory.json` so the **report UI** shows versions and structured work items.
3. **Cursor’s index** only sees folders you **add to the workspace** — so add the Entrata root (or monorepo) as a second folder.

---

## Step 1 — Locate Entrata code locally

Use your normal internal process (git clone, **Google Drive zip**, etc.). The PHP monolith used by this tracker’s inventory is the folder that contains **`Applications/`** and a root **`composer.json`** — in **Core Repo** that is:

- **`/Users/alonso.roca/Desktop/Core Repo/entrata-core`**

Set **`ENTRATA_MONO_ROOT`** to that **`entrata-core`** path (not only `Core Repo`), so `Applications/ProspectPortal`, `Applications/Chat`, etc. resolve correctly.

You still **open** **`Core Repo`** (or `entrata-core`) as the second folder in Cursor so the agent can browse the full tree.

---

## Step 2 — Multi-root workspace in Cursor (recommended)

1. In Cursor: **File → Open Workspace from File…** (or **Add Folder to Workspace…**).
2. Add **two** roots:
   - **Tracker Competitors Bot** (this repo).
   - **Entrata** root (monorepo or parent folder that contains your apps).

Or use the multi-root workspace file at the **Tracker repo root**:

- **`entrata-plus-tracker.code-workspace`** — pre-wired for `Core Repo` next to the tracker (this file is **gitignored** so your path is not pushed; copy from `entrata-plus-tracker.code-workspace.example` on a new machine).
- In Cursor: **File → Open Workspace from File…** → choose that `.code-workspace` file.

Result: **@ mentions**, search, and the agent can read **both** codebases in one session.

---

## Step 3 — Environment variable for paths

In the shell profile you use for `npm run serve` / `node index.js collect`:

```bash
export ENTRATA_MONO_ROOT="/Users/alonso.roca/Desktop/Core Repo/entrata-core"
```

Match the variable name to what you put in `app-inventory.json` (e.g. `${ENTRATA_MONO_ROOT}/...`).

---

## Step 4 — `app-inventory.json` (tracker)

Edit `initiative-1-tracker/tracker/config/app-inventory.json` per product (ids match `products.json`).

**Option A — `package_json` only**

```json
"leasing-ai": {
  "artifacts": [
    {
      "label": "Leasing AI UI",
      "package_json": "${ENTRATA_MONO_ROOT}/path/to/package.json"
    }
  ]
}
```

**Option B — `repo_root` (uses `package.json` at that folder)**

```json
"prospect-portal": {
  "artifacts": [
    {
      "label": "Prospect Portal web",
      "repo_root": "${ENTRATA_MONO_ROOT}/prospect-portal"
    }
  ]
}
```

Restart the tracker server after edits if you want the UI to re-read files on each request (inventory is read at report build time).

---

## Step 5 — How the agent should use Entrata code

With both folders in the workspace:

- Ask Cursor to **compare** a competitor gap to **your** implementation: e.g. “Given `gapReport` / pricing dimension, which module in `ENTRATA_MONO_ROOT/...` owns pricing copy?”
- Use **`@` folder** or **`@` file** to point at the Entrata subtree so context stays precise.
- The Cursor rule **`.cursor/rules/entrata-app-context.mdc`** reminds the agent to prefer **inventory paths** and **local repo** over inventing APIs.

---

## Step 6 — YouTube / Google Cloud on standby

When your manager grants Cloud access, add `YOUTUBE_DATA_API_KEY` and keep using the same workspace — no change to this layout.

---

## Checklist

| Step | Done |
|------|------|
| Entrata code cloned / path known | ☐ |
| Cursor workspace = Tracker + Entrata | ☐ |
| `ENTRATA_MONO_ROOT` exported for collect/serve | ☐ |
| `app-inventory.json` filled for key products | ☐ |
| Reload report → “Our apps (inventory)” shows versions | ☐ |

See also: [APP-INVENTORY-AND-STRUCTURED-WHAT-TO-CHANGE.md](./APP-INVENTORY-AND-STRUCTURED-WHAT-TO-CHANGE.md).
