-- 0011_inventory_project: scope inventory snapshots to a project (#90). NULL project_id is the
-- legacy/global partition used by the on-disk `POST /ingest` path and the single-tenant dashboard;
-- the cloud push path (`POST /inventory`) writes rows tagged with the authed project's id.
ALTER TABLE inventory_snapshots ADD COLUMN project_id TEXT;

CREATE INDEX IF NOT EXISTS inventory_snapshots_project_id ON inventory_snapshots(project_id);
