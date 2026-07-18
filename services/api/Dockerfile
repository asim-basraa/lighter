# syntax=docker/dockerfile:1
# Lighter API (@lighter/api). Build context = repo ROOT (monorepo). We copy ONLY the api subtree
# (root manifests + packages/* + services/api) and install with `--filter @lighter/api...`, so the
# web/starter workspaces — and their `lighter-example` sibling-repo dep — never enter the build.
# The API runs TypeScript directly via tsx (no compile step); migrations run at boot (server.ts).
FROM node:22-slim AS runtime

# better-sqlite3 compiles from source (python3/make/g++); the git-backed SpecStore needs `git`.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
WORKDIR /app

# Manifests first for layer caching, then just the api-relevant sources.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/api ./services/api

# Install only @lighter/api and its workspace deps (db, ingestion, spec, generation). Lockfile is not
# frozen because the workspace is intentionally partial here (no web/starter/apps in the context).
RUN pnpm install --filter "@lighter/api..." --frozen-lockfile=false

ENV NODE_ENV=production
# The API binds to PORT (Railway-injected; defaults to 3000). DB + specs live on the mounted volume:
#   DB_DIALECT=sqlite  DATABASE_URL=/data/lighter.db  SPECS_DIR=/data/.lighter-specs
EXPOSE 3000
CMD ["pnpm", "--filter", "@lighter/api", "start"]
