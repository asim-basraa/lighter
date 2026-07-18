import type { ReactNode } from 'react';
import type { z } from 'zod';

/**
 * A component's single source of truth for the json-render integration + Lighter ingestion.
 *
 * - `props` is a Zod schema — json-render's catalog consumes it directly, and the build converts it to
 *   a JSON Schema for `dist/catalog.json` (what Lighter ingests + constrains AI generation to).
 * - `render` maps a spec element's `{ props, children }` to the React component, so a json-render spec
 *   renders through this design system.
 * - `description` + `slots` feed the catalog. Description quality gates generation quality.
 *
 * The full React component library is larger than the catalog; only components that are meaningful in
 * an AI-authored, prop-driven spec expose a `CatalogComponent`.
 */
export interface CatalogComponent<P extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  slots?: string[];
  props: P;
  render: (element: { props: z.infer<P>; children?: ReactNode }) => ReactNode;
}

/**
 * Author a catalog component with typed `render` props (inferred from the Zod schema), returning the
 * erased `CatalogComponent` so a heterogeneous `CatalogComponent[]` stays assignable.
 */
export function catalogComponent<P extends z.ZodTypeAny>(
  def: CatalogComponent<P>,
): CatalogComponent {
  return def as unknown as CatalogComponent;
}
