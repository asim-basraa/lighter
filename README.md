# Lighter

Design-in-code prototyping and design-system inventory. Lighter ingests a design-system repo
(tokens, React components, a json-render catalog) and provides an inventory dashboard, an
ideation surface (Claude generates catalog-constrained json-render specs), and a review surface
(deploy to shareable URLs, element-anchored comments, approvals) that produces a coding-agent
handoff bundle.

See [docs/prd.md](docs/prd.md) for the full product spec.

## Repository layout

- `packages/*` — shared libraries (db, ingestion, spec model, catalog)
- `services/*` — the backend service and web client
- `../lighter-example` — the example design system, a separate repo that doubles as the test fixture

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
