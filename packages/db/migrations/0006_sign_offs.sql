-- 0006_sign_offs: sign-off set enforcement (#26).
-- sign_off_config: the configurable required parties per screen (each a role — customer / internal).
-- sign_offs: which party has signed off a specific version. A version is only 'approved' once every
-- configured party for its screen has a sign_offs row.
CREATE TABLE IF NOT EXISTS sign_off_config (
  screen_id TEXT NOT NULL,
  party TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (screen_id, party)
);
CREATE TABLE IF NOT EXISTS sign_offs (
  screen_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  party TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (screen_id, version, party)
);
