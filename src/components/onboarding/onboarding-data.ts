export interface OnboardingSlide {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  kind: 'scan' | 'rank' | 'breakdown' | 'coach' | 'close';
}

/**
 * The pitch, in order: we scan everything → we rank it by value → you can audit the
 * ranking → a coach explains it → your goal turns into a plan. Every claim here has to
 * map to something the app actually does (the universes in lib/*-routes.ts, the score in
 * lib/score.ts, the breakdown on route/[id], RouteCoach) — no invented stats.
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
    eyebrow: 'RANKED, NOT RANDOM',
    title: 'Then we rank them.\nBest one on top.',
    body: 'Every option gets one 0–100 value score: chance of hitting your goal, capital safety, cash required, time to payout. No more guessing which tab had the good idea.',
    kind: 'rank',
  },
  {
    id: 'breakdown',
    eyebrow: 'RECEIPTS, NOT VIBES',
    title: 'See the exact math\nbehind every pick',
    body: 'Open any route for the full breakdown — the live price it came from, how the score was built, what happens if it goes against you. If we can\'t show our work, it doesn\'t rank.',
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

/** Slide 2 — an honest-looking leaderboard: safe stuff wins, longshots are listed last. */
export interface RankedPreviewRow {
  emoji: string;
  name: string;
  platform: string;
  score: number;
  riskLevel: number;
  note: string;
}

export const RANKED_PREVIEW: RankedPreviewRow[] = [
  { emoji: '📈', name: 'VOO · S&P 500', platform: 'Vanguard', score: 82, riskLevel: 3, note: 'Capital preserved' },
  { emoji: '🏦', name: 'SGOV · T-bills', platform: 'iShares', score: 74, riskLevel: 1, note: 'Contractual yield' },
  { emoji: '🎯', name: 'Heat win · Yes 58¢', platform: 'Polymarket', score: 61, riskLevel: 3, note: 'All-or-nothing' },
  { emoji: '₿', name: 'BTC', platform: 'Coinbase', score: 43, riskLevel: 5, note: 'High volatility' },
  { emoji: '🎲', name: '4-leg parlay', platform: 'Sportsbook', score: 11, riskLevel: 5, note: 'Listed last, not hidden' },
];

/** Slide 3 — mirrors ScoreMathCard's real weights (35 / 25 / 30 / 10). */
export interface BreakdownFactor {
  label: string;
  weight: string;
  raw: number;
  points: number;
}

export const BREAKDOWN_FACTORS: BreakdownFactor[] = [
  { label: 'Chance of hitting goal', weight: '35%', raw: 70, points: 24.5 },
  { label: 'Capital safety', weight: '25%', raw: 88, points: 22.0 },
  { label: 'Cash required', weight: '30%', raw: 100, points: 30.0 },
  { label: 'Time to payout', weight: '10%', raw: 55, points: 5.5 },
];

export const BREAKDOWN_SCORE = 82;

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
    text: 'The parlay pays more, but all four legs have to land — roughly a 6% shot, and a miss takes the whole stake. VOO clears your $30 target with your capital intact, so 82 vs 11.',
  },
];

/** Slide 5 — closing proof points. Each maps to a real screen in the app. */
export const CLOSING_PROOF: { emoji: string; label: string }[] = [
  { emoji: '🧭', label: 'Every option in one ranked list' },
  { emoji: '🧾', label: 'Full math and sources on each pick' },
  { emoji: '💬', label: 'AI coach on call while you decide' },
];
