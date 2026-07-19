# Lighter — Test Plan (feature by feature)

Executable, traceable test cases. Each block maps to a feature in `FEATURE_BRIEFS.md`. Run against a
scoped-mode server (`ENVIRONMENT_SETUP.md`) with `$API` and `$TOK` exported, unless a case says otherwise.

**Conventions**
- IDs: `TC-<AREA>-<NN>`. Priority `[P1]` (must pass / release-blocking) · `[P2]` (important) · `[P3]` (edge/nice).
- Surface tag: `[api]` `[web]` `[cli]`.
- "Expected" is the pass condition. Anything else is a defect unless the PRODUCT_GUIDE marks it by-design.
- `AUTH` in a step = send `-H "authorization: Bearer $TOK"`.

**Result-logging template** (copy per run):

| TC ID | Run date | Env/build | Result (Pass/Fail/Blocked) | Notes / defect link |
| --- | --- | --- | --- | --- |

---

## 0. Smoke suite (run first — gates everything else)

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-SMOKE-01 | P1 | api | `GET $API/health` | `200 {status:'ok', db:'ok', healthChecks:<n>}` |
| TC-SMOKE-02 | P1 | api | `GET $API/projects/me` AUTH | `200 {id, name}` |
| TC-SMOKE-03 | P1 | api | `GET $API/projects/me` **without** auth | `401 {message:'missing bearer token'}` |
| TC-SMOKE-04 | P1 | api | Push a design system (`POST /inventory` AUTH, §F-INGEST), then `GET $API/projects/inventory` AUTH | `200` model with the expected component/token counts |
| TC-SMOKE-05 | P1 | api | `POST $API/screens` AUTH `{name:"Smoke"}` | `201 {id:"smoke", name:"Smoke"}` |
| TC-SMOKE-06 | P1 | web | Start web, open `http://localhost:4000/` | Dashboard renders (Components page; empty or populated, no crash) |

If any P1 smoke case fails, stop and report — the environment isn't ready.

---

## F-INGEST — Design-system ingestion

**Pre-conditions:** `../lighter-example` built (`dist/catalog.json` + `dist/tokens.json` exist).

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-INGEST-01 | P1 | api | `POST $API/inventory` AUTH with `{catalog:<catalog.json>, tokens:<tokens.json>}` | `201 {status:'ok', model}`; model component & token counts match the artifacts; components/tokens sorted by name |
| TC-INGEST-02 | P1 | api | `GET $API/projects/inventory` AUTH after TC-INGEST-01 | `200` returns the same model |
| TC-INGEST-03 | P1 | api | `POST $API/inventory` AUTH with body `"not-an-object"` | `400` |
| TC-INGEST-04 | P1 | api | `POST $API/inventory` AUTH with a catalog missing required fields | `400` with `issues` (Zod detail) |
| TC-INGEST-05 | P1 | api | `POST $API/inventory` **without** auth | `401` |
| TC-INGEST-06 | P2 | api | `GET $API/projects/inventory` AUTH on a **fresh** project (nothing pushed) | `404 'no inventory pushed yet'` |
| TC-INGEST-07 | P2 | api | Token category check: push tokens named `color.blue.500`, `spacing.4`, `nodot` | model tokens have `category` = `color`, `spacing`, and `nodot` (whole name when no dot) |
| TC-INGEST-08 | P3 | api | Push twice; second push with a changed catalog | latest inventory reflects the second push (snapshot replaced) |
| **On-disk / global path (needs a global-mode API or the `lighter-ingest` bin):** |
| TC-INGEST-09 | P2 | cli | `pnpm --filter @lighter/ingestion ingest ../../../lighter-example --artifact-dir dist` (bin `lighter-ingest`) | Pretty-printed inventory JSON; exit 0 |
| TC-INGEST-10 | P2 | cli | `lighter-ingest` with no path | `UsageError`; exit 1 |
| TC-INGEST-11 | P2 | api | (global mode) `POST /ingest {repoPath:"/nonexistent"}` | `422` (generic message; detail server-logged) |
| TC-INGEST-12 | P1 | api | (global mode) `POST /ingest {repoPath:<valid>, artifactDir:"../dist"}` | `400` (traversal guard on `..`/separator) |
| TC-INGEST-13 | P2 | api | (global mode) `POST /ingest {}` (no repoPath) | `400` |

---

## F-INGEST-SB — Storybook / cva ingestion (library)

