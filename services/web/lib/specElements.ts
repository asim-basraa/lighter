import type { Spec } from '@lighter/spec';
import { toJsonRender } from '@lighter/spec/render';

/** An addressable element of a spec: the structural id a comment anchors to, and its component type. */
export interface SpecElement {
  id: string;
  type: string;
}

/**
 * List every element of a spec as an `{ id, type }` anchor, in deterministic pre-order (`el-0`,
 * `el-1`, …). This is the set of anchors a reviewer can attach a comment to — derived from the same
 * json-render conversion the renderer uses, so the ids match what the API validates against. Uses the
 * browser-safe `@lighter/spec/render` subpath (no node-only catalog validator).
 */
export function specElements(spec: Spec): SpecElement[] {
  const { elements } = toJsonRender(spec);
  return Object.entries(elements).map(([id, el]) => ({ id, type: el.type }));
}
