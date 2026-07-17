// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { FlowLink } from '../lib/share.js';
import { FlowNav } from './FlowNav.js';

afterEach(cleanup);

describe('FlowNav', () => {
  it('renders nothing when there is no flow', () => {
    const { container } = render(<FlowNav flow={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('links a deployed target to its shared mock', () => {
    const flow: FlowLink[] = [{ label: 'Continue', targetScreenId: 'confirm', token: 'abc123' }];
    render(<FlowNav flow={flow} />);
    const link = screen.getByRole('link', { name: /continue/i });
    expect(link.getAttribute('href')).toBe('/share/abc123');
  });

  it('shows an undeployed target as a disabled control, not a link', () => {
    const flow: FlowLink[] = [{ label: 'Pay', targetScreenId: 'pay', token: null }];
    render(<FlowNav flow={flow} />);
    expect(screen.queryByRole('link', { name: /pay/i })).toBeNull();
    expect(screen.getByText('Pay').getAttribute('aria-disabled')).toBe('true');
  });
});
