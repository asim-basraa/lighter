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

  it('marks an undeployed studio preview as a draft, and says no review link exists (#164)', () => {
    // The point of #164 is that looking at a screen creates no shareable artifact — the banner has to
    // say so, or a screenshot of a preview is indistinguishable from a deployed prototype.
    render(<VersionBanner screenName="Storefront" version={2} deployedAt={null} />);
    const banner = screen.getByRole('note', { name: /draft preview/i });
    expect(banner.textContent).toContain('Storefront');
    expect(banner.textContent).toContain('v2');
    expect(banner.textContent).toMatch(/not deployed — no review link/);
    // It must NOT claim to be a deployed prototype.
    expect(banner.textContent).not.toMatch(/^Prototype/);
  });
});
