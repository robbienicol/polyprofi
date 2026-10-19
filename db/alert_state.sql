-- What the server has already alerted each user about, so nothing is sent twice,
-- and when they were last checked, so each scheduled run takes the longest-waiting.
CREATE TABLE IF NOT EXISTS alert_state (
  clerk_id   text        PRIMARY KEY,
  ledger     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz
);
