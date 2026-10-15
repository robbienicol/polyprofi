# Pathey — product briefing for LightReel

LightReel writes the script. This file is what you paste in so it knows what the
product is, what's genuinely differentiated, and what it is legally not allowed to say.

---

## Paste this into LightReel

```
PRODUCT BRIEF — write the script from this. Do not invent features or numbers.

THE APP
Pathey. An iOS app. Tagline: "Not advice. Just the math."
It's a GPS for money. You tell it the goal — the amount, the deadline, and how much
you have — and it ranks every route that could get you there, safest first, each one
scored out of 100. It does not pick for you and it never promises a return.

WHO IT'S FOR
Someone with real disposable income and no investing background, who's sick of
choosing between boring advice they don't understand and hyped-up tips from people
with no accountability. They think in goals — "$600 by March", "a deposit by
summer" — not in asset classes.

WHAT MAKES IT DIFFERENT (lead with these — this is the video)

1. Prediction markets, screened properly. This is our edge and nobody else has it.
   Pathey pulls live Polymarket and Kalshi markets and treats them as a real asset
   class, then gives you screening tools that don't exist anywhere else:
   - Kalshi vs Polymarket price comparison on the same contract, showing which venue
     is cheaper and by how many cents.
   - Filter by topic — sports, politics, crypto, finance, pop culture.
   - Filter by when the market actually resolves: days, weeks, or months. So you can
     find only the ones that settle before your deadline.
   - Filter by loss profile: all-or-nothing versus capital preservation.
   - Sort by best chance, biggest return, or best expected value.
   Retail traders currently do this by hand across two websites and a spreadsheet.

2. One list, one score. A treasury bill, an index fund, crypto and a Polymarket
   position are scored by the same math and sit in the same ranked list. Nobody else
   puts a Roth IRA and a prediction market on one map.

3. The AI coach. Every route opens into a chat with a coach that knows that specific
   route. Ask it why this ranks where it does, what could go wrong, or how much to
   put in — and it answers on that route's actual numbers. It talks you through the
   pick instead of just handing you one.

4. You decide what "best" means. Four dials: chance of hitting it, protecting your
   money, using less cash, getting there sooner. Drag them and the whole list
   re-ranks live to your definition of good, not ours.

5. Every score shows its working. Tap a score and you see how it was built, including
   why a route got capped — like maturing after your deadline. No black box.

6. It tells you when the goal doesn't add up. If the number isn't reachable in the
   time given, it says so. The app that tells you no is the one you can trust.

7. Then it tracks it. It hands you off to the venue where you actually trade, then
   watches the position against your goal and shows the distance left to run.

TONE
Calm, dry, level. Confident without hype. This is a map, not a tip sheet. Short
sentences, full stops, no exclamation marks. Never sound like a finance guru.

HARD RULES — a finance app, these get us rejected or fined
- No returns, no win rates, no profit figures, no performance claims of any kind.
- Never the words: guaranteed, safe, risk-free, best returns, easy money, beat the
  market, make money fast.
- A dollar amount may only appear as a goal the user typed, never as a result.
- Never phrase anything as a recommendation to buy a specific thing.
- End on: "Not financial advice. Investing involves risk, including loss of capital."

FORMAT
45 seconds, 9:16 vertical. Open on the goal ("you know the number, not the route"),
spend the most time on prediction-market screening and the AI coach, close on
"Not advice. Just the math."

LOOK
Warm near-black background (#141312). Terracotta (#D9653D) is the only saturated
colour in frame. Cool desaturated shadows, one warm light source, shallow depth of
field, slow deliberate camera, subtle grain.

NOTE ON SCREENS
Do not attempt to render the app's interface — leave gaps for real screen
recordings at: goal setup, the ranked routes list, the prediction-market filters,
the Kalshi vs Polymarket comparison, and the AI coach conversation.
```

---

## Screen recordings — already captured

Raw simulator takes in `marketing/captures/` (1206x2622, iPhone 16 Pro, real live
Polymarket data). Not trimmed — each has dead air at the head and tail where the
gesture was set up, so pull the useful stretch in the editor.

| File | Length | What's in it |
| --- | --- | --- |
| `01-routes-list.mp4` | 28s | Ranked list scrolling — live Polymarket cards, `/100` badges, Safe labels, chance-of-hitting bars |
| `02-prediction-filters.mp4` | 63s | Tapping **Prediction markets** reveals the facets, then Sports + Weeks filter the list. The differentiator shot |
| `03-route-detail.mp4` | 95s | One route end to end: risk breakdown, exit plan, potential outcome, track-record calibration, SCORE MATH working, THE PLAN, then a real AI Coach question and answer |
| `04-score-weights.mp4` | 61s | Dragging *Protecting your money* to 57% — the other three re-weight live and the list re-ranks |
| `05-home-goals.mp4` | 32s | Home tracked-value chart, goals with distance to go, portfolio |

Best single frames: the SCORE MATH card (shows its own arithmetic and why it capped
the score), and THE PLAN paragraph, which says in the app's own words that a route
has no edge unless you think the market is wrong.

End card: wordmark `PATHEY` / `NOT ADVICE. JUST THE MATH.` / App Store badge, then
the 2s disclaimer card in terracotta on `#141312`.

## Two things to fix before this footage ships

1. Route cards and the coach's opening line show **"+$350 potential profit"**. That
   is a forward-looking money figure on camera — exactly what the compliance rules
   above forbid, and the riskiest thing in the frame for App Store review. Either
   crop those cards out or change the ad to only show goal figures.
2. The Track record card renders **"Polymarket NaN%"** under "Buying every one of
   them". A visible NaN in a marketing video is a credibility hit — fix or avoid.
