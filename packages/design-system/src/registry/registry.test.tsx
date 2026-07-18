// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SpecView, catalog, registry, type PreviewSpec } from './index.js';

afterEach(cleanup);

describe('json-render registry', () => {
  it('exposes a catalog + registry for every catalog component', () => {
    expect(catalog).toBeTruthy();
    expect(registry).toBeTruthy();
  });

  it('renders a json-render spec through the design system', () => {
    const spec = {
      root: 'el-0',
      elements: {
        'el-0': { type: 'PageShell', props: { title: 'Welcome' }, children: ['el-1', 'el-2'] },
        'el-1': { type: 'Text', props: { content: 'Hello from the DS' } },
        'el-2': { type: 'Button', props: { label: 'Get started', variant: 'primary' } },
      },
    } as unknown as PreviewSpec;

    render(<SpecView spec={spec} />);
    expect(screen.getByText('Welcome')).toBeTruthy();
    expect(screen.getByText('Hello from the DS')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy();
  });
});
