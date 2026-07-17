import { SpecSchema, validateAgainstCatalog, type Spec, type Catalog } from '@lighter/spec';
import type { LlmClient } from './llm.js';
import { buildSystemPrompt, type CatalogComponent } from './prompt.js';

export interface GenerateOptions {
  /** Natural-language description of the screen to generate. */
  intent: string;
  /** The design-system components the spec may use. */
  catalog: CatalogComponent[];
  /** The LLM client (inject a fake in tests). */
  client: LlmClient;
  /** The component the root node must be. Defaults to `PageShell`. */
  rootComponent?: string;
  /** How many times to try before giving up. Defaults to 3. */
  maxAttempts?: number;
}

export interface GenerateResult {
  spec: Spec;
  /** How many model calls it took (1 = valid on the first try). */
  attempts: number;
}

/** Thrown when generation can't produce a catalog-valid spec within `maxAttempts`. */
export class GenerationError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly lastIssues: string[],
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

/** Pull the JSON object out of a model response that may include fences or stray prose. */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new Error('no JSON object found in the response');
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

/**
 * Generate a spec from an intent, constrained to the catalog. Builds a catalog-derived system
 * prompt, asks the model for a spec, then validates it: structurally, root-is-the-shell, and against
 * the catalog's prop schemas. On any failure it feeds the specific issues back to the model and
 * retries, up to `maxAttempts`. Returns the first spec that validates; throws `GenerationError`
 * (carrying the last issues) if none does.
 */
export async function generateSpec(opts: GenerateOptions): Promise<GenerateResult> {
  const rootComponent = opts.rootComponent ?? 'PageShell';
  const maxAttempts = opts.maxAttempts ?? 3;
  const catalogMap: Catalog = Object.fromEntries(
    opts.catalog.map((c) => [c.name, { props: c.props }]),
  );
  const system = buildSystemPrompt(opts.catalog, rootComponent);

  let lastIssues: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const user =
      attempt === 1
        ? opts.intent
        : `${opts.intent}\n\nYour previous attempt was rejected for these reasons:\n${lastIssues
            .map((i) => `- ${i}`)
            .join('\n')}\n\nReturn a corrected spec as JSON only.`;

    const raw = await opts.client.complete(system, user);

    let spec: Spec;
    try {
      spec = SpecSchema.parse(extractJson(raw));
    } catch (err) {
      lastIssues = [`Output was not a valid spec: ${(err as Error).message}`];
      continue;
    }

    const issues: string[] = [];
    if (spec.root.type !== rootComponent) {
      issues.push(`The root component must be "${rootComponent}", but it was "${spec.root.type}".`);
    }
    for (const issue of validateAgainstCatalog(spec, catalogMap)) {
      issues.push(`${issue.path} (${issue.component}): ${issue.message}`);
    }

    if (issues.length === 0) {
      return { spec, attempts: attempt };
    }
    lastIssues = issues;
  }

  throw new GenerationError(
    `Generation did not produce a catalog-valid spec after ${maxAttempts} attempts`,
    maxAttempts,
    lastIssues,
  );
}
