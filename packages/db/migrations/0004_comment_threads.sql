-- 0004_comment_threads: replies (#24). A reply points at its parent comment via parent_id; a
-- top-level comment has parent_id NULL. Threads stay one level deep (a reply's parent is always a
-- root), enforced in the application layer. FK integrity is enforced in code (SQLite foreign_keys
-- pragma is off by default), so this is a plain nullable column.
ALTER TABLE comments ADD COLUMN parent_id INTEGER;
CREATE INDEX IF NOT EXISTS comments_parent ON comments (parent_id);
