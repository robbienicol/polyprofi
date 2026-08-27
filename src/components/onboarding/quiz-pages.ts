/**
 * The quiz, as data: what the pages are, what each one needs before its button
 * unlocks, and the copy each one shows for a given set of answers.
 *
 * Pages come in three kinds. Most are questions. Two are *statements* — an
 * interstitial that pays off the answer before it, and a loader that does a
 * visible piece of work on what's been said so far. One is a permission ask.
 * Keeping all three in one ordered list is what lets the screen render them as
 * a single sliding track with one progress bar across the top.
 *
 * Copy rules. Plain, but never simple-minded: write the way a good adviser talks
 * to a client, not the way an app talks to a child. And never ask a question in
 * a way that sounds like an interrogation — "what are you working towards?" gets
 * the same answer as "what's the money for?" from the friendlier end.
 *
 * Every page's copy is built from the answers, not written once: a page opens by
 * reading the previous answer back, and the read-back does two jobs — it tells
 * them the answer was a sensible one, then says what it changes about the plan.
 * Never parrots the label back, and never flatters: "that is enough to spread
 * out properly" is encouragement, "great choice!" is noise.
 *
 * The voice throughout is someone sitting next to them who has done this before.
 * Pure module — no React, no storage.
 */

import type { PageCopy } from '@/components/onboarding/quiz-kit';
import { deviceCountry } from '@/lib/device-region';
import type { LossReaction, NotificationChoice, SurveyAnswers } from '@/lib/onboarding-profile';

export const PAGE_IDS = [
  'motivation',
  'outcome',
  'experience',
  'starting_point',
  // The first of two working pauses. Four answers in is where a run starts to
  // feel like a form, so this is where the app does something with them and says
  // so — every bar it fills is named after something they actually said.
  'profiling',
  'capital',
  'horizon',
  'loss_reaction',
  'markets',
  // Asked straight after the opposite question, while the same list is fresh.
  // Exclusions are worth their own page: people are far more certain about what
  // they will not touch than about what they want.
  'avoid_markets',
  'avoid_platforms',
  // The second pause, and the one doing real work on the markets just picked.
  'scan',
  'notifications',
  'review',
] as const;

export type PageId = (typeof PAGE_IDS)[number];

/** Pages that are statements or permission asks rather than things we ask them. */
const NON_QUESTIONS: readonly PageId[] = ['profiling', 'scan', 'notifications', 'review'];

/** How many questions the welcome screen promises. Counted, never hardcoded. */
export const SURVEY_QUESTION_COUNT = PAGE_IDS.filter((id) => !NON_QUESTIONS.includes(id)).length;

/* ----------------------------------------------------------------- options */

export const SKIP = 'Prefer not to say';
export const OTHER = 'Other';
export const SOMETHING_ELSE = 'Something else';

export const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', SKIP] as const;

export const EXPERIENCE_LEVELS = [
  { label: 'None yet', note: 'Starting from scratch' },
  { label: 'A little', note: 'A few positions' },
  { label: 'Comfortable', note: 'I invest regularly' },
  { label: 'Professional', note: 'Skip the explaining' },
] as const;

export const OUTCOMES = [
  { label: 'Long-term growth', emoji: '🌱' },
  { label: 'A safety net', emoji: '🛟' },
  { label: 'Beating inflation', emoji: '📉' },
  { label: 'Income on the side', emoji: '💵' },
  { label: 'One thing I want', emoji: '🎯' },
  { label: SOMETHING_ELSE, emoji: '✏️' },
] as const;

export const AMOUNTS = [
  { label: 'Under $1,000', note: 'A starting position' },
  { label: '$1,000 - $5,000', note: 'Room for a few picks' },
  { label: '$5,000 - $25,000', note: 'Enough to diversify' },
  { label: '$25,000 - $100,000', note: 'Substantial capital' },
  { label: '$100,000+', note: 'Preservation matters most' },
  { label: SKIP, note: "We'll ask on each search instead" },
] as const;

/**
 * Only classes the search can actually route to. Sports markets and Currencies used to
 * sit here and mapped onto categories nothing builds, so picking either narrowed the
 * search to nothing — see SEARCH_CATEGORY_BY_MARKET in @/lib/onboarding-profile.
 */
export const MARKETS = [
  { label: 'Stocks & ETFs', emoji: '📈' },
  { label: 'Savings & T-bills', emoji: '🏦' },
  { label: 'Crypto', emoji: '₿' },
  { label: 'Prediction markets', emoji: '🔮' },
] as const;

/** Both mid-quiz loaders fill three bars. Labels are built from the answers. */
export const SCAN_TASK_COUNT = 3;

/* -------------------------------------------------------------------- gates */

