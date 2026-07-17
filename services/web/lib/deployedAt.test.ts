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

  it('treats a zone-less ISO datetime as UTC, not the viewer local zone', () => {
    // Late-evening UTC must not roll back to the previous day for a viewer west of UTC.
    expect(formatDeployedAt('2026-07-17T23:30:00')).toBe('17 Jul 2026');
  });

  it('respects an explicit timezone offset', () => {
    // 00:30 at +05:00 is 19:30 UTC the previous day → 16 Jul in UTC.
    expect(formatDeployedAt('2026-07-17T00:30:00+05:00')).toBe('16 Jul 2026');
  });

  it('falls back to the raw string when it cannot be parsed', () => {
    expect(formatDeployedAt('not-a-date')).toBe('not-a-date');
  });
});
