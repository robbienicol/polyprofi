import type { PortfolioProgressPoint } from '@/api/client/storage';
import type { SportsMatch } from '@/lib/sports-market-match';
import type { AcquisitionPlatform, QuizAnswers, SavingsGoal, SavingsGoalState, TrackedBet } from '@/types/bets';
import type { MarketQualityFacts, Route, SavedRoutesBatch } from '@/types/routes';

type JsonRecord = Record<string, unknown>;

export type Validator<T> = (value: unknown) => value is T;

export function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function responseJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

export function parseJsonAs<T>(raw: string, validator: Validator<T>): T | null {
  const parsed = parseJson(raw);
  return validator(parsed) ? parsed : null;
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAcquisitionPlatformArray(value: unknown): value is AcquisitionPlatform[] {
  return Array.isArray(value)
    && value.every((item) => isOneOf(item, ['robinhood', 'polymarket', 'kalshi']));
}

export function isQuizAnswers(value: unknown): value is QuizAnswers {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.balance)
    && isFiniteNumber(value.target)
    && isOneOf(value.timeframe, ['today', 'week', 'month', '3months', '1year', '5years'])
    && isStringArray(value.categories)
    && isOneOf(value.riskTolerance, ['conservative', 'balanced', 'aggressive'])
    && isOptional(value.preferredPlatforms, isAcquisitionPlatformArray)
    && isFiniteNumber(value.maxRiskLevel)
    && isFiniteNumber(value.minProbability);
}

export function isSavingsGoal(value: unknown): value is SavingsGoal {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.emoji === 'string'
    && isFiniteNumber(value.targetAmount)
    && typeof value.createdAt === 'string'
    && isOptional(value.achievedAt, isString)
    && isOptional(value.celebratedAt, isString);
}

export function isSavingsGoalState(value: unknown): value is SavingsGoalState {
  if (!isRecord(value)) return false;
  return (value.current === null || isSavingsGoal(value.current))
    && isFiniteNumber(value.achievedCount)
    && isOptional(value.accountingVersion, isFiniteNumber);
}

export function isRoute(value: unknown): value is Route {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.category === 'string'
    && typeof value.emoji === 'string'
    && typeof value.description === 'string'
    && isFiniteNumber(value.riskLevel)
    && isFiniteNumber(value.probability)
    && isFiniteNumber(value.expectedReturn)
    && typeof value.platform === 'string'
    && typeof value.strategy === 'string'
    && isOneOf(value.lossProfile, ['binary', 'partial'])
    && typeof value.meetsTarget === 'boolean'
    && isOptional(value.line, isString)
    && isOptional(value.maturesInDays, isFiniteNumber)
    && isOptional(value.marketQuality, isMarketQualityFacts)
    && isOptional(value.sourceSlug, isString)
    && isOptional(value.sourceEndDate, isString);
}

function isMarketQualityFacts(value: unknown): value is MarketQualityFacts {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.executionScore)
    && isOptional(value.stabilityScore, isFiniteNumber)
    && isFiniteNumber(value.liquidityUsd)
    && isOptional(value.spreadCents, isFiniteNumber)
    && isOptional(value.bestBidCents, isFiniteNumber)
    && isOptional(value.bestAskCents, isFiniteNumber)
    && isOptional(value.recentRangePts, isFiniteNumber)
    && isOptional(value.pricePositionPct, isFiniteNumber)
    && isOneOf(value.pricePosition, ['steady', 'near_recent_low', 'middle', 'near_recent_high', 'unavailable'])
    && isOptional(value.oneDayMovePts, isFiniteNumber)
    && isOptional(value.oneWeekMovePts, isFiniteNumber)
    && isOptional(value.oneMonthMovePts, isFiniteNumber);
}

export function isTrackedBet(value: unknown): value is TrackedBet {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.category === 'string'
    && typeof value.emoji === 'string'
    && typeof value.description === 'string'
    && typeof value.platform === 'string'
    && typeof value.strategy === 'string'
    && isFiniteNumber(value.riskLevel)
    && isFiniteNumber(value.probability)
    && isFiniteNumber(value.expectedReturn)
    && isFiniteNumber(value.amountWagered)
    && isOneOf(value.status, ['active', 'won', 'lost'])
    && typeof value.createdAt === 'string';
}

export function isPortfolioProgressPoint(value: unknown): value is PortfolioProgressPoint {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.time)
    && isFiniteNumber(value.value)
    && isFiniteNumber(value.basisValue)
    && isFiniteNumber(value.livePnl)
    && isFiniteNumber(value.projectedPnl);
}

export function isSavedRoutesBatch(value: unknown): value is SavedRoutesBatch {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.generatedAt === 'string'
    && isQuizAnswers(value.quizSnapshot)
    && Array.isArray(value.routes)
    && value.routes.every(isRoute);
}

export function isSportsMatch(value: unknown): value is SportsMatch {
  if (!isRecord(value)) return false;
  return typeof value.polymarketSlug === 'string'
    && isOneOf(value.league, ['NBA', 'WNBA', 'NFL', 'MLB', 'NHL'])
    && typeof value.kalshiYesTicker === 'string'
    && typeof value.kalshiNoTicker === 'string';
}

export function isArrayOf<T>(validator: Validator<T>): Validator<T[]> {
  return (value: unknown): value is T[] => Array.isArray(value) && value.every(validator);
}

export function isRecordOf<T>(validator: Validator<T>): Validator<Record<string, T>> {
  return (value: unknown): value is Record<string, T> => (
    isRecord(value) && Object.values(value).every(validator)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isOptional<T>(value: unknown, validator: Validator<T>): value is T | undefined {
  return value === undefined || validator(value);
}

function isOneOf<const T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === 'string' && options.includes(value);
}
