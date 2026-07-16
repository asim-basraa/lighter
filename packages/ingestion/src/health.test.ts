import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingest } from './ingest.js';
import { computeHealth } from './health.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const health = (repo: string) => ingest(join(fixtures, repo), { artifactDir: 'artifacts' }).health;

describe('ingestion health findings', () => {
  it('reports no findings for a healthy design system — with previews + usedTokens present so the checks actually run', () => {
    expect(health('example-ds')).toEqual([]);
  });

  it('flags missing descriptions, missing previews, and orphaned tokens', () => {
    const findings = health('unhealthy-ds');
    const targetsFor = (kind: string) =>
      findings.filter((f) => f.kind === kind).map((f) => f.target);

    expect(targetsFor('missing-description')).toEqual(['Widget']); // whitespace-only description
    expect(targetsFor('missing-preview')).toEqual(['Widget']); // absent from previews
    expect(targetsFor('orphaned-token')).toEqual(['radius.none']); // absent from usedTokens
    expect(findings).toHaveLength(3);
  });

  it('is sorted by kind then target for stable output', () => {
    const findings = health('unhealthy-ds');
    const sorted = [...findings].sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.target.localeCompare(b.target),
    );
    expect(findings).toEqual(sorted);
  });

  it('skips preview/token checks when the artifact omits previews and usedTokens', () => {
    const findings = computeHealth(
      { components: { A: { description: 'A well described component.', slots: [], props: {} } } },
      [{ name: 'color.x', value: '#000', category: 'color' }],
    );
    // No previews/usedTokens ⇒ absence of signal is not a finding; description is fine ⇒ none.
    expect(findings).toEqual([]);
  });

  it('treats present-but-empty previews/usedTokens as "flag everything", not skip', () => {
    // An empty array is a real (truthy) signal distinct from omission: the repo declares it ships
    // zero previews and references zero tokens, so every component/token should be flagged.
    const findings = computeHealth(
      {
        components: { A: { description: 'A well described component.', slots: [], props: {} } },
        previews: [],
        usedTokens: [],
      },
      [{ name: 'color.x', value: '#000', category: 'color' }],
    );
    expect(findings).toEqual([
      { kind: 'missing-preview', target: 'A', message: 'Component "A" has no preview spec.' },
      {
        kind: 'orphaned-token',
        target: 'color.x',
        message: 'Token "color.x" is not referenced by any component.',
      },
    ]);
  });
});
