// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SpecView, ELEMENT_ID_ATTR } from './index.js';
import type { PreviewSpec } from './index.js';

afterEach(cleanup);

/** A nested spec: shell → grid → card → button, so ids must be threaded several levels deep. */
const spec = {
  root: 'el-0',
  elements: {
    'el-0': { type: 'PageShell', props: { title: 'Shop' }, children: ['el-1'] },
    'el-1': { type: 'Grid', props: { columns: 2, gap: '4' }, children: ['el-2', 'el-4'] },
    'el-2': { type: 'Card', props: { title: 'Slate Runner' }, children: ['el-3'] },
    'el-3': { type: 'Button', props: { label: 'Add to cart', variant: 'primary' } },
    'el-4': { type: 'Text', props: { content: 'Second column' } },
  },
} as unknown as PreviewSpec;

const ids = (root: HTMLElement) =>
  [...root.querySelectorAll(`[${ELEMENT_ID_ATTR}]`)].map((n) => n.getAttribute(ELEMENT_ID_ATTR));

describe('element identity for review tooling (#160)', () => {
  it('tags every element with its spec id when annotate is on', () => {
    const { container } = render(<SpecView spec={spec} annotate />);
    // Every element in the spec is represented, in pre-order.
    expect(ids(container)).toEqual(['el-0', 'el-1', 'el-2', 'el-3', 'el-4']);
  });

  it('anchors ids to the right components (so a comment lands on what the reviewer clicked)', () => {
    const { container } = render(<SpecView spec={spec} annotate />);
    const at = (id: string) => container.querySelector(`[${ELEMENT_ID_ATTR}="${id}"]`);
    expect(at('el-3')?.textContent).toContain('Add to cart');
    expect(at('el-4')?.textContent).toContain('Second column');
    // A container's subtree includes its children — this is what makes "comment on a block" work.
    expect(at('el-2')?.textContent).toContain('Add to cart');
    expect(at('el-1')?.textContent).toContain('Second column');
  });

  it('carries the id on a display:contents wrapper, so it generates no box', () => {
    const { container } = render(<SpecView spec={spec} annotate />);
    for (const node of container.querySelectorAll(`[${ELEMENT_ID_ATTR}]`)) {
      expect((node as HTMLElement).style.display).toBe('contents');
    }
  });

  it('is OFF by default — a consumer render is unchanged', () => {
    const { container } = render(<SpecView spec={spec} />);
    expect(ids(container)).toEqual([]);
  });

  it('renders identical content with and without annotation (fidelity guard)', () => {
    // The review surface must render what the product renders (#158/#159). Annotation may add id
    // carriers, but must not change the rendered text/structure of the components themselves.
    const plain = render(<SpecView spec={spec} />).container.textContent;
    cleanup();
    const tagged = render(<SpecView spec={spec} annotate />).container.textContent;
    expect(tagged).toBe(plain);
  });
});
