import type { CsfArgType, CsfMeta, CsfModule } from './csf.js';

/** A single component's catalog entry — matches `@lighter/ingestion`'s CatalogEntryArtifact shape. */
export interface CatalogEntry {
  description: string;
  slots: string[];
  props: Record<string, unknown>;
}

/** The catalog produced from a set of stories — matches `@lighter/ingestion`'s CatalogArtifact shape. */
export interface StorybookCatalog {
  components: Record<string, CatalogEntry>;
  previews: string[];
}

/** Derive the component name: prefer the component's own name, fall back to the title's last segment. */
export function componentName(meta: CsfMeta): string {
  const comp = meta.component as { displayName?: unknown; name?: unknown } | undefined;
  if (comp && typeof comp === 'object') {
    if (typeof comp.displayName === 'string' && comp.displayName) return comp.displayName;
    if (typeof comp.name === 'string' && comp.name) return comp.name;
  }
  const segment = (meta.title ?? '').split('/').pop()?.trim();
  if (!segment) {
    throw new Error('CSF module has neither a component name nor a title to derive a name from');
  }
  return segment;
}

function controlToTypeName(control: CsfArgType['control']): string | undefined {
  const name = typeof control === 'string' ? control : control ? control.type : undefined;
  switch (name) {
    case 'text':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'number':
    case 'range':
      return 'number';
    default:
      return undefined;
  }
}

/**
 * Map one CSF argType to a JSON Schema fragment + whether it's required. Enumerated `options` win
 * (→ `enum`); otherwise the SB `type` or the `control` decides string/boolean/number. Unknown shapes
 * fall back to a permissive `{}` so an unrecognized control never blocks ingestion.
 */
export function argTypeToSchema(argType: CsfArgType): {
  schema: Record<string, unknown>;
  required: boolean;
} {
  const required = typeof argType.type === 'object' && argType.type?.required === true;

  if (Array.isArray(argType.options) && argType.options.length > 0) {
    return { schema: { enum: [...argType.options] }, required };
  }

  const typeName =
    typeof argType.type === 'string'
      ? argType.type
      : typeof argType.type === 'object'
        ? argType.type?.name
        : undefined;
  const kind = typeName ?? controlToTypeName(argType.control);

  switch (kind) {
    case 'boolean':
      return { schema: { type: 'boolean' }, required };
    case 'number':
      return { schema: { type: 'number' }, required };
    case 'string':
    case 'text':
      return { schema: { type: 'string' }, required };
    default:
      return { schema: {}, required };
  }
}

/** Build a props JSON Schema object from a component's argTypes. */
function propsSchema(argTypes: Record<string, CsfArgType> = {}): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [name, argType] of Object.entries(argTypes)) {
    const { schema, required: isRequired } = argTypeToSchema(argType);
    properties[name] = schema;
    if (isRequired) required.push(name);
  }
  const out: Record<string, unknown> = { type: 'object', properties, additionalProperties: false };
  if (required.length > 0) out.required = required;
  return out;
}

/** Heuristic: a component that takes `children` is a container (`['default']` slot); else a leaf. */
function slotsOf(argTypes: Record<string, CsfArgType> = {}): string[] {
  return Object.prototype.hasOwnProperty.call(argTypes, 'children') ? ['default'] : [];
}

/** Whether the module exports at least one named story (⇒ the component has a preview). */
function hasStories(module: CsfModule): boolean {
  return Object.keys(module).some((key) => key !== 'default');
}

/** Convert one CSF module into a named catalog entry. */
export function storyModuleToCatalogEntry(module: CsfModule): {
  name: string;
  entry: CatalogEntry;
} {
  const meta = module.default;
  if (!meta) throw new Error('CSF module is missing its `default` (meta) export');
  const argTypes = meta.argTypes ?? {};
  return {
    name: componentName(meta),
    entry: {
      description: meta.parameters?.docs?.description?.component ?? '',
      slots: slotsOf(argTypes),
      props: propsSchema(argTypes),
    },
  };
}

/**
 * Build a Lighter catalog from a set of evaluated CSF modules. The result satisfies
 * `@lighter/ingestion`'s CatalogArtifact contract, so it can be validated and ingested directly
 * (`POST /inventory`). Components are emitted in sorted order for stable, diffable output.
 */
export function buildCatalogFromStories(modules: CsfModule[]): StorybookCatalog {
  const components: Record<string, CatalogEntry> = {};
  const previews: string[] = [];
  for (const module of modules) {
    const { name, entry } = storyModuleToCatalogEntry(module);
    components[name] = entry;
    if (hasStories(module)) previews.push(name);
  }

  const sortedComponents: Record<string, CatalogEntry> = {};
  for (const name of Object.keys(components).sort((a, b) => a.localeCompare(b))) {
    sortedComponents[name] = components[name]!;
  }
  return { components: sortedComponents, previews: previews.sort((a, b) => a.localeCompare(b)) };
}
