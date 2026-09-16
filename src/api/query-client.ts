import { QueryClient } from '@tanstack/react-query';

/**
 * One client for the whole app.
 *
 * The defaults exist to stop the cache flashing. React Query's stock `gcTime` is
 * five minutes, so a query that nothing is mounted against — the launch gates in
 * `app/index.tsx`, say, once the user is past them — is dropped, and the next
 * mount starts back at `pending`. Every gate that reads `isLoading` then shows a
 * full-screen loader for data that was already on the device. A day of `gcTime`
 * and a real `staleTime` mean a screen re-entered later renders its last answer
 * on the first frame and refreshes underneath.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: 1,
        // A tab regaining focus is not news on a device, and a refetch storm on
        // every app resume is what makes lists blink.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        // Every mutation here writes to disk optimistically and rolls back on
        // failure; a silent retry would replay the write against fresher state.
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * The client for the current environment.
 *
 * `web` is built with `output: "server"`, so this module is evaluated inside a
 * request handler as well as in the app. A module-level singleton there would be
 * one cache shared by every visitor — with a day of `gcTime`, for a day. The
 * server gets a throwaway client per render; the app gets one for its lifetime.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

/**
 * Options for a query whose source of truth is this device (AsyncStorage).
 *
 * Local reads can't go stale behind our back — every writer is a mutation in this
 * app that updates the cache as it goes — so there is nothing to poll for. The
 * cache is kept for the life of the process, which is what lets a gate answer
 * instantly on a second visit. Explicit `invalidateQueries` still refetches.
 */
export const deviceQuery = {
  staleTime: Infinity,
  gcTime: Infinity,
} as const;
