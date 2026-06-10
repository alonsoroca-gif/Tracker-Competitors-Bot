#!/usr/bin/env bash
# Re-clone entrata-core when git pull fails (bad object HEAD).
# Run from Tracker repo. Requires VPN + SSH to github.com.
set -euo pipefail

CORE_PATH="${1:-$(cat "$(dirname "$0")/../.core-path" 2>/dev/null || true)}"
if [ -z "$CORE_PATH" ]; then
  echo "Usage: reclone-core.sh /path/to/entrata-core"
  exit 1
fi

PARENT="$(dirname "$CORE_PATH")"
NAME="$(basename "$CORE_PATH")"
BACKUP="${CORE_PATH}.broken-$(date +%Y%m%d-%H%M)"

echo "=== entrata-core re-clone ==="
echo "Target: $CORE_PATH"
echo "Backup: $BACKUP"
echo ""

if [ -d "$CORE_PATH" ]; then
  mv "$CORE_PATH" "$BACKUP"
  echo "Moved broken clone → $BACKUP"
fi

# Shallow clone first — faster and more reliable on large monolith
if ! git clone --depth 1 --branch main git@github.com:entrata/core.git "$CORE_PATH"; then
  echo "Shallow clone failed — retrying full clone..."
  rm -rf "$CORE_PATH"
  git clone git@github.com:entrata/core.git "$CORE_PATH"
  cd "$CORE_PATH"
  git checkout main
fi
cd "$CORE_PATH"
git pull origin main 2>/dev/null || true
ls Applications | head

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TRACKER_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$TRACKER_ROOT/initiative-1-tracker/tracker"
node scripts/core-parity-check.js --save-core "$CORE_PATH"
npm run verify:core
npm run test:parity
npm run manager:preflight

echo ""
echo "=== DONE — git pull should work now ==="
cd "$CORE_PATH" && git pull
