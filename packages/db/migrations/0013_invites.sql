-- 0013_invites: pending team invitations (#91). An owner invites by email before that person has ever
-- logged in (magic-link means a Supabase user exists only after first login). We store the invite by
-- (project, email); on the invitee's first authenticated request their invites are materialized into
-- `project_members` and removed here. Indexed by email for the login-time lookup.
CREATE TABLE IF NOT EXISTS project_invites (
  project_id TEXT NOT NULL REFERENCES projects(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, email)
);

CREATE INDEX IF NOT EXISTS project_invites_email ON project_invites(email);
