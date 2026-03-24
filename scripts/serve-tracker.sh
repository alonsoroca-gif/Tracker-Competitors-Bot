#!/usr/bin/env bash
# Start the Competitor Tracker report UI (Express on port 3000 by default).
# Usage: from repo root → ./scripts/serve-tracker.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TRACKER="$ROOT/initiative-1-tracker/tracker"
cd "$TRACKER"
if [[ ! -d node_modules ]]; then
  echo "Installing dependencies…"
  npm install
fi
echo "Opening Tracker at http://localhost:${PORT:-3000} (Ctrl+C to stop)"
exec npm run serve
