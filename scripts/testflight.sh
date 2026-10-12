#!/usr/bin/env bash
#
# One-shot iOS release: build the production IPA locally on this Mac with EAS
# and upload it straight to TestFlight with altool. No cloud build, no manual step.
#
#   bun run build            # checks → local build → TestFlight upload
#   SKIP_CHECKS=1 bun run build   # skip the type-check gate
#   UPLOAD=0 bun run build        # build only, leave the IPA on disk
#
# Upload credentials come from .env: APPLE_ID and APPLE_APP_PASSWORD (an
# app-specific password from appleid.apple.com, not the account password).
#
# The build number comes from EAS (appVersionSource: remote + autoIncrement in
# eas.json), so every run gets the next one without touching app.json. The IPA
# lands in build-artifacts/ (gitignored) and is read back to print exactly which
# version/build went up.

set -euo pipefail

cd "$(dirname "$0")/.."

PROFILE="${PROFILE:-production}"
ARTIFACT_DIR="build-artifacts"
STAMP="$(date +%Y%m%d-%H%M%S)"
IPA="$ARTIFACT_DIR/Pathey-$STAMP.ipa"
STEP="setup"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { STEP="$1"; printf '\n\033[1;38;5;173m▸ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
trap 'code=$?; [ $code -ne 0 ] && printf "\n\033[1;31m✗ Failed during: %s (exit %s)\033[0m\n" "$STEP" "$code" >&2' EXIT

# ── preflight ────────────────────────────────────────────────────────────────
step "Preflight"
[ "$(uname -s)" = "Darwin" ] || fail "Local iOS builds need macOS with Xcode."
command -v xcodebuild >/dev/null || fail "xcodebuild not found. Install Xcode and run: sudo xcode-select -s /Applications/Xcode.app"
command -v pod >/dev/null || fail "CocoaPods not found. Install it: brew install cocoapods"
command -v fastlane >/dev/null || fail "fastlane not found (EAS local builds use it to sign). Install it: brew install fastlane"

UPLOAD="${UPLOAD:-1}"
if [ "$UPLOAD" = "1" ]; then
  # Read straight out of .env so the secrets never need to be exported by hand.
  if [ -f .env ]; then
    APPLE_ID="${APPLE_ID:-$(grep -m1 '^APPLE_ID=' .env | cut -d= -f2- | tr -d '"'"'"'\"')}"
    APPLE_APP_PASSWORD="${APPLE_APP_PASSWORD:-$(grep -m1 '^APPLE_APP_PASSWORD=' .env | cut -d= -f2- | tr -d '"'"'"'\"')}"
  fi
  [ -n "${APPLE_ID:-}" ] || fail "APPLE_ID not set (.env or env). Set UPLOAD=0 to build only."
  [ -n "${APPLE_APP_PASSWORD:-}" ] || fail "APPLE_APP_PASSWORD not set (.env or env). Set UPLOAD=0 to build only."
fi

if command -v eas >/dev/null; then
  EAS=(eas)
else
  EAS=(bunx eas-cli@latest)
fi

"${EAS[@]}" whoami >/dev/null 2>&1 || fail "Not logged in to EAS. Run: ${EAS[*]} login"
echo "EAS: $("${EAS[@]}" whoami 2>/dev/null | head -1) · Xcode: $(xcodebuild -version | head -1)"

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "Note: uncommitted changes — they will be in this build."
fi

if [ "${SKIP_CHECKS:-0}" != "1" ]; then
  step "Type-check"
  # Fails in seconds instead of 15 minutes into a native build.
  npx tsc --noEmit -p .
fi

# ── build ────────────────────────────────────────────────────────────────────
step "Building iOS ($PROFILE) locally — this takes a while"
mkdir -p "$ARTIFACT_DIR"
"${EAS[@]}" build \
  --platform ios \
  --profile "$PROFILE" \
  --local \
  --non-interactive \
  --output "$IPA"

[ -f "$IPA" ] || fail "Build finished but no IPA at $IPA"

# Read the version and build number straight out of the IPA that was produced.
PLIST_TMP="$(mktemp -d)"
unzip -q -o "$IPA" 'Payload/*.app/Info.plist' -d "$PLIST_TMP"
PLIST="$(find "$PLIST_TMP/Payload" -maxdepth 2 -name Info.plist | head -1)"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")"
BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$PLIST")"
rm -rf "$PLIST_TMP"
bold "Built Pathey $VERSION ($BUILD) → $IPA"

# ── upload ───────────────────────────────────────────────────────────────────
if [ "$UPLOAD" != "1" ]; then
  STEP="done"
  bold "✓ Pathey $VERSION ($BUILD) built (upload skipped):"
  echo "  xcrun altool --upload-app -f $IPA -t ios -u \"\$APPLE_ID\" -p \"\$APPLE_APP_PASSWORD\""
  exit 0
fi

step "Validating with App Store Connect"
xcrun altool --validate-app -f "$IPA" -t ios -u "$APPLE_ID" -p "$APPLE_APP_PASSWORD"

step "Uploading to TestFlight"
xcrun altool --upload-app -f "$IPA" -t ios -u "$APPLE_ID" -p "$APPLE_APP_PASSWORD"

STEP="done"
bold "✓ Pathey $VERSION ($BUILD) uploaded to TestFlight. Processing takes ~5-15 min."
echo "  https://appstoreconnect.apple.com/apps/6789668562/testflight/ios"
