export {
  type Spec,
  type SpecNode,
  SpecSchema,
  SpecNodeSchema,
  ensureIds,
  newNodeId,
  DuplicateIdError,
  DuplicateNameError,
  type RawSpec,
  type RawSpecNode,
  componentTypesOf,
  staleComponents,
} from './spec.js';
export {
  toJsonRender,
  fromJsonRender,
  isValidJsonRender,
  type JsonRenderSpec,
} from './json-render.js';
export { validateAgainstCatalog, type Catalog, type CatalogIssue } from './catalog-validate.js';
