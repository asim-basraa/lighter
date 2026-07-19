import { loadInventory, apiInventoryFetcher } from '../../../lib/inventory.js';
import { apiAuthHeaders } from '../../../lib/session.js';
import { TokenInventory } from '../../../components/TokenInventory.js';
import { DashboardView } from '../../../components/DashboardView.js';

/** The token inventory view: every ingested token, grouped by category and rendered visually. */
export const dynamic = 'force-dynamic';

export default async function TokensPage() {
  const { model, error } = await loadInventory(
    apiInventoryFetcher(undefined, await apiAuthHeaders()),
  );
  return (
    <DashboardView title="Tokens" error={error}>
      <TokenInventory tokens={model?.tokens ?? []} />
    </DashboardView>
  );
}
