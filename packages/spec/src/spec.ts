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
  /**
   * Stable identity, generated once and preserved across every edit (#184).
   *
   * Ids used to be positional — assigned `el-0`, `el-1`, … at serialize time — which meant inserting
   * a node renumbered every element after it. Anything holding an id (a comment anchor, and later a
   * region reference or a binding) silently came to point at a different element. Identity now lives
   * on the node, so an insert cannot move it.
   *
   * **Opaque.** Nothing may parse an id. Legacy nodes keep the `el-<n>` id they used to serialise to
   * so existing anchors survive migration; new nodes get a different form. Both are just strings.
   *
   * Optional on the *input* type only, so hand-written and pre-#184 stored specs still parse —
   * `ensureIds` fills them in.
   */
  id: string;
  /**
   * Human handle for a slot (`FORM`, `HERO`) — the stable name an author, a comment or a validation
   * message refers to. Components don't need one; only slots are worth naming.
   */
  name?: string;
  /** Component type name, as declared in the design-system catalog. */
  type: string;
  /** Component props (shape validated against the catalog in a later slice). */
  props: Record<string, unknown>;
  /** Ordered child nodes. Empty for leaf components. */
  children: SpecNode[];
}

export interface Spec {
  root: SpecNode;
  /**
   * Optional mock data attached to the spec, so a customer-facing screen can render realistically.
   * Travels with the spec (and thus with the version). Serializes to json-render's top-level `state`.
   */
  data?: Record<string, unknown>;
}

/**
 * Input shape a spec node may be parsed from — `children` may be omitted for a leaf, and `id` may be
 * omitted entirely (every spec stored before #184 has no ids). `ensureIds` assigns them.
 */
interface SpecNodeInput {
  id?: string;
  name?: string;
  type: string;
  props: Record<string, unknown>;
  children?: SpecNodeInput[];
}

/** A node as it may appear on disk or in a request: `id` and `name` may be absent. */
export interface RawSpecNode {
  id?: string;
  name?: string;
  type: string;
  props: Record<string, unknown>;
  children: RawSpecNode[];
}

export interface RawSpec {
  root: RawSpecNode;
  data?: Record<string, unknown>;
}

/**
 * Zod schema for a spec node BEFORE id migration — recursive, so the whole tree is validated
 * structurally. `children` defaults to `[]` so a hand-edited leaf can omit it (the natural way to
 * write a leaf in JSON); the parsed output always carries a `children` array.
 *
 * This does NOT guarantee ids. Parse through `SpecSchema` to get a fully-identified `Spec`.
 */
export const SpecNodeSchema: z.ZodType<RawSpecNode, z.ZodTypeDef, SpecNodeInput> = z.lazy(() =>
  z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    type: z.string().min(1),
    props: z.record(z.unknown()),
    children: z.array(SpecNodeSchema).default([]),
  }),
);

export class DuplicateIdError extends Error {}
export class DuplicateNameError extends Error {}

/**
 * A fresh node id. Deliberately NOT of the form `el-<digits>`, so a generated id can never collide
 * with a legacy positional one preserved by `ensureIds`.
 */
export function newNodeId(): string {
  return `n${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Give every node a stable id, and check ids and names are unique (#184).
 *
 * A node without an id takes **the id it would previously have serialised to** — `el-0`, `el-1`, …
 * in pre-order. That is the migration: everything already anchored to those ids (comments today,
 * region references and bindings later) keeps pointing at the same element, and from this moment the
 * ids are frozen, so the next insert can't move them.
 *
 * Idempotent: a spec that already has ids passes through unchanged. The positional counter still
 * advances across identified nodes so a partially-identified tree migrates consistently — and if
 * that produces a collision it throws rather than silently merging two elements.
 */
export function ensureIds(spec: RawSpec): Spec {
  const ids = new Set<string>();
  const names = new Set<string>();
  let position = 0;

  const walk = (node: RawSpecNode): SpecNode => {
    const id = node.id ?? `el-${position}`;
    position += 1;
    if (ids.has(id)) {
      throw new DuplicateIdError(`Duplicate element id "${id}" — ids must be unique within a spec`);
    }
    ids.add(id);
    if (node.name !== undefined) {
      if (names.has(node.name)) {
        throw new DuplicateNameError(
          `Duplicate slot name "${node.name}" — names must be unique within a spec`,
        );
      }
      names.add(node.name);
    }
    const built: SpecNode = {
      id,
      type: node.type,
      props: node.props,
      children: node.children.map(walk),
    };
    if (node.name !== undefined) built.name = node.name;
    return built;
  };

  const migrated: Spec = { root: walk(spec.root) };
  if (spec.data !== undefined) migrated.data = spec.data;
  return migrated;
}

/**
 * Zod schema for a whole spec. The parse boundary for stored/edited spec JSON.
 *
 * Parsing IS the migration: every read path in the system already goes through here, so a spec
 * stored before #184 gains stable ids the first time it is read, with no separate migration step and
 * no way to forget one.
 */
export const SpecSchema = z
  .object({
    root: SpecNodeSchema,
    data: z.record(z.unknown()).optional(),
  })
  .transform((raw) => ensureIds(raw));

/**
 * Component types the spec references that are NOT in the known catalog — i.e. removed or renamed
 * components (#37). A non-empty result means the spec is stale against the current design system; an
 * empty result means every component it uses still exists, so the spec stays valid. First-seen order.
 */
export function staleComponents(spec: Spec, known: Iterable<string>): string[] {
  const knownSet = known instanceof Set ? known : new Set(known);
  return componentTypesOf(spec).filter((type) => !knownSet.has(type));
}

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
