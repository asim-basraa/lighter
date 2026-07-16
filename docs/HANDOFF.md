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

## Environment / secrets

- `.env` (gitignored) holds `ANTHROPIC_API_KEY` (needed for slice #17 generation), `DB_DIALECT=sqlite`, `DATABASE_URL`.
  ⚠️ Key was pasted in plaintext in chat — recommend rotating in Anthropic Console.
- Toolchain: Node 22, pnpm 10.

## ⚠️ BLOCKER needing the user (one-time)

The gh token lacks **`workflow`** scope, so `.github/workflows/ci.yml` cannot be pushed.

- CI YAML is stashed at `<scratchpad>/pending-ci/ci.yml` (runs install→lint→typecheck→test).
- Fix: run `gh auth refresh -h github.com -s workflow`, then re-add the file as its own small PR.
- Until then, "CI passes" is validated by running those same commands locally (they pass).

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
- [ ] **#5 ingestion health findings** — NEXT. Extend `@lighter/ingestion`: flag components missing descriptions, missing preview specs, orphaned/unused tokens; test with unhealthy fixtures. Add a 2nd fixture `fixtures/unhealthy-ds/`.
- [ ] #6 service bootstrap · #7 ingestion API endpoint
- [ ] #8–12 inventory dashboard · #13–16 spec model+versioning
- [ ] #17–20 generation · #21–30 review surface
- [ ] #31–33 handoff bundle · #34–37 auth & freshness

## Monitoring (mobile)

GitHub Mobile → Lighter Backlog board + PRs. For hands-off runs, user should set permission mode to
"bypass permissions" (Shift+Tab). Optional: session mirroring to claude.ai (not enabled).
