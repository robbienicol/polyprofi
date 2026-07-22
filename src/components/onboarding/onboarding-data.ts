import { TrackedBet } from '@/types/bets';
import { Route } from '@/types/routes';

export interface OnboardingSlide {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  kind: 'welcome' | 'goal' | 'safety' | 'routes' | 'tracked';
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    eyebrow: 'POLYPROFIT',
    title: 'The safest way\nto hit your goal',
    body: 'Tell us how much you have, what you want to make, and your deadline. We scan prediction markets and more — ranked safest first.',
    kind: 'welcome',
  },
  {
    id: 'goal',
    eyebrow: 'YOUR QUIZ',
    title: 'Your deadline\npicks your routes',
    body: '$300 → $330 in a year? VOO and treasuries lead. Same goal this week? Prediction-market contracts take over. One quiz, tailored results.',
    kind: 'goal',
  },
  {
    id: 'safety',
    eyebrow: 'WHY WE\'RE DIFFERENT',
    title: 'Safety you\ncan measure',
    body: 'VOO averages ~10%/year — history, not hype. A longshot parlay can wipe you out. We rank both on honest odds and capital preserved.',
    kind: 'safety',
  },
  {
    id: 'routes',
    eyebrow: 'YOUR ROUTES',
    title: 'Best-value plays\nshown first',
    body: 'Every route gets a transparent goal-effectiveness score using chance, capital safety, money required, and maturity.',
    kind: 'routes',
  },
  {
    id: 'tracked',
    eyebrow: 'LOCK IT IN',
    title: 'Track & sell\nwhen you\'re up',
    body: 'On prediction markets, price moves during the event. We alert you to sell when your profit goal is hit — before the final whistle.',
    kind: 'tracked',
  },
];

/** Demo routes for onboarding — VOO (safe) vs PM contract (ranked below). */
export const DEMO_ROUTES: Route[] = [
  {
    id: 'onboard-voo',
    category: 'Stocks & ETFs',
    emoji: '📈',
    description: 'VOO tracks the S&P 500 — ~10% historical annual return, capital preserved.',
    riskLevel: 1,
    probability: 62,
    expectedReturn: 30,
    platform: 'Fidelity',
    strategy: 'Buy VOO · hold through deadline',
    lossProfile: 'partial',
    meetsTarget: true,
  },
  {
    id: 'onboard-poly',
    category: 'Polymarket',
    emoji: '🏀',
    description: 'Heat to win — consensus edge after de-vigging books vs contract price.',
    riskLevel: 3,
    probability: 68,
    expectedReturn: 42,
    platform: 'Polymarket',
    strategy: 'Buy Yes · sell early if goal hit',
    line: 'Heat win · Yes 58¢',
    lossProfile: 'binary',
    meetsTarget: true,
  },
];

export const DEMO_TRACKED_BETS: TrackedBet[] = [
  {
    id: 'onboard-won',
    category: 'Polymarket',
    emoji: '🏀',
    description: 'Heat Yes — sold at halftime after +$30 unrealized gain.',
    platform: 'Polymarket',
    strategy: 'Early exit',
    riskLevel: 3,
    probability: 68,
    expectedReturn: 35,
    amountWagered: 50,
    status: 'won',
    createdAt: '2026-06-28T18:00:00.000Z',
    profitGoal: 30,
  },
  {
    id: 'onboard-active',
    category: 'Stocks & ETFs',
    emoji: '📈',
    description: 'VOO position — capital preserved, tracking toward year-end goal.',
    platform: 'Vanguard',
    strategy: 'Hold',
    riskLevel: 1,
    probability: 62,
    expectedReturn: 30,
    amountWagered: 300,
    status: 'active',
    createdAt: '2026-06-29T10:00:00.000Z',
    profitGoal: 30,
  },
];
