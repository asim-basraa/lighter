// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { VersionBanner } from './VersionBanner.js';

afterEach(cleanup);

describe('VersionBanner', () => {
  it('shows the screen, version, deploy date, and a prototype signal', () => {
    render(<VersionBanner screenName="Checkout" version={3} deployedAt="2026-07-17 09:30:00" />);
    const banner = screen.getByRole('note'); // a labelled, non-interactive banner
    expect(banner.textContent).toContain('Checkout');
    expect(banner.textContent).toContain('v3');
    expect(banner.textContent).toContain('17 Jul 2026');
    expect(banner.textContent).toMatch(/prototype/i);
  });
});
