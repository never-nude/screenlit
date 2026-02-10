#!/usr/bin/env bash
set -e

FOLDER="$(basename "$(pwd)")"
DATE="$(date +%Y-%m-%d)"
CATALOG_COUNT="$(grep -c "id:" catalog.js || echo "unknown")"

cat <<EOT > build.txt
ScreenLit Build
Folder: ${FOLDER}
Date: ${DATE}
Catalog: ${CATALOG_COUNT}
Notes: frozen snapshot
EOT

echo "build.txt updated"
