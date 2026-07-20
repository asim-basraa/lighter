/**
 * Turn a component's props JSON Schema into form controls (#166).
 *
 * The catalog already IS JSON Schema — enums, `required`, `description` and numeric bounds all come
 * from the design system's own zod definitions. So the property panel is generated, never
 * hand-written: a component that gains a variant gains the control for free, and the panel can't
 * drift from the real contract the way a hand-maintained form would.
 *
 * Deliberately limited to a component's *declared* props. There is no arbitrary styling control
 * here — per-instance padding or colour would make specs stop being compositions of approved
 * components, which is the whole premise. If a design needs something the props can't express, that
 * is a signal for the design system, not an escape hatch in the editor.
 */
export type ControlKind = 'text' | 'textarea' | 'number' | 'boolean' | 'enum' | 'json';

export interface PropControl {
  name: string;
  kind: ControlKind;
  required: boolean;
  description?: string;
  /** For `enum`. Includes an empty choice when the prop is optional. */
  options?: string[];
  min?: number;
  max?: number;
  /** True when the schema allows null in addition to its main type. */
  nullable: boolean;
}

function unwrapNullable(schema: Record<string, unknown>): {
  schema: Record<string, unknown>;
  nullable: boolean;
} {
  // Two shapes a catalog can carry: zod-to-json-schema's `anyOf: [{...}, {type:'null'}]`, and the
  // draft-style `type: ['string','null']`.
  if (Array.isArray(schema.anyOf)) {
    const branches = schema.anyOf as Record<string, unknown>[];
    const nonNull = branches.filter((b) => b.type !== 'null');
    if (nonNull.length === 1) return { schema: nonNull[0]!, nullable: branches.length > nonNull.length };
  }
  if (Array.isArray(schema.type)) {
    const types = (schema.type as string[]).filter((t) => t !== 'null');
    if (types.length === 1) {
      return { schema: { ...schema, type: types[0] }, nullable: (schema.type as string[]).includes('null') };
    }
  }
  return { schema, nullable: false };
}

/** Props whose content is long enough that a single-line input is the wrong shape. */
const MULTILINE = new Set(['message', 'description', 'content', 'help']);

function kindFor(name: string, schema: Record<string, unknown>): ControlKind {
  if (Array.isArray(schema.enum)) return 'enum';
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case 'boolean':
      return 'boolean';
    case 'number':
    case 'integer':
      return 'number';
    case 'array':
    case 'object':
      // Structured props (Select options, Breadcrumb items) get a JSON editor rather than a
      // half-working bespoke builder that silently drops fields.
      return 'json';
    case 'string':
      return MULTILINE.has(name) ? 'textarea' : 'text';
    default:
      return 'json';
  }
}

/** Controls for one component's props, in schema order. */
export function controlsFor(propsSchema: unknown): PropControl[] {
  if (!propsSchema || typeof propsSchema !== 'object') return [];
  const root = propsSchema as Record<string, unknown>;
  const properties =
    root.properties && typeof root.properties === 'object'
      ? (root.properties as Record<string, Record<string, unknown>>)
      : {};
  const required = Array.isArray(root.required) ? (root.required as string[]) : [];

  return Object.entries(properties).map(([name, raw]) => {
    const { schema, nullable } = unwrapNullable(raw ?? {});
    const kind = kindFor(name, schema);
    const isRequired = required.includes(name);
    const control: PropControl = {
      name,
      kind,
      required: isRequired,
      nullable,
      description: typeof schema.description === 'string' ? schema.description : undefined,
    };
    if (kind === 'enum') {
      const values = (schema.enum as unknown[]).map(String);
      // An optional enum needs a way back to "unset" — without the blank choice, picking a value
      // once would be irreversible.
      control.options = isRequired ? values : ['', ...values];
    }
    if (typeof schema.minimum === 'number') control.min = schema.minimum;
    if (typeof schema.maximum === 'number') control.max = schema.maximum;
    return control;
  });
}

/** Coerce a control's raw form value into what the schema expects. */
export function coerce(control: PropControl, raw: string | boolean): unknown {
  if (control.kind === 'boolean') return Boolean(raw);
  if (typeof raw !== 'string') return raw;
  if (raw === '' && !control.required) return undefined; // clearing an optional prop removes it
  switch (control.kind) {
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'json':
      try {
        return JSON.parse(raw);
      } catch {
        return undefined; // caller keeps the previous value and surfaces the parse error
      }
    default:
      return raw;
  }
}

/** Render a stored prop value back into a form field's string value. */
export function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}
