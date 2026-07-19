# syntax=docker/dockerfile:1
# Lighter studio (@lighter/web, Next.js). Build context = repo ROOT (monorepo). Copies only the web
# subtree (root manifests + packages/* + services/web) and installs with `--filter @lighter/web...`.
# The studio renders specs via the in-repo `lighter-example` workspace package (vendored), so there is
# no sibling-repo dependency to resolve.
FROM node:22-slim AS runtime

# better-sqlite3 (pulled transitively via api/db dev deps) compiles from source; git for completeness.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
WORKDIR /app

# tsconfig.base.json is extended by services/web/tsconfig.json — Next's build reads it, so it must
# be present at the repo root inside the image.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY services/web ./services/web

RUN pnpm install --filter "@lighter/web..." --frozen-lockfile=false

# NEXT_PUBLIC_* must be present at BUILD time — Next inlines them into the client + middleware bundle.
# Railway passes service variables as Docker build args, but only for ARGs the Dockerfile declares;
# promote them to ENV so `next build` sees them. Absent (e.g. local build) → studio runs pre-auth.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN pnpm --filter @lighter/web build

ENV NODE_ENV=production
# Next binds to the Railway-injected PORT (defaults to 8080 here). LIGHTER_API_URL points at the api
# service over Railway private networking.
EXPOSE 8080
CMD ["sh", "-c", "pnpm --filter @lighter/web exec next start -p ${PORT:-8080} -H 0.0.0.0"]
