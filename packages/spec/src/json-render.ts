import { validateSpec, type Spec as JsonRenderSpec, type UIElement } from '@json-render/core';
import type { Spec, SpecNode } from './spec.js';

/**
 * The json-render boundary. This is the ONLY module in Lighter that imports `@json-render/core`; the
 * rest of the system speaks the internal `Spec` (see `./spec`). Keeping json-render isolated here is
 * what preserves the option to add another serialization target (e.g. A2UI) later.
 *
 * The internal spec is a nested tree; json-render wants a flat `{ root, elements }` map keyed by
 * string ids. Ids are an artifact of that format — generated deterministically on serialize (pre-
 * order `el-0`, `el-1`, …) and discarded on deserialize — so an internal → json-render → internal
 * round-trip is lossless.
 */
export type { JsonRenderSpec };

/** Serialize an internal spec to a json-render spec. Ids are assigned in deterministic pre-order. */
export function toJsonRender(spec: Spec): JsonRenderSpec {
  const elements: Record<string, UIElement> = {};
  let counter = 0;

  const walk = (node: SpecNode): string => {
    const id = `el-${counter++}`;
    const element: UIElement = { type: node.type, props: node.props };
    // Insert the parent before its children so element key order is stable pre-order.
    elements[id] = element;
    const childIds = node.children.map(walk);
    if (childIds.length > 0) element.children = childIds;
    return id;
  };

  const root = walk(spec.root);
  return { root, elements };
}

/**
 * Deserialize a json-render spec back to an internal spec by walking from the root. Ids are dropped.
 * Throws if the spec references an element id that isn't present (a malformed json-render spec).
 */
export function fromJsonRender(jr: JsonRenderSpec): Spec {
  const build = (id: string): SpecNode => {
    const element = jr.elements[id];
    if (!element) {
      throw new Error(`json-render spec references missing element "${id}"`);
    }
    return {
      type: element.type,
      props: (element.props ?? {}) as Record<string, unknown>,
      children: (element.children ?? []).map(build),
    };
  };
  return { root: build(jr.root) };
}

/** Whether a json-render spec is structurally valid (no error-severity issues). Warnings are OK. */
export function isValidJsonRender(jr: JsonRenderSpec): boolean {
  return validateSpec(jr).valid;
}
