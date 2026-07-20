import { describe, it, expect } from 'vitest';
import { SpecSchema } from '@lighter/spec';
import type { Spec } from '@lighter/spec';
import { specElements } from './specElements.js';

const spec: Spec = SpecSchema.parse({
  root: {
    type: 'PageShell',
    props: { title: 'Checkout' },
    children: [
      { type: 'Text', props: { content: 'Hi', size: 'md' }, children: [] },
      { type: 'Button', props: { label: 'Pay', variant: 'primary' }, children: [] },
    ],
  },
});

describe('specElements', () => {
  it('lists every element as an { id, type } anchor in pre-order', () => {
    expect(specElements(spec)).toEqual([
      { id: 'el-0', type: 'PageShell' },
      { id: 'el-1', type: 'Text' },
      { id: 'el-2', type: 'Button' },
    ]);
  });
});
