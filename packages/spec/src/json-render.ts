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

/**
 * json-render reserves these keys as ELEMENT-level fields (visibility, event bindings, repeat,
 * watchers). The internal spec keeps only catalog `props`, so a prop named any of these can't be
 * represented distinctly — the boundary refuses it loudly rather than letting json-render silently
 * reinterpret a plain prop as behaviour.
 */
const RESERVED_ELEMENT_KEYS = ['visible', 'on', 'repeat', 'watch'] as const;

/** Serialize an internal spec to a json-render spec. Ids are assigned in deterministic pre-order. */
export function toJsonRender(spec: Spec): JsonRenderSpec {
  const elements: Record<string, UIElement> = {};
  let counter = 0;

  const walk = (node: SpecNode): string => {
    for (const key of RESERVED_ELEMENT_KEYS) {
      if (key in node.props) {
        throw new Error(
          `Component "${node.type}" has a prop "${key}" that collides with a json-render reserved element field; rename the prop.`,
        );
      }
    }
    const id = `el-${counter++}`;
    // Copy props so the emitted spec never aliases the internal spec's mutable objects.
    const element: UIElement = { type: node.type, props: { ...node.props } };
    // Insert the parent before its children so element key order is stable pre-order.
    elements[id] = element;
    const childIds = node.children.map(walk);
    if (childIds.length > 0) element.children = childIds;
    return id;
  };

  const root = walk(spec.root);
  // Mock data attached to the spec becomes json-render's initial `state`, so a rendered screen can
  // read realistic values.
  return spec.data ? { root, elements, state: spec.data } : { root, elements };
}

/**
 * Deserialize a json-render spec back to an internal spec by walking from the root. Ids are dropped.
 *
 * The internal spec is a thin subset of json-render: it models `type`/`props`/`children` plus
 * top-level `state` (mapped to the spec's mock `data`). If a json-render spec carries an element-
 * level field the internal spec can't represent (`visible`/`on`/`repeat`/`watch`), this throws rather
 * than silently dropping it, so the loss is loud. (Round-trips that originate from `toJsonRender`
 * never hit this.) Also throws if the spec references an element id that isn't present.
 */
export function fromJsonRender(jr: JsonRenderSpec): Spec {
  const build = (id: string): SpecNode => {
    const element = jr.elements[id];
    if (!element) {
      throw new Error(`json-render spec references missing element "${id}"`);
    }
    for (const key of RESERVED_ELEMENT_KEYS) {
      if (element[key] !== undefined) {
        throw new Error(
          `json-render element "${id}" uses "${key}", which the internal spec cannot represent yet`,
        );
      }
    }
    return {
      type: element.type,
      props: { ...((element.props ?? {}) as Record<string, unknown>) },
      children: (element.children ?? []).map(build),
    };
  };
  const spec: Spec = { root: build(jr.root) };
  if (jr.state !== undefined) spec.data = { ...jr.state };
  return spec;
}

/** Whether a json-render spec is structurally valid (no error-severity issues). Warnings are OK. */
export function isValidJsonRender(jr: JsonRenderSpec): boolean {
  return validateSpec(jr).valid;
}
