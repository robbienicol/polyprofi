/**
 * Coarse topics for prediction markets, resolved from Polymarket's tag slugs.
 *
 * Gamma returns granular tags (`nfl`, `french-election`, `bitcoin`) mixed with
 * operational ones (`earn-4`, `hide-from-new`). A sampled probe across every
 * maturity band the app fetches found 100% of markets carry at least one tag, and
 * that canonical coarse slugs (`sports`, `politics`, `crypto`, `finance`,
 * `pop-culture`) are present often enough to bucket on directly. Sub-tags are kept
 * as fallbacks so a market tagged only `nfl` still reads as Sports.
 */

/**
 * Asset classes whose routes carry prediction-market facets. One definition, shared
 * by the filter panel that reveals the facets and the filter logic that applies them,
 * so the two can never disagree about when they are live.
 */
export const PREDICTION_CATEGORIES: readonly string[] = ['Polymarket', 'Sports Predictions'];

export function isPredictionCategory(category: string | null | undefined): boolean {
  return category != null && PREDICTION_CATEGORIES.includes(category);
}

export interface PredictionTopic {
  value: string;
  label: string;
  emoji: string;
  /** Tag slugs that put a market in this bucket. */
  slugs: readonly string[];
}

/**
 * Order is priority: the first bucket that matches wins. Election markets commonly
 * carry both `politics` and `world`, and should read as Politics, so Politics sits
 * ahead of World. Sports leads because it rarely overlaps anything else.
 */
export const PREDICTION_TOPICS: readonly PredictionTopic[] = [
  {
    value: 'sports',
    label: 'Sports',
    emoji: '🏈',
    slugs: [
      'sports', 'nfl', 'nba', 'wnba', 'mlb', 'nhl', 'baseball', 'basketball', 'football',
      'soccer', 'epl', 'uefa', 'champions-league', 'tennis', 'golf', 'pga', 'ufc', 'mma',
      'boxing', 'formula1', 'f1', 'nascar', 'cricket', 'rugby', 'olympics', 'cfb',
      'college-football', 'college-basketball', 'esports', 'dota-2', 'csgo', 'lol', 'valorant',
    ],
  },
  {
    value: 'crypto',
    label: 'Crypto',
    emoji: '₿',
    slugs: ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'xrp', 'dogecoin', 'memecoins', 'stablecoins', 'defi'],
  },
  {
    value: 'politics',
    label: 'Politics',
    emoji: '🏛',
    slugs: [
      'politics', 'elections', 'election', 'primaries', 'primary-elections', 'main-election',
      'us-presidential-election', 'world-elections', 'global-elections', 'republican-primary',
      'democratic-primary', 'president', 'congress', 'senate', 'house', 'governor-midterms',
      'midterms', 'trump', 'biden', 'supreme-court', 'foreign-policy', 'immigration',
    ],
  },
  {
    value: 'economy',
    label: 'Economy',
    emoji: '📈',
    slugs: ['finance', 'economy', 'economics', 'inflation', 'fed', 'interest-rates', 'recession', 'oil', 'gas', 'commodities', 'stocks', 'earnings', 'gdp', 'jobs', 'tariffs'],
  },
  {
    value: 'culture',
    label: 'Culture',
    emoji: '🎬',
    slugs: ['pop-culture', 'celebrities', 'music', 'movies', 'awards', 'oscars', 'grammys', 'tv', 'twitter', 'tweets-markets', 'science', 'space', 'aliens', 'ai', 'tech'],
  },
  {
    value: 'world',
    label: 'World',
    emoji: '🌍',
    slugs: ['world', 'geopolitics', 'middle-east', 'israel', 'iran', 'ukraine', 'russia', 'china', 'taiwan', 'venezuela', 'war', 'military-strikes', 'nuclear'],
  },
] as const;

/**
 * Tags Polymarket uses for its own bookkeeping — rewards programmes, display
 * hints, derivative plumbing. They are never topics and must not leak into the UI.
 */
const OPERATIONAL_TAG_PATTERNS: readonly RegExp[] = [
  /^earn(-|$)/,
  /^rewards?(-|$)/,
  /^hide-from/,
  /^parent-for/,
  /^hit-price$/,
  /^monthly$/,
  /^weekly$/,
  /^daily$/,
  /^recurring$/,
  /^games$/, // umbrella that rides along with both sports and esports; adds nothing
];

export function isOperationalTag(slug: string): boolean {
  return OPERATIONAL_TAG_PATTERNS.some((pattern) => pattern.test(slug));
}

/** Strips Polymarket's bookkeeping tags, leaving only ones that could be a topic. */
export function meaningfulTagSlugs(slugs: readonly string[]): string[] {
  return slugs.filter((slug) => slug.length > 0 && !isOperationalTag(slug));
}

/**
 * The coarse topic for a market's tags, or null when nothing recognisable matched.
 * Null is a real answer: a market tagged only `ethiopia` belongs to no bucket, and
 * inventing one would be worse than leaving it untagged.
 */
export function topicForTags(slugs: readonly string[]): string | null {
  const meaningful = new Set(meaningfulTagSlugs(slugs));
  if (meaningful.size === 0) return null;
  for (const topic of PREDICTION_TOPICS) {
    if (topic.slugs.some((slug) => meaningful.has(slug))) return topic.value;
  }
  return null;
}

/**
 * Leagues inside Sports. Someone who knows the NFL cold and nothing about German
 * table tennis gets no edge from seeing the two ranked side by side — their edge is
 * what they know — so each league is its own portal. Order is priority: college
 * football tags often ride with `football`, so the specific league is matched first.
 */
