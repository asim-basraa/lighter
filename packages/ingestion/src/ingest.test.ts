import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingest } from './ingest.js';

const fixtureRepo = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'example-ds');
const ingestFixture = () => ingest(fixtureRepo, { artifactDir: 'artifacts' });

describe('ingest — pure inventory projection of a design-system repo', () => {
  it('produces the example design system’s components with descriptions and slots', () => {
    const model = ingestFixture();
    const names = model.components.map((c) => c.name);
    expect(names).toEqual(['Button', 'Card', 'PageShell', 'Stack', 'Text']); // sorted

    const shell = model.components.find((c) => c.name === 'PageShell');
    expect(shell?.slots).toEqual(['default']); // container
    expect(shell?.description.length).toBeGreaterThan(20);

    const button = model.components.find((c) => c.name === 'Button');
    expect(button?.slots).toEqual([]); // leaf
  });

  it('exposes each component’s props as a JSON Schema', () => {
    const button = ingestFixture().components.find((c) => c.name === 'Button');
    const props = button?.props as { properties?: Record<string, unknown> };
    expect(props.properties).toHaveProperty('label');
    expect(props.properties).toHaveProperty('variant');
  });

  it('normalizes tokens into name/value/category, sorted', () => {
    const { tokens } = ingestFixture();
    const blue = tokens.find((t) => t.name === 'color.blue.500');
    expect(blue?.value).toBe('#3b82f6');
    expect(blue?.category).toBe('color');
    // categories cover the five foundations
    const categories = new Set(tokens.map((t) => t.category));
    for (const c of ['color', 'fontSize', 'space', 'radius', 'shadow']) {
      expect(categories.has(c), c).toBe(true);
    }
    // stable, sorted output
    const sorted = [...tokens].sort((a, b) => a.name.localeCompare(b.name));
    expect(tokens).toEqual(sorted);
  });

  it('is deterministic — same repo yields a deep-equal model each call', () => {
    expect(ingestFixture()).toEqual(ingestFixture());
  });

  it('fails loudly with the missing path when artifacts are absent', () => {
    const empty = mkdtempSync(join(tmpdir(), 'empty-ds-'));
    try {
      expect(() => ingest(empty)).toThrow(/could not read required artifact.*tokens\.json/is);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('reports the artifact path when an artifact is structurally malformed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bad-ds-'));
    const art = join(dir, 'artifacts');
    mkdirSync(art);
    // valid JSON, but a token value is a number rather than a string
    writeFileSync(join(art, 'tokens.json'), JSON.stringify({ 'space.4': 16 }));
    writeFileSync(join(art, 'catalog.json'), JSON.stringify({ components: {} }));
    try {
      expect(() => ingest(dir, { artifactDir: 'artifacts' })).toThrow(
        /malformed artifact.*tokens\.json/is,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports catalog.json by path when the catalog artifact is malformed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bad-catalog-'));
    const art = join(dir, 'artifacts');
    mkdirSync(art);
    // tokens.json is valid, so failure must originate from the catalog parse branch
    writeFileSync(join(art, 'tokens.json'), JSON.stringify({ 'space.4': '1rem' }));
    // valid JSON, but the Button entry is missing the required `description` field
    writeFileSync(
      join(art, 'catalog.json'),
      JSON.stringify({ components: { Button: { slots: [], props: {} } } }),
    );
    try {
      expect(() => ingest(dir, { artifactDir: 'artifacts' })).toThrow(
        /malformed artifact.*catalog\.json/is,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
