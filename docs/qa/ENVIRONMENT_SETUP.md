# Lighter — QA Environment Setup

This gets you from a clean checkout to a running system you can test against, in both **global** (no
auth, simplest) and **scoped** (multi-tenant, what production runs) modes.

> **Apple Silicon gotcha:** `pnpm` runs under Rosetta (x64) here while `node` is native arm64. Always
> validate with **`pnpm test`**, never a bare `npx vitest` — native modules (`better-sqlite3`) are pinned
> to x64 to match pnpm's node. A bare runner picks the wrong arch and fails confusingly.

## 0. Prerequisites

- **Node 22**, **pnpm 10** (the repo pins the pnpm version via `packageManager`).
- The **`lighter-example`** design system must be checked out as a **sibling** repo (it's a `file:`
  dependency and the test fixture):

```bash
# siblings:  ~/work/lighter/lighter   and   ~/work/lighter/lighter-example
git clone <lighter-example-url> ../lighter-example
```

## 1. Install & build

```bash
pnpm install
pnpm --filter lighter-example build          # emits ../lighter-example/dist/{catalog,tokens}.json
pnpm --filter @lighter/design-system build   # emits packages/design-system/dist/{catalog,tokens}.json (24 comps, 388 tokens)
```

## 2. Run the automated suite first (baseline)

Before manual testing, confirm the build is green — this is your regression baseline:

```bash
pnpm test        # vitest across every package + service
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm --filter @lighter/web build   # the web app must pass a PRODUCTION build (dev has an RSC quirk)
```

All must pass. If `pnpm test` is red on a clean checkout, stop and report — manual QA on a red baseline
is not meaningful.

## 3. Run the API

### 3a. Global mode (no auth — easiest for API testing)

There is no CLI flag for this; it's the mode you get by constructing `createApp({ specStore })`. The
shipped `server.ts` does **not** run this mode. For pure API testing without tokens, the fastest path is
the test suite (which drives global mode via `app.request()`), or a tiny harness that calls
`createApp({ specStore, … })`. **Most manual QA should use scoped mode (3b), which is what ships.**

### 3b. Scoped mode (what `pnpm start` runs)

```bash
cd services/api
DB_DIALECT=sqlite \
DATABASE_URL=./lighter.db \
SPECS_DIR=./.lighter-specs \
LIGHTER_TOKEN_SIGNING_SECRET=dev-secret-keep-stable \
LIGHTER_BOOTSTRAP_PROJECT="QA Project" \
ANTHROPIC_API_KEY=sk-…            # OPTIONAL — enables generation; omit to test the rest \
NOTIFY_WEBHOOK_URL=http://localhost:9000/notify   # OPTIONAL — see §6 \
DESIGN_SYSTEM_REPO=../../../lighter-example \
DESIGN_SYSTEM_ARTIFACT_DIR=dist \
WEBHOOK_SECRET=whsec-dev          # OPTIONAL — enables the re-ingest webhook \
pnpm start
```

**Capture the bootstrap token.** With `LIGHTER_BOOTSTRAP_PROJECT` set, the server seeds a project and
**logs its API token once, at boot**. Copy it — you need it as `Authorization: Bearer <token>` for all
scoped writes. Re-running is idempotent (an existing project is not re-minted, so the token is not
re-logged; keep the one you captured, and keep `LIGHTER_TOKEN_SIGNING_SECRET` **stable** or previously
minted tokens stop validating).

Export it for convenience:

```bash
export TOK='<the-bootstrap-token>'
export API=http://localhost:3000
```

### Environment variable reference

