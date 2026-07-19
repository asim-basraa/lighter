# Lighter — QA Pack

This directory is the **QA hand-off pack** for Lighter. It is self-contained: a tester who has
never seen the product should be able to read it top-to-bottom, stand up an environment, and run a
full feature-by-feature test pass without asking an engineer.

## What's in the pack

| Doc | Read it to… |
| --- | --- |
| **[PRODUCT_GUIDE.md](./PRODUCT_GUIDE.md)** | Understand what Lighter is, who uses it, the architecture, the two deployment modes, and the glossary. **Start here.** |
| **[USE_CASES.md](./USE_CASES.md)** | Walk the end-to-end user journeys (the "happy paths") that the features compose into. Good for exploratory/acceptance testing. |
| **[FEATURE_BRIEFS.md](./FEATURE_BRIEFS.md)** | Get a one-page brief per feature: what it does, how it behaves, its boundaries, and its acceptance criteria. The index of *what* to test. |
| **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)** | Stand up a test environment (API + web + design system), seed a project token, and get the smoke test green. |
| **[TEST_PLAN.md](./TEST_PLAN.md)** | Execute. Numbered, traceable test cases per feature with pre-conditions, steps, expected results, and edge cases. The index of *how* to test. |

## How the docs relate

```
PRODUCT_GUIDE ─ what the product is and how it's put together
     │
USE_CASES ───── the journeys a real user takes (acceptance-level)
     │
FEATURE_BRIEFS ─ each journey broken into features (one brief each)   ◄── traceability ──►   TEST_PLAN
     │                                                                                          (TC-* cases)
ENVIRONMENT_SETUP ─ how to run all of the above
```

Every feature brief in `FEATURE_BRIEFS.md` has a matching test-case block in `TEST_PLAN.md`, and both
carry the same **feature ID** (e.g. `F-INGEST`, `F-GEN`, `F-APPROVE`) so you can trace a requirement →
a test → a result.

## Test-case ID scheme

- Feature IDs: `F-<AREA>` (e.g. `F-SHARE`).
- Test-case IDs: `TC-<AREA>-<NN>` (e.g. `TC-SHARE-03`).
- Each test case is tagged **[P1]/[P2]/[P3]** for priority and **[api]/[web]/[cli]** for the surface it
  exercises.

## Ground truth & scope notes (read before testing)

These are facts about the build that will otherwise surprise a tester:

1. **The running server is multi-tenant (scoped) mode.** `services/api/src/server.ts` always starts with
   project-scoped storage and **bearer-token auth**. Most write endpoints require
   `Authorization: Bearer <project-token>`. The token also encodes the project, so data is isolated per
   project. (`docs/API.md` documents an older *single-tenant/global* mode that has no auth — that mode
   still exists in the code via `createApp({ specStore })` and is what much of the test suite drives, but
   it is **not** what `pnpm start` runs.) See PRODUCT_GUIDE §"Deployment modes".
2. **The web UI is a thin surface.** `services/web` implements only the **four dashboard pages**
   (Components, Tokens, Health, Usage) and the **public review surface** (`/share/<token>`). Generation,
   screen editing, approvals, sign-off, and export **have no web UI** — they are API-only and must be
   tested with `curl`/the CLI/an HTTP client.
3. **Generation costs money and needs a key.** `POST /generate*` and refine only work when
   `ANTHROPIC_API_KEY` is funded. Without it those routes return `501`. QA can exercise the *rest* of the
   pipeline with hand-written specs (no key needed).
4. **Postgres is not wired.** `DB_DIALECT=postgres` throws at startup. Test on SQLite.
5. This pack describes the `cloud-platform` branch as of the ingest/CLI/scoped-auth work. If the branch
   moves, re-verify endpoint paths against `services/api/src/*.ts`.
