import type { z } from 'zod';

/**
 * A tiny, dependency-free Zod → JSON Schema converter for the subset used by catalog component props
 * (object of string / number / boolean / enum / array / literal, with optional + nullable). It emits
 * the `props` JSON Schema that ships in `dist/catalog.json` — what Lighter ingests and validates
 * AI-generated specs against (via ajv). Kept intentionally small; extend it as the prop vocabulary grows.
 */
type JsonSchema = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function def(schema: z.ZodTypeAny): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (schema as any)._def;
}

function convert(schema: z.ZodTypeAny): { json: JsonSchema; required: boolean } {
  const d = def(schema);
  switch (d.typeName) {
    case 'ZodOptional': {
      const inner = convert(d.innerType);
      return { json: inner.json, required: false };
    }
    case 'ZodDefault': {
      const inner = convert(d.innerType);
      return { json: inner.json, required: false };
    }
    case 'ZodNullable': {
      const inner = convert(d.innerType);
      return { json: { anyOf: [inner.json, { type: 'null' }] }, required: inner.required };
    }
    case 'ZodString':
      return { json: { type: 'string' }, required: true };
    case 'ZodBoolean':
      return { json: { type: 'boolean' }, required: true };
    case 'ZodNumber': {
      const json: JsonSchema = { type: 'number' };
      for (const check of d.checks ?? []) {
        if (check.kind === 'int') json.type = 'integer';
        if (check.kind === 'min') json.minimum = check.value;
        if (check.kind === 'max') json.maximum = check.value;
      }
      return { json, required: true };
    }
    case 'ZodEnum':
      return { json: { type: 'string', enum: [...d.values] }, required: true };
    case 'ZodLiteral':
      return { json: { const: d.value }, required: true };
    case 'ZodArray':
      return { json: { type: 'array', items: convert(d.type).json }, required: true };
    case 'ZodObject':
      return { json: objectToJsonSchema(schema as z.ZodObject<z.ZodRawShape>), required: true };
    default:
      return { json: {}, required: true };
  }
}

/** Convert a `z.object({...})` into a JSON Schema object with `properties`/`required`. */
export function objectToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): JsonSchema {
  const shape = schema.shape;
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    const { json, required: isRequired } = convert(value as z.ZodTypeAny);
    properties[key] = json;
    if (isRequired) required.push(key);
  }
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
}
