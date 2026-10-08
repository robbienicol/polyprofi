#!/usr/bin/env bash
#
# One-shot iOS release: build the production IPA locally on this Mac with EAS,
# then upload it to TestFlight.
#
#   bun run build            # checks → local build → submit
#   SKIP_CHECKS=1 bun run build   # skip the type-check gate
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

# ── submit ───────────────────────────────────────────────────────────────────
step "Uploading $VERSION ($BUILD) to TestFlight"
"${EAS[@]}" submit \
  --platform ios \
  --profile "$PROFILE" \
  --path "$IPA" \
  --non-interactive

STEP="done"
bold "✓ Pathey $VERSION ($BUILD) uploaded. It shows in TestFlight once Apple finishes processing (usually 5–15 min)."