Exercise via unit tests / a small harness that calls the exports (no bin). See
`packages/ingest-storybook/src/*.test.ts` for reference fixtures.

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-SB-01 | P2 | api | `buildCatalogFromStories([...CSF modules])` | `{components, previews}` both sorted by name |
| TC-SB-02 | P2 | api | A module with only a `default` export (no stories) | component present but **not** in `previews` |
| TC-SB-03 | P2 | api | An argType with non-empty `options[]` | schema is `{enum:[...]}` |
| TC-SB-04 | P2 | api | An argType with an **unknown** control | schema is permissive `{}` (ingestion not blocked) |
| TC-SB-05 | P2 | api | A module with no `default` meta | `storyModuleToCatalogEntry` throws |
| TC-SB-06 | P3 | api | `buildCatalogFromCva` where a variant's keys are exactly `"true"/"false"` | that prop becomes boolean (not an enum) |
| TC-SB-07 | P3 | api | cva variant with other keys | prop becomes a `select` enum of the keys |
| TC-SB-08 | P3 | api | Push a resulting catalog (with an empty description) to `POST /inventory`, check health | yields a `missing-description` finding (see F-HEALTH) |

---

## F-DTCG — DTCG token resolution

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-DTCG-01 | P2 | api/cli | `dtcgToTokens(doc)` with nested groups | token names are dotted paths (`color.blue.500`); `$`-keys skipped |
| TC-DTCG-02 | P2 | api/cli | A `$value` of exactly `"{color.blue.500}"` | resolved to the referenced value |
| TC-DTCG-03 | P2 | api/cli | Multi-hop alias (`a → b → literal`) | fully resolved |
| TC-DTCG-04 | P2 | api/cli | Two docs defining the same token | **later doc wins** |
| TC-DTCG-05 | P1 | api/cli | Circular alias `a → b → a` | throws `"circular token alias: …"` |
| TC-DTCG-06 | P1 | api/cli | Alias to a non-existent token | throws `"… references unknown token …"` |
| TC-DTCG-07 | P2 | api/cli | `$value` = `"1px solid {color.border}"` (partial) | returned **literally**, not resolved |
| TC-DTCG-08 | P3 | api/cli | Numeric / array / composite `$value` | stringified (`String` / `JSON.stringify`) |
| TC-DTCG-09 | P2 | cli | `lighter sync --tokens-dtcg <circular>.json` | CLI surfaces the throw as an error; exit 1 |

---

## F-DASH — Inventory dashboard (Components / Tokens)

**Pre-conditions:** the **global** inventory is populated (see ENVIRONMENT_SETUP §5 note). `[web]`.

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-DASH-01 | P1 | web | Open `/` | Grid of component cards: name, health badge, description, live preview, props table |
| TC-DASH-02 | P1 | web | Inspect a card's props table | Columns Prop/Type/Required/Default; `—` where no default; "No props." when none |
| TC-DASH-03 | P2 | web | Find a component with no preview spec | Card shows "No preview available" (not blank) |
| TC-DASH-04 | P1 | web | Open `/tokens` | Tokens grouped (Color/Type scale/Spacing/Radii/Shadows); each has a swatch `data-testid="swatch-<name>"` |
| TC-DASH-05 | P2 | web | Empty inventory | `/` shows "No components ingested yet"; `/tokens` shows "No tokens ingested yet" |
| TC-DASH-06 | P1 | web | With the API **unreachable** (stop it) reload `/` | Red "Could not reach the inventory API: …" message, not a crash |
| TC-DASH-07 | P3 | web | Confirm previews render via direct React (no `<iframe>` in DOM) | No iframe element; component renders inline |

---

## F-HEALTH — Catalog health findings

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-HEALTH-01 | P1 | api | Push a fully-healthy design system; inspect `model.health` | `[]` (no findings) |
| TC-HEALTH-02 | P1 | web | Open `/health` when healthy | Green "✓ All healthy" banner (`role="status"`) |
| TC-HEALTH-03 | P1 | api | Push a component with `description:""` | one `missing-description` finding for it |
| TC-HEALTH-04 | P2 | api | Push a component with a **3-char** description | still flagged `missing-description` (threshold is ≤3) |
| TC-HEALTH-05 | P1 | api | Push with `previews` provided, one component absent from it | one `missing-preview` finding |
| TC-HEALTH-06 | P1 | api | Push **without** a `previews` array | **no** `missing-preview` findings (check disabled) |
| TC-HEALTH-07 | P1 | api | Push with `usedTokens`, a token absent from it | one `orphaned-token` finding |
| TC-HEALTH-08 | P2 | api | Push **without** `usedTokens` | **no** `orphaned-token` findings |
| TC-HEALTH-09 | P2 | web | Open `/health` with findings | Red summary with correct count + per-kind breakdown; findings grouped by target |
| TC-HEALTH-10 | P3 | api | Findings ordering | sorted by (kind, target) |

