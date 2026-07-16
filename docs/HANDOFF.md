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

## Progress
- [x] Setup: 42 SDLC skills synced to `.claude/skills/`; triage labels + `area:*` created; 37 issues published to board.
- [x] **#1 Monorepo scaffold + Drizzle DB** — MERGED (PR #38, squash). `@lighter/db` with dialect-agnostic client, `_migrations` ledger, health_checks round-trip. 5 tests green.
- [ ] **#2 lighter-example tokens** — NEXT.
- [ ] #3 components + page shell + catalog
- [ ] #4 catalog ingestion pure fn + CLI (first end-to-end)
- [ ] #5 ingestion health findings
- [ ] #6 service bootstrap · #7 ingestion API endpoint
- [ ] #8–12 inventory dashboard · #13–16 spec model+versioning
- [ ] #17–20 generation · #21–30 review surface
- [ ] #31–33 handoff bundle · #34–37 auth & freshness

## Monitoring (mobile)
GitHub Mobile → Lighter Backlog board + PRs. For hands-off runs, user should set permission mode to
"bypass permissions" (Shift+Tab). Optional: session mirroring to claude.ai (not enabled).
