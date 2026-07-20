# syntax=docker/dockerfile:1
# Aurora storefront (@lighter/shop, Next.js) — the consumer app the studio frames for live preview.
# Build context = repo ROOT (monorepo): copies the root manifests + packages/* + apps/shop and
# installs with `--filter @lighter/shop...`, so services/ never enters the image.
FROM node:22-slim AS runtime

# git for completeness; no native modules are needed here (no better-sqlite3 in this subtree).
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
WORKDIR /app

# tsconfig.base.json is extended by apps/shop/tsconfig.json — next build reads it, so it must exist
# at the repo root inside the image (the studio image needed the same, see services/web/Dockerfile).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps/shop ./apps/shop

RUN pnpm install --filter "@lighter/shop..." --frozen-lockfile=false
RUN pnpm --filter @lighter/shop build

# NOTE: no NEXT_PUBLIC_* build args on purpose. Which studios may drive this app is read per REQUEST
# (apps/shop/lib/studioOrigins.ts) from LIGHTER_STUDIO_ORIGINS, so the image is portable and the app
# can be repointed with an env change + restart instead of a rebuild.
ENV NODE_ENV=production
EXPOSE 8080
CMD ["sh", "-c", "pnpm --filter @lighter/shop exec next start -p ${PORT:-8080} -H 0.0.0.0"]
