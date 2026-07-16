-- 0001_inventory: persisted ingestion snapshots.
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
