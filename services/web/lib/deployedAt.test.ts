import { describe, it, expect } from 'vitest';
import { formatDeployedAt } from './deployedAt.js';

describe('formatDeployedAt', () => {
  it('formats a SQLite UTC timestamp as a stable, human date', () => {
    // Rendered in UTC so the banner reads the same regardless of the viewer's timezone.
    expect(formatDeployedAt('2026-07-17 09:30:00')).toBe('17 Jul 2026');
  });

  it('also accepts an ISO timestamp', () => {
    expect(formatDeployedAt('2026-01-05T23:59:59Z')).toBe('5 Jan 2026');
  });

  it('falls back to the raw string when it cannot be parsed', () => {
    expect(formatDeployedAt('not-a-date')).toBe('not-a-date');
  });
});
