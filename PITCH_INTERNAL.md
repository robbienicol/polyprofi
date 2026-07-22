# PolyProfit — Internal Pitch Breakdown

> INTERNAL ONLY. Includes honest criticisms and open risks. Do not show to investors verbatim — pull the strong parts into the deck, keep the "Risks & Hard Truths" section for yourself.
> Date: 2026-06-24 · Stage: pre-product, no users yet · Source: /office-hours session + design doc

---

## 1. One-liner

**PolyProfit is a GPS for money: tell it your goal and risk, and it shows you the honest, ranked routes to get there — across savings, stocks, crypto, sports, and prediction markets.**

Alt framings to test in the deck:
- "Google Maps for your money goal."
- "The app that tells you what's actually achievable with your money — and what isn't."
- "One honest answer instead of ten conflicting hot takes."

---

## 2. The Idea

A user sets a concrete goal — "$8,000 → $9,000 in 1 year, as safe as possible" — and PolyProfit returns a ranked set of "routes" calibrated to that goal: the math-best vehicle, the real probability of hitting it, the expected return, and the risk profile. Routes span every money-making avenue on one risk/reward map, from a T-bill to a parlay.

The wedge (what we sell first): **the honest answer, not picks.**  this is a tough call. ai was saying like amazon sold books before they sold everything, netflix sent cd's before they became the center of movies, what do we target as a neiche before expanding to every single person that want to make money? i think the wedge is the safety percentage meter and putting a number to the risk you take when doing x options but we need to xpand and find a pocket of people. like are we selling to sports degens or smart money people

---

## 3. Problem

People with disposable income want to grow it but don't know how. They're stuck between:
- **Fragmentation** — answers scattered across Reddit, X, paid Discords, touts, YouTube. Conflicting, unaccountable, often dishonest.
- **No calibration** — no trustworthy way to know what's *actually achievable* for their money, goal, and timeframe.
- **Trust vacuum** — the loudest voices (touts, hype accounts) are the least trustworthy; the trustworthy options (index funds, advisors) feel inaccessible or boring.

The cost to the user: wasted time, conflicting signals, and money lost chasing bad picks.

---

## 4. Why Now

- **AI made the engine buildable solo.** Ten live data sources, a de-vigging consensus model, calibrated probabilities, auth, payments — built by one person. A few years ago this was a 5-engineer, multi-month effort.
- **Retail participation is structurally high** across sports betting (legalized in most US states), crypto, and retail stock trading.
- **Distrust of touts/hype is at a peak** — an honesty-first positioning is differentiated in a market saturated with hopium.

---

## 5. Target User / Beachhead

**"Eddie"** — the named first customer.
- High income (e.g. a superintendent / skilled trades / professional), real disposable income.
- Financially unsophisticated, knows little about investing.
- Cautious; afraid of looking dumb or getting scammed with his money, but doesnt mind some risk as long as he trusts the process
- Currently does nothing systematic, or dabbles based on scattered advice.

Why Eddie is the wedge: he has money + no knowledge + a trust problem. He's reachable (founder knows him and his network of trades/professionals). He is NOT the degenerate gambler the product's flashier features were built for — which is the central strategic correction (see §13).

---

## 6. Product / How It Works (the engine)

Already built and verified working:
- **10 live data sources:** OpenAI (gpt-4o), Grok (live X/web search), odds-api.io (sportsbook odds, 34 sports), Reddit (via RapidAPI scrape of daily pick threads), OKX (crypto funding), CoinGecko, Yahoo Finance, Polymarket, ESPN, Fear & Greed Index.
- **De-vig + consensus engine:** strips the bookmaker margin from odds to get the true implied probability, then ensembles sportsbook + prediction market + analyst lean into an edge. (This math is the trust mechanism.)
- **Calibrated playbook matrix:** for any (target %, timeframe), returns the statistically-best vehicle and honest hit probability (e.g. 1% in 1 year → T-bill/HYSA at ~99%; 100% in a day → OTM options at ~2%).
- **Parlay builder:** stacks favorite legs to a target multiple with honest combined odds + true hit chance (e.g. $10 → ~$1,186 at 1.4%).
- **Route cards + detail screens:** ranked safe→risky, with probability meters, strategy, and on-demand AI "deeper analysis."
- **Auth, $9.99/mo paywall, share-to-unlock first result** (built-in referral primitive).

