import { z } from 'zod';

/**
 * Lighter's internal UI spec — a framework-agnostic nested tree. This is the representation the rest
 * of the system stores, versions, edits, and validates against the catalog; json-render is only one
 * serialization target (see `./json-render`), leaving the door open to emit A2UI or another format
 * later without touching stored specs.
 *
 * Deliberately thin: a node is a component `type`, its `props`, and ordered `children`. It does not
 * model json-render-specific concerns (state, visibility, actions, repeat) — those stay behind the
 * serializer boundary. Specs are authored from the ingested catalog's components.
 */
export interface SpecNode {
  /** Component type name, as declared in the design-system catalog. */
  type: string;
  /** Component props (shape validated against the catalog in a later slice). */
  props: Record<string, unknown>;
  /** Ordered child nodes. Empty for leaf components. */
  children: SpecNode[];
}

export interface Spec {
  root: SpecNode;
}

/** Input shape a spec node may be parsed from — `children` may be omitted for a leaf. */
interface SpecNodeInput {
  type: string;
  props: Record<string, unknown>;
  children?: SpecNodeInput[];
}

/**
 * Zod schema for a spec node — recursive, so the whole tree is validated structurally. `children`
 * defaults to `[]` so a hand-edited leaf can omit it (the natural way to write a leaf in JSON); the
 * parsed output always carries a `children` array.
 */
export const SpecNodeSchema: z.ZodType<SpecNode, z.ZodTypeDef, SpecNodeInput> = z.lazy(() =>
  z.object({
    type: z.string().min(1),
    props: z.record(z.unknown()),
    children: z.array(SpecNodeSchema).default([]),
  }),
);

/** Zod schema for a whole spec. The parse boundary for stored/edited spec JSON. */
export const SpecSchema = z.object({
  root: SpecNodeSchema,
});

/** Collect every distinct component `type` referenced anywhere in a spec, in first-seen order. */
export function componentTypesOf(spec: Spec): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const walk = (node: SpecNode): void => {
    if (!seen.has(node.type)) {
      seen.add(node.type);
      order.push(node.type);
    }
    node.children.forEach(walk);
  };
  walk(spec.root);
  return order;
}