/**
 * What each page needs before Continue unlocks. An exhaustive Record, so adding
 * a page without deciding its gate is a compile error rather than a page nobody
 * can leave. Statements and the permission ask return true.
 */
export const CAN_CONTINUE: Record<PageId, (answers: SurveyAnswers) => boolean> = {
  motivation: (a) => a.motivations.length > 0,
  outcome: (a) => Boolean(a.outcome),
  experience: (a) => Boolean(a.experience),
  starting_point: (a) => Boolean(a.ageRange),
  profiling: () => true,
  capital: (a) => Boolean(a.amount),
  horizon: (a) => Boolean(a.horizon),
  loss_reaction: (a) => Boolean(a.lossReaction),
  // No market is a real answer: it means "show me everything".
  markets: () => true,
  // Both exclusion pages are opt-in; skipping one means "nothing is off limits".
  avoid_markets: () => true,
  avoid_platforms: () => true,
  scan: () => true,
  notifications: () => true,
  review: () => true,
};

/* --------------------------------------------------------------------- copy */

/** "a", "a and b", "a, b and c". */
function phraseList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Each experience level implies a different promise about how the app will
 * talk, so it gets its own line rather than a generic "got it".
 */
// Keyed on the option labels exactly as EXPERIENCE_LEVELS writes them.
const EXPERIENCE_ACKS: Record<string, string> = {
  'None yet': 'Then you are starting in exactly the right place. Every pick comes with an explanation.',
  'A little': 'That is further along than most people get. We will skip the basics and get to the numbers.',
  Comfortable: 'Then you want the numbers rather than the commentary. That is what you will get.',
  Professional: 'Understood. Raw pricing and sourcing, and we will stay out of your way.',
};

const LOSS_ACKS: Record<LossReaction, string> = {
  sell: "Knowing that about yourself is worth a lot. We'll start where the return is fixed.",
  hold: "That patience is an advantage. Slower picks suit you.",
  buy: "You can sit through a swing, so the sharper end stays on the table.",
  unsure: "Nobody knows until it happens. We'll show you the downside before you commit, not after.",
};

const HORIZON_ACKS: Record<string, string> = {
  weeks: "A few weeks is tight, so we'll be straight with you about what that costs.",
  months: 'A few months is a sensible window. That opens up most of what we price.',
  year: 'A year is plenty of room, and the steady stuff does its best work at that length.',
  years: "Years to work with. That's the patient way to do this, and it pays for itself.",
};

const AMOUNT_ACKS: Record<string, string> = {
  'Under $1,000': "That is a real start, and it is how nearly everyone begins. Nothing we show you will cost more.",
  '$1,000 - $5,000': "A few thousand is plenty to work with — enough to split across a few picks.",
  '$5,000 - $25,000': 'Enough to spread out properly, instead of putting it all on one thing.',
  '$25,000 - $100,000': 'At that size the safe picks pay real money, so we start there.',
  '$100,000+': 'At that size, protecting it matters more than chasing big wins. We will treat it that way.',
  [SKIP]: "No problem. We'll ask how much each time instead.",
};