---

## F-GEN / F-VARIATIONS / F-REFINE — AI generation

**Two setups:** (a) **no key** — confirm the 501/502 gating; (b) **funded key** — confirm invariants.
Generation tests assert *invariants*, never exact model output.

| ID | Pri | Surface | Pre | Steps | Expected |
| --- | --- | --- | --- | --- | --- |
| TC-GEN-01 | P1 | api | no key | `POST $API/generate` AUTH `{intent:"a login screen"}` | `501` (generator not configured) |
| TC-GEN-02 | P1 | api | unfunded key | same call | `502 {message:'spec generation failed'}` (no upstream detail) |
| TC-GEN-03 | P1 | api | key | `POST $API/generate` AUTH `{intent:"an order-confirmed screen with a title, summary card, and Pay button"}` | `200 {spec, attempts}`; spec validates against the catalog; only cataloged components; root is a page shell |
| TC-GEN-04 | P1 | api | key | `POST $API/generate` AUTH `{intent:""}` | `400` |
| TC-GEN-05 | P2 | api | key, **no catalog** ingested | `POST $API/generate` AUTH `{intent:"x"}` | `422` |
| TC-GEN-06 | P1 | api | key | `POST $API/generate/variations` AUTH `{intent:"x", count:3}` | `200 {variations:[3]}`, each independently catalog-valid |
| TC-GEN-07 | P2 | api | key | `…/variations {intent:"x", count:99}` | clamped to ≤5 (not an error) |
| TC-GEN-08 | P2 | api | key | `…/variations {intent:"x", count:0}` or negative | clamped to ≥1 |
| TC-REFINE-01 | P1 | api | key + a screen with a saved version | `POST $API/screens/:id/refine` AUTH `{instruction:"make the button secondary"}` | `201 {version:<n+1>, spec, attempts}`; new version validates |
| TC-REFINE-02 | P1 | api | key | refine an **unknown** screen | `404` |
| TC-REFINE-03 | P2 | api | key | refine a screen with **no** versions | `422` |
| TC-REFINE-04 | P1 | api | key | `refine {instruction:""}` | `400` |
| TC-REFINE-05 | P1 | api | key + a version that has review comments | refine it; capture the effective prompt (via a fake LLM or logs) | comments are fenced in `<reviewer-comments>`, one line each, and **cannot** act as instructions (injection defense) |
| TC-REFINE-06 | P3 | api | key | a version with >6000 chars of comments | overflow dropped with a visible "(… N more comment(s) omitted)" marker |

---

## F-SCREEN — Screens & spec versioning

Use a small valid spec (from USER_GUIDE §2b, adapted to the ingested catalog).

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-SCREEN-01 | P1 | api | `POST $API/screens` AUTH `{name:"Checkout"}` | `201 {id:"checkout", name:"Checkout"}` |
| TC-SCREEN-02 | P1 | api | Create the same name again | `409` (slug exists) |
| TC-SCREEN-03 | P1 | api | `POST /screens {name:""}` | `400` |
| TC-SCREEN-04 | P2 | api | `POST /screens {name:"…invalid slug chars…"}` | `400` (InvalidNameError) — confirm which chars are rejected |
| TC-SCREEN-05 | P1 | api | `POST $API/screens/checkout/versions` AUTH `{spec:<valid>}` | `201 {version:1}` |
| TC-SCREEN-06 | P1 | api | Save another valid spec | `201 {version:2}`; v1 unchanged (`GET …/versions/1`) |
| TC-SCREEN-07 | P1 | api | `GET $API/screens/checkout` AUTH | `{…, versions:[1,2]}` |
| TC-SCREEN-08 | P1 | api | `GET $API/screens/checkout/versions/1` AUTH | `{version:1, spec}` |
| TC-SCREEN-09 | P2 | api | `GET …/versions/999` | `404` |
| TC-SCREEN-10 | P2 | api | `GET …/versions/abc` | `400` (not a positive integer) |
| TC-SCREEN-11 | P1 | api | `POST $API/screens/checkout/duplicate` AUTH `{name:"Checkout copy"}` | `201`; new screen's v1 == checkout's latest spec |
| TC-SCREEN-12 | P2 | api | Duplicate a screen that has **no** versions | `422` (ScreenEmptyError) |
| TC-SCREEN-13 | P2 | api | `POST …/versions {}` (no spec) | `400` |
| TC-SCREEN-14 | P2 | cli | `lighter screen create Checkout2 --shell` | creates screen + v1 `PageShell` scaffold; prints "…with a shell page (v1)" |

---

