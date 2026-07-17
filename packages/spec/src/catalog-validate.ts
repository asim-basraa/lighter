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
  code: 'unknown-component' | 'invalid-props' | 'catalog-schema-invalid';
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
    // `Object.hasOwn`, not `in`: `in` walks the prototype chain, so `constructor`/`__proto__`/etc.
    // would falsely count as catalog components and then blow up `ajv.compile` on undefined props.
    if (!Object.hasOwn(catalog, node.type)) {
      issues.push({
        path,
        component: node.type,
        code: 'unknown-component',
        message: `Unknown component "${node.type}" — not in the design-system catalog`,
      });
    } else {
      try {
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
      } catch (err) {
        // A catalog whose props schema won't compile (bad keyword, unresolvable $ref, …) is a
        // catalog problem, not a 500 — surface it as a structured issue.
        issues.push({
          path,
          component: node.type,
          code: 'catalog-schema-invalid',
          message: `Catalog schema for "${node.type}" is not a compilable JSON Schema: ${(err as Error).message}`,
        });
      }
    }
    node.children.forEach((child, i) => walk(child, `${path}/children/${i}`));
  };

  walk(spec.root, 'root');
  return issues;
}
