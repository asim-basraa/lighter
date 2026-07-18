/**
 * The subset of Component Story Format (CSF) the adapter reads. This is the in-memory shape of an
 * evaluated `*.stories` module — a `default` export (the meta) plus named story exports. Loading the
 * real story files off disk (which requires a bundler, since they import React components) is a
 * separate glue slice; this package's job is the pure CSF-shape → catalog transformation.
 */

/** A single arg's metadata. CSF is loose here, so every field is optional and multi-shaped. */
export interface CsfArgType {
  description?: string;
  /** Either a SB docgen type (`{ name, required }`) or a bare type name (`'string'`). */
  type?: string | { name?: string; required?: boolean };
  /** Either a control name (`'text'`) or a control object (`{ type: 'text' }`), or `false` to disable. */
  control?: string | { type?: string } | false;
  /** Enumerated values (select/radio controls). */
  options?: unknown[];
}

/** The `default` export of a CSF module — component metadata. */
export interface CsfMeta {
  title?: string;
  /** The component itself; we only read a name off it. */
  component?: unknown;
  argTypes?: Record<string, CsfArgType>;
  args?: Record<string, unknown>;
  parameters?: { docs?: { description?: { component?: string } } };
  tags?: string[];
}

/** A named story export. We only need its optional args/name for cataloging. */
export interface CsfStory {
  name?: string;
  args?: Record<string, unknown>;
}

/** An evaluated CSF module: a `default` meta plus one or more named story exports. */
export interface CsfModule {
  default: CsfMeta;
  [named: string]: CsfMeta | CsfStory | unknown;
}
