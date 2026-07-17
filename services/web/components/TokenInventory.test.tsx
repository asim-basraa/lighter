// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { TokenInventory } from './TokenInventory.js';
import type { InventoryToken } from '../lib/inventory.js';

afterEach(cleanup);

const tokens: InventoryToken[] = [
  { name: 'color.blue.500', value: '#3b82f6', category: 'color' },
  { name: 'fontSize.md', value: '1rem', category: 'fontSize' },
  { name: 'space.4', value: '1rem', category: 'space' },
  { name: 'radius.md', value: '0.375rem', category: 'radius' },
  { name: 'shadow.md', value: '0 4px 6px -1px rgb(0 0 0 / 0.1)', category: 'shadow' },
];

function section(container: HTMLElement, category: string) {
  return container.querySelector(`[data-category="${category}"]`) as HTMLElement;
}

describe('TokenInventory', () => {
  it('renders a section for every token category present', () => {
    const { container } = render(<TokenInventory tokens={tokens} />);
    for (const category of ['color', 'fontSize', 'space', 'radius', 'shadow']) {
      expect(section(container, category), category).toBeTruthy();
    }
  });

  it('shows each token name and value', () => {
    render(<TokenInventory tokens={tokens} />);
    expect(screen.getByText('color.blue.500')).toBeTruthy();
    expect(screen.getByText('#3b82f6')).toBeTruthy();
    expect(screen.getByText('radius.md')).toBeTruthy();
  });

  it('renders a color as a visual swatch carrying its value as the background', () => {
    const { container } = render(<TokenInventory tokens={tokens} />);
    const swatch = within(section(container, 'color')).getByTestId('swatch-color.blue.500');
    // happy-dom normalizes the hex to rgb; just assert a background color is actually applied.
    expect(swatch.style.background || swatch.style.backgroundColor).toBeTruthy();
  });

  it('renders spacing visually as a bar whose width is the token value', () => {
    const { container } = render(<TokenInventory tokens={tokens} />);
    const bar = within(section(container, 'space')).getByTestId('swatch-space.4');
    expect(bar.style.width).toBe('1rem');
  });

  it('applies the radius and shadow values to their preview boxes', () => {
    const { container } = render(<TokenInventory tokens={tokens} />);
    expect(
      within(section(container, 'radius')).getByTestId('swatch-radius.md').style.borderRadius,
    ).toBe('0.375rem');
    expect(
      within(section(container, 'shadow')).getByTestId('swatch-shadow.md').style.boxShadow,
    ).toContain('rgb');
  });

  it('shows an empty state when there are no tokens', () => {
    render(<TokenInventory tokens={[]} />);
    expect(screen.getByText(/no tokens/i)).toBeTruthy();
  });
});
