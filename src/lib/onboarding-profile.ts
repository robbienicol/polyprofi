/**
 * Everything the first-run funnel learns about someone that the server profile
 * has no column for — the name they gave, the consent they ticked, and the
 * answers the revamped quiz added (motivation, loss reaction, check-in
 * cadence, what they said to the notification ask).
 *
 * Stored as one JSON blob under a single AsyncStorage key, sanitized on read,
 * so adding a question never needs a key or a migration. Same contract as
 * lib/preferences: unknown fields are dropped, missing fields fall back.
 *
 * Pure module — no storage or React imports — so the client layer, the copy
 * builder, and the screens can all depend on it without a cycle.
 */

/** How someone says they'd react to a position going against them. */
export const LOSS_REACTIONS = [
  { value: 'sell', label: 'Sell it', note: 'Take what is left' },
  { value: 'hold', label: 'Hold on', note: 'Give it time to recover' },
  { value: 'buy', label: 'Buy more', note: 'It is cheaper now' },
  { value: 'unsure', label: 'Honestly, no idea', note: 'Never been there' },
] as const;

export type LossReaction = (typeof LOSS_REACTIONS)[number]['value'];

/** How often the app should come to them, unprompted. */
export const CHECK_IN_CADENCES = [
  { value: 'daily', label: 'Every morning', note: 'A fresh read each day' },
  { value: 'weekly', label: 'Once a week', note: 'A Sunday round-up' },
  { value: 'events', label: 'Only when it matters', note: 'Goal reached, or time to sell' },
] as const;

export type CheckInCadence = (typeof CHECK_IN_CADENCES)[number]['value'];

/** How soon they want to see the money move. Sets how long a pick may take to pay. */
export const HORIZONS = [
  { value: 'weeks', label: 'Weeks', note: 'Quick, and riskier for it' },
  { value: 'months', label: 'A few months', note: 'A balance of both' },
  { value: 'year', label: 'About a year', note: 'Steadier ground' },
  { value: 'years', label: 'Several years', note: 'Time on your side' },
] as const;

export type Horizon = (typeof HORIZONS)[number]['value'];

/** Whether more money is coming, which changes how much of it we put to work now. */
export const CONTRIBUTIONS = [
  { value: 'none', label: 'No, this is it', note: 'A single lump sum' },
  { value: 'monthly', label: 'Yes, monthly', note: 'A set amount each month' },
  { value: 'sometimes', label: 'When I can', note: 'No fixed schedule' },
] as const;

export type Contribution = (typeof CONTRIBUTIONS)[number]['value'];

/** What brought them here. Multi-select — most people have more than one reason. */
export const MOTIVATIONS = [
  'Grow what I have',
  'Make my money work harder',
  'Stay ahead of inflation',
  'Understand how it works',
  'Reach one specific goal',
  'Stop guessing at it',
] as const;

export type Motivation = (typeof MOTIVATIONS)[number];

/** Their answer to the permission ask. `null` means they haven't been asked yet. */
export type NotificationChoice = 'enabled' | 'skipped' | null;

/**
 * Every answer the quiz collects, in one object.
 *
 * Some of these map onto server profile columns and some don't; keeping them
 * together is what lets the quiz hand the whole run to the build screen, which
 * is the thing that actually performs the save.
 */
export interface SurveyAnswers {
  motivations: Motivation[];
  outcome: string | null;
  outcomeOther: string;
  experience: string | null;
  ageRange: string | null;
  country: string | null;
  countryOther: string;
  amount: string | null;
  horizon: Horizon | null;
  lossReaction: LossReaction | null;
  contribution: Contribution | null;
  markets: string[];
  /** Markets they want left out entirely. Beats `markets` wherever they overlap. */
  avoidMarkets: string[];
  /** Platform values from ACQUISITION_PLATFORMS they do not want routed to. */
  avoidPlatforms: string[];
  checkIn: CheckInCadence | null;
}

export const EMPTY_ANSWERS: SurveyAnswers = {
  motivations: [],
  outcome: null,
  outcomeOther: '',
  experience: null,
  ageRange: null,
  country: null,
  countryOther: '',
  amount: null,
  horizon: null,
  lossReaction: null,
  contribution: null,
  markets: [],
  avoidMarkets: [],
  avoidPlatforms: [],
  checkIn: null,
};

