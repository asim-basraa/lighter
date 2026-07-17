-- 0005_version_status: per-version approval state (#25). One row per (screen, version); absence of a
-- row means the default 'draft'. State is mutable review lifecycle, so it lives in the DB (not the
-- immutable git-backed spec files).
CREATE TABLE IF NOT EXISTS version_status (
  screen_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  state TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (screen_id, version)
);
