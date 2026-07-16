import { fetchInventory, apiInventoryFetcher, type InventoryComponent } from '../lib/inventory.js';
import { ComponentGallery } from '../components/ComponentGallery.js';

/**
 * The inventory dashboard home: the component gallery. A server component — it fetches the latest
 * inventory from the Lighter API at request time and hands the component list to the gallery. If the
 * API is unreachable, it degrades to an inline message instead of a crash.
 */
export default async function Page() {
  let components: InventoryComponent[] = [];
  let error: string | null = null;

  try {
    const inventory = await fetchInventory(apiInventoryFetcher());
    components = inventory?.components ?? [];
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load inventory';
  }

  return (
    <main style={{ padding: 'var(--space-6)', maxWidth: 1120, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--fontSize-2xl)', color: 'var(--color-neutral-900)' }}>
        Component inventory
      </h1>
      {error ? (
        <p style={{ color: 'var(--color-red-700)' }}>Could not reach the inventory API: {error}</p>
      ) : (
        <ComponentGallery components={components} />
      )}
    </main>
  );
}
