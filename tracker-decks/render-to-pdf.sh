#!/bin/bash
# Renders PRD HTML files in this folder to PDF in ~/Desktop/tracker-decks/.
#
# Usage:
#   bash render-to-pdf.sh                       # render all PRD-*.html
#   bash render-to-pdf.sh 2026-05-26T17-45-38Z  # render only PRD-*<run-id>*.html
#
# The optional run-id arg was added 2026-05-26 (Gap #5 from live cycle) so
# we don't re-render stale PRDs from prior drops every time a new cycle runs.
# Re-rendering is harmless but wastes ~3s per stale PDF.
set -euo pipefail
shopt -s nullglob   # unmatched globs expand to empty (not literal pattern)

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$HOME/Desktop/tracker-decks"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
RUN_ID="${1:-}"

if [ ! -x "$CHROME" ]; then
  echo "render-to-pdf.sh: Google Chrome not found at $CHROME" >&2
  echo "" >&2
  echo "PDF export requires headless Chrome. If you're on macOS, install Chrome:" >&2
  echo "  https://www.google.com/chrome/" >&2
  echo "If you're on Linux/Windows, this script needs updating to detect alternative" >&2
  echo "tooling (pandoc, wkhtmltopdf, weasyprint). See SKILL.md anti-pattern #10." >&2
  exit 2
fi

mkdir -p "$OUT_DIR"

# Collect matching files into an array. We expand the glob after $SRC_DIR
# is quoted, so paths containing spaces ("Tracker Competitors Bot") work.
if [ -n "$RUN_ID" ]; then
  echo "Filtering by run-id: $RUN_ID"
  matches=( "$SRC_DIR"/PRD-*"$RUN_ID"*.html )
else
  matches=( "$SRC_DIR"/PRD-*.html )
fi

if [ ${#matches[@]} -eq 0 ]; then
  echo "render-to-pdf.sh: no matching HTML files in $SRC_DIR" >&2
  [ -n "$RUN_ID" ] && echo "  (pattern: PRD-*${RUN_ID}*.html)" >&2
  exit 1
fi

for html in "${matches[@]}"; do
  base="$(basename "$html" .html)"
  echo "Rendering $base.pdf ..."
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --no-pdf-header-footer \
    --print-to-pdf="$OUT_DIR/$base.pdf" \
    "file://$html"
done

echo
echo "Done. Output:"
ls -la "$OUT_DIR/"