export interface PredictionSubtopic {
  value: string;
  label: string;
  topic: string;
  slugs: readonly string[];
}

export const PREDICTION_SUBTOPICS: readonly PredictionSubtopic[] = [
  { value: 'cfb', label: 'College football', topic: 'sports', slugs: ['cfb', 'college-football', 'ncaaf'] },
  { value: 'nfl', label: 'NFL', topic: 'sports', slugs: ['nfl'] },
  { value: 'cbb', label: 'College basketball', topic: 'sports', slugs: ['college-basketball', 'ncaab', 'march-madness'] },
  { value: 'nba', label: 'NBA', topic: 'sports', slugs: ['nba'] },
  { value: 'wnba', label: 'WNBA', topic: 'sports', slugs: ['wnba'] },
  { value: 'mlb', label: 'MLB', topic: 'sports', slugs: ['mlb', 'baseball'] },
  { value: 'nhl', label: 'NHL', topic: 'sports', slugs: ['nhl', 'hockey'] },
  { value: 'soccer', label: 'Soccer', topic: 'sports', slugs: ['soccer', 'epl', 'uefa', 'champions-league', 'la-liga', 'serie-a', 'bundesliga', 'mls'] },
  { value: 'tennis', label: 'Tennis', topic: 'sports', slugs: ['tennis'] },
  { value: 'golf', label: 'Golf', topic: 'sports', slugs: ['golf', 'pga'] },
  { value: 'fighting', label: 'UFC & boxing', topic: 'sports', slugs: ['ufc', 'mma', 'boxing'] },
  { value: 'f1', label: 'F1', topic: 'sports', slugs: ['formula1', 'f1'] },
  { value: 'esports', label: 'Esports', topic: 'sports', slugs: ['esports', 'dota-2', 'csgo', 'lol', 'valorant'] },
];

/** The league for a market's tags within a topic, or null when none matched. */
export function subtopicForTags(slugs: readonly string[], topic: string | null): string | null {
  if (!topic) return null;
  const meaningful = new Set(meaningfulTagSlugs(slugs));
  const match = PREDICTION_SUBTOPICS.find((sub) => sub.topic === topic && sub.slugs.some((slug) => meaningful.has(slug)));
  return match?.value ?? null;
}

export function predictionTopic(value: string | null | undefined): PredictionTopic | null {
  return PREDICTION_TOPICS.find((topic) => topic.value === value) ?? null;
}

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[prediction-topics] ${message}`);
}

export function __selfCheck(): void {
  invariant(isPredictionCategory('Polymarket'), 'Polymarket is a prediction category');
  invariant(isPredictionCategory('Sports Predictions'), 'sports predictions are a prediction category');
  invariant(!isPredictionCategory('Stocks & ETFs'), 'stocks are not a prediction category');
  invariant(!isPredictionCategory(null), 'the all-assets view is not a prediction category');

  // Coarse slugs, as seen in the sampled probe.
  invariant(topicForTags(['sports', 'games', 'tennis']) === 'sports', 'a sports market reads as Sports');
  invariant(topicForTags(['politics', 'elections', 'florida-primary']) === 'politics', 'an election market reads as Politics');
  invariant(topicForTags(['crypto', 'bitcoin']) === 'crypto', 'a crypto market reads as Crypto');
  invariant(topicForTags(['finance', 'oil']) === 'economy', 'an oil market reads as Economy');
  invariant(topicForTags(['pop-culture']) === 'culture', 'a pop-culture market reads as Culture');
  invariant(topicForTags(['geopolitics', 'iran']) === 'world', 'a geopolitics market reads as World');

  // Sub-tag only: a market tagged nfl but not sports still buckets.
  invariant(topicForTags(['nfl']) === 'sports', 'a sub-tag alone is enough to bucket');
  invariant(topicForTags(['french-election', 'france', 'politics']) === 'politics', 'a country election reads as Politics');

  // Priority: politics beats world when both are present.
  invariant(
    topicForTags(['world', 'politics', 'global-elections']) === 'politics',
    'politics outranks world when a market carries both',
  );
  // Priority: sports beats culture for an esports market carrying both.
  invariant(topicForTags(['esports', 'tech']) === 'sports', 'sports outranks culture for esports');

  // Operational tags never decide a topic.
  invariant(topicForTags(['earn-4', 'hide-from-new']) === null, 'operational tags alone yield no topic');
  invariant(topicForTags(['rewards-20-4pt5-50', 'sports']) === 'sports', 'operational tags are ignored alongside a real one');
  invariant(isOperationalTag('earn-4'), 'earn-4 is operational');
  invariant(isOperationalTag('hit-price'), 'hit-price is a market type, not a topic');
  invariant(!isOperationalTag('politics'), 'politics is not operational');
  invariant(meaningfulTagSlugs(['earn-4', 'politics', '']).join(',') === 'politics', 'only meaningful slugs survive the filter');

  // Unrecognised and empty inputs.
  invariant(topicForTags(['ethiopia']) === null, 'an unmapped country tag yields no topic');
  invariant(topicForTags([]) === null, 'no tags yields no topic');

  invariant(predictionTopic('sports')?.label === 'Sports', 'a topic resolves to its label');
  invariant(predictionTopic('nope') === null, 'an unknown topic resolves to null');
  invariant(new Set(PREDICTION_TOPICS.map((t) => t.value)).size === PREDICTION_TOPICS.length, 'topic values are unique');
}
