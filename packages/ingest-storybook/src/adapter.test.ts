import { describe, it, expect } from 'vitest';
import { CatalogArtifact } from '@lighter/ingestion';
import { buildCatalogFromStories, argTypeToSchema, componentName } from './adapter.js';
import type { CsfModule } from './csf.js';

const buttonStories: CsfModule = {
  default: {
    title: 'Components/Button',
    component: { displayName: 'Button' },
    argTypes: {
      label: { type: { name: 'string', required: true } },
      variant: { control: 'select', options: ['primary', 'secondary'] },
      disabled: { control: 'boolean' },
    },
    parameters: { docs: { description: { component: 'A clickable button.' } } },
  },
  Primary: { args: { label: 'Go', variant: 'primary' } },
  Secondary: { args: { label: 'Back', variant: 'secondary' } },
};

const cardStories: CsfModule = {
  default: {
    title: 'Layout/Card',
    argTypes: {
      title: { control: 'text' },
      children: { control: 'text' },
    },
  },
  Default: { args: { title: 'Hi' } },
};

describe('argTypeToSchema (#88)', () => {
  it('maps a required docgen string type', () => {
    expect(argTypeToSchema({ type: { name: 'string', required: true } })).toEqual({
      schema: { type: 'string' },
      required: true,
    });
  });
  it('maps options to an enum', () => {
    expect(argTypeToSchema({ control: 'select', options: ['a', 'b'] })).toEqual({
      schema: { enum: ['a', 'b'] },
      required: false,
    });
  });
  it('maps controls to primitives', () => {
    expect(argTypeToSchema({ control: 'boolean' }).schema).toEqual({ type: 'boolean' });
    expect(argTypeToSchema({ control: 'number' }).schema).toEqual({ type: 'number' });
    expect(argTypeToSchema({ control: 'text' }).schema).toEqual({ type: 'string' });
  });
  it('is permissive for unknown controls', () => {
    expect(argTypeToSchema({ control: 'color' }).schema).toEqual({});
  });
});

describe('componentName (#88)', () => {
  it('prefers the component displayName', () => {
    expect(componentName({ title: 'X/Y', component: { displayName: 'Button' } })).toBe('Button');
  });
  it('falls back to the title last segment', () => {
    expect(componentName({ title: 'Components/Nav/Link' })).toBe('Link');
  });
  it('throws when neither is present', () => {
    expect(() => componentName({})).toThrow();
  });
});

describe('buildCatalogFromStories (#88)', () => {
  it('produces a valid Lighter catalog (validates against the ingestion contract)', () => {
    const catalog = buildCatalogFromStories([buttonStories, cardStories]);
    // The whole point: the adapter output IS ingestable.
    expect(() => CatalogArtifact.parse(catalog)).not.toThrow();
  });

  it('maps components, props, required, enums, description, and slots', () => {
    const { components } = buildCatalogFromStories([buttonStories, cardStories]);
    expect(Object.keys(components)).toEqual(['Button', 'Card']); // sorted

    expect(components.Button).toEqual({
      description: 'A clickable button.',
      slots: [],
      props: {
        type: 'object',
        additionalProperties: false,
        required: ['label'],
        properties: {
          label: { type: 'string' },
          variant: { enum: ['primary', 'secondary'] },
          disabled: { type: 'boolean' },
        },
      },
    });

    // `children` argType ⇒ container slot; missing docs ⇒ empty description (health will flag it).
    expect(components.Card!.slots).toEqual(['default']);
    expect(components.Card!.description).toBe('');
  });

  it('lists components with stories as previews', () => {
    const { previews } = buildCatalogFromStories([buttonStories, cardStories]);
    expect(previews).toEqual(['Button', 'Card']);
  });
});
