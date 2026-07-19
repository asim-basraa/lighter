# Lighter — Feature Briefs

One brief per feature. Each has: **Purpose**, **How it works / behavior**, **Surface** (endpoints/UI/CLI),
**Boundaries & rules**, and **Acceptance criteria**. The feature ID (`F-*`) matches the test-case block in
`TEST_PLAN.md`.

> Legend for status: **✅ shipped & has UI** · **🔌 shipped, API/CLI only (no web UI)** · **⚠️ mode/config-gated**

---

## F-INGEST — Design-system ingestion  🔌⚠️

**Purpose:** turn a design system's built artifacts into the normalized inventory that is Lighter's
guardrail and dashboard source.

**How it works:** ingestion is a pure function over two artifacts — `catalog.json`
(`{components:{name:{description,slots?,props}}, previews?, usedTokens?}`) and `tokens.json` (flat
`name→string`). It validates both (Zod), normalizes them (components + tokens sorted by name; token
`category = name.split('.')[0]`), computes **health findings**, and returns `{components, tokens, health}`.
Two entry paths share the same core (`buildInventory`) so they can't diverge:
- **On-disk** (`ingest(repoPath,{artifactDir})`) — reads files off the server FS. Exposed as `POST /ingest`
  (global) and the bin `lighter-ingest`.
- **Inline** (`ingestArtifacts(catalog,tokens)`) — receives artifacts in the request body. Exposed as
  `POST /inventory` (scoped, bearer-guarded) and used by CLI `sync`.

**Surface:** `POST /ingest` (unauth, global), `GET /inventory` (unauth, global), `POST /inventory` +
`GET /projects/inventory` (scoped, bearer), CLI `sync`, bin `lighter-ingest`.

**Boundaries & rules:**
- `POST /ingest`: `repoPath` required (else `400`); `artifactDir` with `..`/separator → `400` (traversal
  guard); bad repo/artifacts → `422`.
- `POST /inventory`: body must be an object (`400`); Zod failure → `400` with `issues`.
- `repoPath` is a server-read path (documented LFI/SSRF posture — internal only).
- Absent `previews`/`usedTokens` **disables** the corresponding health check (absence ≠ problem).

**Acceptance criteria:** a valid design system ingests to a model whose component/token counts match the
artifacts; an unhealthy fixture yields exactly the expected findings; a malformed artifact fails loudly
with the file path (on-disk) or `issues` (inline), never a 500.

---

## F-DASH — Inventory dashboard (Components / Tokens)  ✅

**Purpose:** let a maintainer browse the real design system at a glance.

