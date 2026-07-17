// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import type { Spec } from '@lighter/spec';
import { VariationsView } from './VariationsView.js';

afterEach(cleanup);

const variation = (label: string): Spec => ({
  root: {
    type: 'PageShell',
    props: { title: label },
    children: [{ type: 'Button', props: { label, variant: 'primary' }, children: [] }],
  },
});

describe('VariationsView', () => {
  it('renders each variation side by side as a live preview', () => {
    const { container } = render(<VariationsView specs={[variation('One'), variation('Two')]} />);
    // Two variation columns, each a live SpecView rendering its own button.
    const columns = container.querySelectorAll('[data-variation]');
    expect(columns).toHaveLength(2);
    expect(within(columns[0] as HTMLElement).getByRole('button', { name: 'One' })).toBeTruthy();
    expect(within(columns[1] as HTMLElement).getByRole('button', { name: 'Two' })).toBeTruthy();
    // Labeled for comparison.
    expect(screen.getByText('Variation 1')).toBeTruthy();
    expect(screen.getByText('Variation 2')).toBeTruthy();
  });

  it('shows an empty state when there are no variations', () => {
    render(<VariationsView specs={[]} />);
    expect(screen.getByText(/no variations/i)).toBeTruthy();
  });
});
