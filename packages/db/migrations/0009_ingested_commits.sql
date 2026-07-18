-- 0009_ingested_commits: idempotency ledger for the design-system push webhook (#36). One row per
-- processed commit sha; a re-delivered webhook for a commit already here is a no-op.
CREATE TABLE IF NOT EXISTS ingested_commits (
  commit_sha TEXT PRIMARY KEY,
  ingested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
