#!/bin/bash
# Build script for Chrome Web Store submission
# Run: bash build.sh

set -e

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])" 2>/dev/null || grep '"version"' manifest.json | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')
OUTPUT="parsely-v${VERSION}.zip"

echo "Building Parsely - Browser Copilot v${VERSION}..."

# Remove old build if it exists
rm -f "$OUTPUT"

# Create zip with only the extension files (exclude dev/meta files)
zip -r "$OUTPUT" \
  manifest.json \
  background.js \
  claude-client.js \
  content.js \
  content.css \
  sidepanel.html \
  sidepanel.js \
  sidepanel.css \
  icons/

echo ""
echo "✓ Built: $OUTPUT"
echo ""
echo "File sizes:"
unzip -l "$OUTPUT" | awk 'NR>3 {printf "  %-40s %s\n", $4, $1}'
echo ""
echo "Total zip size: $(du -sh "$OUTPUT" | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Upload $OUTPUT to https://chrome.google.com/webstore/devconsole"
echo "  2. Fill in store listing from STORE_LISTING.md"
echo "  3. Add privacy policy URL"
echo "  4. Add screenshots (1280x800 or 640x400)"
echo "  5. Submit for review"