## F-VALIDATE — Catalog validation guardrail

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-VAL-01 | P1 | api | Save a spec referencing a component **not** in the catalog | `400 'spec does not match the catalog'` with `issues` incl. `unknown-component` |
| TC-VAL-02 | P1 | api | Save a spec with a valid component but a **bad prop** (wrong type / missing required) | `400` with `invalid-props` issue, path like `props/foo` |
| TC-VAL-03 | P1 | api | Save structurally-broken JSON (e.g. `children` not an array, `type` empty) | `400 'spec is not structurally valid'` with Zod `issues` |
| TC-VAL-04 | P1 | api | Save a version when **no catalog** ingested (fresh project) | `422` |
| TC-VAL-05 | P2 | api | Save a spec whose node `type` is `"constructor"` or `"__proto__"` | treated as **unknown-component** (`Object.hasOwn`), rejected `400` — not a crash |
| TC-VAL-06 | P3 | api | Ingest a catalog whose own props schema is malformed, then save a spec using it | `catalog-schema-invalid` surfaced as a structured issue, **not** a 500 |
| TC-VAL-07 | P2 | api | A spec node omitting `children` on a leaf | accepted (children defaults to `[]`) |

---

## F-INTENT — Screen intent document

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-INTENT-01 | P1 | api | `PUT $API/screens/checkout/intent` AUTH `{intent:"# Checkout\n…"}` | `200 {intent}` |
| TC-INTENT-02 | P1 | api | `GET $API/screens/checkout/intent` AUTH | `200 {intent:"# Checkout\n…"}` |
| TC-INTENT-03 | P2 | api | `GET …/intent` on a screen that never set one | `200 {intent:null}` |
| TC-INTENT-04 | P2 | api | `PUT …/intent {intent:123}` (non-string) | `400` |
| TC-INTENT-05 | P3 | api | `PUT …/intent {intent:""}` | `200` (empty string allowed) |
| TC-INTENT-06 | P2 | api | `PUT …/intent` on unknown screen | `404` |

---

## F-SHARE — Deploy & tokenized review link

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-SHARE-01 | P1 | api | `POST $API/screens/checkout/versions/1/share` AUTH `{}` | `201 {token, expiresAt:null}` |
| TC-SHARE-02 | P1 | api | Deploy the **same** version again | returns the **same token** (idempotent, unique index) |
| TC-SHARE-03 | P1 | api | `GET $API/share/<token>` (no auth) | `200 {screen, version, spec, deployedAt, flow}` |
| TC-SHARE-04 | P1 | api | `GET $API/share/deadbeef` (unknown) | `404 'share not found'` |
| TC-SHARE-05 | P1 | api | Deploy `{expiresInSeconds:1}`, wait 2s, `GET /share/<token>` | `404 'share not found'` (expired fails closed) |
| TC-SHARE-06 | P2 | api | Deploy `{expiresInSeconds:604800}` then GET | `200`; `expiresAt` ~7 days out |
| TC-SHARE-07 | P2 | api | Re-deploy with a **new** expiry | same token, updated `expiresAt` |
| TC-SHARE-08 | P2 | api | Deploy version `999` (missing) | `404` (never mint for a missing version) |
| TC-SHARE-09 | P2 | api | Deploy `{expiresInSeconds:"soon"}` (non-number) | `400` |
| TC-SHARE-10 | P2 | api | Deploy `{expiresInSeconds:-5}` or absurd value | `400` (out of range / NaN date) |
| TC-SHARE-11 | P1 | api | Check `GET …/versions/1/status` before & after first deploy | `draft` → `shared` |
| TC-SHARE-12 | P2 | api | Deploy a version already `approved`, re-check status | stays `approved` (deploy only advances from draft) |
| TC-SHARE-13 | P2 | cli | `lighter deploy checkout --version 1 --expires 3600` | prints `<url>/share/<token>`; note URL is built client-side from `--url` |

---

## F-REVIEW — Public review surface

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-REVIEW-01 | P1 | web | Open `/share/<valid-token>` | Mock renders live via the design system; **Prototype** version banner shows `screen · v{n} · {date}` |
| TC-REVIEW-02 | P1 | web | Open `/share/<unknown-token>` | "This shared mock was not found. The link may be invalid." |
| TC-REVIEW-03 | P2 | web | Open `/share/<expired-token>` | not-found message (same fail-closed behavior) |
| TC-REVIEW-04 | P2 | web | Confirm the review page has **no** internal nav (Components/Tokens/…) | Bare layout, no dashboard nav |
| TC-REVIEW-05 | P3 | web | With API down, open a share link | Generic "Something went wrong loading this shared mock." (no stack trace) |

---

## F-COMMENT — Element-anchored comments & threads

