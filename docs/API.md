# Lighter — API Reference

Base URL defaults to `http://localhost:3000`. All bodies and responses are JSON. Routes are grouped
by surface. A route is only mounted when its dependency is configured (noted per group).

Conventions: `4xx` errors return `{ "status": "error", "message": "…" }` (plus `issues`/`missing`/
`state` where useful). Errors never leak upstream/internal detail.

---

## Health & inventory

| Method | Path         | Notes                                                                                                                                                                                          |
| ------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/health`    | `200 {status:'ok', db:'ok'}`, or `503` if the DB is unreachable.                                                                                                                               |
| `POST` | `/ingest`    | Ingest a design system. Body `{ repoPath, artifactDir? }`. `201 {model}`; `400` bad input; `422` bad repo/artifacts. _Internal — repoPath is a server-read path; keep off untrusted networks._ |
| `GET`  | `/inventory` | The latest ingested `InventoryModel` (components, tokens, health). `404` if nothing ingested.                                                                                                  |

## Generation _(mounted when an LLM client is configured; else `501`)_

| Method | Path                   | Notes                                                                                                                                                                               |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/generate`            | Body `{ intent }`. `200 {spec, attempts}`. Catalog-constrained, validate-or-retry. `422` if it never validates; `502` on an upstream failure (no detail leaked).                    |
| `POST` | `/generate/variations` | Body `{ intent, count? }` (count 1–5, default 3). `200 {variations: [{spec, attempts}]}`.                                                                                           |
| `POST` | `/screens/:id/refine`  | Body `{ instruction }`. Refines the screen's latest version and saves it as the next version. Folds the version's review comments into the prompt. `201 {version, spec, attempts}`. |

## Screens & versions _(mounted when a SpecStore is configured)_

| Method | Path                             | Notes                                                                                                                                                                                                 |
| ------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/screens`                       | Body `{ name }`. `201 {id, name}`; `409` if the slug exists; `400` empty name.                                                                                                                        |
| `GET`  | `/screens`                       | List `[{id, name}]`.                                                                                                                                                                                  |
| `GET`  | `/screens/:id`                   | `{id, name, versions:[…]}`; `404` unknown.                                                                                                                                                            |
| `POST` | `/screens/:id/versions`          | Body `{ spec }`. Validates against the catalog. `201 {version}`; `400` structural/catalog issues (with `issues`); `422` if no catalog ingested.                                                       |
| `GET`  | `/screens/:id/versions/:version` | `{version, spec}`; `404` unknown.                                                                                                                                                                     |
| `POST` | `/screens/:id/duplicate`         | Body `{ name }`. New screen whose v1 copies this screen's latest spec. `201`.                                                                                                                         |
| `GET`  | `/specs`                         | One record per screen's latest version for the blast-radius view: `[{screen, version, components, stale, staleComponents}]`. `stale` = references a component missing from the current catalog (#37). |
| `GET`  | `/screens/:id/intent`            | `{intent: string                                                                                                                                                                                      | null}`; `404` unknown screen. |
| `PUT`  | `/screens/:id/intent`            | Body `{ intent }` (markdown). `200 {intent}`; `400` non-string; `404` unknown.                                                                                                                        |

## Deploy & public review surface

Deploy is internal; the `/share/:token` routes are the **public**, account-free surface.

| Method | Path                                   | Notes                                                                                                                                                                                   |
| ------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/screens/:id/versions/:version/share` | Deploy to a tokenized link. Body `{ expiresInSeconds? }`. `201 {token, expiresAt}`. Advances `draft → shared`. `404` if the version doesn't exist; `400` bad ttl.                       |
| `GET`  | `/share/:token`                        | Public. `{screen, version, spec, deployedAt, flow}`. `404` for an unknown or **expired** token.                                                                                         |
| `POST` | `/share/:token/comments`               | Public. Body `{ elementId, body, author? }` (top-level) **or** `{ parentId, body, author? }` (reply). `201 {comment}`. `422` unknown element; `400` empty/over-length; `404` bad token. |
| `GET`  | `/share/:token/comments`               | Public. Flat list of the version's comments (each carries `parentId`).                                                                                                                  |
| `GET`  | `/screens/:id/comments`                | Internal. Comments across all versions grouped by `version → element → threads (root + replies)` (#27).                                                                                 |

## Approval & sign-off _(SpecStore)_

| Method | Path                                             | Notes                                                                                                                                      |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/screens/:id/versions/:version/status`          | `{version, state}` (`draft`/`shared`/`changes-requested`/`approved`). `404` unknown version.                                               |
| `POST` | `/screens/:id/versions/:version/request-changes` | `shared → changes-requested`. `409` on an illegal transition.                                                                              |
| `POST` | `/screens/:id/versions/:version/approve`         | `shared`/`changes-requested → approved`. **Gated** by the sign-off set (`409 {missing}` until complete). Idempotent when already approved. |
| `GET`  | `/screens/:id/sign-off-set`                      | The configured required parties `{parties:[{party, role}]}`.                                                                               |
| `PUT`  | `/screens/:id/sign-off-set`                      | Body `{ parties:[{party, role}] }`. Requires ≥1 `customer` + ≥1 `internal`. `400` otherwise. Atomic replace.                               |
| `POST` | `/screens/:id/versions/:version/sign-offs`       | Body `{ party }` (must be in the set). `200 {signed, missing, complete}`. `400` if unknown party / no set configured.                      |

## Flow (click-through) _(SpecStore)_

| Method | Path                | Notes                                                                                                                                                                   |
| ------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/screens/:id/flow` | `{links:[{label, target}]}`.                                                                                                                                            |
| `PUT`  | `/screens/:id/flow` | Body `{ links:[{label, target}] }` (≤20; each `target` must be an existing screen). Resolved into each deployed mock's `flow` (with the target's live token or `null`). |

## Hand-off _(SpecStore)_

| Method | Path                                    | Notes                                                                                                                                                                                      |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/screens/:id/versions/:version/export` | Bundle `{screen, version, spec, catalogPrompt, tokens, intent, reactExport}`. **`403` unless the version is `approved`**; `404` unknown; `422` no catalog / spec can't serialize to React. |

## Design-system re-ingest webhook _(mounted when `DESIGN_SYSTEM_REPO` **and** `WEBHOOK_SECRET` are set)_

| Method | Path                      | Notes                                                                                                                                                                                                                                                                                                                      |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/webhooks/design-system` | Re-ingests the server-configured repo. **Requires** a valid `X-Hub-Signature-256` HMAC (`401` otherwise). Idempotent per commit sha (`after`/`head_commit.id`): a re-delivery → `200 {status:'skipped'}`; a new commit → `201 {status:'ok', commit}`. `400` no sha / bad JSON; `422` bad repo/artifacts (generic message). |

---

## Notifications (side effect, not an endpoint)

When `NOTIFY_WEBHOOK_URL` is configured, the API POSTs a JSON event to it on:

- a **comment** — `{kind:'comment', screenId, version, elementId, author, body, parentId}`
- an **approval** — `{kind:'approval', screenId, version}`

Delivery is best-effort and time-bounded: a failing or slow sink never breaks the comment/approval it
was triggered by.

---

## The approval state machine

```
draft ──deploy──► shared ──request-changes──► changes-requested
                    │                                  │
                 approve ◄───────────────────────── approve
                    │
                    ▼
                approved            (terminal; a fix is a NEW version, not a re-open)
```

`approve` transitions to `approved` only when the configured sign-off set (if any) is complete.
