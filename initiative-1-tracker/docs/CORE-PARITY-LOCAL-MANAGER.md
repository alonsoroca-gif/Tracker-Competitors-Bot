# Core parity — local manager path (Billy / anyone with Core clone)

Use this when **GitHub fine-grained token** for `entrata/core` is pending or denied, but the manager **already has `entrata-core` on disk** (the normal manager onboarding path).

## Who needs what

| Role | Skill | Needs Core on disk? | Needs GitHub token? |
|------|-------|---------------------|---------------------|
| **Billy** | `tracker-feed` (morningbrief) | **No** | **No** |
| **Billy** | `tracker-publish` (factory) | **Yes** (Product rows) | No — local Layer 1 + agent Layer 2 |
| **You** | `/trackerstart` lab | Yes | Optional |

**tracker-feed only reads** `parity` / `parity_l2` from `tracker-briefs/…/signals-table.json`. Billy does **not** run parity at 8am unless you add an explicit gap-fill step (not default).

---

## Billy — one-time setup (15 min)

### 1. Clone both repos

```bash
git clone <tracker-repo-url>
git clone <entrata-core-url>    # internal — Billy already has access
```

### 2. Multi-root Cursor workspace

Copy `entrata-plus-tracker.code-workspace.example` → `entrata-plus-tracker.code-workspace` and fix the Core path to Billy's clone.

**File → Open Workspace from File…**

### 3. Cache Core path for scripts

```bash
cd initiative-1-tracker/tracker
node scripts/core-parity-check.js --save-core /path/to/entrata-core
node scripts/verify-core-setup.js
npm run test:parity
```

Expected: `verify-core-setup: OK` and `21/21 passed` (or similar).

### 4. Optional env (persistent)

```bash
# ~/.zshrc
export ENTRATA_MONO_ROOT=/path/to/entrata-core
```

---

## Running parity (local — two layers)

### Layer 1 — script (no token)

```bash
echo '[{"id":"1","competitor_signal":"…","proposed_feature":"…","product_id":"prospect-portal"}]' \
  | node initiative-1-tracker/tracker/scripts/core-parity-check.js --stdin --format markdown
```

### Layer 2 — agent in chat (required for Product rows)

Same as `/trackerstart` Path A: agent **Read/Grep** on Core paths in the workspace (or `@` Core files). Layer 2 **wins** over Layer 1 for tiering.

---

## Where parity runs in automation

| Host | Parity mode |
|------|-------------|
| **Billy's Mac** + `tracker-publish` | **Local Path A** — `git pull` entrata-core, then `verify-core-setup.js` + `core-parity-check.js` (no `--github`) + Layer 2 in agent session |
| **Billy `tracker-feed` @ 8am** | **None** — displays pre-filled parity column from brief |

**Handoff default:** tracker-publish kicks off at morningbrief Step 0 (~8:00am) on Billy's Mac with Path A. See [CORE-CLONE-SETUP.md](./CORE-CLONE-SETUP.md).

---

## Billy installs morningbrief only (no publish)

If Billy only runs **tracker-feed**:

1. Clone **tracker repo** only
2. `git pull` before morningbrief
3. Paste block from `MORNINGBRIEF-TRACKER-PROMPT.md`

No Core clone, no parity scripts, no GitHub token.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `verify-core-setup: FAIL` | `--save-core` path wrong or `Applications/` missing |
| Stale parity vs production | `git pull` in entrata-core (local is only as fresh as last pull) |
| `verify-github-core-access: 404` | Token pending — use local path above |
| Product row parity `not_scanned` in brief | Publish didn't finish Layer 2 — re-run publish on machine with Core |

---

## Related

- `TRACKER-PARITY-GITHUB.md` — when token is approved (automation @ main)
- `TRACKER-EXTERNAL-ONBOARDING.md` §3.3 — clone Core
- `.cursor/skills/tracker-publish/SKILL.md` — Phase 3 parity
