import { loadInventory } from '../../../lib/inventory.js';
import { HealthPanel } from '../../../components/HealthPanel.js';
import { DashboardView } from '../../../components/DashboardView.js';

/** The health view: ingestion findings across the design system, with a summary of unhealthy items. */
export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const { model, error } = await loadInventory();
  return (
    <DashboardView title="Health" error={error}>
      <HealthPanel findings={model?.health ?? []} />
    </DashboardView>
  );
}
