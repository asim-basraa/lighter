# @lighter/web

The Lighter web client (Next.js App Router) — the single app for the internal inventory dashboard
(#8–12), the ideation UI (#17–20), and the customer review surface (#21–30).

## Data source

The dashboard reads the latest ingested inventory from the Lighter API (`@lighter/api`):

- `LIGHTER_API_URL` — base URL of the running API. Defaults to `http://localhost:3000`.

Component _previews_ are rendered live through `lighter-example`'s `<SpecView>` (imported from the
browser-safe `lighter-example/ui` subpath); the design system must have been built
(`pnpm --filter lighter-example build`) so `dist/tokens.css` exists.

## Running locally

```sh
# 1. start the API (defaults to :3000)
pnpm --filter @lighter/api start
# 2. start the web app (:4000, to avoid colliding with the API on :3000)
pnpm --filter @lighter/web dev
```

The dev/start scripts pin port **4000** so `next dev` doesn't fight the API's default **3000**.
Home (`/`) renders per-request (`force-dynamic`) so it always reflects the latest ingest.
