-- Single shared row per cache key, holding the crawled Polymarket "pick bundle"
-- (tagged events, comment picks, Metaculus edges, whale trades). The crawl is
-- identical for every user at a given moment, so it is computed here once and
-- served to everyone, instead of once per device — see
-- src/app/api/polymarket-picks+api.ts.
CREATE TABLE IF NOT EXISTS polymarket_pick_cache (
  key TEXT PRIMARY KEY,
  bundle JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
