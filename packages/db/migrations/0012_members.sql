-- 0012_members: Supabase-Auth user mirror + project membership (#91). Studio login is Supabase Auth;
-- we mirror the Supabase user id (JWT `sub`) + email here and join users to projects via
-- `project_members` so one user can belong to many projects (teams). Role is 'owner' or 'member';
-- owners invite members and mint/revoke machine tokens. The machine-auth lane (`project_tokens`) is
-- unchanged — a token still implies its project directly.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,            -- Supabase auth user id (JWT `sub`)
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,            -- 'owner' | 'member'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_user_id ON project_members(user_id);