export interface OnboardingProfile {
  /** First name, captured on the carousel. Every screen after it reads as a conversation. */
  name: string;
  /** Agreed to the privacy/AI terms slide before a single question was asked. */
  consented: boolean;
  /** Their answer to the permission ask. */
  notifications: NotificationChoice;
  /**
   * The completed quiz run, kept so the build screen can name real answers in
   * its progress rows and perform the server save itself.
   */
  answers: SurveyAnswers;
}

export const DEFAULT_ONBOARDING_PROFILE: OnboardingProfile = {
  name: '',
  consented: false,
  notifications: null,
  answers: EMPTY_ANSWERS,
};

/** Longest name we'll render inline in a sentence before it starts wrapping headlines. */
const MAX_NAME_LENGTH = 24;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function sanitizeOnboardingProfile(value: unknown): OnboardingProfile {
  if (!isRecord(value)) return DEFAULT_ONBOARDING_PROFILE;

  return {
    name: typeof value.name === 'string' ? value.name.trim().slice(0, MAX_NAME_LENGTH) : '',
    consented: value.consented === true,
    notifications: oneOf(value.notifications, ['enabled', 'skipped'] as const),
    answers: sanitizeAnswers(value.answers),
  };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function sanitizeAnswers(value: unknown): SurveyAnswers {
  if (!isRecord(value)) return EMPTY_ANSWERS;

  return {
    motivations: strings(value.motivations).filter((item): item is Motivation =>
      (MOTIVATIONS as readonly string[]).includes(item)
    ),
    outcome: stringOrNull(value.outcome),
    outcomeOther: typeof value.outcomeOther === 'string' ? value.outcomeOther : '',
    experience: stringOrNull(value.experience),
    ageRange: stringOrNull(value.ageRange),
    country: stringOrNull(value.country),
    countryOther: typeof value.countryOther === 'string' ? value.countryOther : '',
    amount: stringOrNull(value.amount),
    horizon: oneOf(
      value.horizon,
      HORIZONS.map((item) => item.value)
    ),
    lossReaction: oneOf(
      value.lossReaction,
      LOSS_REACTIONS.map((item) => item.value)
    ),
    contribution: oneOf(
      value.contribution,
      CONTRIBUTIONS.map((item) => item.value)
    ),
    markets: strings(value.markets),
    avoidMarkets: strings(value.avoidMarkets),
    avoidPlatforms: strings(value.avoidPlatforms),
    checkIn: oneOf(
      value.checkIn,
      CHECK_IN_CADENCES.map((item) => item.value)
    ),
  };
}

/**
 * Onboarding market labels mapped onto the values the route filter matches on
 * (see QUIZ_TO_ROUTE_CATEGORIES in lib/quiz-profile). Savings and stocks share a
 * bucket because the route category "Stocks" already covers treasuries.
 */
const SEARCH_CATEGORY_BY_MARKET: Record<string, string> = {
  'Stocks & ETFs': 'Stocks',
  'Savings & T-bills': 'Stocks',
  Crypto: 'Crypto',
  'Prediction markets': 'Polymarket',
  'Sports markets': 'Sports Predictions',
  Currencies: 'Forex',
};

/**
 * The categories a search should start from: what they said they were drawn to,
 * minus anything they asked us to leave out.
 *
 * An empty array means "no filter" to the search screen, which is the right
 * answer both when they picked nothing and when their picks were all excluded.
 */
export function searchCategoriesFor(answers: SurveyAnswers): string[] {
  const avoided = new Set(answers.avoidMarkets);
  const wanted = answers.markets.filter((market) => !avoided.has(market));
  return Array.from(
    new Set(wanted.map((market) => SEARCH_CATEGORY_BY_MARKET[market]).filter(Boolean))
  );
}

/** First name only, trimmed — what the copy interpolates. Empty string if unknown. */
export function firstName(profile: OnboardingProfile | undefined): string {
  return (profile?.name ?? '').trim().split(/\s+/)[0] ?? '';
}

/* ------------------------------------------------- answers → search settings */

/**
 * How they said they'd react to a position going against them, turned into the
 * risk tolerance every search runs at.
 *
 * The quiz has always asked this and the search has always ignored it, running
 * `balanced` for everyone. It is the single answer that changes the most: it
 * flows through `applyRiskTolerance` into the risk cap and probability floor,
 * and into the AI prompt's risk note.
 *
 * Experience only ever pulls *toward* the middle, never past it. Someone who
 * says they'd buy the dip but has never held a position gets the balanced feed
 * rather than the sharp end — they are describing an instinct they have not
 * tested. Nobody is made riskier than their own answer.
 */
export function riskToleranceFor(answers: SurveyAnswers): 'conservative' | 'balanced' | 'aggressive' {
  const untested = answers.experience === 'None yet';
  switch (answers.lossReaction) {
    case 'sell':
      return 'conservative';
    case 'buy':
      return untested ? 'balanced' : 'aggressive';
    case 'unsure':
      return untested ? 'conservative' : 'balanced';
    case 'hold':
      return 'balanced';
    default:
      return 'balanced';
  }
}

/**
 * The horizon they gave, as the timeframe a first search should start on. Keep
 * the values in sync with TIMEFRAMES in `@/app/quiz` — they are the same union.
 *
 * "A few months" lands on 3 months rather than 1: the quiz's own note for it is
 * "a balance of both", and one month is short enough that safe instruments
 * cannot reach a meaningful target.
 */
export function searchTimeframeFor(answers: SurveyAnswers): 'week' | '3months' | '1year' | '5years' {
  switch (answers.horizon) {
    case 'weeks':
      return 'week';
    case 'months':
      return '3months';
    case 'year':
      return '1year';
    case 'years':
      return '5years';
    default:
      return 'week';
  }
}

/**
 * The categories to keep out of a search entirely.
 *
 * `searchCategoriesFor` already subtracts these from the markets it seeds the
 * picker with, but that is only a default and only an *inclusion* — someone who
 * named nothing they wanted and one thing they wanted left out ends up with an
 * empty category list, which the filter reads as "no preference" and shows them
 * the very thing they excluded.
 *
 * Anything they also asked for wins, because two onboarding markets share a
 * search category: ruling out savings must not rule out stocks with it.
 */
export function excludedSearchCategoriesFor(answers: SurveyAnswers): string[] {
  const wanted = new Set(searchCategoriesFor(answers));
  return Array.from(
    new Set(
      answers.avoidMarkets
        .map((market) => SEARCH_CATEGORY_BY_MARKET[market])
        .filter((category) => Boolean(category) && !wanted.has(category))
    )
  );
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const answers = (over: Partial<SurveyAnswers>): SurveyAnswers => ({ ...EMPTY_ANSWERS, ...over });

  console.assert(
    riskToleranceFor(answers({ lossReaction: 'sell' })) === 'conservative',
    "someone who'd sell on the way down gets the conservative feed, not everyone's 'balanced'",
  );
  console.assert(
    riskToleranceFor(answers({ lossReaction: 'buy', experience: 'Comfortable' })) === 'aggressive',
    'buying the dip with real experience opens the sharp end',
  );
  console.assert(
    riskToleranceFor(answers({ lossReaction: 'buy', experience: 'None yet' })) === 'balanced',
    'an untested instinct is pulled to the middle, never past it',
  );
  console.assert(
    riskToleranceFor(answers({ lossReaction: 'unsure', experience: 'None yet' })) === 'conservative',
    '"no idea" plus no experience is the one combination that should start safest',
  );
  console.assert(riskToleranceFor(EMPTY_ANSWERS) === 'balanced', 'no answer still falls back to balanced');

  console.assert(searchTimeframeFor(answers({ horizon: 'months' })) === '3months', 'a few months is 3 months, not 1');
  console.assert(searchTimeframeFor(EMPTY_ANSWERS) === 'week', 'no horizon keeps the old one-week default');

  // The reported gap: ruling a market out did nothing unless you also named one you wanted.
  console.assert(
    excludedSearchCategoriesFor(answers({ avoidMarkets: ['Crypto'] })).includes('Crypto'),
    'a market ruled out is excluded even when nothing was picked',
  );
  // Two onboarding markets share the "Stocks" search category.
  console.assert(
    excludedSearchCategoriesFor(answers({ markets: ['Stocks & ETFs'], avoidMarkets: ['Savings & T-bills'] })).length === 0,
    'ruling out savings must not rule out stocks with it — the market they asked for wins',
  );
  console.assert(
    excludedSearchCategoriesFor(EMPTY_ANSWERS).length === 0,
    'no exclusions means an empty list, which the filter reads as no exclusion at all',
  );
}
