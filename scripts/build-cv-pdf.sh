#!/usr/bin/env bash
# Generate the CV PDF locally, mirroring the CI "Generate CV PDF" step in
# .github/workflows/deploy.yml. Output: static/cv.pdf (gitignored), so
# `hugo server` serves /cv.pdf and the Download button works locally.
# macOS / local-dev only; CI uses google-chrome on ubuntu.
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

hugo --minify --quiet --destination "$TMP/public"

# Absolutize internal links so they work from the downloaded PDF
sed -i '' -E \
  -e 's#href=("?)/posts/#href=\1https://shahfazal.com/posts/#g' \
  -e 's#href=("?)/projects/#href=\1https://shahfazal.com/projects/#g' \
  -e 's#href=("?)/elections-municipales-2026/#href=\1https://shahfazal.com/elections-municipales-2026/#g' \
  "$TMP/public/cv/index.html"

python3 -m http.server 8099 --directory "$TMP/public" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null; rm -rf "$TMP"' EXIT
sleep 2

"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=5000 --print-to-pdf=static/cv.pdf \
  "http://localhost:8099/cv/" 2>/dev/null

test -s static/cv.pdf && echo "static/cv.pdf generated ($(wc -c < static/cv.pdf) bytes)"
