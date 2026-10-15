-- Device blobs mirrored per account (see src/api/client/user-data-sync.ts).
CREATE TABLE IF NOT EXISTS user_data (
  clerk_id   text        NOT NULL,
  key        text        NOT NULL,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clerk_id, key)
);
