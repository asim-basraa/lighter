import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, UsageError } from './ingest-cli.js';

const fixtureRepo = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'example-ds');

describe('ingest CLI', () => {
  it('returns the inventory model as JSON for a repo path', () => {
    const out = run(['node', 'cli', fixtureRepo, '--artifact-dir', 'artifacts']);
    const parsed = JSON.parse(out) as { components: { name: string }[]; tokens: unknown[] };
    expect(parsed.components.map((c) => c.name)).toContain('Button');
    expect(parsed.tokens.length).toBeGreaterThan(0);
  });

  it('throws a UsageError when no repo path is given', () => {
    expect(() => run(['node', 'cli'])).toThrow(UsageError);
  });
});
