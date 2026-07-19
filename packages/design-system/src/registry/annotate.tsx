'use client';

import { Children, createContext, useContext, type ReactNode } from 'react';
import { catalogDefs } from './catalog-defs.js';

/**
 * Opt-in element identity for review tooling (#160).
 *
 * Lighter anchors review comments to `el-N` ids, but json-render does **not** pass an element's own id
 * to its renderer — `ComponentRenderProps.element` is a `UIElement` (type/props/children), with no
 * identity field (verified by runtime probe). Identity is, however, derivable top-down: the spec's
 * `root` names the first element, and every element's `children` array names its children. So each
 * component is told its id by its parent, through React context (a context provider emits no DOM, so
 * threading identity costs nothing structurally).
 *
 * The id reaches the DOM on a `display: contents` wrapper, which generates **no box** — children lay
 * out exactly as if it weren't there. That matters: the review surface must keep rendering the same
 * boxes a consumer app does (see #158/#159), so annotation must not perturb layout.
 *
 * This registry is **separate from the default one**. Consumers (`<SpecView spec />`) render exactly
 * the DOM they always did; only `<SpecView spec annotate />` opts into the wrappers.
 *
 * Caveat for measurement: a `display: contents` element has no rect of its own — take the union of its
 * children's rects when positioning outlines/pins.
 */
const ElementIdContext = createContext<string | null>(null);

/** Attribute carrying an element's spec id, for hit-testing and comment anchoring. */
export const ELEMENT_ID_ATTR = 'data-lighter-el';

/** Provide the root element's id, so the top of the tree knows who it is. */
export function AnnotationRoot({ rootId, children }: { rootId: string; children: ReactNode }) {
  return <ElementIdContext.Provider value={rootId}>{children}</ElementIdContext.Provider>;
}

interface RenderProps {
  element: { props: Record<string, unknown>; children?: string[] };
  children?: ReactNode;
}

/**
 * Wrap one catalog component so it tags its DOM with its element id and hands each rendered child the
 * id of the corresponding spec child.
 *
 * `repeat` / `visible` can make the rendered children not line up 1:1 with `element.children`; when an
 * index has no id we simply pass the child through untagged rather than mis-attributing it. Unmapped
 * elements stay commentable through the element picker, so review is never blocked.
 */
function annotated(def: (typeof catalogDefs)[number]) {
  function Annotated(rp: RenderProps) {
    const id = useContext(ElementIdContext);
    const childIds = rp.element.children ?? [];
    const kids = Children.map(rp.children, (child, i) => {
      const childId = childIds[i];
      return childId ? (
        <ElementIdContext.Provider value={childId}>{child}</ElementIdContext.Provider>
      ) : (
        child
      );
    });
    const rendered = def.render({ props: rp.element.props as never, children: kids });
    // `display: contents` → no box, no layout impact; purely a carrier for the id.
    return (
      <span {...{ [ELEMENT_ID_ATTR]: id ?? undefined }} style={{ display: 'contents' }}>
        {rendered}
      </span>
    );
  }
  Annotated.displayName = `Annotated(${def.name})`;
  return Annotated;
}

/**
 * A registry that renders the same components as the default one, but tags each element with its spec
 * id. Built directly (not via `defineRegistry`) because that helper adapts components to
 * `{ props, children }` and hides `element.children` — which is exactly the identity we need.
 */
export const annotatedRegistry = Object.fromEntries(
  catalogDefs.map((d) => [d.name, annotated(d)]),
) as Record<string, unknown>;
