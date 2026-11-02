import { cachedOptionChains } from '@/server/market/option-chains';
import { withAuth } from '@/server/shared/http';

export const getOptionChains = withAuth('options-chains', async () => {
  const result = await cachedOptionChains();
  // Stale quotes are flagged, not hidden: the device still shows the snapshot time.
  return result
    ? Response.json({ chains: result.value.chains, fetchedAt: result.fetchedAt, ...(result.stale ? { stale: true } : null) })
    : Response.json({ chains: [] });
});
