# Lighter build — HANDOFF

Resume with `claude --continue` in `/Users/asim/work/lighter/lighter`. This file is the source of
truth for where the autonomous build loop is.

## Loop definition (per slice)

For each issue in dependency order:

1. `gh issue edit <n> --add-label in-progress --remove-label ready`
2. Branch `feat/<n>-<slug>` off `main`.
3. TDD: write failing test → implement → green. Run `pnpm test typecheck lint format`.
4. Commit, push, open PR with `Closes #<n>`.
5. Fresh **code-review** subagent → fix findings.
6. Fresh **test** subagent (independent verification) → fold in changes.
7. Fresh **final-review** subagent → APPROVE.
8. **Auto-merge when green** (`gh pr merge <pr> --squash --delete-branch`) — user opted into auto-merge, no approval gate.
9. Sync `main`, next slice.

## Decisions locked

- Tracker: GitHub Issues on `asim-basraa/lighter`. Board: Project #1 "Lighter Backlog".
- `lighter-example` = **separate sibling repo** at `/Users/asim/work/lighter/lighter-example` (doubles as test fixture). NOT inside the monorepo (overrides PRD line 64 per user).
- Persistence: SQLite v1 via Drizzle, Postgres-swappable (driver + `DB_DIALECT` only, no query rewrites).
- Merge policy: auto-merge when review+tests green.
- **Web client: Next.js (App Router)** (user-chosen) at `services/web` — ONE app for the internal
  dashboard (#8-12), ideation UI (#17-20), and the customer review surface (#21-30, tokenized
  per-spec URLs). Consumes `@lighter/api` for ingested metadata AND depends on `lighter-example`
  (file/link dep) for the real React registry + `<SpecView>` to render live previews.

## Frontend phase plan (#8-12) — read before starting

- **Prerequisite (closes the producer gap):** teach `lighter-example` to emit `dist/catalog.json`
  from its catalog — `{ components: { name: {description, slots, props: <JSON Schema>} }, previews:
[names], usedTokens: [names] }`. Use `zod-to-json-schema` on each component's Zod `props`. Wire
  into `pnpm build`, test it. This makes `ingest()` / `POST /ingest` work against the LIVE example,
  so the dashboard's data genuinely "comes from the inventory API" (AC of #8). Do this FIRST as a
  small lighter-example PR.
- Then `services/web` (Next.js): #8 gallery (fetch `/inventory` for the list + render each preview
  via lighter-example `<SpecView>`), #9 props table (from `props` JSON Schema), #10 token inventory,
  #11 health panel (from `model.health`), #12 usage.
- `services/web` needs `lighter-example` as a dependency: `pnpm add lighter-example@file:../../lighter-example`
  (or `link:`). CI note: sibling repo must be present — fine locally; revisit if CI is wired.

## Environment / secrets

