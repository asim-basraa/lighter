-- 0010_projects: multi-project cloud foundation (#87). A `projects` row per tenant, and
-- `project_tokens` holding the HMAC hash of each machine API token (CLI / GitHub Action lane).
-- Only the hash is stored, so a DB leak never exposes a usable token. Human/studio auth is
-- Supabase Auth (#91) and lives outside these tables.
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_tokens (
  token_hash TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  label TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS project_tokens_project_id ON project_tokens(project_id);
