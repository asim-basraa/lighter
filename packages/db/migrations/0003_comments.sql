-- 0003_comments: review comments anchored to a screen spec version + element (#23).
-- element_id is a structural json-render element id (el-0, el-1, …), stable for an immutable
-- version — so a comment survives layout changes (it is not anchored to pixels). author is optional
-- (public reviewers need no account). Threads/replies arrive in #24.
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  screen_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  element_id TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS comments_screen_version ON comments (screen_id, version);
