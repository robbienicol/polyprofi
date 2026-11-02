export const PORTFOLIO_HISTORY_VERSION = 1;

interface PortfolioHistoryEnvelope<T> {
  accountingVersion: number;
  points: T[];
}

type Validator<T> = (value: unknown) => value is T;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rejects unversioned points so data written by older accounting rules cannot leak into returns. */
export function parsePortfolioHistory<T>(raw: string, isPoint: Validator<T>): T[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)
      || value.accountingVersion !== PORTFOLIO_HISTORY_VERSION
      || !Array.isArray(value.points)
      || !value.points.every(isPoint)) {
      return null;
    }
    return value.points;
  } catch {
    return null;
  }
}

export function serializePortfolioHistory<T>(points: T[]): string {
  const history: PortfolioHistoryEnvelope<T> = {
    accountingVersion: PORTFOLIO_HISTORY_VERSION,
    points,
  };
  return JSON.stringify(history);
}

export function __selfCheck(): void {
  const isPoint = (value: unknown): value is { value: number } => (
    isRecord(value) && typeof value.value === 'number'
  );
  const point = { value: 100 };

  if (parsePortfolioHistory(JSON.stringify([point]), isPoint) !== null) {
    throw new Error('[portfolio-history] unversioned history must be reset');
  }
  const parsed = parsePortfolioHistory(serializePortfolioHistory([point]), isPoint);
  if (parsed?.[0]?.value !== 100) {
    throw new Error('[portfolio-history] current history must round-trip');
  }
}