- `.env` (gitignored) holds `ANTHROPIC_API_KEY` (needed for slice #17 generation), `DB_DIALECT=sqlite`, `DATABASE_URL`.
  ⚠️ Key was pasted in plaintext in chat — recommend rotating in Anthropic Console.
- Toolchain: Node 22, pnpm 10.

## Status (2026-07-17): frontend phase PUBLISHED ✅

GitHub auth was restored (`gh auth login -s workflow`); the whole frontend phase is merged to `main`
and CI is live. Nothing pending to publish for #8–12.

- Prerequisite: lighter-example **PR #3** (`dist/catalog.json` + `./ui` entry) — MERGED.
- #8 PR #43 · #9 PR #44 · #10 PR #45 · #11 PR #46 · #12 PR #47 — all MERGED (squash), issues CLOSED.
- #35 (SSO) — **CLOSED** (dropped, no SSO planned); the repoPath-hardening concern is kept as a
  standalone SECURITY note in `services/api/src/app.ts` (PR #48), untracked until the ingest surface
  is exposed.
- CI — `.github/workflows/ci.yml` live (**PR #49**): checks out `lighter` + `lighter-example`
  siblings (the `file:` dep needs both), runs install/lint/typecheck/test + a production web build.
  Green on `main`.

### Toolchain gotcha (recorded in agent memory `lighter-toolchain-arch`)

`pnpm` runs under Rosetta (x64) here; `node` is native arm64. **Validate with `pnpm test`, never
bare `npx vitest`** (arch mismatch on native modules). Root `pnpm.supportedArchitectures` makes
esbuild/rollup multi-arch; `better-sqlite3` is kept x64 to match pnpm's node.

## Repo topology for PRs

- Monorepo slices (`lighter`): branch + PR in `asim-basraa/lighter`, `Closes #N` auto-closes.
- Design-system slices (#2,#3,...): branch + PR in `asim-basraa/lighter-example`; reference
  `asim-basraa/lighter#N` and **close the issue manually** on merge (cross-repo keywords don't fire).

## Progress

- [x] Setup: 42 SDLC skills synced to `.claude/skills/`; triage labels + `area:*` created; 37 issues published to board.
- [x] **#1 Monorepo scaffold + Drizzle DB** — MERGED (lighter PR #38). `@lighter/db`: dialect-agnostic client, `_migrations` ledger, health_checks round-trip. 5 tests.
- [x] **#2 lighter-example tokens** — MERGED (lighter-example PR #1). Typed token source (5 categories) + `pnpm build` → dist/tokens.json (flat, ingestion-ready) + dist/tokens.css. 7 tests. Collision guard + null-safe flatten.
- [x] **#3 components + page shell + json-render catalog** — MERGED (lighter-example PR #2). 5 components (Text/Button/Card/Stack/PageShell) with Zod props + descriptions + `slots`; `@json-render/core`+`react` 0.19.0 catalog/registry; `<SpecView>`; preview specs. 16 tests. json-render API: `defineSchema`→`defineCatalog(schema,{components,actions})`, `defineRegistry`, `<Renderer>` needs State+Visibility+Action providers; flat spec `{root,elements}`.
- [x] **#4 catalog ingestion pure fn + CLI** — MERGED (lighter PR #39). `@lighter/ingestion`: `ingest(repoPath,{artifactDir})` reads `<dir>/{tokens.json,catalog.json}` → InventoryModel (components+tokens). Hermetic fixture mirrors lighter-example. Zod artifact contract, fails loud w/ path. 15 tests. ⚠️ **Producer gap:** lighter-example emits tokens.json but NOT catalog.json yet — wire that (emit `dist/catalog.json` from its catalog) when doing #7/#36 so live ingestion works, not just the fixture.
- [x] **#5 ingestion health findings** — MERGED (lighter PR #40). `computeHealth`: missing-description / missing-preview / orphaned-token; `InventoryModel.health`; artifact gains optional `previews`+`usedTokens` (absent⇒skip, `[]`⇒flag-all). `unhealthy-ds` fixture. 20 tests.
- [x] **#6 service bootstrap** — MERGED (lighter PR #41). `@lighter/api`: Hono `createApp({db})` factory over `@lighter/db`; `GET /health` (200 ok / 503 degraded on DB failure); `app.onError` 500 seam; API-level harness via `app.request()`. 24 tests. NOTE for later: raw `err.message` is echoed in responses — redact/log-vs-expose when hardening errors (#7+).
- [x] **#7 ingestion API endpoint** — MERGED (lighter PR #42). `@lighter/db`: `inventory_snapshots` (migration 0001) + `saveInventory`/`latestInventory` (opaque JSON). `@lighter/api`: `POST /ingest` (201/400/422, traversal-guarded artifactDir) + `GET /inventory` (200/404). 31 tests. repoPath hardening (allowlist under a root) is a standing SECURITY note in app.ts — #35/SSO was dropped, so it's untracked until the ingest surface is exposed.
- [x] **Prerequisite: lighter-example emits `dist/catalog.json`** — MERGED (lighter-example PR #3). `build-catalog.ts` (zod-to-json-schema) emits components{description,slots,props JSON Schema} + previews + usedTokens; unified `build-artifacts.ts`; asserts the emitted artifact parses under a replica of `@lighter/ingestion`'s CatalogArtifact. Also added `./ui` browser-safe package entry + `.` barrel. **Verified live**: API ingest of the real example → 5 components, 40 tokens, 0 health findings.
- [x] **#8–12 inventory dashboard** — MERGED (lighter PRs #43–47; Next.js App Router at `services/web` = `@lighter/web`, React 18.3). Each slice TDD'd → fresh code-review subagent → fixes → `pnpm test typecheck lint format` green → `next build` clean. **89 web/total tests.** End-to-end verified: prod web on :4000 against live API on :3000 renders live components + `<SpecView>` previews (SSR), token values, and "All healthy".
  - #8 gallery (live preview via `lighter-example/ui` `<SpecView>`; data from `/inventory`); #9 props table from props JSON Schema; #10 visual token inventory (`/tokens`); #11 health panel + per-component badges (`/health`); #12 usage/blast-radius (`/usage`).
  - Integration invariants recorded in memory `lighter-web-scaffold` (transpilePackages json-render, inline token CSS, force-dynamic, port 4000, root vitest.config).
  - **#12 seam**: `lib/specs.ts` `loadSpecs()` returns `[]` (no spec persistence yet) → usage view shows a "no saved specs yet" notice. Wire the real source here when #15 lands — no view change.
- [ ] #13–16 spec model+versioning — NEXT. #15 unblocks #12's live specs (`loadSpecs`).
- [ ] #17–20 generation · #21–30 review surface
- [ ] #31–33 handoff bundle · #34, #36, #37 auth & freshness
- ~~#35 internal SSO~~ — **DROPPED & CLOSED** (user, 2026-07-17): no SSO support needed. The GitHub
  issue when auth is restored. The repoPath-hardening concern that rode along with #35 is preserved
  as a standalone SECURITY note in `services/api/src/app.ts` (branch `chore/drop-sso-35`) — it needs
  its own ticket only if the ingest surface is ever exposed to untrusted callers.

## Monitoring (mobile)

GitHub Mobile → Lighter Backlog board + PRs. For hands-off runs, user should set permission mode to
"bypass permissions" (Shift+Tab). Optional: session mirroring to claude.ai (not enabled).
