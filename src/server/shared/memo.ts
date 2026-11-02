/**
 * A short-lived, per-instance cache for data that changes by the second (live prices,
 * scores). Too fresh to be worth a database round trip, but still shared by every
 * request one server instance handles: a hundred users holding the same stock cost
 * one quote, not a hundred. Concurrent misses share one fetch.
 */
const entries = new Map<string, { at: number; value: Promise<unknown> }>();

export function memoized<T>(key: string, ttlMs: number, fetch: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = fetch();
  entries.set(key, { at: Date.now(), value });
  // A failed fetch is not cached: the next request tries again.
  value.catch(() => entries.delete(key));
  return value;
}
