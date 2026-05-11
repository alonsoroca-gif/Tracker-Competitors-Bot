#!/bin/bash
# Renders both PRD HTML files in this folder to PDF in ~/Desktop/tracker-decks/.
# Run from this folder (tracker-decks/ in the workspace):
#   bash render-to-pdf.sh
# or from anywhere with the full path.
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$HOME/Desktop/tracker-decks"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mkdir -p "$OUT_DIR"

for html in "$SRC_DIR"/PRD-*.html; do
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
