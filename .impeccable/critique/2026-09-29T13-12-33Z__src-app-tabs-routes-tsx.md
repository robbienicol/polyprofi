---
target: src/app/(tabs)/routes.tsx
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:/Users/robbienicol/Documents/polyprofit/src/app/(tabs)/routes.tsx"
target_fingerprint: "sha256:1df5d2e5e503935afad59761bab939f85267c2df3183aed2964062d57e105d17"
target_path: /Users/robbienicol/Documents/polyprofit/src/app/(tabs)/routes.tsx
timestamp: 2026-09-29T13-12-33Z
slug: src-app-tabs-routes-tsx
---
Method: dual-agent (A: design review · B: deterministic evidence). Both ran isolated; neither saw the other's output.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Only progress bar is fake (`ui/loaders.tsx:33-38`, fixed timer). Committing money produces no receipt. |
| 2 | Match System / Real World | 3 | "Default order" names nothing; detail titled "Opportunity"; "pick" in shipped copy 6 times against binding terminology. |
| 3 | User Control and Freedom | 3 | `confirmAcquire` (`routes.tsx:384-392`) writes a position and launches an external venue in one tap. No undo. |
| 4 | Consistency and Standards | 2 | Three color scales for the same 0-100 idea; hand-rolled switch + 3 hand-rolled segmented controls; 134 hardcoded font sizes incl. 12.5/11.5/13.5 off-scale. |
| 5 | Error Prevention | 2 | `TrackRouteForm.tsx:67` validates only `Number(amount) > 0`. |
| 6 | Recognition Rather Than Recall | 2 | Ranked by weights set on Settings tab (`routes.tsx:213-214`); never named or linked here. |
| 7 | Flexibility and Efficiency | 3 | Keyword search, saved batches, group-by-chance are real. No compare, no save-for-later. |
| 8 | Aesthetic and Minimalist | 2 | 64 interactive controls in default state; detail card renders ~40 numeric values. |
| 9 | Error Recovery | 2 | Honest-no falls to `EmptyFiltered`, renders literal string "No  routes" (`routes.tsx:736-738`). |
| 10 | Help and Documentation | 2 | ScoreMathCard / Market Quality / Settlement unreachable until a route is opened. No glossary. |
| **Total** | | **23/40** | **Needs work** |

## Design Specificity Verdict

Split, and the split runs the wrong way: the parts nobody sees first are authored for Pathey; the screen that IS the product is category-interchangeable.

