// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HealthBadge } from './HealthBadge.js';
import type { HealthFinding } from '../lib/inventory.js';

afterEach(cleanup);

describe('HealthBadge', () => {
  it('shows a healthy state when there are no findings', () => {
    render(<HealthBadge findings={[]} />);
    expect(screen.getByText(/healthy/i)).toBeTruthy();
  });

  it('shows the count of findings when unhealthy', () => {
    const findings: HealthFinding[] = [
      { kind: 'missing-preview', target: 'Widget', message: 'no preview' },
      { kind: 'missing-description', target: 'Widget', message: 'no description' },
    ];
    render(<HealthBadge findings={findings} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText(/healthy/i)).toBeNull();
  });

  it('names the finding kinds it represents (accessible label)', () => {
    const findings: HealthFinding[] = [
      { kind: 'missing-preview', target: 'Widget', message: 'no preview' },
    ];
    render(<HealthBadge findings={findings} />);
    expect(screen.getByRole('status').getAttribute('aria-label')).toMatch(/missing preview/i);
  });
});
