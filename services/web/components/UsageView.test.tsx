// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { UsageView } from './UsageView.js';
import type { InventoryComponent } from '../lib/inventory.js';
import type { SpecRecord } from '../lib/usage.js';

afterEach(cleanup);

const components: InventoryComponent[] = [
  { name: 'Button', description: 'x', slots: [], props: {} },
  { name: 'PageShell', description: 'x', slots: ['default'], props: {} },
];

const specs: SpecRecord[] = [
  { screen: 'Checkout', version: 'v2', components: ['Button'] },
  { screen: 'Settings', version: 'v1', components: ['Button'] },
];

function card(name: string) {
  return screen.getByRole('heading', { name }).closest('[data-component]') as HTMLElement;
}

describe('UsageView', () => {
  it('lists the referencing screens and versions for a used component', () => {
    render(<UsageView components={components} specs={specs} />);
    const button = card('Button');
    expect(within(button).getByText(/Checkout/)).toBeTruthy();
    expect(within(button).getByText(/v2/)).toBeTruthy();
    expect(within(button).getByText(/Settings/)).toBeTruthy();
  });

  it('shows an empty state for a component no spec references', () => {
    render(<UsageView components={components} specs={specs} />);
    expect(within(card('PageShell')).getByText(/not used|no saved spec/i)).toBeTruthy();
  });

  it('shows a distinct "no saved specs yet" notice when specs are empty (live state pending #15)', () => {
    render(<UsageView components={components} specs={[]} />);
    // A single page-level notice — not 40 misleading per-component "Not used" rows.
    expect(screen.getByText(/no saved specs yet/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Button' })).toBeNull();
  });

  it('shows an empty state when there are no components at all', () => {
    render(<UsageView components={[]} specs={[]} />);
    expect(screen.getByText(/no components/i)).toBeTruthy();
  });
});
