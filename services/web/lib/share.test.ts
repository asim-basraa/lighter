import { describe, it, expect } from 'vitest';
import type { Spec } from '@lighter/spec';
import { loadShare } from './share.js';

const spec: Spec = {
  root: {
    type: 'PageShell',
    props: { title: 'Checkout' },
    children: [{ type: 'Button', props: { label: 'Pay', variant: 'primary' }, children: [] }],
  },
};

const sharedBody = {
  screen: { id: 'checkout', name: 'Checkout' },
  version: 2,
  spec,
  deployedAt: '2026-07-17 09:30:00',
};

const okResponse = () =>
  new Response(JSON.stringify(sharedBody), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('loadShare', () => {
  it('returns the shared version on success', async () => {
    const loaded = await loadShare('tok', () => okResponse());
    expect(loaded.error).toBeNull();
    expect(loaded.share).toEqual(sharedBody);
  });

  it('folds a 404 into a not-found error without throwing', async () => {
    const loaded = await loadShare('nope', () => new Response('', { status: 404 }));
    expect(loaded.share).toBeNull();
    expect(loaded.error).toMatch(/not found/i);
  });

  it('folds any other failure into a generic message that does not leak internals', async () => {
    const loaded = await loadShare('tok', () => new Response('', { status: 500 }));
    expect(loaded.share).toBeNull();
    expect(loaded.error).toMatch(/something went wrong/i);
    // The upstream status/URL must not reach an unauthenticated viewer.
    expect(loaded.error).not.toMatch(/500/);
  });
});
