import { loadInventory, apiInventoryFetcher } from '../../../lib/inventory.js';
import { loadSpecs, apiSpecsFetcher } from '../../../lib/specs.js';
import { apiAuthHeaders } from '../../../lib/session.js';
import { UsageView } from '../../../components/UsageView.js';
import { DashboardView } from '../../../components/DashboardView.js';

/**
 * The usage / blast-radius view: for each component, which saved screens and spec versions use it.
 * Specs come from `loadSpecs` (empty until the spec model, #13–16, persists them).
 */
export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const headers = await apiAuthHeaders();
  const [inventory, specs] = await Promise.all([
    loadInventory(apiInventoryFetcher(undefined, headers)),
    loadSpecs(apiSpecsFetcher(undefined, headers)),
  ]);
  const error = inventory.error ?? specs.error;
  return (
    <DashboardView title="Usage" error={error}>
      <UsageView components={inventory.model?.components ?? []} specs={specs.specs} />
    </DashboardView>
  );
}
