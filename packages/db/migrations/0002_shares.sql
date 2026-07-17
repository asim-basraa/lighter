-- 0002_shares: tokenized share links to a specific screen spec version (#21).
-- The token is the only credential to view a deployed mock (no account). One share per
-- (screen_id, version) so re-sharing a version is a stable URL, enforced by the UNIQUE index.
CREATE TABLE IF NOT EXISTS shares (
  token TEXT PRIMARY KEY,
  screen_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS shares_screen_version ON shares (screen_id, version);
