# Core parity via GitHub (live `main`)

> **Path B (optional):** Use if **Billy** gets `entrata/core` token approved. **Path A (default):** local clone — [BILLY-TRACKER-SETUP.md](./BILLY-TRACKER-SETUP.md) §4. Cancelled for Alonso's account only.

Parity reads **entrata-core on GitHub** at `ref=main` — no local clone, no stale disk copy.

## Quick start

```bash
# 1. Set token (read-only on entrata-core)
export ENTRATA_CORE_GITHUB_TOKEN=ghp_...

# 2. Config owner/repo (default: entrata/core — see local clone remote)

# 3. Preflight
node initiative-1-tracker/tracker/scripts/verify-github-core-access.js

# 4. Run parity (GitHub Layer 1)
echo '[{"id":"1","competitor_signal":"…","proposed_feature":"…","product_id":"prospect-portal"}]' \
  | node initiative-1-tracker/tracker/scripts/core-parity-check.js --stdin --github --format markdown
```

## Two layers (unchanged)

| Layer | Tool | Source |
|-------|------|--------|
| **Layer 1** | `core-parity-check.js --github` | Recursive **git tree** @ `main` + keyword scan on fetched files |
| **Layer 2** | Agent Read on GitHub paths | `feature_audit.code_scan_prompt` in JSON output |

Layer 2 wins on conflict for tiering.

## How Layer 1 works

1. **One** recursive tree fetch per batch (`GET .../git/trees/{sha}?recursive=1`).
2. List paths under `Applications/{App}/` (same depth/ext filters as local scan).
3. Fetch file contents selectively (batched, rate-limit aware).
4. Same scoring thresholds as local `core-parity-check.js`.

## Rate limits

- GitHub REST: ~5,000 requests/hour per token.
- One tree fetch + ~N file reads per Product row (capped like local: 600 files/app max).
- Script pauses when `x-ratelimit-remaining` is low.
- **Warning, not blocker** for typical drops (few Product rows).

## Config

`initiative-1-tracker/tracker/config/entrata-core-github.json`:

- `owner`, `repo`, `default_ref` (usually `main`)
- `api_base` — use `https://api.github.com` or your GHE host

Env: `ENTRATA_CORE_GITHUB_TOKEN` or `GITHUB_TOKEN`.

## Local mode

`core-parity-check.js` without `--github` still uses local clone (legacy). Prefer `--github` for automation and fresh `main`.

## Tests

```bash
npm run test:parity-github --prefix initiative-1-tracker/tracker
npm run test:parity --prefix initiative-1-tracker/tracker
```

`test:parity-github` soft-skips without token.
