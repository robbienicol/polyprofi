# Pathey Brand

Decided 2 September 2026. Voice, marks and type. Code tokens: `DESIGN.md`.

## Tagline

**Not advice. Just the math.**

Ships with the wordmark: store listing, screenshots, video end cards, web hero,
deck title.

Second line, where there's room: **We don't have the best recipe. We have the
best compass.**

## Claims

- We don't pick. You pick the goal, we price every route to it.
- Every score opens into its working.
- A Roth IRA and a Polymarket bet get the same scoring.
- Routes are ranked for your number, deadline and risk.
- When the goal doesn't add up in the time given, we say so.

Never claim returns, safety, or anything that reads as a recommendation to buy.

## Screenshot copy

| # | Line | Screen |
| --- | --- | --- |
| 1 | Not advice. Just the math. | Hero / routes list |
| 2 | Tell it the goal. It finds the route. | Goal setup |
| 3 | Six months or six years — the math changes with your goals. | Quiz / timeframe |
| 4 | A Roth IRA and a Polymarket bet deserve the same math. Sometimes the bet wins. | Ranked routes |
| 5 | An AI coach for every pick — including what could go wrong. | Route coach |
| 6 | We don't have the best recipe. We have the best compass. | Close / CTA |

Bench: Every route, safest first. · Scored out of 100. Here's the working. ·
You decide what "best" means. Drag the dials, the list re-ranks. · It'll tell
you when the goal doesn't add up. · Then it hands you to where you actually
trade. · Prediction markets, scored like everything else. · Nobody knows the
market. Everybody can read a map.

Rules: short sentences, full stops not exclamation marks. No "guaranteed",
"safe", "best returns", "easy money". Numbers specific or absent — no "up to".

## Colour

| Role | Hex | Token |
| --- | --- | --- |
| Brand / CTA | `#D9653D` | `Brand[500]` |
| Dark background | `#141312` | `Colors.dark.background` |
| Light background | `#F7F3EC` | `Colors.light.background` |
| Primary text | `#1C1A18` | `Colors.light.text` |
| Muted text | `#756F68` | `Colors.light.textSecondary` |
| Positive | `#2FA66A` | `Semantic.positive` |
| Caution | `#E2A33C` | `Semantic.caution` |
| Negative | `#DB4B4B` | `Semantic.negative` |
| Info | `#5478D4` | `Semantic.info` |

- Brand means action, never "good".
- One meaning per semantic colour. No decorative use.
- Text on brand is `#141312` (5.2:1). Light text on brand fails contrast.
- Risk ramp safe → risky: `#2FA66A → #8FAE4E → #E2A33C → #E07D45 → #DB4B4B`.

## Icon

A short bar above a longer bar, fully rounded: an equals sign stepped up.

- Ground `#F7F3EC`, mark `#D9653D`. Cream mark on `#141312` for dark surfaces.
- 1024 canvas: bar height 124, radius 62. Upper bar x 262, y 300, w 352. Lower
  bar x 262, y 600, w 500.
- No gradients, no tilt, no wordmark inside the icon, never on orange ground.

| File | Contents |
| --- | --- |
| `assets/images/icon.png` | 1024, full bleed |
| `assets/images/android-icon-background.png` | 1024, flat `#F7F3EC` |
| `assets/images/android-icon-foreground.png` | 1024, mark at 66% (adaptive safe zone) |
| `assets/images/android-icon-monochrome.png` | 1024, white mark, transparent |
| `assets/images/splash-icon.png` | 512, cream mark, transparent |
| `assets/images/favicon.png` | 48 |

`app.json` → `android.adaptiveIcon.backgroundColor` = `#F7F3EC`.

## Type

**Source Serif 4** display, **Public Sans** everything else. Source Serif reads
institutional; Public Sans was drawn for US government services. Warmth comes
from the palette, not the type.

| Use | Face | Weight |
| --- | --- | --- |
| Headings, hero, screenshot copy, figures ≥ 18px | Source Serif 4 | 600 / 700 |
| Body, labels, buttons, anything under 18px | Public Sans | 400–700 |
| Figures | Public Sans + `fontVariant: ['tabular-nums']` | 700 |

- 18px threshold is `DISPLAY_MIN_SIZE` in `src/constants/theme.ts`.
- Native ignores `fontWeight` on custom faces — each weight is its own family.
  Use `displayFontFamily()` / `bodyFontFamily()`.
- No serif under 18px. No third family.
- Was Plus Jakarta Sans, dropped 2 September 2026 — read as generic startup.

## Name

**Pathey**. Lowercase in code, URLs, handles. "PolyProfit" / `polyprofit`
survive as the repo name, Expo slug and bundle id — internal only.
