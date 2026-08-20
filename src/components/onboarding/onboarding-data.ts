export interface OnboardingSlide {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  kind: 'scan' | 'rank' | 'breakdown' | 'coach' | 'close';
}

/**
 * The pitch, in order: we scan everything → you compare the options → you can inspect
 * the underlying facts → a coach explains them → your goal turns into a plan. Every
 * claim here has to map to something the app actually does — no invented stats.
 */
export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'scan',
    eyebrow: 'STOP GUESSING',
    title: 'We scan every way\nto grow your money',
    body: 'Stocks, treasuries, crypto, prediction markets, sports lines — priced live, in one sweep. What used to take ten apps and an hour now takes one glance.',
    kind: 'scan',
  },
  {
    id: 'rank',
    eyebrow: 'ONE CLEAR COMPARISON',
    title: 'Then compare them.\nSide by side.',
    body: 'See each option through the same lens: chance of hitting your goal, downside, cash required, and time to payout.',
    kind: 'rank',
  },
  {
    id: 'breakdown',
    eyebrow: 'RECEIPTS, NOT VIBES',
    title: 'See the exact math\nbehind every pick',
    body: 'Open any route for the full breakdown — the live price, source, cash required, timeframe, and what happens if it goes against you.',
    kind: 'breakdown',
  },
  {
    id: 'coach',
    eyebrow: 'AN ANALYST THAT NEVER SLEEPS',
    title: 'Ask why. Get a\nstraight answer.',
    body: 'The coach reads every number on the card. Why it ranks first, what would kill it, how much to put in — plain English, in seconds, any hour of the day.',
    kind: 'coach',
  },
  {
    id: 'close',
    eyebrow: 'YOUR MOVE',
    title: 'Stop watching.\nStart winning.',
    body: 'Give us your amount, your target, your deadline. Get a ranked plan built from live markets in under a minute — the edge people used to pay analysts for.',
    kind: 'close',
  },
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
  { emoji: '📈', name: 'VOO · S&P 500', platform: 'Vanguard', riskLevel: 3, note: 'Market exposure' },
  { emoji: '🏦', name: 'SGOV · T-bills', platform: 'iShares', riskLevel: 1, note: 'Contractual yield' },
  { emoji: '🎯', name: 'Heat win · Yes 58¢', platform: 'Polymarket', riskLevel: 3, note: 'All-or-nothing' },
  { emoji: '₿', name: 'BTC', platform: 'Coinbase', riskLevel: 5, note: 'High volatility' },
  { emoji: '🎲', name: '4-leg parlay', platform: 'Sportsbook', riskLevel: 5, note: 'Four outcomes required' },
];

/** Slide 3 — the route facts users can inspect directly. */
export interface BreakdownFactor {
  label: string;
  value: string;
}

export const BREAKDOWN_FACTORS: BreakdownFactor[] = [
  { label: 'Chance of hitting goal', value: '70%' },
  { label: 'Downside', value: 'Market can decline' },
  { label: 'Cash required', value: '$286' },
  { label: 'Time to payout', value: '12 months' },
];

/** Slide 4 — scripted coach exchange. Mirrors what RouteCoach answers about. */
export interface CoachTurn {
  role: 'user' | 'coach';
  text: string;
}

/** Starter prompts shown in the coach panel — the kinds of question it actually fields. */
export const COACH_STARTERS: string[] = ['Why #1?', 'What could go wrong?', 'How much should I put in?'];

export const COACH_SCRIPT: CoachTurn[] = [
  { role: 'user', text: 'Why is VOO first and not the parlay?' },
  {
    role: 'coach',
    text: 'The parlay pays more, but all four legs have to land — roughly a 6% shot, and a miss takes the whole stake. VOO has a different payoff and downside profile.',
  },
];

/** Slide 5 — closing proof points. Each maps to a real screen in the app. */
export const CLOSING_PROOF: { emoji: string; label: string }[] = [
  { emoji: '🧭', label: 'Every option in one comparison' },
  { emoji: '🧾', label: 'Full math and sources on each pick' },
  { emoji: '💬', label: 'AI coach on call while you decide' },
];
