import { Hono, type Context } from 'hono';
import {
  listHealthChecks,
  saveInventory,
  latestInventory,
  listComments,
  type Db,
} from '@lighter/db';
import { ingest, type InventoryModel } from '@lighter/ingestion';
import { toJsonRender, type Spec } from '@lighter/spec';
import {
  generateSpec,
  generateVariations,
  refineSpec,
  GenerationError,
  type LlmClient,
  type CatalogComponent,
  type ElementFeedback,
} from '@lighter/generation';
import type { SpecStore } from './specStore.js';
import { registerScreenRoutes } from './screens.js';
import { registerShareRoutes } from './shares.js';
import { registerCommentRoutes } from './comments.js';
import { registerApprovalRoutes } from './approval.js';
import type { Notifier } from './notifier.js';

export interface AppDeps {
  db: Db;
  /** Git-backed store for screens + spec versions. When present, the /screens routes are mounted. */
  specStore?: SpecStore;
  /** LLM client for spec generation. When present, POST /generate is available. */
  specGenerator?: LlmClient;
  /** Notification sink for comment/approval events (#29). Optional — absent means no notifications. */
  notifier?: Notifier;
}

/**
 * Gather a version's review comments as element-anchored feedback for refinement (#28). Groups every
 * comment (root + reply) by the element id it was left on, in creation order, and labels each element
 * with its component type. Returns undefined when there are no comments, so a plain refine is
 * unaffected. A spec that can't serialize just loses the type labels — the comments still flow.
 */
async function collectFeedback(
  db: Db,
  screenId: string,
  version: number,
  spec: Spec,
): Promise<ElementFeedback[] | undefined> {
  const comments = await listComments(db, screenId, version);
  if (comments.length === 0) return undefined;
  const typeOf = new Map<string, string>();
  try {
    for (const [id, el] of Object.entries(toJsonRender(spec).elements)) typeOf.set(id, el.type);
  } catch {
    // Unserializable spec → no type labels; feedback still flows by element id.
  }
  const byElement = new Map<string, string[]>();
  for (const c of comments) {
    const bucket = byElement.get(c.elementId);
    if (bucket) bucket.push(c.body);
    else byElement.set(c.elementId, [c.body]);
  }
  return [...byElement].map(([elementId, bodies]) => ({
    elementId,
    elementType: typeOf.get(elementId),
    comments: bodies,
  }));
}