Get element ids first: `GET $API/share/<token>` and read the spec (or use the web element `<select>`).

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-COMMENT-01 | P1 | api | `POST $API/share/<token>/comments {elementId:"el-1", body:"make it secondary", author:"Dana"}` | `201 <comment>` with `parentId:null` |
| TC-COMMENT-02 | P1 | api | `GET $API/share/<token>/comments` | flat list incl. the new comment |
| TC-COMMENT-03 | P1 | api | Reply: `POST …/comments {parentId:<id from 01>, body:"agreed"}` | `201`; reply inherits parent's element anchor |
| TC-COMMENT-04 | P1 | api | Reply to the **reply** (`parentId` = reply's id) | `400 'can only reply to a top-level comment'` |
| TC-COMMENT-05 | P1 | api | Top-level comment with **no** elementId | `400` (elementId required) |
| TC-COMMENT-06 | P1 | api | Comment with `elementId:"el-999"` (not in spec) | `422 'element "el-999" is not in this version'` |
| TC-COMMENT-07 | P1 | api | Comment with empty body | `400` |
| TC-COMMENT-08 | P2 | api | Body > 4000 chars | `400` |
| TC-COMMENT-09 | P2 | api | Author > 120 chars | `400` |
| TC-COMMENT-10 | P2 | api | `parentId` referencing a comment on a **different** version's token | `404 'parent comment not found'` |
| TC-COMMENT-11 | P2 | api | `parentId:"abc"` (non-integer) | `400` |
| TC-COMMENT-12 | P1 | api | Any comment to an unknown/expired token | `404 'share not found'` |
| TC-COMMENT-13 | P1 | web | On `/share/<token>`, pick an element, type a comment, Post | Comment appears in the thread without reload; anchor shows `el-N · Type` |
| TC-COMMENT-14 | P1 | web | Reply via the panel | Element select hidden, "Replying to …" + Cancel; reply nests under the root |
| TC-COMMENT-15 | P2 | web | Submit with empty body | Submit disabled / no-op |
| TC-COMMENT-16 | P2 | web | Post to a stale anchor (element removed in a newer version — reproduce via a 422) | Red alert "That element is no longer part of this version." |
| TC-COMMENT-17 | P2 | web | With comments endpoint failing on load | "Couldn't load existing comments. You can still leave a new one below." |

---

## F-AGGREGATE — Comment aggregation (PM view)

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-AGG-01 | P1 | api | Add comments across two versions/elements, then `GET $API/screens/checkout/comments` AUTH | `{screen, versions:[…]}` grouped by version → element → threads |
| TC-AGG-02 | P2 | api | `GET …/comments` on unknown screen | `404` |

---

## F-APPROVE — Approval state machine

Start each row from a known state (check with `GET …/status`).

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-APPROVE-01 | P1 | api | `GET …/versions/1/status` on a never-deployed version | `draft` |
| TC-APPROVE-02 | P1 | api | From `draft`: `POST …/approve` | `409` (must be shared/changes-requested first) |
| TC-APPROVE-03 | P1 | api | From `draft`: `POST …/request-changes` | `409` (illegal from draft) |
| TC-APPROVE-04 | P1 | api | Deploy (→ shared), then `POST …/request-changes` | `200 {state:'changes-requested'}` |
| TC-APPROVE-05 | P1 | api | From `shared` (no sign-off set): `POST …/approve` | `200 {state:'approved'}` |
| TC-APPROVE-06 | P1 | api | From `changes-requested`: `POST …/approve` | `200 approved` |
| TC-APPROVE-07 | P2 | api | `POST …/approve` again (already approved) | `200` idempotent; **no** duplicate approval notification |
| TC-APPROVE-08 | P2 | api | `POST …/request-changes` twice | second is idempotent `200` |
| TC-APPROVE-09 | P2 | api | From `approved`: `POST …/request-changes` | `409` (terminal) |
| TC-APPROVE-10 | P2 | api | `GET/POST` with bad version param | `400`; missing version `404` |

---

## F-SIGNOFF — Sign-off enforcement

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-SIGNOFF-01 | P1 | api | `PUT $API/screens/checkout/sign-off-set` AUTH `{parties:[{party:"acme",role:"customer"},{party:"lead",role:"internal"}]}` | `200 {parties:[…]}` |
| TC-SIGNOFF-02 | P1 | api | Set with only a customer (no internal) | `400` (needs ≥1 customer + ≥1 internal) |
| TC-SIGNOFF-03 | P2 | api | Set with a duplicate party id | `400` |
| TC-SIGNOFF-04 | P2 | api | Set with role `"manager"` | `400` (role must be customer/internal) |
| TC-SIGNOFF-05 | P2 | api | `parties` not an array | `400` |
| TC-SIGNOFF-06 | P1 | api | With a set configured, deploy → `POST …/approve` before any sign-off | `409 {message:'sign-off incomplete', missing:["acme","lead"]}` |
| TC-SIGNOFF-07 | P1 | api | `POST …/versions/1/sign-offs {party:"acme"}` | `200 {signed:["acme"], missing:["lead"], complete:false}` |
| TC-SIGNOFF-08 | P1 | api | Sign the last party, then `POST …/approve` | `200 approved` |
| TC-SIGNOFF-09 | P2 | api | `POST …/sign-offs {party:"stranger"}` (not in set) | `400` |
| TC-SIGNOFF-10 | P2 | api | `POST …/sign-offs` on a screen with **no** set | `400 'no sign-off set configured'` |
| TC-SIGNOFF-11 | P2 | api | `GET $API/screens/checkout/sign-off-set` AUTH | `200 {parties:[…]}` (or `404` unknown screen) |

---

## F-EXPORT — Hand-off bundle

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-EXPORT-01 | P1 | api | `GET $API/screens/checkout/versions/1/export` AUTH on a **non-approved** version | `403 {message:'only an approved version can be exported', state}` |
| TC-EXPORT-02 | P1 | api | Approve the version (F-SIGNOFF/F-APPROVE), then export | `200 {screen, version, spec, catalogPrompt, tokens, intent, reactExport}` (all 7 fields) |
| TC-EXPORT-03 | P1 | api | Inspect `reactExport` | a standalone `.tsx` embedding the spec; renders via the design system when dropped into a DS-equipped project |
| TC-EXPORT-04 | P2 | api | Export a missing version | `404` |
| TC-EXPORT-05 | P2 | api | Export with **no catalog** ingested | `422 'no design-system catalog ingested'` |
| TC-EXPORT-06 | P3 | api | Approve+export a spec with a prop named `visible`/`on`/`repeat`/`watch` | `422 'spec cannot be exported to React: …'` |
| TC-EXPORT-07 | P3 | api | Export bundle's `intent` field | equals the screen's INTENT.md (or null) |

---

## F-FLOW — Click-through flows

Need two screens, each with a deployed version (e.g. `checkout`, `receipt`).

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-FLOW-01 | P1 | api | `PUT $API/screens/checkout/flow` AUTH `{links:[{label:"View receipt",target:"receipt"}]}` | `200 {links:[…]}` |
| TC-FLOW-02 | P1 | api | `GET $API/share/<checkout-token>` with receipt **deployed** | `flow[0]` has a non-null `token` (receipt's live token) |
| TC-FLOW-03 | P1 | api | Same, with receipt **not** deployed | `flow[0].token === null` |
| TC-FLOW-04 | P1 | web | Open checkout's share page | Flow bar; "View receipt" links to receipt's mock; disabled ("Not deployed yet") when target undeployed |
| TC-FLOW-05 | P2 | api | `PUT …/flow` with `target:"ghost"` (no such screen) | `400 'target screen "ghost" not found'` |
| TC-FLOW-06 | P2 | api | `PUT …/flow` with 21 links | `400` (>20) |
| TC-FLOW-07 | P2 | api | `PUT …/flow` with empty label or empty target | `400` |

---

## F-STALE — Stale-spec detection

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-STALE-01 | P1 | api | Save a spec using component `X`; `GET $API/specs` AUTH | record has `stale:false`, `staleComponents:[]` |
| TC-STALE-02 | P1 | api | Re-ingest a catalog with `X` **removed/renamed**; `GET /specs` | that spec now `stale:true`, `staleComponents:["X"]` |
| TC-STALE-03 | P2 | api | `GET /specs` with **no catalog** ingested | all records `stale:false` (`known=null`) |
| TC-STALE-04 | P2 | web | `/usage` after TC-STALE-02 | reflects the change (component set / usage pills) |

---

## F-WEBHOOK — Re-ingest webhook

**Pre-conditions:** server started with `DESIGN_SYSTEM_REPO` **and** `WEBHOOK_SECRET`. Compute the sig:
`SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.*= //')"`.

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-WEBHOOK-01 | P1 | api | POST `{"after":"sha-A"}` with a **valid** signature | `201 {status:'ok', commit:"sha-A"}` |
| TC-WEBHOOK-02 | P1 | api | Re-deliver the **same** sha-A (valid sig) | `200 {status:'skipped', reason:'commit already ingested'}` |
| TC-WEBHOOK-03 | P1 | api | POST a new `{"after":"sha-B"}` (valid sig) | `201 {status:'ok', commit:"sha-B"}` |
| TC-WEBHOOK-04 | P1 | api | POST with **no** `X-Hub-Signature-256` | `401 'invalid signature'` |
| TC-WEBHOOK-05 | P1 | api | POST with a signature made from the **wrong** secret | `401` |
| TC-WEBHOOK-06 | P2 | api | POST invalid JSON (valid sig over the raw bytes) | `400 'invalid JSON payload'` |
| TC-WEBHOOK-07 | P2 | api | POST `{}` (no sha) valid sig | `400 'payload missing a commit sha'` |
| TC-WEBHOOK-08 | P2 | api | Point `DESIGN_SYSTEM_REPO` at a broken repo, POST valid | `422 'ingestion failed'` (generic) |
| TC-WEBHOOK-09 | P3 | api | Start with `DESIGN_SYSTEM_REPO` set but **no** `WEBHOOK_SECRET`; POST the webhook | route not mounted (`404`); startup logged a warning |

---

## F-NOTIFY — Notifications

**Pre-conditions:** `NOTIFY_WEBHOOK_URL` points at a logging sink (ENVIRONMENT_SETUP §6).

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-NOTIFY-01 | P1 | api | Post a comment (F-COMMENT) | sink receives `{kind:'comment', screenId, version, elementId, author, body, parentId}` |
| TC-NOTIFY-02 | P2 | api | Post a **reply** | sink also receives a `comment` event (parentId set) |
| TC-NOTIFY-03 | P1 | api | Approve a version (real transition) | sink receives `{kind:'approval', screenId, version}` |
| TC-NOTIFY-04 | P2 | api | Idempotent re-approve | **no** second approval event |
| TC-NOTIFY-05 | P1 | api | Point `NOTIFY_WEBHOOK_URL` at a dead host, post a comment | comment still `201` (delivery best-effort, never blocks) |
| TC-NOTIFY-06 | P2 | api | Unset `NOTIFY_WEBHOOK_URL`, post a comment | `201`; no notification attempted |

---

## F-AUTH — Project scoping / bearer auth

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-AUTH-01 | P1 | api | `GET $API/screens` **without** auth | `401 'missing bearer token'` |
| TC-AUTH-02 | P1 | api | `GET $API/screens` with a bogus token | `401 'invalid token'` |
| TC-AUTH-03 | P1 | api | Create screen "iso" under project A; with project B's token, `GET /screens/iso` | `404`/not visible — data isolated by `<projectId>:<screenId>` |
| TC-AUTH-04 | P2 | api | Push inventory to project A; `GET /projects/inventory` with B's token | B's own (empty/different) inventory, not A's |
| TC-AUTH-05 | P2 | api | `GET /inventory` (unauth global) vs `GET /projects/inventory` (scoped) | they return **different** stores (global typically empty) — no aliasing |
| TC-AUTH-06 | P3 | api | Restart server with a **different** `LIGHTER_TOKEN_SIGNING_SECRET`, reuse the old token | old token now `401` (validates against the secret) |

---

## F-CLI — The `lighter` CLI

Run from `packages/cli` (`pnpm lighter -- <args>`) or the built bin. Use `--url $API --token $TOK`.

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-CLI-01 | P1 | cli | `lighter whoami --url $API --token $TOK` | `<name> (<id>)` |
| TC-CLI-02 | P1 | cli | `lighter inventory --url $API --token $TOK` | `<n> components, <m> tokens` |
| TC-CLI-03 | P1 | cli | `lighter sync --url $API --token $TOK --dir dist` (from a built DS dir) | `synced <n> components, <m> tokens` |
| TC-CLI-04 | P2 | cli | `lighter sync` with no built `dist/` | error telling you to build or pass `--dir` |
| TC-CLI-05 | P1 | cli | `lighter screen create Checkout --url $API --token $TOK` | `created screen checkout` |
| TC-CLI-06 | P2 | cli | `lighter screen create Checkout --shell …` | `created screen checkout with a shell page (v1)` |
| TC-CLI-07 | P1 | cli | `lighter deploy checkout --url $API --token $TOK` | prints `<url>/share/<token>` |
| TC-CLI-08 | P2 | cli | `lighter deploy checkout --version abc` | throws (version must be a positive integer); exit 1 |
| TC-CLI-09 | P2 | cli | `lighter deploy checkout --expires -1` | throws (expires must be positive finite); exit 1 |
| TC-CLI-10 | P2 | cli | `lighter open checkout …` | deploys latest + prints review URL (idempotent) |
| TC-CLI-11 | P1 | cli | any command with **no** `--url` (and none in env/config) | `UsageError`; exit 1 |
| TC-CLI-12 | P1 | cli | `lighter help` (or no args) | prints help; exit 0; no `--url` required |
| TC-CLI-13 | P3 | cli | Arg-parser quirk: `lighter generate "x" --screen --url $API …` | `--screen` is boolean → spec **not** saved as a screen (only printed). Confirms the documented two-parser behavior. |
| TC-CLI-14 | P2 | cli | Any call returning non-2xx (e.g. bad token) | `LighterApiError` "METHOD path → status: body"; exit 1 |
| TC-CLI-15 | P3 | cli | `--url` with a trailing slash | review URL still well-formed (trailing slash stripped) |

---

## F-PERSIST — Persistence & migrations

| ID | Pri | Surface | Steps | Expected |
| --- | --- | --- | --- | --- |
| TC-PERSIST-01 | P1 | api | Start with `DB_DIALECT=postgres` | **startup throws** ("not wired yet") — clean failure, not a silent misbehavior |
| TC-PERSIST-02 | P2 | api | Start with `DB_DIALECT=mysql` (unknown) | throws `Unknown DB_DIALECT` |
| TC-PERSIST-03 | P2 | api | Start with `DATABASE_URL=./nested/dir/lighter.db` (missing dir) | parent dir auto-created; server starts |
| TC-PERSIST-04 | P1 | api | `GET $API/health` after boot | `db:'ok'`; migrations applied (ledger populated) |
| TC-PERSIST-05 | P2 | api | Restart the server (same DB file) | no re-migration errors (ledger makes it a no-op); data persists |
| TC-PERSIST-06 | P2 | api | Simulate DB unreachable, `GET /health` | `503 {status:'degraded', db:'error'}` |

---

## Cross-cutting / non-functional checks

| ID | Pri | Area | Check | Expected |
| --- | --- | --- | --- | --- |
| TC-X-01 | P1 | Error hygiene | Trigger an LLM failure, an ingest failure, a DB error | Responses carry generic messages; **no** upstream/internal detail or stack traces leaked to the client |
| TC-X-02 | P2 | Error shape | Any 4xx | body is `{status:'error', message}` (+ `issues`/`missing`/`state` where relevant) |
| TC-X-03 | P2 | Input bounds | Oversized bodies (comment >4000, flow >20, author >120, feedback >6000) | each is bounded with the documented code/marker |
| TC-X-04 | P2 | Immutability | Save v1, save v2, re-fetch v1 | v1 spec is byte-identical to the original (versions are immutable) |
| TC-X-05 | P3 | Git backing | After several saves, inspect `SPECS_DIR` git log | one commit per mutation; one file per version |
| TC-X-06 | P1 | Regression | `pnpm test && pnpm typecheck && pnpm lint && pnpm --filter @lighter/web build` | all green (the automated gate behind manual QA) |
| TC-X-07 | P3 | Serializer boundary | grep the repo for `@json-render/core` imports | only `packages/spec/src/json-render.ts` imports it (enforced by a test) |

---

## Traceability summary (feature → primary cases)

| Feature | Primary P1 cases |
| --- | --- |
| F-INGEST | TC-INGEST-01/02/05, TC-INGEST-12 |
| F-INGEST-SB | TC-SB-01/05 |
| F-DTCG | TC-DTCG-05/06 |
| F-DASH | TC-DASH-01/02/04/06 |
| F-HEALTH | TC-HEALTH-01/02/03/05/06/07 |
| F-GEN/VAR/REFINE | TC-GEN-01/03/06, TC-REFINE-01/05 |
| F-SCREEN | TC-SCREEN-01/02/05/06/07/11 |
| F-VALIDATE | TC-VAL-01/02/03/04/05 |
| F-INTENT | TC-INTENT-01/02 |
| F-SHARE | TC-SHARE-01/02/03/04/05/11 |
| F-REVIEW | TC-REVIEW-01/02 |
| F-COMMENT | TC-COMMENT-01/03/04/05/06/12/13/14 |
| F-AGGREGATE | TC-AGG-01 |
| F-APPROVE | TC-APPROVE-01..06 |
| F-SIGNOFF | TC-SIGNOFF-01/02/06/07/08 |
| F-EXPORT | TC-EXPORT-01/02/03 |
| F-FLOW | TC-FLOW-01/02/03/04 |
| F-STALE | TC-STALE-01/02 |
| F-WEBHOOK | TC-WEBHOOK-01..05 |
| F-NOTIFY | TC-NOTIFY-01/03/05 |
| F-AUTH | TC-AUTH-01/02/03 |
| F-CLI | TC-CLI-01/02/03/05/07/11/12 |
| F-PERSIST | TC-PERSIST-01/04 |
