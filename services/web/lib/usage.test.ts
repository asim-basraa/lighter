import { describe, it, expect } from 'vitest';
import { usageFor, usageByComponent, type SpecRecord } from './usage.js';

const specs: SpecRecord[] = [
  { screen: 'Checkout', version: 'v2', components: ['Button', 'Card', 'Text'] },
  { screen: 'Checkout', version: 'v1', components: ['Button', 'Text'] },
  { screen: 'Settings', version: 'v1', components: ['Text'] },
  // A duplicate reference (same screen+version listing Button twice across records) must not double-count.
  { screen: 'Checkout', version: 'v2', components: ['Button'] },
];

describe('usageFor', () => {
  it('lists the screens and versions that reference a component', () => {
    expect(usageFor(specs, 'Button')).toEqual([
      { screen: 'Checkout', version: 'v1' },
      { screen: 'Checkout', version: 'v2' },
    ]);
  });

  it('deduplicates identical screen+version references', () => {
    // Button appears in the Checkout/v2 record twice — still one entry.
    expect(
      usageFor(specs, 'Button').filter((r) => r.screen === 'Checkout' && r.version === 'v2'),
    ).toHaveLength(1);
  });

  it('returns an empty list for a component no saved spec references', () => {
    expect(usageFor(specs, 'PageShell')).toEqual([]);
    expect(usageFor([], 'Button')).toEqual([]);
  });
});

describe('usageByComponent', () => {
  it('maps each requested component to its referencing screens+versions', () => {
    const map = usageByComponent(specs, ['Button', 'Card', 'PageShell']);
    expect(map.get('Card')).toEqual([{ screen: 'Checkout', version: 'v2' }]);
    expect(map.get('PageShell')).toEqual([]); // present but unused
    expect(map.get('Button')).toHaveLength(2);
  });
});
