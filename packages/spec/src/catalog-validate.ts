import Ajv, { type ValidateFunction } from 'ajv';
import type { Spec, SpecNode } from './spec.js';

/**
 * A catalog to validate specs against: component name → its props JSON Schema. This is deliberately
 * a plain shape (not the ingestion `InventoryModel`) so `@lighter/spec` stays free of a dependency
 * on the ingestion layer — the API adapts its ingested catalog to this on the way in.
 */
export type Catalog = Record<string, { props: Record<string, unknown> }>;

/** A structured reason a spec doesn't match the catalog. */
export interface CatalogIssue {
  /** Location of the offending node in the spec tree, e.g. `root/children/0`. */
  path: string;
  /** The node's component type. */
  component: string;
  code: 'unknown-component' | 'invalid-props';
  message: string;
}

/**
 * Validate a spec against the catalog: every node's component must exist, and its props must satisfy
 * that component's props JSON Schema. Returns all issues found (empty ⇒ valid) so callers can show a
 * complete list rather than one-at-a-time. Purely structural — it does not render or execute anything.
 */
export function validateAgainstCatalog(spec: Spec, catalog: Catalog): CatalogIssue[] {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const compiled = new Map<string, ValidateFunction>();
  const issues: CatalogIssue[] = [];

  const propsValidator = (type: string): ValidateFunction => {
    let validate = compiled.get(type);
    if (!validate) {
      validate = ajv.compile(catalog[type]!.props);
      compiled.set(type, validate);
    }
    return validate;
  };

  const walk = (node: SpecNode, path: string): void => {
    if (!(node.type in catalog)) {
      issues.push({
        path,
        component: node.type,
        code: 'unknown-component',
        message: `Unknown component "${node.type}" — not in the design-system catalog`,
      });
    } else {
      const validate = propsValidator(node.type);
      if (!validate(node.props)) {
        for (const err of validate.errors ?? []) {
          const where = err.instancePath ? `props${err.instancePath}` : 'props';
          issues.push({
            path,
            component: node.type,
            code: 'invalid-props',
            message: `${where} ${err.message ?? 'is invalid'}`,
          });
        }
      }
    }
    node.children.forEach((child, i) => walk(child, `${path}/children/${i}`));
  };

  walk(spec.root, 'root');
  return issues;
}
