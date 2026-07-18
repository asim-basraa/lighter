# Lighter — Developer Guide

Everything a contributor or a consumer needs to build on Lighter. For the product walkthrough see
[USER_GUIDE.md](./USER_GUIDE.md); for the HTTP surface see [API.md](./API.md).

---

## 1. What Lighter is (architecture in one screen)

Lighter is a **pnpm monorepo**. Data flows one direction: a design system is ingested into an
**inventory**, screens are authored as an internal **spec**, specs are stored **versioned in git**,
and everything else (dashboard, generation, review, hand-off) is a projection over those.

```
design system repo ──ingest──►  InventoryModel  ──►  GET /inventory, dashboard
   (dist/catalog.json,                 │
    dist/tokens.json)                  ├─► catalog constrains AI generation (@lighter/generation)
                                       └─► catalog validates hand-written specs (@lighter/spec)

author screen ─► internal Spec (nested tree) ─► SpecStore (one git-committed file per version)
                        │
                        └─► json-render serializer (the ONE module that touches json-render)
                                    │
                                    └─► rendered live by the design system's <SpecView>
```

### Packages (`packages/*`) — pure libraries, no HTTP

| Package               | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lighter/spec`       | The internal UI spec (nested `{type, props, children, data?}`), its Zod schema, catalog validation, `componentTypesOf`/`staleComponents`, and the **json-render serializer boundary** (`toJsonRender`/`fromJsonRender`). This is the **only** module in the repo that imports `@json-render/core` — enforced by a test — so the rest of the system stays serializer-agnostic. Browser-safe subpath: `@lighter/spec/render`. |
| `@lighter/ingestion`  | `ingest(repoPath, {artifactDir})` → `InventoryModel` (components + prop schemas + tokens + health findings). Pure function over a repo's built artifacts.                                                                                                                                                                                                                                                                   |
| `@lighter/db`         | Dialect-agnostic Drizzle client (SQLite now, Postgres-swappable), a `_migrations` ledger, and all data-access helpers (shares, comments, version status, sign-offs, flow, ingest log, inventory snapshots).                                                                                                                                                                                                                 |
| `@lighter/generation` | The AI boundary: an injectable `LlmClient` interface (real impl = `AnthropicLlmClient`), the catalog-constrained prompt (`buildSystemPrompt` / `catalogPrompt`), and `generateSpec`/`generateVariations`/`refineSpec` (prompt → parse → validate-against-catalog → retry). Tests inject a fake client, so **no test makes a paid call**.                                                                                    |

### Services (`services/*`) — the running apps

| Service        | Responsibility                                                                                                                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lighter/api` | A [Hono](https://hono.dev) app built by `createApp(deps)`. Owns the git-backed `SpecStore`, all routes, and the injectable boundaries (`specGenerator`, `notifier`, `designSystem`). A factory (not a singleton) so tests drive it via `app.request()` over an in-memory DB + temp store. |
| `@lighter/web` | A Next.js 14 (App Router) app: the internal dashboard (`(dashboard)` route group) and the **public review surface** (`/share/[token]`, on the bare root layout, no internal nav). Renders specs live via the design system's `<SpecView>`.                                                |

### First-party design system + starter (`packages/design-system`, `apps/*`)

Lighter ships a reference design system and a bootstrap app so a consumer can start with a working,
correct-by-construction stack instead of building one from scratch.

| Workspace                           | Responsibility                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lighter/design-system`            | A comprehensive, **DTCG-token-driven** React component library (layout, typography, forms, data-display, feedback, overlays, navigation, tables, 59 icons). It also ships the **json-render registry** (`<SpecView>`) and, at build, the `dist/catalog.json` + `dist/tokens.json` artifacts Lighter ingests. **Swap the DTCG tokens (`tokens/*.tokens.json`) and everything re-themes** — zero runtime. |
| `@lighter/starter` (`apps/starter`) | A Next.js 14 App Router app wired to the design system out of the box: `<ThemeProvider>`, the stylesheet, a component showcase, a json-render editor (`toJsonRender` → `<SpecView>`), and a sample dashboard. The **starting point for a consumer** — clone, edit tokens, ship.                                                                                                                         |

The design system is the reference producer of Lighter's ingestion contract: `pnpm --filter
@lighter/design-system build` emits `dist/catalog.json` (24 catalog components) and
`dist/tokens.json` (388 tokens), which `POST /ingest` (or `ingest()`) turns into an inventory with
0 health findings. It's the in-repo twin of `../lighter-example`.

> **DTCG in one line:** tokens are authored in the [Design Tokens Community Group](https://tr.designtokens.org)
> format (`$type`/`$value`/`$description`, groups, `{alias}` references, composite types). The build
> resolves them to flat CSS custom properties (`--primary-default`, `--spacing-4`, …); components only
> ever read those vars, so re-theming never touches component code.

### Key design decisions

- **The internal spec is thin and framework-agnostic.** json-render is one serialization target behind a single module, leaving room to emit another format later without touching stored specs.
- **Specs are versioned in git.** `SpecStore` writes one immutable file per version (`<root>/<screen>/<n>.json`) and commits every mutation, so `git log` is the design timeline. Mutable per-screen state (approval, sign-offs, comments) lives in the DB, not the immutable files.
- **Boundaries are injected.** The LLM client and the notification sink are interfaces passed into `createApp`, so tests never touch the network and the delivery target is swappable.
- **The design system is the guardrail.** Both AI generation and hand-written specs are validated against the ingested catalog; you can't save or generate a spec that uses a component you don't have.
- **No auth (by decision).** SSO was dropped. Internal endpoints assume a trusted caller; the one internet-facing endpoint (the re-ingest webhook) **requires** an HMAC secret. The public review surface is gated only by the unguessable share token.

---

## 2. Prerequisites & setup

- **Node 22**, **pnpm 10** (`packageManager` pins the version).
- **`lighter-example`** — the demo design system — is a **separate sibling repo** at
  `../lighter-example` (a `file:` dependency, and the test fixture's real-world twin). Clone it next
  to this repo before installing.

```bash
# siblings: ~/work/lighter/lighter  and  ~/work/lighter/lighter-example
git clone <lighter-example-url> ../lighter-example
pnpm install
pnpm --filter lighter-example build      # emits dist/catalog.json + dist/tokens.json
```

### ⚠️ Toolchain gotcha (Apple Silicon)

`pnpm` runs under Rosetta (x64) here while `node` is native arm64. **Always validate with
`pnpm test`, never a bare `npx vitest`** — native modules (`better-sqlite3`) are pinned to x64 to
match pnpm's node, and a bare runner picks the wrong arch. Root `pnpm.supportedArchitectures` keeps
esbuild/rollup multi-arch.

---

## 3. The dev loop

```bash
pnpm test          # vitest across every package + service (run this — see the gotcha above)
pnpm typecheck     # tsc --noEmit in each package/service
pnpm lint          # eslint
pnpm format        # prettier --check   (use `npx prettier --write .` to fix)
```

All four must be green before a PR. The web app additionally must pass a production build
(`pnpm --filter @lighter/web build`) — a dev-only `next dev` RSC quirk with the json-render/react
context does **not** affect the production build (which is what CI runs).

### Running it locally

The API reads config from env; the web app reads `LIGHTER_API_URL`.

```bash
# API on :3000
cd services/api && \
  DB_DIALECT=sqlite DATABASE_URL=./lighter.db SPECS_DIR=./.lighter-specs \
  ANTHROPIC_API_KEY=sk-…        # optional — enables generation \
  NOTIFY_WEBHOOK_URL=…          # optional — comment/approval notifications \
  DESIGN_SYSTEM_REPO=../../../lighter-example DESIGN_SYSTEM_ARTIFACT_DIR=dist WEBHOOK_SECRET=…  # optional — enables the re-ingest webhook \
  pnpm start

# Web on :4000  (production build renders the review surface correctly)
cd services/web && LIGHTER_API_URL=http://localhost:3000 pnpm build && pnpm start
```

| Env var                                                                | Used by | Notes                                                                             |
| ---------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| `DB_DIALECT` / `DATABASE_URL`                                          | api     | `sqlite` + a file path (or `:memory:`). Postgres is swappable at the driver only. |
| `SPECS_DIR`                                                            | api     | Git-backed spec store root (default `.lighter-specs`).                            |
| `ANTHROPIC_API_KEY`                                                    | api     | Enables `POST /generate*` and refine. Absent → those return 501.                  |
| `NOTIFY_WEBHOOK_URL`                                                   | api     | Comment/approval events POST here. Absent → no notifications.                     |
| `DESIGN_SYSTEM_REPO` / `DESIGN_SYSTEM_ARTIFACT_DIR` / `WEBHOOK_SECRET` | api     | The re-ingest webhook mounts only when the repo **and** the secret are set.       |
| `LIGHTER_API_URL`                                                      | web     | Where the web app fetches from (default `http://localhost:3000`).                 |

---

## 4. Persistence & migrations

Raw SQL lives **only** in `packages/db/migrations/NNNN_name.sql`; everything else goes through the
Drizzle ORM. `runMigrations` applies pending files in order, tracked in a `_migrations` ledger
(re-running is a no-op). Adding a table: add a migration + a `sqliteTable` in `schema.ts` + a
data-access helper + a test. Current schema: health checks, inventory snapshots, shares, comments,
version status, sign-off config/records, flow links, ingested commits.

---

## 5. Adding a feature (the slice loop)

Each unit of work is a vertical slice, TDD-first:

1. Branch `feat/<slug>` off `main`.
2. Write a failing test → implement → green. Keep pure logic in a `packages/*` module with its own
   unit test; keep HTTP glue thin in `services/api` with an `app.request()` integration test.
3. `pnpm test typecheck lint format` all green (+ `next build` if you touched the web app).
4. Open a PR (`Closes #N`); CI checks out both sibling repos and runs the full gate.

**Conventions**

- Match the surrounding code's comment density and idioms; comments explain _why_, not _what_.
- Validate untrusted input at the route; return structured errors; never leak upstream/internal
  detail (LLM errors → generic 502; ingest errors → generic message, detail logged).
- Any new public/write surface: bound input size, and fail **closed** on the security-relevant path.
- New json-render usage must stay inside `packages/spec/src/json-render.ts` (a test enforces this).

---

## 6. CI

`.github/workflows/ci.yml` checks out `lighter` **and** `lighter-example` as siblings (the `file:`
dep needs both), installs, then runs lint + typecheck + test + a production web build. Green-on-main
is the merge gate.

---

## 7. Consuming Lighter

- **As an HTTP service:** everything is REST/JSON — see [API.md](./API.md). The public review surface
  is the token-based `/share/*` routes; the internal surface is the `/screens/*`, `/ingest`,
  `/generate*` routes (keep those on a trusted network).
- **As libraries:** the `packages/*` are independently useful — `@lighter/spec` (spec type + catalog
  validation + the json-render boundary), `@lighter/ingestion` (`ingest()`), `@lighter/generation`
  (catalog-constrained generation over your own `LlmClient`), `@lighter/db` (the schema + helpers).
- **Bring your own design system:** anything that emits `dist/catalog.json`
  (`{components: {name: {description, props: <JSON Schema>}}}` + previews + used tokens) and
  `dist/tokens.json` can be ingested — `lighter-example` and `@lighter/design-system` are the two
  reference producers.
- **Or start from the first-party stack:** clone `apps/starter` (a Next.js app already wired to
  `@lighter/design-system`), swap the DTCG tokens in `packages/design-system/tokens/*.tokens.json`
  to get your own design system, and `pnpm --filter @lighter/design-system build` to produce the
  artifacts Lighter ingests. See [`apps/starter/README.md`](../apps/starter/README.md).
