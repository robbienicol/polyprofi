/**
 * Resolve to `fallback` if `promise` hasn't settled in `ms`. React Native's fetch
 * has no default timeout, so a stalled connection otherwise hangs forever — and a
 * route search that hangs leaves the analysing loader spinning with no way out.
 * The underlying promise is left to finish (its own caches still benefit); its
 * rejection is absorbed so a late failure can't surface as an unhandled one.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label?: string): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      if (label) console.warn(`[timeout] ${label} exceeded ${ms}ms — continuing without it`);
      resolve(fallback);
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => {
        clearTimeout(timer);
        if (label) console.warn(`[timeout] ${label} failed: ${error instanceof Error ? error.message : String(error)}`);
        resolve(fallback);
      },
    );
  });
}
