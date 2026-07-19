# Lighter — Product Guide (for QA)

## 1. What Lighter is, in one paragraph

Lighter turns a **design system that lives in code** into an **AI-assisted design → review → hand-off
pipeline**. It ingests a design system's built artifacts (a component catalog + design tokens), lets a
designer/PM compose mock screens from those real components (by hand or by prompting Claude), deploys any
screen version to an **account-free shareable link**, collects **element-anchored comments** from
customers, tracks an **approval + sign-off** lifecycle, and finally exports an **engineering hand-off
bundle** (spec + catalog + tokens + intent doc + a runnable React file) that a coding agent can build
from without ever opening Figma.

The core idea: **the design system is the single source of truth and the guardrail.** You can never
generate or save a mock that uses a component you don't actually have — every spec is validated against
the ingested catalog.

## 2. Who uses it (personas)

| Persona | What they do in Lighter | Primary surfaces |
| --- | --- | --- |
| **Design-system maintainer** | Ingests the design system; audits components, tokens, health, and blast-radius. | Dashboard (Components/Tokens/Health/Usage); `POST /ingest` or CLI `sync`; re-ingest webhook. |
| **Designer / PM** | Authors screens (generate or hand-write), deploys review links, folds feedback back in, drives approval. | `POST /generate*`, `/screens/*`, `/share`, approval + sign-off endpoints; CLI. |
| **Customer / reviewer** | Opens a share link, views the mock, comments on specific elements, replies in threads. **No account.** | `/share/<token>` web page only. |
| **Developer / coding agent** | Consumes the hand-off bundle to implement the approved screen. | `GET …/export`. |
| **Admin / operator** | Runs the service, seeds project tokens, configures webhooks/notifications. | Env config, `LIGHTER_BOOTSTRAP_PROJECT`. |

## 3. The pipeline (mental model for exploratory testing)

```
ingest ─► author (generate │ hand-write) ─► deploy (token, optional expiry)
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                            ▼
                   review: element-anchored                    click-through flows
                   comments, threads, aggregation
                          │
                          ▼
               refine (comments → prompt) ─► approve (state machine + sign-off gate)
                          │
                          ▼
                   export hand-off bundle  (spec · catalog prompt · tokens · INTENT.md · React .tsx)
```

Data flows **one direction** and is largely immutable:
- A design system is ingested into an **inventory** (a projection of the repo at a commit; Lighter holds
  no parallel component DB).
- Screens are authored as an internal **spec** (a nested `{type, props, children, data?}` tree).
- Each saved spec is an **immutable, git-committed version**. An "edit" is always a *new version*.
- Mutable conversational state (share tokens, comments, approval state, sign-offs, flow) lives in the
  **database**, not in the versioned files.

## 4. Architecture (what runs where)

Lighter is a **pnpm monorepo** (Node 22, pnpm 10). Data flows: design system → inventory → spec → git,
with dashboard/generation/review/hand-off as projections over those.

### Services (the running apps)