---

## 7. Business Model

- Subscription: **$9.99/mo** (already implemented).
- Built-in viral loop: **share-to-unlock** first results free, pay after.
- Open question (internal): does a "tell me the truth" product justify a *recurring* subscription, or does the honest answer get consumed once? Possible reframes: ongoing monitoring ("alert me when my goal becomes achievable"), progress tracking, periodic re-planning. **Must resolve before scaling.**

---

## 8. Market (rough — VERIFY before putting numbers on a slide)

Do not fabricate precise TAM. Directionally:
- US legal sports betting handle: tens of billions/yr.
- US retail investors: ~tens of millions of people.
- Crypto retail holders: tens of millions in the US.
- Personal-finance / robo-advisor apps (Betterment, Wealthfront, Robinhood) serve millions.

Honest framing for the deck: bottom-up, not top-down. "If 100k Eddies pay $9.99/mo = ~$12M ARR." Lead with the beachhead math, not a $X billion TAM hand-wave.

---

## 9. Competition / Status Quo

| Category | Examples | Why we're different |
|---|---|---|
| Touts / pick-sellers | Discords, X accounts, paid tipsters | We aggregate + de-vig + tell the truth; we don't sell hopium |
| Robo-advisors | Betterment, Wealthfront | We cover *all* avenues incl. speculative, goal-first, honest about odds |
| Brokerages | Robinhood, Coinbase | They execute; they don't tell you *what's achievable* for your goal |
| Fragmented free sources | Reddit, X, YouTube | We're the single honest aggregated answer vs ten conflicting ones |

The real competitor for Eddie's safe money is "just buy VOO" / his bank / a human advisor — all trusted and cheap. That's the bar.

---

## 10. Go-To-Market

- **Beachhead:** Eddie + his network (trades, professionals with income + low financial literacy). Direct outreach, not paid ads, for first users.
- **Wedge product:** the honest goal → probability → best-vehicle answer. Demote parlays/longshots from the headline for this audience.
- **Viral primitive:** share-to-unlock already in the app.
- **Sequence:** prove Eddie pays for honesty → expand avenue coverage → grow toward the universal "GPS for money" vision.

---

## 11. Moat / Defensibility

- The **unified risk/reward model** across all avenues (the GPS metaphor) — hard to copy well, easy to describe.
- **Honesty-first brand** in a hype-saturated market — positioning moat.
- **Calibration quality** — IF the math is provably calibrated over time, that becomes a real, defensible track record. (Also the biggest technical risk — see §13.)

---

## 12. Traction (honest)

- Product: substantially built, all integrations live and verified.
- Users: **zero outside the founder.** No demand evidence yet beyond "people say it's cool" (which is not evidence).
- Next proof point: 5 user interviews + 10 paying, non-friend users who renew once.

---

## 13. Risks & Hard Truths (INTERNAL — keep for yourself)

These are the criticisms from the session. Don't hide from them; they're your real to-do list.

