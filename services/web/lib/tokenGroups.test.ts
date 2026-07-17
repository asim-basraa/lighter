import { describe, it, expect } from 'vitest';
import { groupTokensByCategory } from './tokenGroups.js';
import type { InventoryToken } from './inventory.js';

const tokens: InventoryToken[] = [
  { name: 'radius.md', value: '0.375rem', category: 'radius' },
  { name: 'color.blue.500', value: '#3b82f6', category: 'color' },
  { name: 'space.4', value: '1rem', category: 'space' },
  { name: 'color.neutral.900', value: '#0f172a', category: 'color' },
  { name: 'shadow.md', value: '0 4px 6px rgba(0,0,0,.1)', category: 'shadow' },
  { name: 'fontSize.md', value: '1rem', category: 'fontSize' },
  { name: 'brand.primary', value: '#abc', category: 'brand' },
];

describe('groupTokensByCategory', () => {
  it('groups tokens under their category', () => {
    const groups = groupTokensByCategory(tokens);
    const color = groups.find((g) => g.category === 'color')!;
    expect(color.tokens.map((t) => t.name)).toEqual(['color.blue.500', 'color.neutral.900']);
  });

  it('orders the five known categories first, unknown ones alphabetically after', () => {
    const order = groupTokensByCategory(tokens).map((g) => g.category);
    expect(order).toEqual(['color', 'fontSize', 'space', 'radius', 'shadow', 'brand']);
  });

  it('preserves the incoming token order within a category', () => {
    const groups = groupTokensByCategory([
      { name: 'space.8', value: '2rem', category: 'space' },
      { name: 'space.1', value: '0.25rem', category: 'space' },
    ]);
    expect(groups[0]!.tokens.map((t) => t.name)).toEqual(['space.8', 'space.1']);
  });

  it('returns an empty array for no tokens', () => {
    expect(groupTokensByCategory([])).toEqual([]);
  });
});
