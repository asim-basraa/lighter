-- 0007_flow: click-through flow links between screens (#30). An ordered list per screen — each link
-- is a labelled navigation to another screen, letting a reviewer click through a multi-screen journey
-- in the deployed mocks. position gives a stable order; the set is replaced wholesale on reconfigure.
CREATE TABLE IF NOT EXISTS flow_links (
  screen_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  target_screen_id TEXT NOT NULL,
  PRIMARY KEY (screen_id, position)
);