| Var | Effect |
| --- | --- |
| `DB_DIALECT` | `sqlite` (default) or `postgres`. **`postgres` throws at startup — not wired.** Use sqlite. |
| `DATABASE_URL` | SQLite file path or `:memory:` (default `:memory:`). A file path's parent dir is auto-created. |
| `SPECS_DIR` | Git-backed spec store root (default `.lighter-specs`). |
| `LIGHTER_TOKEN_SIGNING_SECRET` | HMAC secret for project tokens. Must stay stable or tokens stop validating. |
| `LIGHTER_BOOTSTRAP_PROJECT` | Seeds a project + token on boot; token logged once. Idempotent. |
| `ANTHROPIC_API_KEY` | Enables `POST /generate*` + refine. Absent → those return **501**. Unfunded → **502**. |
| `NOTIFY_WEBHOOK_URL` | Comment/approval events POST here (5s timeout, best-effort). Absent → no-op. |
| `DESIGN_SYSTEM_REPO` + `WEBHOOK_SECRET` | **Both** required to mount `POST /webhooks/design-system`. Repo alone → webhook disabled + warning. |
| `DESIGN_SYSTEM_ARTIFACT_DIR` | Build dir within the design-system repo (e.g. `dist`). |
| `PORT` | API listen port (default 3000). |
| `LIGHTER_API_URL` | (web) where the web app fetches from (default `http://localhost:3000`). |

## 4. Load a design system (scoped mode)

Because scoped mode never touches the client FS, push the built artifacts **inline** — via CLI `sync`
or `POST /inventory`.

### Via the CLI (recommended)

```bash
cd ../lighter-example         # a dir with dist/catalog.json + dist/tokens.json
pnpm --dir <lighter-repo>/packages/cli lighter -- sync \
  --url $API --token $TOK --dir dist
# → "synced 24 components, 388 tokens"  (counts depend on the design system)
```

### Via curl

```bash
curl -s -X POST $API/inventory -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d "{\"catalog\":$(cat ../lighter-example/dist/catalog.json),\"tokens\":$(cat ../lighter-example/dist/tokens.json)}"
# → 201 { status:'ok', model }
```

Confirm:

```bash
curl -s $API/projects/inventory -H "authorization: Bearer $TOK" | head -c 300
```

> Note: `GET /inventory` (unauthed, **global**) is a *different* store from `GET /projects/inventory`
> (scoped). In scoped mode the global one is typically empty — don't confuse them.

## 5. Run the web UI

```bash
cd services/web
LIGHTER_API_URL=$API pnpm build && LIGHTER_API_URL=$API pnpm start   # http://localhost:4000
```

Use a **production build** for the review surface — a `next dev` RSC quirk with the json-render/react
context affects dev only, not the prod build.

> The dashboard pages read the **global/unauthed** `GET /inventory` and `GET /specs`. If you loaded the
> design system into a *project* (scoped) in §4, the dashboard may show "No components ingested yet"
> because it reads the global store. To populate the dashboard, either run the API so its global store is
> seeded, or point QA of the dashboard at a global-mode API. This mismatch is itself worth a QA note
> (see TC-DASH-06).

## 6. Optional: a notification sink

To observe notifications (§ comment/approval events), run any endpoint that logs POST bodies and set
`NOTIFY_WEBHOOK_URL` to it. Quick sink:

```bash
# a throwaway listener on :9000 that prints what it receives
node -e "require('http').createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{console.log('NOTIFY',b);s.end('ok')})}).listen(9000)"
```

## 7. Smoke test (prove the environment works)

Run this after setup. All should succeed in order (scoped mode, generation optional):

```bash
curl -s $API/health                                   # 200 {status:'ok', db:'ok', healthChecks:N}
curl -s $API/projects/me -H "authorization: Bearer $TOK"        # 200 {id, name}
curl -s $API/projects/inventory -H "authorization: Bearer $TOK" # 200 model (after §4)
curl -s -X POST $API/screens -H "authorization: Bearer $TOK" \
     -H 'content-type: application/json' -d '{"name":"Smoke"}'  # 201 {id:"smoke", name:"Smoke"}
```

If all four pass, you're ready to run `TEST_PLAN.md`.

## 8. Reset between runs

- **DB:** delete the SQLite file (`rm services/api/lighter.db`) or use `DATABASE_URL=:memory:` for a fresh
  DB each boot.
- **Specs:** delete the store dir (`rm -rf services/api/.lighter-specs`).
- Re-run §3b to re-bootstrap. (New signing secret ⇒ old tokens invalid, so keep it stable if you want to
  reuse a token.)
