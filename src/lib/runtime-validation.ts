import type { PortfolioProgressPoint } from '@/api/client/storage';
import type { QuizAnswers, TrackedBet } from '@/types/bets';
import type { Route, SavedRoutesBatch } from '@/types/routes';

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

export function isQuizAnswers(value: unknown): value is QuizAnswers {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.balance)
    && isFiniteNumber(value.target)
    && isOneOf(value.timeframe, ['today', 'week', 'month', '3months', '1year', '5years'])
    && isStringArray(value.categories)
    && isOneOf(value.riskTolerance, ['conservative', 'balanced', 'aggressive'])
    && isFiniteNumber(value.maxRiskLevel)
    && isFiniteNumber(value.minProbability);
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
    && isOptional(value.maturesInDays, isFiniteNumber);
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
