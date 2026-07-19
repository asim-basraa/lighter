import { loadInventory, apiInventoryFetcher } from '../../../lib/inventory.js';
import { apiAuthHeaders } from '../../../lib/session.js';
import { HealthPanel } from '../../../components/HealthPanel.js';
import { DashboardView } from '../../../components/DashboardView.js';

/** The health view: ingestion findings across the design system, with a summary of unhealthy items. */
export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const { model, error } = await loadInventory(
    apiInventoryFetcher(undefined, await apiAuthHeaders()),
  );
  return (
    <DashboardView title="Health" error={error}>
      <HealthPanel findings={model?.health ?? []} />
    </DashboardView>
  );
}
