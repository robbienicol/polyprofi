# Pathey Design System

Tagline: **Not advice. Just the math.** It is the one line that ships with
the wordmark — store listing, end cards, hero. The supporting line is "We don't
have the best recipe. We have the best compass."; "GPS for money" stays the
internal shorthand for the same idea. See `BRANDING.md`.

The palette below is the whole palette. Nothing else ships. Every value lives in
`src/constants/theme.ts` — import the token, never paste a hex into a screen.

## Palette

| Role | Hex | Token |
| --- | --- | --- |
| Brand / CTA | `#D9653D` | `Brand[500]` |
| Dark background | `#141312` | `Colors.dark.background` |
| Light background | `#F7F3EC` | `Colors.light.background` |
| Primary text | `#1C1A18` | `Colors.light.text` |
| Muted text | `#615B55` / `#ADA69C` | `Colors.light.textSecondary` / `Colors.dark.textSecondary` |
| Quietest text | `#766D63` / `#8E8880` | `Colors.light.textTertiary` / `Colors.dark.textTertiary` |
| Control boundary | `#A28F70` / `#736B61` | `Colors.*.borderControl` |
| Positive only | `#2FA66A` | `Semantic.positive` |
| Caution only | `#E2A33C` | `Semantic.caution` |
| Negative only | `#DB4B4B` | `Semantic.negative` |
| Neutral / info | `#5478D4` | `Semantic.info` |

Supporting neutrals (surfaces, borders, tertiary text) are warm tints derived
from the two backgrounds and are defined in `Colors.light` / `Colors.dark`.

## Rules

- **Brand is for action, not for meaning.** Primary buttons, selected states,
  focus rings, progress fills, brand marks. It never means "good".
- **Semantic colors have exactly one meaning each.** `positive` = realised or
  unrealised gain, a win, a goal hit. `caution` = projections, warnings,
  pending. `negative` = loss, error, destructive. `info` = neutral emphasis.
  Don't use them decoratively, and don't use brand in their place.
- **Text on brand is dark.** Use `OnBrand` (`#141312`) — 5.2:1 on `#D9653D`.
  Light text on the CTA fails contrast.
- **Risk ramp** (`RiskScale`) runs safe → risky:
  `#2FA66A → #8FAE4E → #E2A33C → #E07D45 → #DB4B4B`.
- **Brand ramp** `Brand[50…700]` is for tints and hovers only; `Brand[500]` is
  the action color. Alpha suffixes (`Brand[500] + '18'`) give tinted surfaces.
- **Categorical data** (asset classes, category chips, legend swatches) uses
  `CategoryScale` — clay, slate, rust, haze, sand, stone, ink. It borrows the
  brand hue and the info blue so a category never reads as good or bad.
- The old `Accent.*` aliases are gone. Import `Semantic` / `CategoryScale`.

## Hues as fills, `*Text` as ink

`Semantic`, `Brand[500]` and `RiskScale` are tuned to be **seen**. As words under
18pt they sit between 2.0:1 and 3.6:1 on the warm light grounds, which is not
legible and not what the rules above ask for. Every one of them has a text-safe
counterpart at ≥4.5:1 on every surface in its theme:

- `SemanticText[scheme]` — `positive`, `caution`, `negative`, `info`, `brand`
- `RiskTextScale[scheme]` — the risk ramp as ink, same order, same meaning

Resolve them with the `useSemanticText()` / `useRiskTextScale()` hooks. **A hue
colors a fill, a bar or a badge; its `*Text` counterpart colors the words.**

`textTertiary` and the `*Text` values are tuned for `background` and
`backgroundElement`. On `backgroundSelected` they land near 4:1 — use
`textSecondary` there.

`borderControl` is the boundary color for controls that carry meaning by their
edge: the unfilled half of a slider track, an unselected chip. `border` and
`borderStrong` are decorative separators and stay below 3:1 on purpose.

## What color may say

- **Color is never the only carrier of meaning.** A band, a verdict or a state
  always has a word, a label or a number beside it. A hue that is the sole
  signal fails for a color-blind reader and disappears entirely for VoiceOver.
- **A score is not a gain.** A 0–100 fit score is neither positive nor negative;
  it reads as a number plus a word (`scoreVerdict` / `scoreVerdictShort` in
  `@/lib/score`, one definition for every surface), on a neutral surface.
- **A projection is not a win.** Potential or projected profit renders in ink.
  `Semantic.positive` means a gain that happened.
- **A chance is not a verdict.** A probability meter is ink; the risk ramp is
  what a chance maps onto when it needs a hue.
- On the routes list the risk band is the **only** hue on a card, so a column of
  bands down the list is the safe → risky ramp, made scannable.

## Controls

- **44×44pt minimum** for anything tappable, reached with real height rather
  than `hitSlop` wherever the visual can grow.
- **Platform controls first.** `Switch`, sliders, action sheets and system
  pickers, not pills that render the words "On" and "Off".
- Every interactive element carries an `accessibilityRole` and an authored
  `accessibilityLabel`; sliders add `accessibilityRole="adjustable"` and an
  `accessibilityValue`. A `<TextInput>` never passes through `ThemedText`, so it
  must name its `fontFamily` — `fontWeight` alone is ignored for custom faces on
  native and silently falls back to the system font.
- Reduce Motion is honored: `AccessibilityInfo.isReduceMotionEnabled` gates every
  looping animation.

## Type, radius, spacing

`Type`, `Radius`, `Spacing`, `Shadow` live in `src/constants/theme.ts`.

Two faces, no third. **Source Serif 4** is the display face at
`DISPLAY_MIN_SIZE` (18) and above; **Public Sans** is everything below it,
including every figure. `ThemedText` resolves both from the final size and
weight, so inline-styled headings pick up the serif without asking.

- Custom faces on native ignore `fontWeight` — each weight is its own family.
  Use `displayFontFamily(weight)` / `bodyFontFamily(weight)`, never a raw name.
- Figures take `fontVariant: ['tabular-nums']` so columns don't jitter.
- Anything that names its own `fontFamily` is left alone.

Brand voice, taglines, the icon and the reasoning behind all of it: `BRANDING.md`.
