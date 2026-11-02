# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

Shipped to the App Store only (`eas.json` submits iOS; ASC app id 6789668562,
categories Finance / Productivity, `gambling: false`). `app.json` also carries
Android and web config, but Android has no submit profile and the web target
exists to serve Expo Router API routes (`web.output: "server"`) and as a QA
preview surface — not as a product people use. Design for iOS.

## Users

One app, two ends of the same map; the user self-selects through the goal and
the risk dials rather than through a segmented onboarding.

- **The cautious saver** ("Eddie" in `PITCH_INTERNAL.md`): real disposable
  income, little investing knowledge, afraid of looking dumb or being scammed,
  tolerant of risk only when the process is legible. Currently does nothing
  systematic.
- **The speculator**: already betting or trading prediction markets, and wants
  the same scoring applied to a parlay that gets applied to a T-bill.

Both arrive with a number, a deadline and a risk appetite, and leave with a
ranked set of routes. Neither is being sold picks.

## Product Purpose

The user states a concrete goal — an amount, a deadline, a risk tolerance — and
Pathey prices every route to it, ranked safest to riskiest, with an honest
probability attached to each. It spans savings and treasuries, ETFs, crypto,
card rewards, spending cuts, sports markets and prediction markets on one
risk/reward map. When the goal does not add up in the time given, the product
says so.

Success is the user knowing what is actually achievable with their money, and
trusting the number enough to act on it somewhere else.

## Positioning

Not a picker and not an executor: a compass. Every avenue is scored by one
identical model, so a Roth IRA and a Polymarket contract are directly
comparable — something neither a robo-advisor (speculative avenues absent) nor
a tout (no honest denominator) can truthfully claim. The de-vig and consensus
engine, and the calibration behind the probabilities, are the mechanism; the
honesty is the brand.

## Operating Context

- Phone in hand, usually deciding rather than monitoring.
- Goal-first flow: onboarding and quiz capture profile and risk, goal setup
  captures the number and deadline, routes rank against it, a route detail
  opens the working and an AI coach, and the user is handed off to the venue
  where they actually trade.
- Optional bank connection (Plaid) grounds the numbers in real balances and
  surfaces spending-cut and card-reward routes.
- Portfolio and goal screens track progress after the fact; tracked bets and
  positions are reconciled against live market data.
- Ten live data sources feed the engine (odds, prediction markets, crypto,
  equities, sentiment, AI search).

## Capabilities and Constraints

- Expo SDK 56 / React Native 0.85, Expo Router, React Query for all fetching,
  Clerk auth, Neon Postgres, NativeWind + a token theme in
  `src/constants/theme.ts`.
- Pathey never executes a trade or holds money. It routes out, with each
  venue's fee shown.
- **Commercial stage: early access, free.** `FEATURE_FLAGS.paywallEnabled` is
  off and no StoreKit billing exists; `src/app/early-access.tsx` is the live
  gate. The $9.99/mo subscription in older documents is an unresolved future,
  not current truth — do not design as though the product is paid.
- Terminology: **routes** (never "picks" or "recommendations"), **score**,
  **the working**, **risk ramp**, **goal**. "GPS for money" is internal
  shorthand and does not ship.
- Undecided: the recurring-value model, whether calibration has been
  back-tested against real outcomes, and the regulatory read. All three are
  open in `PITCH_INTERNAL.md` and none should be implied as settled in UI copy.

## Brand Commitments

Name **Pathey** (lowercase in code, URLs and handles; "PolyProfit" survives only
as the repo name, Expo slug and bundle id). Tagline **"Not advice. Just the
math."** ships with the wordmark. Voice: short sentences, full stops not
exclamation marks; numbers specific or absent. Banned words: "guaranteed",
"safe", "best returns", "easy money", "up to".

Full voice, claims, icon geometry and type rationale live in `BRANDING.md`;
tokens in `DESIGN.md` and `src/constants/theme.ts`. Both are binding.

## Evidence on Hand

- Working engine with ten verified live integrations, de-vig + consensus,
  calibrated playbook matrix, parlay builder, route scoring.
- Real screenshots and marketing assets in `store-screenshots/` and
  `marketing/`; App Store listing metadata in `store.config.json`.
- Shipped builds: 1.0.1 on TestFlight.
- **No user testimonials, case studies, press, benchmark numbers or track
  record exist.** As of `PITCH_INTERNAL.md` (2026-06-24) there were zero users
  outside the founder and the calibration back-test had not been run. Never
  fabricate a user count, a hit rate, a return figure or a quote.

## Product Principles

1. **The honest answer beats the flattering one.** Saying the goal does not add
   up in the time given is a feature, and it ships at the same weight as a
   route that works.
2. **One model, every avenue.** No route class gets softer math or a friendlier
   frame because of what it is.
3. **The user picks; we price.** Pathey ranks against the user's own number,
   deadline and risk. It never chooses for them.
4. **A number that can't be opened is a claim.** Scores exist to be traced back
   to their inputs.
5. **The saver and the speculator share one surface.** The risk ramp, not a
   segmented app, is what separates them.

## Accessibility & Inclusion

No product-specific standard has been established beyond the contrast rules
already binding in `DESIGN.md` (dark text on brand; one meaning per semantic
color, never color alone as the carrier of meaning).
