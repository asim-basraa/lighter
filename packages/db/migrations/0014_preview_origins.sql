-- Per-project allowlist of app origins the studio may frame for live preview (#166).
-- A table rather than a column: it's multi-valued, and each entry carries its own provenance.
CREATE TABLE IF NOT EXISTS preview_origins (
  project_id TEXT NOT NULL REFERENCES projects(id),
  origin     TEXT NOT NULL,
  label      TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, origin)
);
