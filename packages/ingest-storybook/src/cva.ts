import type { CsfArgType, CsfModule } from './csf.js';
import { buildCatalogFromStories, type StorybookCatalog } from './adapter.js';

/** A cva `variants` config: propName → { optionKey → classes }. We only read the option keys. */
export type CvaVariants = Record<string, Record<string, unknown>>;

/** A shadcn-style component described by its cva config (what the shadcn preset extracts). */
export interface CvaComponent {
  name: string;
  description?: string;
  /** The component's `cva` variants — the source of its enum/boolean props. */
  variants?: CvaVariants;
  /** Default variant selections (unused for the schema; kept for preview args). */
  defaultVariants?: Record<string, unknown>;
  /** Non-variant props (e.g. `label`, `href`) as CSF argTypes. */
  argTypes?: Record<string, CsfArgType>;
  /** `['default']` for a container, `[]` (default) for a leaf. */
  slots?: string[];
}

/**
 * Map a cva `variants` config to CSF argTypes — the shadcn synergy. Each variant prop becomes an enum
 * of its option keys, or a boolean when the options are exactly `true`/`false` (a boolean variant). So
 * a shadcn component's variant API turns into catalog prop schemas with zero hand-authoring.
 */
export function cvaVariantsToArgTypes(variants: CvaVariants): Record<string, CsfArgType> {
  const argTypes: Record<string, CsfArgType> = {};
  for (const [prop, options] of Object.entries(variants)) {
    const keys = Object.keys(options);
    if (keys.length > 0 && keys.every((k) => k === 'true' || k === 'false')) {
      argTypes[prop] = { control: 'boolean' };
    } else {
      argTypes[prop] = { control: 'select', options: keys };
    }
  }
  return argTypes;
}

/**
 * Build a Lighter catalog directly from a set of shadcn/cva components (no Storybook needed): each
 * component's cva variants + extra argTypes become its prop schema, reusing the same CSF → catalog
 * transformation so the output is identical in shape and directly ingestable.
 */
export function buildCatalogFromCva(components: CvaComponent[]): StorybookCatalog {
  const modules: CsfModule[] = components.map((comp) => ({
    default: {
      title: comp.name,
      argTypes: { ...(comp.variants ? cvaVariantsToArgTypes(comp.variants) : {}), ...comp.argTypes },
      parameters: comp.description
        ? { docs: { description: { component: comp.description } } }
        : undefined,
    },
    // A synthetic story so the component counts as having a preview (matches the CSF path).
    Default: { args: comp.defaultVariants ?? {} },
  }));

  const catalog = buildCatalogFromStories(modules);
  // Honor explicit slots (cva describes props, not composition).
  for (const comp of components) {
    if (comp.slots && catalog.components[comp.name]) {
      catalog.components[comp.name]!.slots = comp.slots;
    }
  }
  return catalog;
}
