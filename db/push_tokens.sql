-- Expo push tokens per device, so alerts reach users while the app is closed
-- (see src/api/client/push-registration.ts and src/server/alerts/).
CREATE TABLE IF NOT EXISTS push_tokens (
  token      text        PRIMARY KEY,
  clerk_id   text        NOT NULL,
  platform   text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
