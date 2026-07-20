import { describe, it, expect } from 'vitest';
import { validateAgainstCatalog, type Catalog } from './catalog-validate.js';
import { SpecSchema, type Spec } from './spec.js';

// Catalog shaped like the ingested one (props are JSON Schema, as lighter-example emits).
const catalog: Catalog = {
  PageShell: {
    props: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
      additionalProperties: false,
    },
  },
  Text: {
    props: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        size: { anyOf: [{ type: 'string', enum: ['sm', 'md', 'lg', 'xl'] }, { type: 'null' }] },
      },
      required: ['content', 'size'],
      additionalProperties: false,
    },
  },
};

const valid: Spec = SpecSchema.parse({
  root: {
    type: 'PageShell',
    props: { title: 'Home' },
    children: [{ type: 'Text', props: { content: 'Hi', size: 'md' }, children: [] }],
  },
});

describe('validateAgainstCatalog', () => {
  it('returns no issues for a spec that matches the catalog', () => {
    expect(validateAgainstCatalog(valid, catalog)).toEqual([]);
  });

  it('flags an unknown component with its path', () => {
    const spec: Spec = SpecSchema.parse({ root: { type: 'Ghost', props: {}, children: [] } });
    const issues = validateAgainstCatalog(spec, catalog);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'root',
      component: 'Ghost',
      code: 'unknown-component',
    });
  });

  it('flags props that violate the component schema (wrong enum value)', () => {
    const spec: Spec = SpecSchema.parse({
      root: { type: 'Text', props: { content: 'Hi', size: 'huge' }, children: [] },
    });
    const issues = validateAgainstCatalog(spec, catalog);
    expect(issues.some((i) => i.code === 'invalid-props' && i.component === 'Text')).toBe(true);
  });

  it('flags a missing required prop', () => {
    const spec: Spec = SpecSchema.parse({ root: { type: 'PageShell', props: {}, children: [] } });
    const issues = validateAgainstCatalog(spec, catalog);
    expect(issues[0]!.code).toBe('invalid-props');
    expect(issues[0]!.message).toMatch(/required|title/i);
  });

  it('flags an unexpected extra prop (additionalProperties: false)', () => {
    const spec: Spec = SpecSchema.parse({
      root: { type: 'PageShell', props: { title: 'Home', bogus: 1 }, children: [] },
    });
    expect(validateAgainstCatalog(spec, catalog).some((i) => i.code === 'invalid-props')).toBe(
      true,
    );
  });

  it('reports issues from deep in the tree with a precise path', () => {
    const spec: Spec = SpecSchema.parse({
      root: {
        type: 'PageShell',
        props: { title: 'Home' },
        children: [{ type: 'Text', props: { content: 'x', size: 'nope' }, children: [] }],
      },
    });
    const issue = validateAgainstCatalog(spec, catalog).find((i) => i.component === 'Text');
    expect(issue?.path).toBe('root/children/0');
  });

  it('treats a prototype-chain key as an unknown component, not a crash', () => {
    // `constructor`/`__proto__`/`toString` exist on the prototype; must not slip past the check.
    for (const type of ['constructor', '__proto__', 'toString']) {
      const spec: Spec = SpecSchema.parse({ root: { type, props: {}, children: [] } });
      const issues = validateAgainstCatalog(spec, catalog);
      expect(issues[0]).toMatchObject({ code: 'unknown-component', component: type });
    }
  });

  it('reports a non-compilable catalog schema as an issue rather than throwing', () => {
    const brokenCatalog: Catalog = {
      Widget: { props: { $ref: '#/definitions/DoesNotExist' } },
    };
    const spec: Spec = SpecSchema.parse({ root: { type: 'Widget', props: {}, children: [] } });
    const issues = validateAgainstCatalog(spec, brokenCatalog);
    expect(issues[0]?.code).toBe('catalog-schema-invalid');
  });

  it('honors nullable-required props: null passes, omission fails', () => {
    // Text.size is `.nullable()` → required but may be null.
    const withNull: Spec = SpecSchema.parse({
      root: { type: 'Text', props: { content: 'Hi', size: null }, children: [] },
    });
    expect(validateAgainstCatalog(withNull, catalog)).toEqual([]);

    const omitted: Spec = SpecSchema.parse({ root: { type: 'Text', props: { content: 'Hi' }, children: [] } });
    expect(validateAgainstCatalog(omitted, catalog).some((i) => i.code === 'invalid-props')).toBe(
      true,
    );
  });

  it('collects all issues, not just the first', () => {
    const spec: Spec = SpecSchema.parse({
      root: {
        type: 'Ghost',
        props: {},
        children: [{ type: 'Text', props: { content: 'x', size: 'bad' }, children: [] }],
      },
    });
    const issues = validateAgainstCatalog(spec, catalog);
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});
