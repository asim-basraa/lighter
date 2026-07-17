// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HealthPanel } from './HealthPanel.js';
import type { HealthFinding } from '../lib/inventory.js';

afterEach(cleanup);

const findings: HealthFinding[] = [
  { kind: 'missing-description', target: 'Widget', message: 'Widget has no description.' },
  { kind: 'missing-preview', target: 'Widget', message: 'Widget has no preview.' },
  { kind: 'orphaned-token', target: 'color.red.500', message: 'Token unused.' },
];

describe('HealthPanel', () => {
  it('summarizes the count of unhealthy items', () => {
    render(<HealthPanel findings={findings} />);
    // 2 affected targets (Widget + color.red.500), 3 findings total.
    const summary = screen.getByRole('status');
    expect(summary.textContent).toMatch(/2/);
    expect(summary.textContent).toMatch(/3/);
  });

  it('lists each finding grouped under its target', () => {
    render(<HealthPanel findings={findings} />);
    expect(screen.getByRole('heading', { name: 'Widget' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'color.red.500' })).toBeTruthy();
    expect(screen.getByText('Widget has no preview.')).toBeTruthy();
    expect(screen.getByText('Token unused.')).toBeTruthy();
  });

  it('shows a healthy state when there are no findings', () => {
    render(<HealthPanel findings={[]} />);
    expect(screen.getByText(/all healthy|no findings|healthy/i)).toBeTruthy();
  });
});
