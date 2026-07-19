import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

/**
 * The component catalog: the machine-readable declaration of what this design system offers and how
 * it may be composed. Each entry pairs a Zod prop schema with a first-class description — description
 * quality gates generation quality, so these are owned documentation, not afterthoughts.
 *
 * Exported standalone (not only inside the built catalog) so Lighter's ingestion can read component
 * names, prop schemas, and descriptions directly.
 */
export const components = {
  PageShell: {
    props: z.object({
      title: z.string(),
    }),
    slots: ['default'],
    description:
      'The layout-owning page shell. Every screen starts from a shell; renders a titled header above a main content region. Put page content in its children.',
  },
  Stack: {
    props: z.object({
      direction: z.enum(['vertical', 'horizontal']).nullable(),
      gap: z.enum(['1', '2', '4', '6', '8']).nullable(),
    }),
    slots: ['default'],
    description:
      'A flex layout container that stacks its children vertically (default) or horizontally with a spacing-token gap. Use for arranging components.',
  },
  Card: {
    props: z.object({
      title: z.string().nullable(),
    }),
    slots: ['default'],
    description:
      'A surface container with optional title, border, radius and shadow. Use to group related content.',
  },
  Text: {
    props: z.object({
      content: z.string(),
      size: z.enum(['sm', 'md', 'lg', 'xl']).nullable(),
    }),
    description:
      'A paragraph of text at one of the type-scale sizes. Use for body copy and labels.',
  },
  Button: {
    props: z.object({
      label: z.string(),
      variant: z.enum(['primary', 'secondary']).nullable(),
    }),
    description: 'A clickable button in a primary or secondary variant.',
  },
};

export const catalog = defineCatalog(schema, {
  components,
  actions: {},
});

/** The component names this design system exposes, in catalog order. */
export const componentNames = Object.keys(components);