/**
 * Build the Lighter API app over its dependencies. Kept as a factory — not a module singleton — so
 * tests construct it over an in-memory DB (and a temp-dir spec store) and drive it via
 * `app.request()`. Later slices mount their routes here.
 */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  // Centralized error shaping at the factory seam, so every route slice returns a consistent body.
  app.onError((err, c) => c.json({ status: 'error', message: err.message }, 500));

  app.get('/health', async (c) => {
    // A real read proves the API can reach the database, not just that the process is up. If the DB
    // is unreachable, report a 503 so an orchestrator's readiness probe can act on it.
    try {
      const checks = await listHealthChecks(deps.db);
      return c.json({ status: 'ok', db: 'ok', healthChecks: checks.length });
    } catch (err) {
      return c.json({ status: 'degraded', db: 'error', message: (err as Error).message }, 503);
    }
  });

  // Trigger ingestion of a design-system repo and persist the resulting inventory snapshot.
  app.post('/ingest', async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      repoPath?: unknown;
      artifactDir?: unknown;
    } | null;
    const repoPath = body?.repoPath;
    if (typeof repoPath !== 'string' || repoPath.length === 0) {
      return c.json({ status: 'error', message: 'repoPath (string) is required' }, 400);
    }
    const artifactDir = typeof body?.artifactDir === 'string' ? body.artifactDir : undefined;
    // artifactDir is a plain build-dir name (e.g. "dist"); reject separators/traversal so it can't
    // redirect the read outside the repo.
    if (artifactDir !== undefined && /[\\/]|\.\./.test(artifactDir)) {
      return c.json(
        { status: 'error', message: 'artifactDir must be a plain directory name' },
        400,
      );
    }

    // SECURITY: repoPath is a client-supplied absolute path read from the server filesystem —
    // acceptable only because this ingest surface is not exposed to untrusted callers. If it is ever
    // exposed, constrain repoPath to an allowlisted base directory (resolve + verify it stays under a
    // configured root). This hardening was previously tracked under #35 (internal SSO); SSO is no
    // longer planned, so it needs its own ticket if/when the surface is exposed — it does not ride
    // along with auth.
    let model: InventoryModel;
    try {
      model = ingest(repoPath, artifactDir ? { artifactDir } : {});
    } catch (err) {
      // A bad repo path / malformed artifacts is a client input problem, not a server fault.
      return c.json({ status: 'error', message: (err as Error).message }, 422);
    }

    await saveInventory(deps.db, model);
    return c.json({ status: 'ok', model }, 201);
  });

  // Serve the most recently ingested inventory model (the dashboard reads this).
  app.get('/inventory', async (c) => {
    const model = await latestInventory(deps.db);
    if (!model) {
      return c.json({ status: 'error', message: 'no inventory ingested yet' }, 404);
    }
    return c.json(model);
  });

  // Shared prelude for the generation routes: resolve the LLM client, the intent, and the catalog —
  // or return the appropriate error response (501 not configured / 400 bad intent / 422 no catalog).
  type GenReady = { generator: LlmClient; intent: string; catalog: CatalogComponent[] };
  const resolveGeneration = async (
    c: Context,
  ): Promise<{ ok: true; value: GenReady } | { ok: false; res: Response }> => {
    const generator = deps.specGenerator;
    if (!generator) {
      return {
        ok: false,
        res: c.json({ status: 'error', message: 'spec generation is not configured' }, 501),
      };
    }
    const body = (await c.req.json().catch(() => null)) as { intent?: unknown } | null;
    const intent = body?.intent;
    if (typeof intent !== 'string' || intent.trim().length === 0) {
      return {
        ok: false,
        res: c.json({ status: 'error', message: 'intent (non-empty string) is required' }, 400),
      };
    }
    const model = (await latestInventory(deps.db)) as InventoryModel | null;
    if (!model) {
      return {
        ok: false,
        res: c.json({ status: 'error', message: 'no design-system catalog ingested yet' }, 422),
      };
    }
    const catalog = model.components.map((comp) => ({
      name: comp.name,
      description: comp.description,
      props: comp.props,
    }));
    return { ok: true, value: { generator, intent, catalog } };
  };

  // Map a generation failure to a response: a GenerationError (invalid after retries) → 422 with the
  // issues; anything else (auth/network/rate limit) → generic 502 without leaking the upstream detail.
  const onGenerationError = (c: Context, err: unknown): Response => {
    if (err instanceof GenerationError) {
      return c.json({ status: 'error', message: err.message, issues: err.lastIssues }, 422);
    }
    console.error('spec generation failed:', err);
    return c.json({ status: 'error', message: 'spec generation failed' }, 502);
  };

  // Generate a spec from an intent, constrained to the ingested catalog (validate-or-retry). Mounted
  // only when an LLM client is configured; a real model call happens only here.
  app.post('/generate', async (c) => {
    const r = await resolveGeneration(c);
    if (!r.ok) return r.res;
    try {
      const { spec, attempts } = await generateSpec({ ...r.value, client: r.value.generator });
      return c.json({ spec, attempts });
    } catch (err) {
      return onGenerationError(c, err);
    }
  });

  // Generate several independent variations from one intent (each a catalog-valid spec) for
  // side-by-side comparison. `count` defaults to 3, clamped to 1–5.
  app.post('/generate/variations', async (c) => {
    const r = await resolveGeneration(c);
    if (!r.ok) return r.res;
    const body = (await c.req.json().catch(() => null)) as { count?: unknown } | null;
    const count = Math.min(
      5,
      Math.max(1, Number.isInteger(body?.count) ? (body!.count as number) : 3),
    );
    try {
      const variations = await generateVariations({ ...r.value, client: r.value.generator, count });
      return c.json({ variations });
    } catch (err) {
      return onGenerationError(c, err);
    }
  });

  // Refine a screen's latest spec with a follow-up instruction, saving the result as a new version.
  // Needs both the store (to read the current spec and save the new one) and the LLM client.
  app.post('/screens/:id/refine', async (c) => {
    const generator = deps.specGenerator;
    const store = deps.specStore;
    if (!generator || !store) {
      return c.json({ status: 'error', message: 'spec refinement is not configured' }, 501);
    }
    const id = c.req.param('id');
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    const latest = (await store.listVersions(id)).at(-1);
    const currentSpec = latest === undefined ? null : await store.getVersion(id, latest);
    if (!currentSpec) {
      return c.json({ status: 'error', message: 'screen has no spec version to refine' }, 422);
    }
    const body = (await c.req.json().catch(() => null)) as { instruction?: unknown } | null;
    const instruction = body?.instruction;
    if (typeof instruction !== 'string' || instruction.trim().length === 0) {
      return c.json(
        { status: 'error', message: 'instruction (non-empty string) is required' },
        400,
      );
    }
    const model = (await latestInventory(deps.db)) as InventoryModel | null;
    if (!model) {
      return c.json({ status: 'error', message: 'no design-system catalog ingested yet' }, 422);
    }
    const catalog = model.components.map((comp) => ({
      name: comp.name,
      description: comp.description,
      props: comp.props,
    }));
    // Feed the current version's review comments back into the refinement (#28): gather them,
    // grouped by the element id they were left on, so the model addresses real feedback mechanically.
    const feedback = await collectFeedback(deps.db, id, latest!, currentSpec);
    let refined;
    try {
      refined = await refineSpec({
        currentSpec,
        instruction,
        catalog,
        client: generator,
        feedback,
      });
    } catch (err) {
      return onGenerationError(c, err);
    }
    // Save outside the generation try so a store/git failure isn't mislabeled a generation error.
    const version = await store.saveVersion(id, refined.spec);
    return c.json({ version, spec: refined.spec, attempts: refined.attempts }, 201);
  });

  // Screen + spec-version CRUD (git-backed), mounted only when a spec store is configured. Specs are
  // validated against the latest ingested catalog, adapted here from the inventory model.
  if (deps.specStore) {
    const loadCatalog = async () => {
      const model = (await latestInventory(deps.db)) as InventoryModel | null;
      if (!model) return null;
      return Object.fromEntries(model.components.map((comp) => [comp.name, { props: comp.props }]));
    };
    registerScreenRoutes(app, deps.specStore, loadCatalog);
    registerShareRoutes(app, deps.db, deps.specStore);
    registerCommentRoutes(app, deps.db, deps.specStore, deps.notifier);
    registerApprovalRoutes(app, deps.db, deps.specStore, deps.notifier);
  }

  return app;
}