1. **No demand evidence.** You built the answer before confirming anyone's asking. "Everyone thinks it's cool" = the sound a problem makes when it isn't painful enough to pay for.
3. **Trust is everything and you have none.** Consultants get paid for track record + accountability. A brand-new AI black box has neither. "Trust the math" only works if the math is verifiably right. - i have ideas for this 
4. **The math is the moat AND the biggest risk.** If your calibrated probabilities and de-vig outputs are wrong, the honesty wedge inverts into a liability. **Back-test calibration against real outcomes before showing it to real users.** Currently treated as solved — it isn't. - i think this is an inherient risk that people take all the time 
5. **Regulatory exposure.** Telling a high-income novice "the math-best vehicle for your goal is X" is close to regulated investment advice regardless of "not financial advice" disclaimers. Could block the saver path entirely. Get a real read (SEC/state RIA safe-harbor, publisher's exemption, 30-min securities-lawyer consult) before scaling.
6. **Two halves fight each other.** Sports betting reads "scam/tout"; investment advice reads "regulated." Stapling them together can leak credibility from the advice side. Sequence carefully.
7. **Retention.** When the honest answer is "do nothing / not achievable," will Eddie keep paying $9.99/mo? Recurring value model is unresolved.
8. **Churn from losing picks.** Your own math says most speculative picks lose. Users read a loss as "this app is wrong," not "variance." Honesty-first framing helps but doesn't eliminate this.

---

## 14. The One Thing To Prove Next (the assignment)

Before any more code: **talk to Eddie + 4 more like him this week.** Don't demo. Ask what they last did with spare money and what they'd pay to stop feeling unsure. Then show ONE screen — the honest "here's what's realistically achievable" answer — and watch their face.

**The question that decides the company: do they pay for the truth, or do they only want the fantasy?** Bring back one real quote each by 2026-07-01.

---

## 15. Pitch Deck Outline (slide-by-slide)

1. **Title** — PolyProfit + one-liner ("GPS for money").
2. **Problem** — fragmentation, no calibration, trust vacuum. Show the 10-conflicting-tabs reality.
3. **Insight** — everything is one risk/reward map; people don't need more picks, they need the honest answer.
4. **Product** — goal in → ranked honest routes out. Screenshot of the honest-answer screen.
5. **Demo / How it works** — the engine: aggregate → de-vig → calibrate → rank. (Credibility slide.)
6. **Why now** — AI made the engine solo-buildable; retail participation high; distrust of hype peaking.
7. **Target user** — Eddie. Make him real and specific.
8. **Wedge & GTM** — honest answer first; Eddie's network; share-to-unlock loop.
9. **Business model** — $9.99/mo + viral unlock; bottom-up ARR math.
10. **Market** — bottom-up ("100k Eddies = ~$12M ARR"), not top-down hand-wave.
11. **Competition** — the 2x2 / table from §9; the real bar is "just buy VOO."
12. **Moat** — unified model + honesty brand + calibration-as-track-record.
13. **Traction & roadmap** — honest: pre-product, first proof = 10 paying renewing users; the calibration back-test; regulatory read.
14. **Team** — solo technical founder who built the whole thing; relentless + resourceful.
15. **Ask** — what you want (if raising) or the milestone you're driving to.

> Deck rule: do NOT lead with parlays or "$10 → $1,000." Lead with honesty and calibration. The casino stuff is an upsell, not the headline.

---

## 16. Founder Resources (the videos)

- **How To Talk To Users** (20 min, Gustaf Alströmer) — your assignment in video form. https://www.youtube.com/watch?v=z1iF1c8w5Lg
- **Why Startup Founders Should Launch Companies Sooner Than They Think** (12 min, Tyler Bosmeny) — get out of the build cave, test now. https://www.youtube.com/watch?v=Nsx5RDVKZSk
- **The New Way To Build A Startup** (8 min, Garry Tan) — the solo + AI "20x company" playbook; your build pattern is an advantage. https://www.youtube.com/watch?v=rWUWfj_PqmM

Bonus, relevant to your situation:
- **How to Get and Evaluate Startup Ideas** (Jared Friedman) — https://www.youtube.com/watch?v=Th8JoIan4dg
- **Vertical AI Agents Could Be 10X Bigger Than SaaS** (Lightcone) — https://www.youtube.com/watch?v=ASABxNenD_U

---

## 17. Approved Design Doc

Full strategic doc (premises, approaches, success criteria): `~/.gstack/projects/polyprofit/robbienicol-master-design-20260624-113608.md`
