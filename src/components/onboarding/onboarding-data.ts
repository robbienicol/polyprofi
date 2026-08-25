/**
 * `name` and `welcome` draw themselves end to end; the five pitch kinds share the
 * eyebrow/title/body layout with an illustration underneath.
 */
export type SlideKind =
  | "name"
  | "welcome"
  | "scan"
  | "rank"
  | "breakdown"
  | "coach"
  | "close";

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
    id: "close",
    eyebrow: "HOW IT WORKS",
    title: "You bring the goal.\nWe do the hard part.",
    body: "Tell us what you want and we build the plan — live prices, ranked, in under a minute. Here is how.",
    kind: "close",
    cta: "Continue",
    footnote: null,
  },
  {
    id: "scan",
    eyebrow: "ONE SWEEP",
    title: "We check every way\nto grow your money",
    body: "Stocks, savings, crypto, prediction markets, sports. You would need ten apps and an afternoon. We do it in one look.",
    kind: "scan",
    cta: "Continue",
    footnote: null,
  },
  {
    id: "rank",
    eyebrow: "SIDE BY SIDE",
    title: "Then we line\nthem up for you",
    body: "Same four questions every time. How likely is it to work? What could you lose? How much do you need? How long does it take?",
    kind: "rank",
    cta: "Continue",
    footnote: null,
  },
  {
    id: "breakdown",
    eyebrow: "NO GUESSING",
    title: "Nothing is hidden\nfrom you",
    body: "Open any pick to see the live price, where it came from, and what happens if it goes wrong. You decide with your eyes open.",
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
    cta: "Let's go →",
    footnote: "A few questions next, then your plan",
  },
];

/**
 * Slide 3 — the markets one sweep covers, in the order the scan beam reaches them.
 *
 * Deliberately no prices, counts, or yields: a number on a marketing slide reads
 * as a claim about what the app found today, and none of these are live. The
 * motion is the message — five markets, one pass, a tick on each.
 */
export const SWEEP_MARKETS: { emoji: string; label: string; note: string }[] = [
  { emoji: "📈", label: "Stocks & ETFs", note: "Funds and shares" },
  { emoji: "🏦", label: "Savings & T-bills", note: "Fixed by contract" },
  { emoji: "₿", label: "Crypto", note: "Big swings" },
  { emoji: "🔮", label: "Prediction markets", note: "Will it happen?" },
  { emoji: "🏈", label: "Sports bets", note: "Live odds" },
];

/** Slide 2 — a compact cross-market comparison. */
export interface RankedPreviewRow {
  emoji: string;
  name: string;
  platform: string;
  riskLevel: number;
  note: string;
}

export const RANKED_PREVIEW: RankedPreviewRow[] = [
  {
    emoji: "📈",
    name: "VOO · S&P 500",
    platform: "Vanguard",
    riskLevel: 3,
    note: "Follows the market",
  },
  {
    emoji: "🏦",
    name: "SGOV · T-bills",
    platform: "iShares",
    riskLevel: 1,
    note: "Fixed by contract",
  },
  {
    emoji: "🎯",
    name: "Heat win · Yes 58¢",
    platform: "Polymarket",
    riskLevel: 3,
    note: "All or nothing",
  },
  {
    emoji: "₿",
    name: "BTC",
    platform: "Coinbase",
    riskLevel: 5,
    note: "Swings hard",
  },
  {
    emoji: "🎲",
    name: "4-leg parlay",
    platform: "Sportsbook",
    riskLevel: 5,
    note: "All four must land",
  },
];

/** Slide 3 — the route facts users can inspect directly. */
export interface BreakdownFactor {
  label: string;
  value: string;
}

export const BREAKDOWN_FACTORS: BreakdownFactor[] = [
  { label: "Chance of hitting goal", value: "70%" },
  { label: "What could go wrong", value: "Market can drop" },
  { label: "Cash you need", value: "$286" },
  { label: "Time to pay out", value: "12 months" },
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
  { role: "user", text: "Why is VOO first and not the parlay?" },
  {
    role: "coach",
    text: "The parlay pays more, but all four legs have to land — about a 6% shot, and a miss loses everything. VOO pays less and risks less.",
  },
];

/** Slide 5 — closing proof points. Each maps to a real screen in the app. */
export const CLOSING_PROOF: { emoji: string; label: string }[] = [
  { emoji: "🧭", label: "Every option in one list" },
  { emoji: "🧾", label: "The math behind each pick" },
  { emoji: "💬", label: "An AI to ask while you decide" },
];
