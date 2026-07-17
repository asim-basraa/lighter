// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { SharedVersion } from '../lib/share.js';
import { SharedMock } from './SharedMock.js';

afterEach(cleanup);

const shared: SharedVersion = {
  screen: { id: 'checkout', name: 'Checkout' },
  version: 2,
  spec: {
    root: {
      type: 'PageShell',
      props: { title: 'Checkout' },
      children: [{ type: 'Button', props: { label: 'Pay', variant: 'primary' }, children: [] }],
    },
  },
};

describe('SharedMock', () => {
  it('renders the shared spec as a live preview', () => {
    render(<SharedMock share={shared} />);
    expect(screen.getByRole('button', { name: 'Pay' })).toBeTruthy();
  });
});
