#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: release.sh <version> (e.g. 1.0.0)}"
MODULE_NAME="fvtt-compendium-importer"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT="${MODULE_DIR}/${MODULE_NAME}-v${VERSION}.zip"

echo "==> Building ${MODULE_NAME} v${VERSION}"

# Update version in module.json
cd "$MODULE_DIR"
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" module.json
sed -i "s|/download/v[^/]*/|/download/v${VERSION}/|g" module.json
sed -i "s|${MODULE_NAME}-v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\.zip|${MODULE_NAME}-v${VERSION}.zip|g" module.json

echo "==> Updated module.json to v${VERSION}"

# Create zip from parent directory
cd ..
zip -r "$OUTPUT" "${MODULE_NAME}/" \
  -x "${MODULE_NAME}/.git/*" \
  -x "${MODULE_NAME}/node_modules/*" \
  -x "${MODULE_NAME}/scripts/release.sh" \
  -x "${MODULE_NAME}/*.zip" \
  -x "${MODULE_NAME}/.gitignore"

echo "==> Created ${OUTPUT}"
echo "==> Done! Upload this zip to your GitHub release."
