import type { Spec, SpecNode } from '@lighter/spec';

/**
 * Pure tree operations for the visual editor (#166).
 *
 * A node is addressed by its **path**: the child indices from the root, so `[]` is the root and
 * `[0, 2]` is the third child of the first child. Paths are derived from the tree on every render
 * rather than stored, so they can't go stale against an edit — the tradeoff is that a path is only
 * meaningful against the spec it was read from, which is why every function here takes the spec.
 *
 * Every operation returns a NEW spec and never mutates its input: the editor keeps the previous spec
 * to fall back on when a change is rejected, and React needs a changed identity to re-render.
 */
export type Path = number[];

export function nodeAt(spec: Spec, path: Path): SpecNode | null {
  let node: SpecNode = spec.root;
  for (const index of path) {
    const next = node.children?.[index];
    if (!next) return null;
    node = next;
  }
  return node;
}

/**
 * Rebuild the tree with `fn` applied to the node at `path`. Returns null when the path doesn't
 * resolve, so callers leave the spec untouched.
 *
 * "Not found" and "delete this node" must stay distinguishable. Conflating them is a real hazard:
 * a stale `path` — one the editor held across an insert or delete — would silently delete whichever
 * ancestor was still reachable, which looks to the author like nodes spontaneously reordering or
 * vanishing. `fn` returning null means delete; a failed lookup returns NOT_FOUND and aborts the
 * whole rebuild.
 */
const NOT_FOUND = Symbol('not-found');

function withNodeAt(
  spec: Spec,
  path: Path,
  fn: (node: SpecNode) => SpecNode | null,
): Spec | null {
  if (path.length === 0) {
    const replaced = fn(spec.root);
    // The root may be edited but never deleted — a spec with no root isn't a spec.
    return replaced ? { ...spec, root: replaced } : null;
  }

  const rebuild = (node: SpecNode, rest: Path): SpecNode | null | typeof NOT_FOUND => {
    const [index, ...deeper] = rest;
    const children = node.children ?? [];
    const child = children[index!];
    if (!child) return NOT_FOUND;

    const replacement = deeper.length === 0 ? fn(child) : rebuild(child, deeper);
    if (replacement === NOT_FOUND) return NOT_FOUND;
    const nextChildren =
      replacement === null
        ? [...children.slice(0, index!), ...children.slice(index! + 1)]
        : [...children.slice(0, index!), replacement, ...children.slice(index! + 1)];
    return { ...node, children: nextChildren };
  };

  const root = rebuild(spec.root, path);
  if (root === NOT_FOUND || root === null) return null;
  return { ...spec, root };
}

/** Replace a node's props wholesale. */
export function setProps(spec: Spec, path: Path, props: Record<string, unknown>): Spec {
  return withNodeAt(spec, path, (node) => ({ ...node, props })) ?? spec;
}

/** Set a single prop. Passing `undefined` removes it, so clearing an optional field is expressible. */
export function setProp(spec: Spec, path: Path, key: string, value: unknown): Spec {
  return (
    withNodeAt(spec, path, (node) => {
      const props = { ...node.props };
      if (value === undefined) delete props[key];
      else props[key] = value;
      return { ...node, props };
    }) ?? spec
  );
}

/** Append a child to the node at `path`, or insert at `index`. */
export function insertChild(spec: Spec, path: Path, child: SpecNode, index?: number): Spec {
  return (
    withNodeAt(spec, path, (node) => {
      const children = [...(node.children ?? [])];
      const at = index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
      children.splice(at, 0, child);
      return { ...node, children };
    }) ?? spec
  );
}

/** Remove the node at `path`. The root can't be removed — that call returns the spec unchanged. */
export function removeAt(spec: Spec, path: Path): Spec {
  if (path.length === 0) return spec;
  return withNodeAt(spec, path, () => null) ?? spec;
}

/**
 * Move a node among its siblings. Returns the spec unchanged when the move isn't possible (root, or
 * already at the end), so callers can wire it to a button without pre-checking.
 */
export function moveWithinParent(spec: Spec, path: Path, delta: number): Spec {
  if (path.length === 0) return spec;
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1]!;
  const parent = nodeAt(spec, parentPath);
  if (!parent) return spec;
  const children = [...(parent.children ?? [])];
  const target = index + delta;
  if (target < 0 || target >= children.length) return spec;
  const [moved] = children.splice(index, 1);
  children.splice(target, 0, moved!);
  return withNodeAt(spec, parentPath, (node) => ({ ...node, children })) ?? spec;
}

/** The path of a node's parent, or null for the root. */
export function parentPath(path: Path): Path | null {
  return path.length === 0 ? null : path.slice(0, -1);
}

/** Depth-first walk yielding every node with its path — what the tree view renders. */
export function walk(spec: Spec): Array<{ node: SpecNode; path: Path }> {
  const out: Array<{ node: SpecNode; path: Path }> = [];
  const visit = (node: SpecNode, path: Path) => {
    out.push({ node, path });
    (node.children ?? []).forEach((child, i) => visit(child, [...path, i]));
  };
  visit(spec.root, []);
  return out;
}

/**
 * The element id json-render will assign this path.
 *
 * `toJsonRender` numbers elements in pre-order as `el-0`, `el-1`, … so the same walk order used by
 * the tree yields the id the rendered DOM carries in `data-lighter-el`. That correspondence is what
 * lets clicking the live canvas select the right tree node (#170).
 */
export function elementIdForPath(spec: Spec, path: Path): string | null {
  const found = walk(spec).findIndex((entry) => samePath(entry.path, path));
  return found === -1 ? null : `el-${found}`;
}

/** The path for a json-render element id, the inverse of `elementIdForPath`. */
export function pathForElementId(spec: Spec, elementId: string): Path | null {
  const match = /^el-(\d+)$/.exec(elementId);
  if (!match) return null;
  const entry = walk(spec)[Number(match[1])];
  return entry ? entry.path : null;
}

export function samePath(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * A new node of `type`, with required props filled from the schema.
 *
 * A component dropped into the tree must render immediately — inserting something that throws
 * because `label` is missing would make the editor feel broken. Placeholders are obvious enough to
 * be worth replacing.
 */
export function defaultNodeFor(type: string, propsSchema: unknown): SpecNode {
  const schema = (propsSchema ?? {}) as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];
  const props: Record<string, unknown> = {};

  for (const key of required) {
    const prop = properties[key];
    props[key] = placeholderFor(key, prop, type);
  }
  return { type, props, children: [] };
}

function placeholderFor(key: string, prop: Record<string, unknown> | undefined, type: string): unknown {
  if (!prop) return '';
  if (Array.isArray(prop.enum)) return prop.enum[0];
  const kind = Array.isArray(prop.type) ? prop.type[0] : prop.type;
  switch (kind) {
    case 'number':
    case 'integer':
      return typeof prop.minimum === 'number' ? prop.minimum : 1;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      // Name the placeholder after what it is, so an inserted component reads as itself on screen.
      return key === 'content' || key === 'label' || key === 'title' ? type : '';
  }
}
