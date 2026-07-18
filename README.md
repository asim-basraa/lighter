# Lighter

Design-in-code prototyping and design-system inventory. Lighter ingests a design-system repo
(tokens, React components, a json-render catalog) and provides an inventory dashboard, an
ideation surface (Claude generates catalog-constrained json-render specs), and a review surface
(deploy to shareable URLs, element-anchored comments, approvals) that produces a coding-agent
handoff bundle.

![Lighter demo](docs/demo/lighter-demo.gif)

## Documentation

- **[Adopting Lighter](docs/ADOPTION.md)** — Lighter as a projection of standards (shadcn, Storybook/CSF, `cva`, DTCG, MSW); the shadcn quick-start with zero Lighter-specific authoring.
- **[Building a New App on Lighter](docs/BUILDING_ON_LIGHTER.md)** — start a product from scratch: the compatibility protocol, the rapid design loop, and how to structure app logic so it never breaks Lighter.
- **[User Guide](docs/USER_GUIDE.md)** — the full pipeline (ingest → author → deploy → review → hand off) with runnable commands.
- **[Developer Guide](docs/DEVELOPMENT.md)** — architecture, setup, the dev loop, conventions, and how to consume Lighter.
- **[API Reference](docs/API.md)** — every HTTP endpoint.
- **[Product spec (PRD)](docs/prd.md)** — the original product spec.

The **entire backlog is shipped** — see [HANDOFF.md](docs/HANDOFF.md) for the build log.

## Repository layout

- `packages/*` — shared libraries (db, ingestion, spec model, catalog) **and `@lighter/design-system`**,
  a comprehensive, DTCG-token-driven React component library that ships the json-render registry and
  the `dist/catalog.json` + `dist/tokens.json` artifacts Lighter ingests
- `services/*` — the backend service (`@lighter/api`) and internal/review web client (`@lighter/web`)
- `apps/*` — **`@lighter/starter`**, a Next.js bootstrap app wired to the design system out of the box;
  the recommended starting point for a consumer (clone, swap DTCG tokens, ship)
- `../lighter-example` — a second example design system, a separate repo that doubles as the test fixture

## Start here (consumers)

Want your own design system + prototyping stack? Start from `apps/starter`:

```bash
pnpm install
pnpm --filter @lighter/design-system build   # emits dist/catalog.json + dist/tokens.json
pnpm --filter @lighter/starter dev            # http://localhost:4100
```

Then edit the DTCG tokens in `packages/design-system/tokens/*.tokens.json` — the whole system
re-themes with no component changes. See [apps/starter/README.md](apps/starter/README.md).

## Persistence

SQLite for v1, accessed exclusively through the Drizzle ORM. The query API is identical for
Postgres — swapping is a driver + config change (`DB_DIALECT`), with no query rewrites.

## Development

```bash
pnpm install
pnpm test
pnpm lint
```

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`.
