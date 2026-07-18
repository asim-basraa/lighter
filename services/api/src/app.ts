import { Hono, type Context } from 'hono';
import {
  listHealthChecks,
  saveInventory,
  latestInventory,
  listComments,
  type Db,
} from '@lighter/db';
import { ingest, ingestArtifacts, type InventoryModel } from '@lighter/ingestion';
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
import { registerFlowRoutes } from './flow.js';
import { registerHandoffRoutes } from './handoff.js';
import { registerWebhookRoutes, type DesignSystemConfig } from './webhook.js';
import { requireProject, type AuthConfig } from './auth.js';
import type { ProjectStores } from './projectStores.js';
import type { ScreenScope } from './screenScope.js';
import type { Notifier } from './notifier.js';

export interface AppDeps {
  db: Db;
  /** Git-backed store for screens + spec versions (single global/single-tenant). Mounts the /screens routes. */
  specStore?: SpecStore;
  /**
   * Per-project spec stores (#87 scoping). When set together with `auth` (and `specStore` is not),
   * the /screens + /specs routes are project-scoped: auth resolves the project, storage is that
   * project's. Mutually exclusive with `specStore` so there's no route collision.
   */
  storeProvider?: ProjectStores;
  /** LLM client for spec generation. When present, POST /generate is available. */
  specGenerator?: LlmClient;
  /** Notification sink for comment/approval events (#29). Optional — absent means no notifications. */
  notifier?: Notifier;
  /** Design-system repo config for the re-ingest webhook (#36). When present, the webhook is mounted. */
  designSystem?: DesignSystemConfig;
  /** Project bearer-auth config (#87). When present, the project-scoped routes (e.g. /projects/me) mount. */
  auth?: AuthConfig;
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

  // Adapt an inventory model into the catalog shape the spec validator expects.
  const catalogFromModel = (model: InventoryModel | null) =>
    model ? Object.fromEntries(model.components.map((comp) => [comp.name, { props: comp.props }])) : null;

  // Screen + spec-version CRUD (git-backed). Two mutually-exclusive modes, so no route collision:
  //  - `specStore`: a single global store (single-tenant; every existing test uses this).
  //  - `storeProvider` + `auth`: per-project scoped stores (#87) — auth resolves the project, and the
  //    store + catalog are that project's.
  if (deps.specStore) {
    const globalStore = deps.specStore;
    const resolveStore = async () => globalStore;
    const resolveCatalog = async () =>
      catalogFromModel((await latestInventory(deps.db)) as InventoryModel | null);
    // Global scope: the DB key is the bare screen id; one shared store (single-tenant, unchanged).
    const globalScope: ScreenScope = {
      storeFor: async () => globalStore,
      keyFor: (_c, screenId) => screenId,
      resolveKey: async (key) => ({ store: globalStore, screenId: key }),
    };
    registerScreenRoutes(app, resolveStore, resolveCatalog);
    registerShareRoutes(app, deps.db, globalScope);
    registerCommentRoutes(app, deps.db, globalScope, deps.notifier);
    registerApprovalRoutes(app, deps.db, globalStore, deps.notifier);
    registerFlowRoutes(app, deps.db, globalStore);
    registerHandoffRoutes(app, deps.db, globalStore);
  } else if (deps.storeProvider && deps.auth) {
    const provider = deps.storeProvider;
    const guard = requireProject(deps.auth);
    // The authed management routes are project-scoped. (approval/flow/handoff scoping is the next
    // slice; those are not mounted in scoped mode yet. The public /share/* routes carry no guard —
    // the share token is the credential and encodes its own project.)
    app.use('/screens', guard);
    app.use('/screens/*', guard);
    app.use('/specs', guard);
    const resolveStore = (c: Context) => provider.forProject(c.get('project').id);
    const resolveCatalog = async (c: Context) =>
      catalogFromModel((await latestInventory(deps.db, c.get('project').id)) as InventoryModel | null);
    // Scoped scope: the DB key is `<projectId>:<screenId>`, so every screenId-keyed table isolates
    // per project with no schema change; a share token recovers its project by splitting the key.
    const scopedScope: ScreenScope = {
      storeFor: (c) => provider.forProject(c.get('project').id),
      keyFor: (c, screenId) => `${c.get('project').id}:${screenId}`,
      resolveKey: async (key) => {
        const i = key.indexOf(':');
        if (i <= 0) return null;
        return { store: await provider.forProject(key.slice(0, i)), screenId: key.slice(i + 1) };
      },
    };
    registerScreenRoutes(app, resolveStore, resolveCatalog);
    registerShareRoutes(app, deps.db, scopedScope);
    registerCommentRoutes(app, deps.db, scopedScope, deps.notifier);
  }

  // The design-system re-ingest webhook needs only the DB + a configured repo, not the spec store.
  if (deps.designSystem) {
    registerWebhookRoutes(app, deps.db, deps.designSystem);
  }

  // Project bearer-auth surface (#87, #90). Mounted only when auth is configured, so existing
  // single-tenant deployments and every existing test are unaffected.
  if (deps.auth) {
    const guard = requireProject(deps.auth);

    // The CLI's `whoami`.
    app.get('/projects/me', guard, (c) => {
      const project = c.get('project');
      return c.json({ id: project.id, name: project.name });
    });

    // The project's latest pushed inventory (the read counterpart to POST /inventory; `lighter inventory`).
    app.get('/projects/inventory', guard, async (c) => {
      const project = c.get('project');
      const model = await latestInventory(deps.db, project.id);
      if (!model) return c.json({ status: 'error', message: 'no inventory pushed yet' }, 404);
      return c.json(model);
    });

    // Cloud push ingest (#90): the CLI / GitHub Action sends the built artifacts `{catalog, tokens}`
    // inline — the API never reads the client's filesystem (that's the on-disk-only `POST /ingest`).
    // The inventory is scoped to the project the bearer token belongs to.
    app.post('/inventory', guard, async (c) => {
      const project = c.get('project');
      const body = (await c.req.json().catch(() => null)) as {
        catalog?: unknown;
        tokens?: unknown;
      } | null;
      if (!body || typeof body !== 'object') {
        return c.json({ status: 'error', message: 'body { catalog, tokens } is required' }, 400);
      }
      let model: InventoryModel;
      try {
        model = ingestArtifacts(body.catalog, body.tokens);
      } catch (err) {
        // A schema violation (ZodError carries `.issues`) is client input, not a server fault.
        const issues = (err as { issues?: unknown }).issues;
        return c.json(
          { status: 'error', message: 'invalid catalog or tokens', ...(issues ? { issues } : {}) },
          400,
        );
      }
      await saveInventory(deps.db, model, project.id);
      return c.json({ status: 'ok', model }, 201);
    });
  }

  return app;
}
