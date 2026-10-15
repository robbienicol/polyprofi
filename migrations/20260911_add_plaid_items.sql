-- One row per bank connection a user completes through Plaid Link. Not FK'd to
-- users(clerk_id): the bank-connect quiz page can run before a users row exists
-- (that row is only upserted when the survey finishes, in building-plan.tsx).
CREATE TABLE IF NOT EXISTS plaid_items (
  id BIGSERIAL PRIMARY KEY,
  clerk_id TEXT NOT NULL,
  item_id TEXT NOT NULL UNIQUE,
  -- Plaid access tokens are long-lived bearer credentials for the linked
  -- account. Plaintext for now, matching how every other secret in this schema
  -- is stored — encrypt this column before real bank data is flowing.
  access_token TEXT NOT NULL,
  institution_id TEXT,
  institution_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plaid_items_clerk_id_idx ON plaid_items (clerk_id);