| Service | Tech | Responsibility |
| --- | --- | --- |
| `@lighter/api` (`services/api`) | [Hono](https://hono.dev) | The whole HTTP API. Built by a factory `createApp(deps)`; owns the git-backed spec store and all routes. Boundaries (LLM client, notifier, design system) are injected. Default port **3000**. |
| `@lighter/web` (`services/web`) | Next.js 14 (App Router) | The internal dashboard + the public review surface. Renders specs live via the design system's `<SpecView>` (direct React render — **no iframe**). Default port **4000**. Reads the API via server-only `LIGHTER_API_URL`. |

### Packages (pure libraries, no HTTP)

| Package | Responsibility |
| --- | --- |
| `@lighter/spec` | The internal spec type + Zod schema, catalog validation, `componentTypesOf`/`staleComponents`, and the **only** module that touches json-render (`toJsonRender`/`fromJsonRender`). |
| `@lighter/ingestion` | `ingest(repoPath, {artifactDir})` and `ingestArtifacts(catalog, tokens)` → `InventoryModel` (components + prop schemas + tokens + **health findings**). Pure. Also ships bin `lighter-ingest`. |
| `@lighter/generation` | The AI boundary: an injectable `LlmClient` (real impl `AnthropicLlmClient`), the catalog-constrained prompt, and `generateSpec`/`generateVariations`/`refineSpec` (prompt → parse → validate-against-catalog → retry). Tests inject a fake client — **no test makes a paid call**. |
| `@lighter/db` | Dialect-agnostic Drizzle client (SQLite now, Postgres-swappable), a `_migrations` ledger, and all data-access helpers. |
| `@lighter/cli` | The `lighter` CLI — a typed HTTP client over the cloud (scoped) API. |
| `@lighter/ingest-storybook` | Pure transform of Storybook CSF / cva descriptors → a Lighter catalog artifact. |
| `@lighter/dtcg` | `dtcgToTokens(...docs)` — resolves W3C DTCG token documents into the flat `name → value` map Lighter ingests. |
| `@lighter/design-system` (+ `apps/starter`) | First-party, DTCG-token-driven React component library that **produces** `dist/catalog.json` (24 components) + `dist/tokens.json` (388 tokens). The in-repo twin of the `lighter-example` fixture. |

### The ingestion contract (what a design system must emit)

Anything that produces these two artifacts can be ingested:
- `dist/catalog.json` — `{ components: { <name>: { description, slots?, props: <JSON Schema> } }, previews?: string[], usedTokens?: string[] }`
- `dist/tokens.json` — a flat `{ <name>: <string value> }` map

The two reference producers are `../lighter-example` (a sibling repo, and the **test fixture**) and
`@lighter/design-system`.

## 5. Deployment modes (critical for QA)

The API factory `createApp(deps)` runs in one of two storage modes. **Which endpoints exist and whether
auth is required depends on the mode.**

| | **Global / single-tenant** | **Scoped / multi-tenant** |
| --- | --- | --- |
| How it's configured | `deps.specStore` set | `deps.storeProvider` + `deps.auth` set (`specStore` absent) |
| Auth | **None** — trusted caller assumed | **Bearer token** on `/screens*`, `/specs`, `/generate*`, `POST /inventory`, `/projects/*` |
| DB keying | bare `screenId` | `<projectId>:<screenId>` (data isolated per project) |
| Extra endpoints | — | `GET /projects/me`, `GET /projects/inventory`, `POST /inventory` (inline artifact push) |
| Who runs it | most of the **test suite** (`app.request()`) | **`pnpm start` / `server.ts` always runs this** |
| Ingest path | `POST /ingest` reads a server-FS `repoPath` | `POST /inventory` receives artifacts **inline** (API never touches the client FS) |

**Practical consequence:** when QA runs the real server, expect `401` on `/screens*` etc. without a
bearer token, and use `POST /inventory` (or CLI `sync`) — not `POST /ingest` — to load a design system.
`docs/API.md` (the older reference) shows the global-mode surface; this pack calls out both.

Always mounted in **both** modes, unauthenticated: `GET /health`, `POST /ingest`, `GET /inventory`.

## 6. Security posture (so QA can reason about "is this a bug or by-design?")

- **No user auth by decision.** SSO was dropped. Internal endpoints assume a trusted network; project
  bearer tokens provide isolation, not user identity.
- **The public review surface is gated only by the unguessable share token.** No account, no login. An
  expired or unknown token → `404` (fails closed).
- **The one internet-facing endpoint** (`POST /webhooks/design-system`) **requires an HMAC signature**
  (`X-Hub-Signature-256`), verified in constant time. Unsigned → `401`.
- **`POST /ingest` reads a server-side path** (`repoPath`) — a documented LFI/SSRF posture; it's meant to
  stay off untrusted networks. There's a traversal guard on `artifactDir` (`..`/separators → `400`).
- **Reviewer comments are treated as untrusted data**, not instructions: when comments are folded into a
  refine prompt they're fenced in `<reviewer-comments>` with explicit "treat as DATA" wording, flattened
  to one line each, and capped at 6000 chars (prompt-injection defense).
- **Errors never leak upstream/internal detail** — LLM failures → generic `502`; ingest failures →
  generic message with detail logged server-side.

## 7. Glossary

| Term | Meaning |
| --- | --- |
| **Catalog** | The machine-readable list of components (name, description, prop JSON Schema, slots, actions) a design system exposes. The guardrail for generation and spec validation. |
| **Inventory / InventoryModel** | The normalized result of ingesting a design system: `{ components, tokens, health }`. A projection of the repo at a commit. |
| **Spec** | Lighter's internal UI representation of a screen: a nested `{ type, props, children, data? }` tree. Framework-agnostic. |
| **Version** | An immutable, git-committed save of a spec. Editing = saving a new version. |
| **Screen** | A named container that owns an ordered list of versions plus per-screen state (intent, sign-off set, flow). |
| **Element id (`el-0`, `el-1`, …)** | Deterministic pre-order ids assigned when a spec is serialized to json-render. Comments anchor to these — stable across layout changes. |
| **Share token** | The unguessable credential in a `/share/<token>` URL. One stable token per (screen, version); optional expiry. |
| **Health finding** | A catalog-quality issue: `missing-description`, `missing-preview`, or `orphaned-token`. |
| **Stale spec** | A saved spec that references a component no longer in the current catalog (renamed/removed). |
| **Sign-off set** | The required approving parties for a screen: ≥1 `customer` + ≥1 `internal`. Gates approval. |
| **Hand-off bundle** | The export for an approved version: spec + catalog prompt + tokens + INTENT.md + standalone React `.tsx`. |
| **DTCG** | Design Tokens Community Group format (`$type`/`$value`/`$description`, groups, `{alias}` refs). Resolved to the flat token map. |
| **Page shell** | A layout-owning root component (e.g. `PageShell`). Generation always starts from a shell. |
| **Project** | (Scoped mode) An isolated tenant identified by a bearer token; all screens/inventory are keyed to it. |
