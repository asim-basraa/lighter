/**
 * Turn a component's props JSON Schema (as ingested from the design system's catalog) into flat
 * table rows. Generated from the schema — never hand-written — so the props view can't drift from
 * the real component contract. Understands both nullable shapes a catalog can carry: zod-to-json-
 * schema's `anyOf: [{enum}, {type:'null'}]` and the draft-style `type: ['string','null']`.
 */
export interface PropRow {
  name: string;
  /** A human-readable type, e.g. `string` or `"primary" | "secondary" | null`. */
  type: string;
  required: boolean;
  /** The schema default rendered as a literal, or null when the schema declares none. */
  default: string | null;
}

function literal(value: unknown): string {
  if (value === null) return 'null';
  return typeof value === 'string' ? `"${value}"` : String(value);
}

/** Best-effort human-readable type for a single (sub)schema. */
function typeLabel(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return 'unknown';
  const s = schema as Record<string, unknown>;
  if (Array.isArray(s.enum)) return s.enum.map(literal).join(' | ');
  if (Array.isArray(s.anyOf)) return s.anyOf.map(typeLabel).join(' | ');
  if (Array.isArray(s.type)) return s.type.map((t) => String(t)).join(' | ');
  if (typeof s.type === 'string') return s.type;
  return 'unknown';
}

export function propsToRows(props: unknown): PropRow[] {
  if (!props || typeof props !== 'object') return [];
  const schema = props as Record<string, unknown>;
  const properties =
    schema.properties && typeof schema.properties === 'object'
      ? (schema.properties as Record<string, unknown>)
      : {};
  const required = Array.isArray(schema.required) ? (schema.required as unknown[]) : [];

  return Object.entries(properties).map(([name, propSchema]) => {
    const s = (propSchema && typeof propSchema === 'object' ? propSchema : {}) as Record<
      string,
      unknown
    >;
    return {
      name,
      type: typeLabel(propSchema),
      required: required.includes(name),
      default: 'default' in s ? literal(s.default) : null,
    };
  });
}
