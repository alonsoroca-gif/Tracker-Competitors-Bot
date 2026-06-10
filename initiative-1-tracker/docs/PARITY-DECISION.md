# Parity decision — Path A locked; morningbrief kickoff

**Date:** 2026-05-27 (handoff lock)

## Locked

| Item | Decision |
|------|----------|
| **When parity runs** | When Billy starts **morningbrief** (~8:00am) — not overnight |
| **Path A** | Local `entrata-core` + `git pull` each publish |
| **Layer 2** | Agent Read/Grep in workspace during background publish |
| **API token** | Optional upgrade (Path B) — Billy may get approval easier |
| **VM / 5:50am** | Out of scope |

## Two problems — two fixes

| Problem | Fix |
|---------|-----|
| Stale Core | `git pull` at publish kickoff (Path A) or API (Path B) |
| Laptop asleep at 5:50am | **Moved publish to 8:00 morningbrief** — not a problem anymore |

## Path B (optional comment on first publish)

Fine-grained token on `entrata/core` → faster Layer 1. Local clone still required for Layer 2. See [TRACKER-PARITY-GITHUB.md](./TRACKER-PARITY-GITHUB.md).

## Docs

- [CORE-CLONE-SETUP.md](./CORE-CLONE-SETUP.md)
- [BILLY-TRACKER-SETUP.md](./BILLY-TRACKER-SETUP.md) §4b
- [MORNINGBRIEF-TRACKER-PROMPT.md](./MORNINGBRIEF-TRACKER-PROMPT.md)
