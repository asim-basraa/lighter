import { loadInventory, apiInventoryFetcher } from '../../lib/inventory.js';
import { apiAuthHeaders } from '../../lib/session.js';
import { ComponentGallery } from '../../components/ComponentGallery.js';
import { DashboardView } from '../../components/DashboardView.js';

/**
 * The inventory dashboard home: the component gallery. A server component — it fetches the latest
 * inventory from the Lighter API at request time and hands the component list to the gallery.
 *
 * `force-dynamic` so the page is rendered per-request against the live API, not statically
 * prerendered at build time (Next's default `fetch` cache would otherwise freeze — or, with the API
 * down at build, permanently bake in the error state).
 */
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { model, error } = await loadInventory(
    apiInventoryFetcher(undefined, await apiAuthHeaders()),
  );
  return (
    <DashboardView title="Components" error={error}>
      <ComponentGallery components={model?.components ?? []} health={model?.health ?? []} />
    </DashboardView>
  );
}
