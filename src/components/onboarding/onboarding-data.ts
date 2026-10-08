/**
 * `name` and `welcome` draw themselves end to end; the five pitch kinds share the
 * eyebrow/title/body layout with an illustration underneath.
 */
export type SlideKind =
  | "name"
  | "welcome"
  | "quiz"
  | "score"
  | "scan"
  | "rank"
  | "breakdown"
  | "coach"
  | "math";

export interface OnboardingSlide {
  id: string;
  eyebrow: string;
  title: string;
  body?: string;
  kind?: SlideKind;
  /** Button label for this slide. */
  cta: string;
  /** The line under the button. Null leaves it out. */
  footnote: string | null;
}

/**
 * The run, in order: your name → hello → what you get → how it is built.
 *
 * The promise ("tell us your goal, we do the rest") lands before the mechanics,
 * so the three slides after it read as how that promise is kept rather than as
 * a list of features.
 *
 * The name comes first and nothing is explained before it, which is the whole
 * point: the greeting on the second slide, and every screen after it, reads as
 * someone talking to you rather than a form collecting from you.
 *
 * The terms live on that first slide too, under its button, so they are agreed to
 * before a single answer is collected rather than somewhere in the middle.
 *
 * Copy rules. Short words, short sentences, no metaphors — anyone should be able
 * to read a slide once and know what it means. And the voice is a hand on the
 * shoulder: deciding to do something about your money is a good decision, this
 * app is the easy way to follow through on it, and nobody is on their own from
 * here. Encouraging, never flattering, and never talking down.
 *
 * Every claim also has to map to something the app really does — no invented stats.
 */
export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "name",
    eyebrow: "FIRST THINGS FIRST",
    title: "What's your name?",
    body: "Just a first name. From here on it is you and us, so we should know what to call you.",
    kind: "name",
    cta: "Continue",
    // The legal line is rendered by the screen, not from here — it carries links.
    footnote: null,
  },
  {
    id: "welcome",
    eyebrow: "",
    title: "",
    body: "",
    kind: "welcome",
    cta: "Show me",
    footnote: null,
  },
  {
    id: "quiz",
    eyebrow: "ONE MINUTE",
    title: "A couple questions\nabout your priorities",
    body: "First we ask a couple questions to get a sense of your financial priorities. That's what shapes your Score.",
    kind: "quiz",
    cta: "Continue",
    footnote: null,
  },
  {
    id: "score",
    eyebrow: "YOUR NUMBER",
    title: "Then we use that\nto build your Score",
    body: "Every option you see gets one number, 0 to 100: how likely it is to work, what you could lose, how much cash it needs, and how long it takes.",
    kind: "score",
    cta: "Continue",
    footnote: null,
  },
  {
    id: "scan",
    eyebrow: "ONE SWEEP",
    title: "We check every way\nto hit your goal",
    body: "Spend less. Save it. Invest it. Bet on an outcome. We check all of it — one look, not ten apps.",
    kind: "scan",
    cta: "Continue",
    footnote: null,
  },
  {
    id: "rank",
    eyebrow: "ONE NUMBER",
    title: "Then we give\nyou a score",
    body: "0 to 100, built from four things: how likely it is to work, what you could lose, how much cash it needs, and how long it takes.",
    kind: "rank",
    cta: "Continue",
    footnote: null,
  },
  {
    id: "breakdown",
    eyebrow: "NO GUESSING",
    title: "Nothing is hidden\nfrom you",
    body: "Open any pick to see where the numbers come from and what happens if it doesn't work out. You decide with your eyes open.",
    kind: "breakdown",
    cta: "Continue",
    footnote: null,
  },
  {
    id: "coach",
    eyebrow: "YOU ARE NOT ALONE",
    title: "Stuck? Just ask.",
    body: "Our AI reads every number on the card and explains it in plain English. No stupid questions, any hour of the day.",
    kind: "coach",
    cta: "Continue",
    footnote: null,
  },
  {
    id: "math",
    eyebrow: "NOT ADVICE",
    title: "One more thing.\nThis isn't advice.",
    body: "We don't have opinions on what you should buy. Every option runs through the same formula, the same way, every time. The number is math — what you do with it is yours.",
    kind: "math",
    cta: "Let's go →",
    footnote: "A few questions next, then your plan",
  },
];

/**
 * Slide 3 — the ways one sweep covers, in the order the scan beam reaches them.
 *
 * Deliberately no prices, counts, or yields: a number on a marketing slide reads
 * as a claim about what the app found today, and none of these are live. The
 * motion is the message — one pass, a tick on each.
 *
 * Cutting spending leads, ahead of any market: it is the one way here that is not
 * a bet, needs no cash up front, and is the actual pitch — this app is not only
 * "where to put your money," it is "every way to hit the number," and stopping a
 * subscription counts as much as buying an ETF. The rest runs safe to speculative.
 *
 * One row per class the search really routes to, and no more: a row here is a promise
 * the quiz has to be able to keep. Sport is covered inside prediction markets rather
 * than listed beside them, which is where the markets actually are.
 */
