#!/usr/bin/env bash
# Handoff: update STATUS/HANDOFF, commit, push. Run when you leave so automation has latest state.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Ensure STATUS has a "Last session" line (optional: replace "—" with timestamp)
if [ -f STATUS.md ]; then
  ts="$(date +%Y-%m-%d\ %H:%M)"
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "s/^\*\*Last session:\*\*.*/\*\*Last session:\*\* $ts (handoff)/" STATUS.md
  else
    sed -i '' "s/^\*\*Last session:\*\*.*/\*\*Last session:\*\* $ts (handoff)/" STATUS.md
  fi
fi

git add STATUS.md HANDOFF.md 2>/dev/null || true
if git diff --staged --quiet 2>/dev/null; then
  echo "No changes to STATUS/HANDOFF; creating handoff commit anyway."
fi
git add STATUS.md HANDOFF.md
git commit -m "handoff: end shift" --allow-empty || true
git push

echo "Handoff done. Automation (CI, scheduled jobs) runs from here."
