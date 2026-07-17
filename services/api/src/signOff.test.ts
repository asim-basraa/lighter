import { describe, it, expect } from 'vitest';
import { validateSignOffSet, missingSignOffs } from './signOff.js';

describe('validateSignOffSet (#26)', () => {
  it('accepts a set with at least one customer and one internal owner', () => {
    const r = validateSignOffSet([
      { party: 'acme', role: 'customer' },
      { party: 'lead', role: 'internal' },
    ]);
    expect(r.ok).toBe(true);
  });

  it('rejects a set missing a customer', () => {
    const r = validateSignOffSet([{ party: 'lead', role: 'internal' }]);
    expect(r.ok).toBe(false);
  });

  it('rejects a set missing an internal owner', () => {
    const r = validateSignOffSet([{ party: 'acme', role: 'customer' }]);
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown role, empty party, or duplicate party', () => {
    expect(validateSignOffSet([{ party: 'x', role: 'manager' }]).ok).toBe(false);
    expect(
      validateSignOffSet([
        { party: '', role: 'customer' },
        { party: 'lead', role: 'internal' },
      ]).ok,
    ).toBe(false);
    expect(
      validateSignOffSet([
        { party: 'dup', role: 'customer' },
        { party: 'dup', role: 'internal' },
      ]).ok,
    ).toBe(false);
  });
});

describe('missingSignOffs (#26)', () => {
  const required = [
    { party: 'acme', role: 'customer' },
    { party: 'lead', role: 'internal' },
  ];

  it('lists the parties that have not signed', () => {
    expect(missingSignOffs(required, ['acme'])).toEqual(['lead']);
  });

  it('is empty when all required parties have signed', () => {
    expect(missingSignOffs(required, ['acme', 'lead'])).toEqual([]);
  });

  it('ignores sign-offs from parties not in the set', () => {
    expect(missingSignOffs(required, ['acme', 'stranger'])).toEqual(['lead']);
  });
});
