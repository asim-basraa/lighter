import { describe, it, expect } from 'vitest';
import { loadSpecs } from './specs.js';
import type { SpecRecord } from './usage.js';

const records: SpecRecord[] = [
  { screen: 'Checkout', version: 'v2', components: ['PageShell', 'Button'] },
];

describe('loadSpecs', () => {
  it('returns the specs from the API on success', async () => {
    const ok = () => Promise.resolve(new Response(JSON.stringify(records), { status: 200 }));
    const { specs, error } = await loadSpecs(ok);
    expect(error).toBeNull();
    expect(specs).toEqual(records);
  });

  it('folds an error status into a message with an empty spec list', async () => {
    const boom = () => Promise.resolve(new Response('nope', { status: 500 }));
    const { specs, error } = await loadSpecs(boom);
    expect(specs).toEqual([]);
    expect(error).toContain('500');
  });

  it('folds a thrown fetch error into a message', async () => {
    const { specs, error } = await loadSpecs(() => Promise.reject(new Error('ECONNREFUSED')));
    expect(specs).toEqual([]);
    expect(error).toContain('ECONNREFUSED');
  });
});
