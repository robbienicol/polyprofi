import { Accent, Brand } from '@/constants/theme';

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
    eyebrow: 'EVERY OPTION, ONE SCAN',
    title: 'We scan every way\nto grow your money',
    body: 'ETFs, mega-cap stocks, treasuries, crypto, prediction markets, sports lines — priced live, in one sweep. You stop hunting across ten apps.',
    kind: 'scan',
  },
  {
    id: 'rank',
    eyebrow: 'RANKED BY VALUE',
    title: 'Then rank them by\nwhat they\'re worth',
    body: 'Every option gets one 0–100 value score: chance of hitting your goal, capital safety, cash required, time to payout. Best value on top.',
    kind: 'rank',
  },
  {
    id: 'breakdown',
    eyebrow: 'NOTHING HIDDEN',
    title: 'See the exact math\nbehind every pick',
    body: 'Open any route for the full breakdown — how the score was built, the live price it came from, and what happens if it goes against you.',
    kind: 'breakdown',
  },
  {
    id: 'coach',
    eyebrow: 'AI COACH · ALWAYS ON',
    title: 'Ask why. Get a\nstraight answer',
    body: 'The coach reads every number on the card. Why it ranks first, what would kill it, how much to put in — in plain English, in seconds.',
    kind: 'coach',
  },
  {
    id: 'close',
    eyebrow: 'YOUR MOVE',
    title: 'Never guess where\nyour money goes',
    body: 'Give us your amount, your target and your deadline. You get a ranked plan in under a minute — with the math behind every line of it.',
    kind: 'close',
  },
];

/** Slide 1 — the universes we actually price. Keep in sync with lib/*-routes.ts. */
export interface ScanSource {
  emoji: string;
  label: string;
  detail: string;
  color: string;
}

export const SCAN_SOURCES: ScanSource[] = [
  { emoji: '📈', label: 'Stocks & ETFs', detail: 'Broad funds + mega-caps', color: Brand[500] },
  { emoji: '🏦', label: 'Treasuries & savings', detail: 'Live yields, every term', color: Accent.blue },
  { emoji: '🎯', label: 'Prediction markets', detail: 'Polymarket, live contracts', color: Accent.violet },
  { emoji: '🏀', label: 'Sports lines', detail: 'Today\'s card, de-vigged', color: Accent.gold },
  { emoji: '₿', label: 'Crypto', detail: 'BTC · ETH · SOL', color: '#F7931A' },
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
