import { desc } from 'drizzle-orm';
import type { Db } from './client.js';
import { inventorySnapshots } from './schema.js';

/**
 * Persist an inventory model as a JSON snapshot and return its id. The model is opaque to the DB
 * layer (stored as JSON text) so `@lighter/db` stays decoupled from ingestion's types. Portable
 * async drizzle idiom — unchanged on a Postgres swap.
 */
export async function saveInventory(db: Db, model: unknown): Promise<number> {
  const [row] = await db
    .insert(inventorySnapshots)
    .values({ model: JSON.stringify(model) })
    .returning();
  if (!row) throw new Error('saveInventory: insert returned no row');
  return row.id;
}

/** Return the most recently saved inventory model, or null if none has been ingested yet. */
export async function latestInventory(db: Db): Promise<unknown | null> {
  const rows = await db
    .select()
    .from(inventorySnapshots)
    .orderBy(desc(inventorySnapshots.id))
    .limit(1);
  const row = rows[0];
  return row ? (JSON.parse(row.model) as unknown) : null;
}