export const SWEEP_MARKETS: { emoji: string; label: string; note: string }[] = [
  { emoji: "✂️", label: "Cut spending", note: "Subscriptions, coffee, etc." },
  { emoji: "🏦", label: "Savings & T-bills", note: "Fixed by contract" },
  { emoji: "📈", label: "Stocks & ETFs", note: "Funds and shares" },
  { emoji: "₿", label: "Crypto", note: "Big swings" },
  {
    emoji: "🔮",
    label: "Prediction markets",
    note: "Politics, sports, world events",
  },
];

/**
 * Slide 2 — a compact cross-market comparison, each row carrying the same score
 * the real route detail screen computes (see `goalEffectivenessScore` in
 * src/lib/score.ts) so the demo numbers read as real, not decorative.
 *
 * The two spending cuts lead, and score highest: no cash down and nothing to
 * lose scores better under the real formula than any market bet, so the list is
 * ordered by score rather than by market/spending-cut grouping — the point is
 * that a cut competes on the same board as a stock, and can win.
 */
export interface RankedPreviewRow {
  emoji: string;
  name: string;
  platform: string;
  riskLevel: number;
  score: number;
  note: string;
  /** Nothing at risk and nothing staked — a spending cut, not a market bet. */
  guaranteed?: boolean;
  /**
   * Chance of hitting the goal, 0-100 — the same meter the real route card
   * shows (see the probability bar in RouteCard.tsx). A spending cut is
   * certain once you do it; a contract's is the market-implied price.
   */
  probability: number;
}

export const RANKED_PREVIEW: RankedPreviewRow[] = [
  {
    emoji: "💳",
    name: "Switch cards for gas",
    platform: "Chase",
    riskLevel: 1,
    score: 91,
    note: "Not your Sapphire Reserve · $0 needed",
    guaranteed: true,
    probability: 100,
  },
  {
    emoji: "🎬",
    name: "Cancel Netflix",
    platform: "You",
    riskLevel: 1,
    score: 88,
    note: "$0 needed · nothing at risk",
    guaranteed: true,
    probability: 100,
  },
  {
    emoji: "📈",
    name: "VOO · S&P 500",
    platform: "Vanguard",
    riskLevel: 3,
    score: 82,
    note: "Follows the market",
    probability: 72,
  },
  {
    emoji: "🏦",
    name: "SGOV · T-bills",
    platform: "iShares",
    riskLevel: 1,
    score: 75,
    note: "Fixed by contract",
    probability: 99,
  },
  {
    emoji: "🎯",
    name: "Heat win · Yes 58¢",
    platform: "Polymarket",
    riskLevel: 3,
    score: 64,
    note: "58% market-implied",
    probability: 58,
  },
];

/**
 * "The Score™" slide — the same four inputs, and the same default weights, the
 * real score formula (`goalEffectivenessScore` in src/lib/score.ts) actually
 * uses (`DEFAULT_SCORE_WEIGHTS`), so the percentages shown are not made up —
 * they are what the formula starts every route at before someone customizes it.
 */
export const SCORE_FACTORS: {
  emoji: string;
  label: string;
  note: string;
  weight: number;
}[] = [
  {
    emoji: "🎯",
    label: "Chance it works",
    note: "How likely the route is to actually reach your number",
    weight: 35,
  },
  {
    emoji: "📉",
    label: "What you could lose",
    note: "How much of your money is at risk if it goes wrong",
    weight: 25,
  },
  {
    emoji: "💵",
    label: "Money you need",
    note: "How much you have to put in up front — less is better",
    weight: 30,
  },
  {
    emoji: "⏳",
    label: "How long it takes",
    note: "How soon it pays out, and whether that's before your deadline",
    weight: 10,
  },
];

/** Final slide — the disclaimer, plain rather than legalese. */
export const MATH_DISCLAIMER: string[] = [
  "Not financial advice",
  "Not a recommendation to buy or sell anything",
  "The formula is the same for everyone — what you do with the number is up to you",
];

/** Slide 3 — the route facts users can inspect directly. */
export interface BreakdownFactor {
  emoji: string;
  label: string;
  value: string;
}

export const BREAKDOWN_FACTORS: BreakdownFactor[] = [
  { emoji: "🎯", label: "Chance it works", value: "70%" },
  { emoji: "⚠️", label: "What could go wrong", value: "Market dips" },
  { emoji: "💵", label: "Money you need", value: "$286" },
  { emoji: "⏳", label: "How long it takes", value: "12 months" },
];

/** Slide 4 — scripted coach exchange. Mirrors what RouteCoach answers about. */
export interface CoachTurn {
  role: "user" | "coach";
  text: string;
}

/** Starter prompts shown in the coach panel — the kinds of question it actually fields. */
export const COACH_STARTERS: string[] = [
  "Why #1?",
  "What could go wrong?",
  "How much should I put in?",
];

export const COACH_SCRIPT: CoachTurn[] = [
  { role: "user", text: "Why is VOO first and not the 6¢ contract?" },
  {
    role: "coach",
    text: "The contract returns more, but the market only gives it a 6% chance, and if it resolves No the position is worth nothing. VOO returns less and risks less.",
  },
];

/** Slide 5 — closing proof points. Each maps to a real screen in the app. */
