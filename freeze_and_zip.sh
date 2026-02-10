#!/usr/bin/env bash
set -e

BASE="$(pwd)"
NAME="$(basename "$BASE")"
DATE="$(date +%Y-%m-%d_%H%M)"
FREEZE_NAME="${NAME}_FREEZE_${DATE}"

cd ..
cp -R "$NAME" "$FREEZE_NAME"
cd "$FREEZE_NAME"

./freeze.sh

cd ..
zip -r "${FREEZE_NAME}.zip" "$FREEZE_NAME"

echo "Frozen and zipped: ${FREEZE_NAME}.zip"
