import { describe, it, expect } from 'vitest';
import { findingsByTarget, findingsFor, healthSummary } from './health.js';
import type { HealthFinding } from './inventory.js';

const findings: HealthFinding[] = [
  { kind: 'missing-description', target: 'Widget', message: 'Widget has no description.' },
  { kind: 'missing-preview', target: 'Widget', message: 'Widget has no preview.' },
  { kind: 'orphaned-token', target: 'color.red.500', message: 'token unused' },
];

describe('healthSummary', () => {
  it('counts total findings, affected targets, and a per-kind breakdown', () => {
    const s = healthSummary(findings);
    expect(s.total).toBe(3);
    expect(s.affected).toBe(2); // Widget + color.red.500
    expect(s.byKind['missing-description']).toBe(1);
    expect(s.byKind['missing-preview']).toBe(1);
    expect(s.byKind['orphaned-token']).toBe(1);
    expect(s.healthy).toBe(false);
  });

  it('reports a healthy system when there are no findings', () => {
    const s = healthSummary([]);
    expect(s.total).toBe(0);
    expect(s.affected).toBe(0);
    expect(s.healthy).toBe(true);
    expect(s.byKind['orphaned-token']).toBe(0);
  });
});

describe('findingsByTarget / findingsFor', () => {
  it('groups findings under their target', () => {
    const map = findingsByTarget(findings);
    expect(map.get('Widget')!.map((f) => f.kind)).toEqual([
      'missing-description',
      'missing-preview',
    ]);
    expect(map.get('color.red.500')).toHaveLength(1);
  });

  it('filters the findings for a single target', () => {
    expect(findingsFor(findings, 'Widget')).toHaveLength(2);
    expect(findingsFor(findings, 'Nope')).toEqual([]);
  });
});