export function buildPageCopy(
  answers: SurveyAnswers,
  name: string,
  notifications: NotificationChoice
): Record<PageId, PageCopy> {
  // Not lowercased: these are written phrases, and "grow what i already have"
  // is what folding a sentence that contains "I" gets you.
  const motivations = phraseList([...answers.motivations]);
  const outcome = answers.outcome === SOMETHING_ELSE ? answers.outcomeOther.trim() : answers.outcome ?? '';
  const markets = phraseList([...answers.markets]);
  const avoided = phraseList([...answers.avoidMarkets]);

  return {
    motivation: {
      // No read-back here: nothing has been asked yet. The question is framed as
      // a decision they already made rather than as "why are you here?", which
      // reads like a form asking them to justify themselves.
      title: name
        ? `${name}, what made you take charge of your money?`
        : 'What made you take charge of your money?',
      helper: 'Pick all that apply. It decides what we show you first.',
    },
    outcome: {
      ack: motivations ? `${motivations}. That is a good reason to start.` : null,
      // Not "what's the money for?" — that reads like being asked to account for
      // yourself. This asks about the thing they want, which is the same answer
      // from the friendlier end.
      title: 'What are you\nworking towards?',
      helper: 'Pick whichever is closest. You can add more goals later.',
    },
    experience: {
      ack: outcome ? `${outcome}. Now every pick has something to aim at.` : null,
      title: "What's your experience\nwith investing?",
      helper: 'There is no wrong answer here. It only sets how much we explain along the way.',
    },
    starting_point: {
      ack: EXPERIENCE_ACKS[answers.experience ?? ''] ?? null,
      title: 'A little about you.',
      // The old helper promised that where you live decides what we show you.
      // Nothing ever read the country, so the promise was not kept — and the
      // device knows the answer anyway. Age is the only thing asked here now.
      helper: 'One question, and only so the numbers we show you are pitched at the right stage.',
    },
    profiling: {
      // Named for what it is doing with their answers, not for the wait.
      title: name ? `Nice work, ${name}. Setting you up…` : 'Nice work. Setting you up…',
      helper: null,
    },
    capital: {
      title: 'Roughly how much are\nyou looking to invest?',
      helper: 'A ballpark is fine, and no amount is too small. Think of it as a ceiling — we will never suggest more than this.',
    },
    horizon: {
      ack: AMOUNT_ACKS[answers.amount ?? ''] ?? null,
      title: "What's your timeframe?",
      helper: 'This decides how long a pick is allowed to take before it pays out.',
    },
    loss_reaction: {
      ack: HORIZON_ACKS[answers.horizon ?? ''] ?? null,
      title: 'Your $500 drops to $400\novernight. What do you do?',
      helper: "The honest answer is the useful one — this is the question that keeps you out of things you would regret.",
    },
    markets: {
      ack: answers.lossReaction ? LOSS_ACKS[answers.lossReaction] : null,
      title: 'Any markets you\nare drawn to?',
      helper: 'Optional — leave it blank and we sweep everything. This only changes what we lead with.',
    },
    avoid_markets: {
      ack: markets ? `${markets}. Noted.` : null,
      title: 'Anything you would\nrather we left out?',
      helper: 'We will never show you these, however well they score. Leave it blank if nothing is off limits.',
    },
    avoid_platforms: {
      ack: avoided
        ? `${avoided} is off the table. You will not see it again.`
        : null,
      title: 'Any apps you would\nrather not use?',
      helper: 'Every pick has to be bought somewhere. We will only route you to the ones you keep.',
    },
    scan: {
      // "what X and Y looks like" would need the verb to agree with a list whose
      // length is up to the member, so the sentence avoids the agreement entirely.
      title: markets ? `Let's price ${markets} right now.` : "Let's see what's out there.",
      helper: null,
    },
    notifications: {
      title: name ? `Let us watch it for you, ${name}.` : 'Let us watch it for you.',
      // Concrete, and about the two things the previews underneath actually show.
      // The old copy quoted their goal back at them and said it "takes more than
      // one visit", which asked them to imagine a future problem — on a page that
      // runs before they have picked anything at all.
      helper: "Prices move after you pick. We'll tell you when a better route opens up, and when it's time to take the money.",
    },
    review: {
      title: name ? `That's the hard part done, ${name}.` : "That's the hard part done.",
      helper: 'Have a look before we build your plan. Tap any line to change it.',
    },
  };
}

/** The three bars on the scan page, named after what the person actually said. */
/** How each timeframe reads inside a sentence about pace. */
const HORIZON_WORDS: Record<string, string> = {
  weeks: 'a few weeks',
  months: 'a few months',
  year: 'a year',
  years: 'a few years',
};

/** The three bars the first loader fills, each named after an answer just given. */
export function profilingTasks(answers: SurveyAnswers): string[] {
  const outcome = answers.outcome === SOMETHING_ELSE ? answers.outcomeOther.trim() : answers.outcome;
  return [
    outcome ? `Saving your goal: ${outcome}` : 'Saving your goal',
    answers.experience
      ? `Setting how much we explain (${answers.experience.toLocaleLowerCase()})`
      : 'Setting how much we explain',
    deviceCountry() ? `Unlocking what you can buy in ${deviceCountry()}` : 'Checking what you can buy',
  ];
}

export function scanTasks(answers: SurveyAnswers): string[] {
  const markets = answers.markets.length > 0 ? answers.markets.length : MARKETS.length;
  return [
    `Getting live prices for ${markets} ${markets === 1 ? 'market' : 'markets'}`,
    answers.amount && answers.amount !== SKIP
      ? `Keeping what ${answers.amount.toLocaleLowerCase()} can buy`
      : 'Dropping what you cannot buy',
    'Putting the safest first',
  ];
}

/** The four bars on the full build screen, after the last question. */
export function buildTasks(answers: SurveyAnswers): string[] {
  const outcome = answers.outcome === SOMETHING_ELSE ? answers.outcomeOther.trim() : answers.outcome;
  return [
    // Colon rather than a preposition: every goal label is a verb phrase, and
    // "aiming at grow my money slowly" is what interpolating one directly gets you.
    outcome ? `Your goal: ${outcome}` : 'Working out your goal',
    answers.amount && answers.amount !== SKIP ? `Sizing picks to ${answers.amount}` : 'Sizing picks to your budget',
    answers.horizon
      ? `Dropping anything slower than ${HORIZON_WORDS[answers.horizon]}`
      : 'Matching your timeframe',
    'Putting the safest first',
  ];
}
