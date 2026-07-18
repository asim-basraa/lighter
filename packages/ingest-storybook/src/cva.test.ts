import { describe, it, expect } from 'vitest';
import { CatalogArtifact } from '@lighter/ingestion';
import { cvaVariantsToArgTypes, buildCatalogFromCva } from './cva.js';

describe('cva → argTypes (#120 shadcn preset)', () => {
  it('maps select variants to enums and true/false variants to booleans', () => {
    const argTypes = cvaVariantsToArgTypes({
      variant: { default: '', destructive: '', outline: '' },
      size: { sm: '', default: '', lg: '' },
      loading: { true: '', false: '' },
    });
    expect(argTypes.variant).toEqual({ control: 'select', options: ['default', 'destructive', 'outline'] });
    expect(argTypes.size).toEqual({ control: 'select', options: ['sm', 'default', 'lg'] });
    expect(argTypes.loading).toEqual({ control: 'boolean' });
  });
});

describe('buildCatalogFromCva (#120)', () => {
  const button = {
    name: 'Button',
    description: 'A shadcn button.',
    variants: {
      variant: { default: '', destructive: '', outline: '' },
      size: { sm: '', default: '', lg: '' },
    },
    argTypes: { label: { type: { name: 'string', required: true } } },
  };
  const card = { name: 'Card', slots: ['default'], argTypes: { title: { control: 'text' } } };

  it('produces an ingestable catalog with enum props from cva variants', () => {
    const catalog = buildCatalogFromCva([button, card]);
    expect(() => CatalogArtifact.parse(catalog)).not.toThrow();

    expect(catalog.components.Button).toEqual({
      description: 'A shadcn button.',
      slots: [],
      props: {
        type: 'object',
        additionalProperties: false,
        required: ['label'],
        properties: {
          variant: { enum: ['default', 'destructive', 'outline'] },
          size: { enum: ['sm', 'default', 'lg'] },
          label: { type: 'string' },
        },
      },
    });
  });

  it('honors explicit slots (cva describes props, not composition)', () => {
    const catalog = buildCatalogFromCva([card]);
    expect(catalog.components.Card!.slots).toEqual(['default']);
  });
});
