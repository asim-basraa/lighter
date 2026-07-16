import { loadInventory } from '../../lib/inventory.js';
import { loadSpecs } from '../../lib/specs.js';
import { UsageView } from '../../components/UsageView.js';
import { DashboardView } from '../../components/DashboardView.js';

/**
 * The usage / blast-radius view: for each component, which saved screens and spec versions use it.
 * Specs come from `loadSpecs` (empty until the spec model, #13–16, persists them).
 */
export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const [{ model, error }, specs] = await Promise.all([loadInventory(), loadSpecs()]);
  return (
    <DashboardView title="Usage" error={error}>
      <UsageView components={model?.components ?? []} specs={specs} />
    </DashboardView>
  );
}
