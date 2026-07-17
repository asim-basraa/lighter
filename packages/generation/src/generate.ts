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

/** The balanced `{…}` substring starting at `start`, respecting strings/escapes, or null. */
function balancedObjectAt(s: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Pull the JSON object out of a model response that may include markdown fences or stray prose. In
 * order: parse the whole string; else the contents of a ``` fence; else the first BALANCED `{…}` that
 * parses — trying each `{` so a brace in prose (e.g. "{placeholder}") doesn't swallow the real spec.
 */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* not bare JSON — try the strategies below */
  }

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fenced content wasn't JSON — fall through to the brace scan */
    }
  }

  for (let start = trimmed.indexOf('{'); start !== -1; start = trimmed.indexOf('{', start + 1)) {
    const candidate = balancedObjectAt(trimmed, start);
    if (candidate === null) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      /* this `{` didn't start valid JSON — try the next one */
    }
  }
  throw new Error('no JSON object found in the response');
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

export interface GenerateVariationsOptions extends GenerateOptions {
  /** How many independent variations to generate. */
  count: number;
}

/**
 * Generate several independent variations from one intent. Each variation is produced by its own
 * `generateSpec` run (own validate-or-retry loop) and is therefore an independently catalog-valid
 * spec — so any of them can be saved as a screen version on its own. A per-variation nudge asks the
 * model for a distinctly different structure so the set isn't N copies. Throws `GenerationError` if
 * any variation can't be made valid.
 */
export async function generateVariations(
  opts: GenerateVariationsOptions,
): Promise<GenerateResult[]> {
  if (!Number.isInteger(opts.count) || opts.count < 1) {
    throw new Error('count must be a positive integer');
  }
  const results: GenerateResult[] = [];
  for (let n = 1; n <= opts.count; n++) {
    const variationIntent = `${opts.intent}\n\n(Variation ${n} of ${opts.count}: choose a distinctly different layout and structure from the other variations.)`;
    results.push(await generateSpec({ ...opts, intent: variationIntent }));
  }
  return results;
}
