/** Coalesce parallel identical fetches and optionally reuse a fresh result. */
export function createInFlightCache<T>(ttlMs: number) {
  let cached: { at: number; value: T } | null = null;
  let inflight: Promise<T> | null = null;

  return async function get(fn: () => Promise<T>, label?: string): Promise<T> {
    const now = Date.now();
    if (cached && now - cached.at < ttlMs) {
      if (label) {
        console.log(`[${label}] using cache (${Math.round((now - cached.at) / 1000)}s old)`);
      }
      return cached.value;
    }
    if (inflight) {
      if (label) console.log(`[${label}] joining in-flight request`);
      return inflight;
    }

    inflight = fn()
      .then((value) => {
        cached = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        inflight = null;
      });

    return inflight;
  };
}
