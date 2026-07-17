/** A component the generator may use, as described to the model. */
export interface CatalogComponent {
  name: string;
  description: string;
  /** Props JSON Schema (from the ingested catalog). */
  props: Record<string, unknown>;
}

/**
 * Build the system prompt that constrains generation to the design system: the component vocabulary
 * (name, description, and prop contract), and the hard rules — output only the internal spec JSON,
 * root at the page shell, only cataloged components. The prompt teaches the shape; `generateSpec`
 * enforces it by validating and retrying, so the model is guided, not trusted.
 */
export function buildSystemPrompt(catalog: CatalogComponent[], rootComponent: string): string {
  const components = catalog
    .map((c) => `### ${c.name}\n${c.description}\nProps (JSON Schema): ${JSON.stringify(c.props)}`)
    .join('\n\n');

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
    components,
  ].join('\n');
}
