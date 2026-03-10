#!/usr/bin/env bash
# Resume: pull latest, run gaps-check, optionally open HANDOFF + STATUS.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git pull
[ -x "$ROOT/scripts/gaps-check.sh" ] && "$ROOT/scripts/gaps-check.sh" || true

echo "Resume done. Review GAPS.md, HANDOFF.md, STATUS.md and pick a task."