**How it works:** four read-only Next.js pages fetch the global inventory (`GET /inventory`, `no-store`).
- **Components (`/`)**: grid of cards — name, health badge, description, a **live preview** (direct React
  render via `<SpecView>`, using the component's own preview spec), and a **props table** generated from
  the component's JSON Schema (Prop/Type/Required/Default).
- **Tokens (`/tokens`)**: tokens grouped by category (Color / Type scale / Spacing / Radii / Shadows /
  unknown), each with a category-appropriate **swatch** (`data-testid="swatch-<name>"`).

**Surface:** web `/` and `/tokens`.

**Boundaries & rules:** purely presentational — no interactive controls. Distinct states: **error**
(API unreachable → red message), **empty** (`No components/tokens ingested yet`), **per-card empty**
(`No preview available`), **populated**.

**Acceptance criteria:** every ingested component/token appears with correct preview/swatch and schema
table; empty and error states render their specific messages, not a blank page.

---

## F-HEALTH — Catalog health findings  ✅

**Purpose:** flag catalog-quality gaps that would hurt generation/hand-off.

**How it works:** `computeHealth` produces three kinds, sorted by (kind, target):
- `missing-description` — `description.trim().length <= 3` (so a 3-char description **is** flagged). Always
  checked.
- `missing-preview` — component not in `previews`. **Only when `previews` provided.**
- `orphaned-token` — token not in `usedTokens`. **Only when `usedTokens` provided.**
The Health page (`/health`) shows a green "All healthy" banner when there are no findings, else a red
summary + per-target grouped findings.

**Surface:** part of the inventory model (`.health`); web `/health`.

**Acceptance criteria:** thresholds and "optional ⇒ skip, don't flag-all" semantics behave exactly as
above; healthy design system → explicit healthy banner (not an empty page).

---

## F-USAGE — Component usage / blast radius  ✅🔌

**Purpose:** show which screens/versions reference each component (blast radius of a change) and flag
stale specs.

**How it works:** `/usage` joins the inventory with `GET /specs`. `GET /specs` returns one record per
screen's **latest** version: `{screen, version, components, stale, staleComponents}`.

**Surface:** `GET /specs` (API); web `/usage`.

**Boundaries & rules:** three distinct empties — no components, "no saved specs yet" (blue notice), and
per-row "Not used in any saved spec." **Stale** = references a component missing from the current catalog;
when no catalog is ingested, `known=null` ⇒ everything reported **not stale**.

**Acceptance criteria:** usage pills reflect real references; stale flag toggles correctly after a
re-ingest removes/renames a component (see F-STALE).

---

## F-GEN — AI generation from intent  🔌⚠️

**Purpose:** go from plain-English intent to a catalog-valid screen spec.

**How it works:** `generateSpec` builds a system prompt = hard rules (output one JSON object
`{root:{type,props,children}}`, root type MUST equal the shell, use ONLY listed components, satisfy each
prop schema) + a deterministic `catalogPrompt`. It calls the injected `LlmClient`, robustly extracts JSON
(whole string → fenced block → first balanced `{…}` that parses), then validates: structural (Zod) →
root-type check → `validateAgainstCatalog`. **On any failure it re-prompts with the specific rejection
reasons, up to `maxAttempts` (default 3).** First valid spec wins; returns `{spec, attempts}`.

**Surface:** `POST /generate {intent}`; CLI `generate "<intent>"`.

**Boundaries & rules:** requires a generator (`ANTHROPIC_API_KEY`) → else **501**. Blank intent → `400`.
No catalog ingested → `422`. Never validates within N attempts → `422` (`GenerationError` with `issues`).
Upstream/network/rate-limit failure → **502** (`spec generation failed`, no detail leaked). The catalog
*guides* via the prompt but is *enforced* by post-validation.

**Acceptance criteria (invariant-based, not exact output):** the returned spec validates against the
catalog, uses only cataloged components, is rooted at a page shell, and invalid model output triggers the
retry path.

---

## F-VARIATIONS — Side-by-side generation variations  🔌⚠️

**Purpose:** explore multiple directions for one intent cheaply.

**How it works:** `generateVariations` runs `count` independent `generateSpec` loops, each nudged to
choose a distinctly different layout; each result is independently catalog-valid.

**Surface:** `POST /generate/variations {intent, count?}`. `count` defaults to 3, clamped 1–5.

**Acceptance criteria:** N valid variations returned; `count` out of range is clamped, not errored;
same error set as F-GEN.

---

## F-REFINE — Conversational refinement (feedback-aware)  🔌⚠️

**Purpose:** iterate on an existing screen with a follow-up instruction, incorporating review comments.

**How it works:** `POST /screens/:id/refine` loads the screen's **latest** spec, folds that version's
review comments in as **fenced, sanitized, element-anchored feedback** (`<reviewer-comments>`, one line
each, capped 6000 chars — prompt-injection defense), applies the instruction, validates/retries like
F-GEN, and saves the result as a **new version**.

**Surface:** `POST /screens/:id/refine {instruction}`.

**Boundaries & rules:** needs generator **and** store (else `501`); unknown screen → `404`; screen with no
version → `422`; blank instruction → `400`; no catalog → `422`; generation failure → `422`/`502`. The new
version is saved **outside** the generation try, so a store failure is a `500`, not a mislabeled
generation error.

**Acceptance criteria:** refine produces a new catalog-valid version; comments visibly influence the
prompt but can never act as instructions; over-cap comments are dropped with a visible marker.

---

## F-SCREEN — Screens & spec versioning  🔌⚠️

**Purpose:** create named screens and save immutable, git-committed spec versions.

**How it works:** `POST /screens {name}` creates a slug-keyed screen; `POST /screens/:id/versions {spec}`
validates and appends the next version (nothing is written on failure); `POST /screens/:id/duplicate
{name}` starts a new screen whose v1 copies the source's latest spec; `GET`s read screens/versions.
Versions are stored as one immutable git-committed file each; per-screen mutable state (intent, sign-off,
flow, approval, comments) lives in the DB.

**Surface:** `POST/GET /screens`, `GET /screens/:id`, `POST/GET /screens/:id/versions[/:v]`,
`POST /screens/:id/duplicate`; CLI `screen create [--shell]`.

**Boundaries & rules:** empty name → `400`; duplicate slug → `409`; invalid name → `400`; version param
must be a positive integer (`400`) and exist (`404`); duplicate of an empty source → `422`.

**Acceptance criteria:** save = new version; an edit never mutates a prior version; duplicate copies the
latest spec as v1; all validation/error codes as above.

---

## F-VALIDATE — Catalog validation guardrail  🔌

**Purpose:** make it impossible to save/generate a spec that uses a component you don't have.

**How it works:** every saved and generated spec runs through `validateAgainstCatalog`, which walks the
tree and emits issues: `unknown-component` (uses `Object.hasOwn`, so `constructor`/`__proto__` are **not**
treated as components), `invalid-props` (Ajv, one issue per error, path like `props/foo`), and
`catalog-schema-invalid` (a bad catalog schema surfaces as a structured issue, not a 500). Validators are
memoized per component type.

**Surface:** enforced inside F-SCREEN (`POST …/versions` → `400` with `issues`) and F-GEN/F-REFINE.

**Boundaries & rules:** no catalog ingested → `422` (can't validate). Structurally invalid spec →
`400 'spec is not structurally valid'`; catalog-mismatch → `400 'spec does not match the catalog'`.

**Acceptance criteria:** unknown component / bad prop is rejected with precise issues; prototype-key
components are rejected as unknown; a malformed catalog schema is reported, never crashes.

---

## F-INTENT — Screen intent document (INTENT.md)  🔌

**Purpose:** capture purpose/flows/edge-states/mocked-data that HTML can't express; ships in the bundle.

**How it works:** `PUT /screens/:id/intent {intent}` stores markdown in the screen's git dir;
`GET …/intent` reads it back (or `null`).

**Surface:** `GET/PUT /screens/:id/intent`.

**Boundaries & rules:** `intent` must be a string (empty string allowed) → non-string `400`; unknown
screen `404`.

**Acceptance criteria:** intent round-trips; appears in the export bundle (F-EXPORT).

---

## F-SHARE — Deploy to a tokenized review link  🔌

**Purpose:** make any version viewable at an unguessable, account-free URL.

**How it works:** `POST /screens/:id/versions/:v/share {expiresInSeconds?}` mints (or **reuses**) a stable
token — one per (screen, version), enforced by a unique index — with an optional absolute expiry.
Deploying advances **`draft → shared` only from draft** (never resets a later state). `GET /share/:token`
resolves the token to `{screen, version, spec, deployedAt, flow}`.

**Surface:** `POST …/share` (deploy), `GET /share/:token` (public); CLI `deploy`/`open`.

**Boundaries & rules:** version must be a positive integer (`400`) and exist (`404` — never mint for a
missing version); `expiresInSeconds` must be a finite in-range number (`400`). **Unknown or expired token
→ `404 'share not found'`** (fails closed on past/NaN expiry). Re-deploy can set/change/clear expiry and
returns the same token.

**Acceptance criteria:** deploy is idempotent (stable token); expiry is enforced; state transition only
fires from draft; the public GET never leaks why a token failed.

---

## F-REVIEW — Public review surface (render + banner + flow)  ✅

**Purpose:** show the customer a live, unmistakably-prototype mock.

**How it works:** `/share/[token]` (bare layout, **no internal nav**) renders the mock via direct React
render (`<SpecView spec={toJsonRender(spec)}/>` — **no iframe**), above it a **VersionBanner** (amber
"Prototype" tag + `screen · v{n} · {deployedAt}`) and a **FlowNav** bar.

**Surface:** web `/share/[token]`.

**Boundaries & rules:** unknown token → "This shared mock was not found."; other failure → generic
"Something went wrong"; technical detail is logged server-side only (public surface). Rendering is direct
React — no sandbox iframe anywhere in the app.

**Acceptance criteria:** a valid token renders the exact spec with the prototype banner; a bad/expired
token shows the not-found message, never a stack trace.

---

## F-COMMENT — Element-anchored comments & threads  ✅

**Purpose:** precise, conversational feedback that survives layout changes.

**How it works:** comments anchor to structural json-render element ids (`el-0`, `el-1`, … deterministic
pre-order). A top-level comment supplies `elementId`; a **reply** supplies `parentId` and inherits the
parent's anchor. Threads are **one level deep**. The web panel lists threads, offers an element `<select>`
+ body + optional name, and posts via a same-origin proxy (`POST /api/share/:token/comments`) that
forwards to the API.

**Surface:** `POST/GET /share/:token/comments` (public), `GET /screens/:id/comments` (internal
aggregation); web CommentsPanel on `/share/[token]`.

**Boundaries & rules:** body required, ≤4000 (`400`); author ≤120 (`400`); unknown/expired token → `404`;
`parentId` not integer → `400`; parent missing/cross-version → `404`; reply-to-a-reply →
`400 'can only reply to a top-level comment'`; top-level with no elementId → `400`; anchor not in this
version's spec → `422`. Web special-cases the 422 to "That element is no longer part of this version."

**Acceptance criteria:** anchoring, threading (one level), cross-version rejection, length caps, and the
stale-anchor 422 all behave as specified; a posted comment appears in the thread without a reload.

---

## F-AGGREGATE — Comment aggregation (PM view)  🔌

**Purpose:** let a PM see all feedback across versions in one place.

**How it works:** `GET /screens/:id/comments` groups every version's comments by version → element →
threads (root + replies).

**Surface:** `GET /screens/:id/comments`.

**Acceptance criteria:** comments from multiple versions/elements are grouped correctly; unknown screen
→ `404`.

---

## F-APPROVE — Approval state machine  🔌

**Purpose:** make sign-off explicit, recorded, and terminal.

**How it works:** per-version state: `draft → shared → {changes-requested | approved}`,
`changes-requested → approved`; **`approved` is terminal** (a fix is a new version — there is no
`changes-requested → shared` edge). Unstored state defaults to `draft`. Transitions are idempotent when
already in the target state.

**Surface:** `GET …/status`, `POST …/request-changes`, `POST …/approve`.

**Boundaries & rules:** illegal transition → `409 {message:'cannot go from "X" to "Y"', state:X}` (e.g.
`draft → approved`, or `draft → changes-requested`). Bad version → `400`; missing version → `404`. Approve
is additionally gated by sign-off (F-SIGNOFF) and fires an approval notification only on a real transition.

**Acceptance criteria:** every legal transition works; every illegal one is `409`; idempotent re-approve
is `200` and does **not** re-fire notifications.

---

## F-SIGNOFF — Sign-off enforcement  🔌

**Purpose:** enforce "approved by all required parties," not assumed.

**How it works:** `PUT /screens/:id/sign-off-set {parties:[{party,role}]}` configures the required set
(each party unique; role ∈ {customer, internal}; **≥1 customer + ≥1 internal**). `POST …/versions/:v/
sign-offs {party}` records one party's sign-off and returns `{signed, missing, complete}`. `approve` is
**blocked `409 {missing:[…]}`** until every required party has signed *that version*. A screen with no set
is ungated.

**Surface:** `GET/PUT /screens/:id/sign-off-set`, `POST …/versions/:v/sign-offs`.

**Boundaries & rules:** bad set (not array / empty party / bad role / duplicate / missing a required role)
→ `400` with the specific message; signing with no set configured → `400`; signing a party not in the set
→ `400`.

**Acceptance criteria:** approve is blocked until complete; each sign-off narrows `missing`; validation of
the set matches every rule above.

---

## F-EXPORT — Hand-off bundle  🔌

**Purpose:** give engineering everything to build the approved screen with no Figma.

**How it works:** `GET /screens/:id/versions/:v/export` returns
`{screen, version, spec, catalogPrompt, tokens, intent, reactExport}` — the approved spec, the
deterministic catalog prompt, the token file, the INTENT.md, and a **runnable standalone `.tsx`** that
embeds the spec and renders it via the design system.

**Surface:** `GET …/export`.

**Boundaries & rules:** **`403 {state}` unless the version is `approved`**; unknown → `404`; no catalog →
`422`; spec that can't serialize to React (a prop named `visible`/`on`/`repeat`/`watch`) → `422`. The
catalog prompt + tokens reflect the **current** ingested design system (can drift post-approval).

**Acceptance criteria:** non-approved export is `403`; approved export contains all 7 fields and the
`reactExport` renders the approved screen when dropped into a design-system-equipped project.

---

## F-FLOW — Click-through flows  🔌

**Purpose:** let reviewers evaluate journeys, not just single screens.

**How it works:** `PUT /screens/:id/flow {links:[{label,target}]}` (≤20; each `target` must be an existing
screen in the same scope). At render, each link resolves to the target screen's latest **live** deployed
token, or `null` so the UI disables dead links.

**Surface:** `GET/PUT /screens/:id/flow`; rendered by FlowNav on `/share/[token]`.

**Boundaries & rules:** not-array/`>20`/empty label/empty target/non-existent target → `400`; unknown
screen → `404`. Target with no live deploy → `token:null` → disabled link ("Not deployed yet").

**Acceptance criteria:** the flow bar links to live targets and disables not-yet-deployed ones; validation
matches every rule.

---

## F-STALE — Stale-spec detection  🔌

**Purpose:** tell the team which mocks a component change breaks.

**How it works:** `GET /specs` computes `staleComponents(spec, known)` per screen's latest version. After a
re-ingest removes/renames a component, specs referencing it flip to `stale:true`. No catalog ingested ⇒
`known=null` ⇒ everything `stale:false`.

**Surface:** `GET /specs`; web `/usage`.

**Acceptance criteria:** stale toggles correctly across a re-ingest; no-catalog yields not-stale.

---

## F-WEBHOOK — Design-system re-ingest webhook  🔌⚠️

**Purpose:** re-ingest automatically on a push to the design-system repo.

**How it works:** `POST /webhooks/design-system` (mounted only when `DESIGN_SYSTEM_REPO` **and**
`WEBHOOK_SECRET` are set). Requires `X-Hub-Signature-256: sha256=<hmac>` over the raw body, verified in
constant time. Reads the commit sha from `after`/`head_commit.id`. Re-ingests the **server-configured**
repo (payload never supplies the path). **Idempotent per commit sha** — a re-delivery → `200 skipped`; a
new sha → `201 ok`.

**Surface:** `POST /webhooks/design-system`.

**Boundaries & rules:** unsigned/wrong-signature → `401`; bad JSON → `400`; missing sha → `400`; ingest
failure → `422` (generic message). Ingestion reads the repo's **current on-disk state**; the sha is only
the idempotency token.

**Acceptance criteria:** a correctly-signed new commit re-ingests once; re-delivery is a no-op skip;
unsigned/mis-signed is refused `401`.

---

## F-NOTIFY — Notifications  🔌⚠️

**Purpose:** push comment/approval events to a team webhook so nobody polls.

**How it works:** when `NOTIFY_WEBHOOK_URL` is set, the API POSTs a JSON event (5s timeout, best-effort)
on: a **comment** (`{kind:'comment', screenId, version, elementId, author, body, parentId}` — top-level
*and* replies) and an **approval** (`{kind:'approval', screenId, version}` — only on a real transition to
approved).

**Surface:** side effect of F-COMMENT and F-APPROVE.

**Boundaries & rules:** a missing/slow/failing sink never breaks the triggering action; an idempotent
re-approve does **not** re-fire.

**Acceptance criteria:** both events fire with the right payload; a broken sink doesn't fail the comment
or approval.

---

## F-AUTH — Project scoping / bearer auth  🔌⚠️

**Purpose:** isolate multiple tenants (design-system teams) on one deployment.

**How it works:** in scoped mode a bearer guard protects `/screens*`, `/specs`, `/generate*`,
`POST /inventory`, `/projects/*`. The token resolves to a project; DB keys become `<projectId>:<screenId>`.
`GET /projects/me` returns the token's project.

**Surface:** `Authorization: Bearer <token>` header; `LIGHTER_BOOTSTRAP_PROJECT` seeds one at boot.

**Boundaries & rules:** missing/malformed header → `401 'missing bearer token'`; unknown/wrong token →
`401 'invalid token'` (does not distinguish). Token validity depends on a stable
`LIGHTER_TOKEN_SIGNING_SECRET`.

**Acceptance criteria:** guarded routes reject without a valid token; one project cannot read another's
data; the unauthed global `GET /inventory` does not alias `GET /projects/inventory`.

---

## F-CLI — The `lighter` CLI  🔌

**Purpose:** a typed command-line client over the cloud (scoped) API.

**How it works:** commands dispatch to HTTP calls. Config precedence: **flags › env
(`LIGHTER_URL`/`LIGHTER_TOKEN`) › `lighter.config.json`**. `--url` is required (except `help`); `--token`
is validated per-command by the server. Commands: `whoami`, `inventory`, `sync [--dir][--tokens-dtcg]`,
`screen create <name> [--shell]`, `generate "<intent>" [--screen <name>]`, `deploy <screen>
[--version][--expires]`, `open <screen>`, `help`.

**Surface:** bin `lighter` (`pnpm lighter`).

**Boundaries & rules (QA gotchas):** two arg-parsers coexist (`parseArgs` vs `flagValue`) — a value flag
followed by another `--flag` is treated as boolean, so `generate` only saves when `--screen` is a real
string; `--version`/`--expires` must be positive numbers; the review URL is built **client-side** from
`--url`, so a wrong/trailing-slash URL yields a plausible-but-wrong link; `sync` needs a pre-built `dist/`.
Non-2xx → `LighterApiError` with `METHOD path → status: body`, exit 1.

**Acceptance criteria:** each command hits the right endpoint and formats output as specified; the
arg-parsing boundaries behave as documented; errors exit non-zero with a useful message.

---

## F-INGEST-SB — Storybook / cva ingestion  🔌

**Purpose:** produce a Lighter catalog from existing Storybook CSF or shadcn/cva components (adopt Lighter
with zero Lighter-specific authoring).

**How it works:** pure transform (`buildCatalogFromStories`, `buildCatalogFromCva`) of evaluated CSF
modules / cva descriptors → the same catalog shape ingestion consumes. Components/previews sorted; a
component gets a preview iff its module has ≥1 non-`default` export. `argTypeToSchema` maps controls to
JSON Schema (`options[]`→enum; text→string; range/number→number; **unknown → permissive `{}`**). Props
schema uses `additionalProperties:false`. Missing description defaults to `''` (→ later a health finding).

**Surface:** library only (no bin); output pushed via `POST /inventory`.

**Acceptance criteria:** a CSF/cva input produces a deterministic, sorted catalog; unknown controls don't
block ingestion; the boolean-variant detection requires literal `"true"/"false"` keys.

---

## F-DTCG — DTCG token resolution  🔌

**Purpose:** resolve W3C DTCG token documents into the flat `name→value` map Lighter ingests.

**How it works:** `dtcgToTokens(...docs)` walks groups vs tokens (a token has `$value`), skips `$`-metadata
keys, names tokens by dotted path (`color.blue.500`), merges multiple docs (**later doc wins**), and
resolves aliases (`"{group.token}"`, multi-hop). Non-string values are `JSON.stringify`d.

**Surface:** used by CLI `sync --tokens-dtcg <file>`; library export.

**Boundaries & rules:** an alias must be the **entire** trimmed string — `"1px solid {color.border}"` is
**not** resolved (returned literally). Circular alias → throws; unknown reference → throws (loud, surfaces
to the CLI user).

**Acceptance criteria:** aliases resolve (incl. multi-hop and later-doc-wins); partial-string aliases are
left literal; circular/unknown refs throw a clear error.

---

## F-PERSIST — Persistence & migrations  🔌⚠️

**Purpose:** durable storage for conversational state, dialect-agnostic.

**How it works:** Drizzle over SQLite (Postgres-swappable at the driver). Migrations are raw SQL files
applied in order, tracked in a `_migrations` ledger (re-running is a no-op). Tables: health checks,
inventory snapshots, shares, comments, version status, sign-off config/records, flow links, ingested
commits, projects/tokens.

**Surface:** internal; observable via `GET /health` (`db:'ok'`).

**Boundaries & rules:** `DB_DIALECT=postgres` **throws** (not wired); unknown dialect throws; a
non-`:memory:` `DATABASE_URL` auto-creates the parent dir.

**Acceptance criteria:** migrations apply once and are idempotent; `GET /health` reports DB reachability;
Postgres is a clean startup failure, not a silent misbehavior.