Authored: `ScoreMathCard.tsx:199-227` (score docked in the user's own numbers); binary-settlement block `RouteOpportunityCard.tsx:480-519`; `EmptyUncovered` answering with coverage; `CapitalSafeNudge` suppressed when the user caused the absence (`route-results.ts:228-241`).

Interchangeable: `src/components/molecules/RouteCard.tsx` entirely (icon tile + score pill + 6pt bar + 26pt green number + orange Add = the Robinhood/DraftKings row); pill-chips filter bar; "Show 30 more"; AI Coach + BETA pill; `AnalyzingLoader` "Analysing thousands of data points in real time".

Sharpest finding: `RouteCard.tsx:7` imports `RiskScale`, `:14-15` export `riskLabel`/`riskColor`, `:23-31` define `displayRiskLevel` — the render body calls none of them. The risk ramp does not appear on the ranking screen.

Deterministic scan: bundled detector ran once, returned `[]`, exit 0, no stderr. NOT a pass — HTML/CSS rules against React Native JSX. Non-informative. All mechanical evidence from independent static analysis: 168 contrast pairs computed / 99 failing; 34 interactive elements / 28 under 44pt; 14 of 34 with any accessibility prop.

Visual overlays: none. No simulator booted; no browser overlay applies to a native target.

## Overall Impression

The honesty this product is built on is real and is all one screen too deep. Everything that earns a cautious user's trust lives on the detail screen, while the list lets you commit money without seeing any of it. The list ranks by score, shows payout largest, shows risk not at all. Biggest opportunity: move the verdict to the top of the screen and put the risk ramp into the composition.

## What's Working

1. `ScoreMathCard.tsx` — each score component as earned-of-max under the user's own weights, the zeroed weight named back to them, hard caps in the language of their own constraint. Hands over the arithmetic instead of asking to be trusted.
2. Four-state search outcome (`route-results.ts:131-143`) — "we don't cover it" vs "your filters are hiding it" vs "still searching", with `EmptyUncovered` closing it by saying what IS covered.
3. Token discipline — zero hardcoded hex across all 14 files (verified; same grep finds 47 in theme.ts). Every `Brand[500]` fill pairs with `OnBrand` at exactly 5.20:1.

## Priority Issues

### [P0] The "this goal doesn't add up" state does not exist
Why: PRODUCT.md's first principle makes the honest no ship at the same weight as a route that works; it ships as a string-interpolation bug. `routes.tsx:736-738` renders `No ${filters.category ?? ''} routes` -> literal "No  routes", with a Clear filters action that cannot help.
Fix: first-class `GoalUnreachable` state ranked above the empty-filter case, driven by unreachable-count vs filtered-count from `buildRouteResults`, naming the shortfall and offering the two amounts/deadlines that bring a route back, as `CapitalSafeNudge` already does.
Command: `/impeccable harden`

### [P0] VoiceOver cannot add a route from the list
Why: `RouteCard.tsx:130-144` is a bare Pressable, no role, no label; RN defaults `accessible` true so iOS collapses the card into one node of ~13 concatenated strings and the nested Add at `:243` becomes unfocusable. 18 interactive elements have no a11y prop at all; `accessibilityHint` appears 0 times; the min-probability slider has no label, role or value.
Fix: authored `accessibilityLabel` + `role="button"` on the card; lift Add out or set `accessible={false}` on the container with its own role/label on Add; `role="adjustable"` + `accessibilityValue` on all three sliders.
Command: `/impeccable audit`

### [P1] The risk ramp never appears on the ranking screen
Why: "ranked safest to riskiest" is the central claim and the ramp is what lets one surface serve both personas. The helpers exist in the file, unused. "Default order" tells nobody what ordered it.
Fix: `RiskScale` band on the card (3pt left rail or VERY SAFE/AGGRESSIVE chip from `displayRiskLevel`); rename default sort to "Best fit for your goal".
Command: `/impeccable colorize`

### [P1] Contrast fails across every semantic color at small sizes — 99 of 168 pairs
Measured: `Semantic.caution` #E2A33C = 2.15:1 light (used 11pt probability, 16pt stake, 22pt "Needed for goal" — fails even 3:1); `Semantic.positive` 2.72-3.02:1 at body sizes; `Semantic.negative` fails 4.5:1 in both themes; `textTertiary` fails at every size in both themes (worst 2.24:1); `Brand[500]` as link text 3.23-3.57:1 on every Edit / Show 30 more / Clear filters. Worst: `routes.tsx:597` compliance footer at `opacity: 0.4` = 1.67:1. Slider max track 1.24:1 against its card.
Fix: darkened text-only variants (`Semantic.cautionText`, `positiveText`, `Brand.text`) at >=4.5:1 for anything under 18pt; current hues for fills and bars only; footer to full-opacity `textSecondary`.
Command: `/impeccable audit`

### [P1] The "not advice" line is broken by the copy and buried by the styling
Why: "never reads as advice" is the one binding constraint. "pick" appears 6 times in shipped copy; `loaders.tsx:19` "Filtering low-edge plays…"; `MoreWaysToSave.tsx:53` "Up to $X more" (banned phrase). Only disclosure on the screen is at 1.67:1, omits "Not financial advice", and leads with "AI-generated". The tagline appears nowhere despite BRANDING.md assigning it to the routes list.
Fix: strip "pick"/"plays", drop "Up to", replace the footer with a legible line carrying the tagline and "Not financial advice", rewrite loader stages to report the real funnel.
Command: `/impeccable clarify`

### [P2] Touch targets: 28 of 34 controls under 44pt, plus a reinvented switch
Extremes: "Clear search"/"Clear filters" bare text at 20pt, "Back to latest search" 17pt, investment slider 26pt. "Add" (primary action on every row) 37pt; the button that commits money 38pt. `hitSlop` appears 5 times and reaches 44 in none. "Group by chance" is a hand-rolled On/Off pill with `role="switch"` bolted on; Sort by / Resolves / Risk are three hand-rolled segmented controls.
Fix: `minHeight: 44`, `hitSlop` where the visual can't grow, real `Switch`, `@expo/ui` or segmented control for the chip rows.
Command: `/impeccable adapt`

## Persona Red Flags

Jordan (first-timer): first screen says "Find prediction routes" — he wanted to save for a car. "Default order" means position can't be trusted. Adjacent cards read "TO HIT GOAL $2,400" and "USES $500" in the same slot. "Capital preservation" under the heading "Risk" reads as a promise. Confirm button says "Open Polymarket"; a position is written before Safari launches.

Sam (VoiceOver / Dynamic Type / contrast): cannot add a route at all. Meaning by color alone twice (score pill verdict, probability band); the interpreting words live two taps away. `minimumFontScale={0.5}` at `RouteOpportunityCard.tsx:583` renders a 22pt figure at 11pt, in Source Serif below its 18pt floor. Text under the 11pt iOS floor at default size: "/100" 9pt, "POTENTIAL PROFIT"/"USES" 10pt. Reduce Motion ignored — `useReducedMotion`/`AccessibilityInfo` = 0 matches across all of src/, while two infinite Animated.loop pulses run in the loader.

Eddie (cautious high earner): 78/100 with no working — `RouteCard.tsx:101-104` documents that risk, loss profile, yield and liquidity were deliberately removed from the card. Cannot answer "why is this first?". Can stake money from the list having seen none of the honesty. After confirming: form closes, Safari opens, no receipt.

## Emotional Journey

Peak is manufactured, end is an ejection. Seven seconds of a loader performing depth it doesn't measure — which also fires the App Store rating prompt (`routes.tsx:146-155`) before the app has answered a single question. The verdict is never stated; the user assembles "is this achievable?" out of 34 cards. A missing route shows "BELOW GOAL" at 10pt grey above +$180 at 26pt green: the card feels like a win while saying it isn't. The remembered last moment is a handoff to a third-party venue with no receipt.

## Cognitive Load — 6 of 8 failed (critical)

Passing: visual grouping, progressive disclosure. Failing: single focus, chunking, visual hierarchy, one-thing-at-a-time, minimal choices, working memory.

Over-4 decision points: asset class 7 chips; prediction topic 7 chips; chance slider 19 stops; investment amount ~24 stops plus a free-text field for the same value; filters panel with a prediction class selected 26 controls in one card; investment facts on a debt route 10 tiles. Default unfiltered state: 64 interactive controls (30 cards x 2 + header + search), 65 with the paginator.

Core inversion: largest thing on a card is the payout at 26pt; the score driving the ranking is a 13pt pill; risk is absent. The screen ranks by one thing and shouts another.

## Minor Observations

- `TrackRouteForm` opens inline mid-list with autoFocus while every other card's Add silently vanishes.
- Four TextInputs set `fontWeight` with no `fontFamily` — the custom face never applies on native, so they render in the system font beside Public Sans.
- Offline has no branch on this screen; it surfaces as the generic error card. Global `OfflineBanner` partly covers it.
- BRANDING.md contradicts itself on figures (Source Serif AND Public Sans); `themed-text.tsx:39` resolves on size alone, so headline money figures render in the serif. Fix the doc, not the code.
- `src/components/app-tabs.tsx` uses NativeTabs with real SF Symbols — a genuine platform win.
- `routes.tsx` is 773 lines holding 7 locally-defined components; `RouteOpportunityCard.tsx` is 772.

## Questions to Consider

1. If the honest answer is the product, why is it never the first thing on the screen?
2. If the risk ramp separates the saver from the speculator, should the list BE a ramp rather than a uniform stack of identical cards?
3. Should "Add" exist on a list card at all, or should the only path to money run through the working?
4. What if the loader showed the real funnel — "412 markets -> 61 priced -> 9 reach your goal"?
5. What would this screen look like if the risk dial were the only control above the fold?
