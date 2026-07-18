import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from './client.js';
import { inventorySnapshots } from './schema.js';

/**
 * Persist an inventory model as a JSON snapshot and return its id. The model is opaque to the DB
 * layer (stored as JSON text) so `@lighter/db` stays decoupled from ingestion's types. Portable
 * async drizzle idiom — unchanged on a Postgres swap.
 *
 * `projectId` scopes the snapshot to a tenant (#90); the default `null` is the legacy/global
 * partition used by the on-disk `POST /ingest` path and the single-tenant dashboard.
 */
export async function saveInventory(
  db: Db,
  model: unknown,
  projectId: string | null = null,
): Promise<number> {
  const [row] = await db
    .insert(inventorySnapshots)
    .values({ model: JSON.stringify(model), projectId })
    .returning();
  if (!row) throw new Error('saveInventory: insert returned no row');
  return row.id;
}

/**
 * Return the most recently saved inventory model for a project, or null if none. A `null` projectId
 * reads the legacy/global partition (`project_id IS NULL`), preserving existing single-tenant
 * behavior; a concrete id reads only that project's snapshots.
 */
export async function latestInventory(
  db: Db,
  projectId: string | null = null,
): Promise<unknown | null> {
  const scope =
    projectId === null
      ? isNull(inventorySnapshots.projectId)
      : eq(inventorySnapshots.projectId, projectId);
  const rows = await db
    .select()
    .from(inventorySnapshots)
    .where(and(scope))
    .orderBy(desc(inventorySnapshots.id))
    .limit(1);
  const row = rows[0];
  return row ? (JSON.parse(row.model) as unknown) : null;
}
