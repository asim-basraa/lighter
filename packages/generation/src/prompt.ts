/** An action a component exposes (e.g. a navigation or submit action). */
export interface CatalogAction {
  name: string;
  description?: string;
}

/** A component the generator may use, as described to the model. */
export interface CatalogComponent {
  name: string;
  description: string;
  /** Props JSON Schema (from the ingested catalog). */
  props: Record<string, unknown>;
  /** Actions the component exposes, if any (from the catalog). */
  actions?: CatalogAction[];
}

/**
 * The catalog's machine-readable prompt (#31): a deterministic rendering of the component vocabulary —
 * each component's name, description, props JSON Schema, and actions. Deterministic means the same
 * catalog always produces byte-identical output, so it can be diffed, cached, and shipped in the
 * handoff bundle (#33). This is the single source the generation system prompt is built on, so the
 * model and the handoff artifact describe the exact same vocabulary.
 */
export function catalogPrompt(catalog: CatalogComponent[]): string {
  return catalog
    .map((c) => {
      const actions =
        c.actions && c.actions.length > 0
          ? c.actions
              .map((a) => (a.description ? `${a.name} — ${a.description}` : a.name))
              .join(', ')
          : 'none';
      return [
        `### ${c.name}`,
        c.description,
        `Props (JSON Schema): ${JSON.stringify(c.props)}`,
        `Actions: ${actions}`,
      ].join('\n');
    })
    .join('\n\n');
}

/**
 * Build the system prompt that constrains generation to the design system: the hard rules plus the
 * catalog's machine-readable vocabulary (see `catalogPrompt`, reused verbatim). The prompt teaches the
 * shape; `generateSpec` enforces it by validating and retrying, so the model is guided, not trusted.
 */
export function buildSystemPrompt(catalog: CatalogComponent[], rootComponent: string): string {
  return [
    'You generate UI specs for a fixed design system. Output ONLY a single JSON object — no prose,',
    'no markdown fences — in this internal spec format:',
    '',
    '  { "root": { "type": "<ComponentName>", "props": { ... }, "children": [ <node>, ... ] } }',
    '',
    "Each node has `type` (a component name), `props` (matching that component's schema), and",
    '`children` (an array of nodes; use [] for leaves).',
    '',
    'Hard rules:',
    `- The root node's type MUST be "${rootComponent}".`,
    '- Use ONLY the components listed below — never invent a component.',
    "- Every node's props MUST satisfy that component's props schema (include required props; a",
    '  nullable prop may be null).',
    '',
    'Available components:',
    '',
    catalogPrompt(catalog),
  ].join('\n');
}
