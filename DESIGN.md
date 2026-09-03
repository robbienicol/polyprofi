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
| Muted text | `#756F68` | `Colors.light.textSecondary`, `Colors.dark.textTertiary` |
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
