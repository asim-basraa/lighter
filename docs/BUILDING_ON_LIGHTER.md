# Building a New App on Lighter

A protocol + step-by-step guide for spinning up a brand-new product on Lighter: define a
design system, build pages from it, and get those pages into Lighter's **design-in-code**
loop so you can prototype, gather customer feedback, and hand off to engineering — fast.

This is the "how do I start a project the right way" companion to the
[User Guide](./USER_GUIDE.md) (the pipeline) and the [Developer Guide](./DEVELOPMENT.md)
(the internals).

---

## 0. The one idea to internalize first

**Lighter is not an app framework. It is a pipeline over a _design system_.**

Your product is really two layers, and only one of them ever crosses into Lighter:

| Layer | What it is | Does Lighter see it? |
| --- | --- | --- |
| **Design system** — the *catalog* | Pure, prop-driven presentational components + design tokens. Serializable. No data fetching, no routing, no side effects. | **Yes.** This is the entire contract. |
| **Application** — the *product* | Business logic, data, auth, routing, state, integrations. Composes the catalog components. | **No.** Lighter never runs or renders your app logic. |

Everything that makes Lighter valuable — AI screen generation, live preview, review
links, element-anchored comments, approvals, handoff bundles — operates purely on the
**catalog** plus a **spec** (a serializable tree of catalog components with static props).

> **The golden rule:** *If it can't be expressed as a catalog component with JSON-serializable
> props, it doesn't belong in the layer Lighter sees.* Keep application logic strictly on the
> app side of that line and you can never break Lighter compatibility.

This single split is what gives you rapid iteration: designers/PMs/AI iterate on the
**catalog + specs** at the speed of JSON, while engineers build **app logic** independently
against the same components. Neither side blocks the other.

```
   ┌─────────────────────── YOUR REPO(s) ───────────────────────┐
   │                                                            │
   │  DESIGN SYSTEM (the catalog)          APPLICATION          │
   │  ─────────────────────────────        ───────────          │
   │  • DTCG tokens  ──► CSS vars          • routes / pages     │
   │  • pure components (Zod props)        • data fetching      │
   │  • json-render registry               • auth, state, API   │
   │  • dist/catalog.json                   • composes the      │
   │  • dist/tokens.json  ─────┐             catalog comps      │
   │                           │                                 │
   └───────────────────────────┼─────────────────────────────────┘
                               │  (build artifacts — the ONLY contract)
                               ▼
                        ┌─────────────┐
                        │   LIGHTER   │  ingest → author/generate → deploy
                        │  pipeline   │  → review → approve → handoff
                        └─────────────┘
```

---

## 1. The compatibility contract (the whole protocol, in one place)

A design system is "Lighter-compatible" if — and *only if* — it emits two machine-readable
artifacts into a build directory (`dist/` by default). That is the entire surface. Match it
and everything downstream works; nothing else about your stack matters.

### `dist/catalog.json` — what components exist and how they compose

```jsonc
{
  "components": {
    "Button": {
      "description": "A clickable button in a primary or secondary variant.",
      "slots": [],                         // ["default"] for containers, [] for leaves
      "props": { /* a JSON Schema object */
        "type": "object",
        "properties": {
          "label":   { "type": "string" },
          "variant": { "enum": ["primary", "secondary"] }
        },
        "required": ["label"],
        "additionalProperties": false
      }
    }
    // …one entry per component
  },
  "previews":   ["Button", "Card", …],     // components that ship a preview spec (health)
  "usedTokens": ["color.primary.default", …] // tokens actually referenced (health)
}
```

- `props` **must be a JSON Schema object.** This is the guardrail: Lighter validates every
  generated *and* hand-written spec against it (`ajv`), and feeds it to the AI so the model
  can only ever emit components you actually have. Rich `description`s directly raise
  generation quality — treat them as owned docs, not afterthoughts.
- `slots` declares whether a component accepts children.
- `previews` / `usedTokens` are optional but power the health report (missing preview /
  orphaned token findings).

Reference schema: [`packages/ingestion/src/model.ts`](../packages/ingestion/src/model.ts)
(`CatalogArtifact`).

### `dist/tokens.json` — a flat name → value map

```json
{
  "color.primary.default": "#2563eb",
  "spacing.4": "16px",
  "radius.md": "8px"
}
```

That's it. Ingestion (`ingest(repoPath, { artifactDir })`) reads exactly these two files,
validates them, and produces the normalized `InventoryModel` (components + tokens + health)
that the whole pipeline consumes. See
[`packages/ingestion/src/ingest.ts`](../packages/ingestion/src/ingest.ts).

### The two reference producers

You never have to guess at the format — there are two working producers in the tree:

- **`@lighter/design-system`** (`packages/design-system`) — the first-party, DTCG-driven
  library. `pnpm --filter @lighter/design-system build` → 24 components, 388 tokens, 0
  health findings. **Start here.**
- **`../lighter-example`** — a second, smaller design system in a sibling repo that doubles
  as the test fixture. Good to read end-to-end (it's ~5 components).

---

## 2. The workflow (the rapid loop we designed)

The goal: **low warm-up, fastest possible design iteration, real customer feedback, clean
handoff.** The loop:

```
  ┌── (once) fork apps/starter ──────────────────────────────────────────┐
  │                                                                       │
  ▼                                                                       │
 tokens + components  ──build──►  dist/{catalog,tokens}.json  ──sync──►  Lighter
  (your design system)                                                    │
                                                                          ▼
                                              author screens: AI-generate from intent
                                              OR hand-write, OR edit live (design-in-code)
                                                                          │
                                                            deploy ──► review link (no login)
                                                                          │
                                        customer comments (anchored to elements) ◄────────┐
                                                                          │                │
                                          refine (comments fold into the next AI prompt) ──┘
                                                                          │
                                                     approve (state machine + sign-off)
                                                                          │
                                                     export handoff bundle ──► engineers build
```

What makes each phase fast:

1. **Warm-up is a fork, not a build.** `apps/starter` already wires theme, app shell, nav,
   routing, and a json-render render surface. You fork it and you're running.
2. **Re-theming is a token edit.** Change `tokens/*.tokens.json`, rebuild — the whole system
   re-skins with zero component edits. Brand exploration is minutes, not days.
3. **Screens are JSON, not code.** A screen is a serializable spec. Generate it from a
   sentence of intent (catalog-constrained, validate-or-retry), or edit it live in the
   design-in-code surface, or hand-write it. No compile step to see it.
4. **Feedback needs no accounts.** Deploy → unguessable link → customers comment anchored to
   specific elements. Comments fold straight back into the next AI refinement.
5. **Handoff is deterministic.** An approved version exports a bundle (spec + catalog prompt +
   tokens + `INTENT.md` + a runnable `.tsx`) that renders through *the same* design system —
   so what the customer approved is exactly what engineering builds.

---

## 3. Step-by-step: a new app from scratch

### Step 0 — Prerequisites

Node 22, pnpm 10. Clone the two sibling repos next to each other and install:

```bash
# ~/work/lighter/lighter  and  ~/work/lighter/lighter-example  as siblings
git clone <lighter-url> lighter
git clone <lighter-example-url> lighter-example
cd lighter && pnpm install
```

### Step 1 — Fork the starter (warm-up)

`apps/starter` is the intended on-ramp. Copy it to your product's app (or work in place while
you prototype):

```bash
pnpm --filter @lighter/design-system build   # emits dist/catalog.json + dist/tokens.json
pnpm --filter @lighter/starter dev            # http://localhost:4100
```

You now have a running Next.js app on the design system: a component showcase
(`/components`), a live json-render surface (`/render`), and a sample dashboard
(`/dashboard`). See [`apps/starter/README.md`](../apps/starter/README.md).

### Step 2 — Make it *your* design system (tokens first)

Everything visual comes from DTCG tokens. Edit
[`packages/design-system/tokens/*.tokens.json`](../packages/design-system/tokens) — primitives
(raw values), semantic (light), semantic-dark (dark overrides). Rebuild and the whole app
re-themes:

```bash
pnpm --filter @lighter/design-system build
```

This is your fastest brand-iteration lever. Do it before touching any component.

### Step 3 — Add a component the Lighter-compatible way

A catalog component is **four things declared together**: a pure React component, a Zod prop
schema, a first-class description, and (optionally) a preview + registry entry. Follow the
existing pattern exactly — e.g. `Badge`:

```tsx
// 1. Pure, prop-driven component — reads ONLY token CSS vars, no data/effects.
export function Badge({ label, tone }: { label: string; tone?: 'info' | 'success' | 'warn' }) {
  return <span className={`lui-badge lui-badge--${tone ?? 'info'}`}>{label}</span>;
}

// 2. Catalog entry: Zod props (→ JSON Schema at build) + a real description.
Badge: {
  props: z.object({
    label: z.string(),
    tone: z.enum(['info', 'success', 'warn']).nullable(),
  }),
  description: 'A small status pill. Use for counts, states, and labels.',
  // slots omitted ⇒ leaf component (no children)
},

// 3. A preview spec so the gallery can render it live (and health stays green).
Badge: {
  root: 'b',
  elements: { b: { type: 'Badge', props: { label: 'New', tone: 'info' }, children: [] } },
},

// 4. Register it so <SpecView> knows how to render the "Badge" type.
```

Rules that keep it compatible (see §4 for the full list): **props must be JSON-Schema
expressible** (strings, numbers, enums, booleans, nullable — no functions, no React nodes, no
callbacks), the component must be **pure** (same props → same output; no fetching, no global
state), and it must **read design decisions only from tokens** (CSS vars), never hard-coded
values.

Then rebuild — `catalog.json` now includes your component:

```bash
pnpm --filter @lighter/design-system build
```

### Step 4 — Build a page from the catalog

Your application pages compose catalog components. In the starter, a page is a normal Next.js
route (`app/dashboard/page.tsx`) that imports components from the design system. **Application
logic lives here** — data fetching, auth, event handlers — and it wraps/props the pure catalog
components. Lighter never sees this file; it only ever sees the *components* it uses, via the
catalog. (See §5 for how to structure this cleanly.)

### Step 5 — Get it into Lighter (ingest)

Start the API and ingest your built design system:

```bash
cd services/api && \
  DB_DIALECT=sqlite DATABASE_URL=./lighter.db SPECS_DIR=./.lighter-specs \
  ANTHROPIC_API_KEY=sk-…   # optional, enables AI generation \
  pnpm start               # :3000

curl -X POST localhost:3000/ingest -H 'content-type: application/json' \
  -d '{"repoPath":"/abs/path/to/lighter/packages/design-system","artifactDir":"dist"}'
```

Your components + tokens are now queryable at `GET /inventory` and drive generation.
(§6 covers cleaner ways to do this sync than a manual curl.)

### Step 6 — Author screens (design-in-code)

Three ways, all producing the same catalog-validated spec:

```bash
# a) AI-generate from a sentence of intent (constrained to YOUR catalog)
curl -X POST localhost:3000/generate -H 'content-type: application/json' \
  -d '{"intent":"An order-confirmed screen: title, summary card, and a Pay button."}'

# b) Create a screen + save a hand-written version (validated against the catalog)
curl -X POST localhost:3000/screens -d '{"name":"Checkout"}' -H 'content-type: application/json'
curl -X POST localhost:3000/screens/checkout/versions -H 'content-type: application/json' -d '{
  "spec": { "root": { "type":"PageShell", "props":{"title":"Order Confirmed"}, "children":[
    { "type":"Button", "props":{"label":"View receipt","variant":"primary"}, "children":[] }
  ]}}
}'

# c) Edit live in the starter's /render surface — paste a spec, see it render via <SpecView>
```

A spec that references a component you don't have (or violates its prop schema) is **rejected**
— the design system is the guardrail. This is the "design in code" activity: the same real
components, edited as data, previewed live.

### Step 7 — Deploy, review, refine, approve, hand off

This is the standard pipeline — see the [User Guide §3–6](./USER_GUIDE.md#3-deploy-to-a-review-link):
deploy to a tokenized link → customers comment anchored to elements → fold comments into
`POST /screens/:id/refine` → approve (with optional sign-off gate) → `GET
…/export` the handoff bundle. The bundle's `reactExport` is a runnable `.tsx` that renders the
approved screen through your design system.

---

## 4. The compatibility protocol (rules that never break Lighter)

Follow these and your app can grow arbitrarily without ever breaking Lighter integration.

**Catalog components (the layer Lighter sees):**

1. **Props are JSON-Schema data only.** Strings, numbers, booleans, enums, arrays, nested
   objects, `nullable`. **No** functions, callbacks, React elements, class instances, or
   `children`-as-a-prop. If a designer/AI can't express it as JSON, it isn't a catalog prop.
2. **Components are pure.** Output is a function of props. No data fetching, no `useEffect`
   side effects, no reads of global/app state, no routing. A catalog component rendered in
   Lighter's preview must look right with *only* its props.
3. **Composition is via `slots`/children, not props.** Containers declare `slots: ['default']`
   and receive children through the spec tree; leaves declare no slots.
4. **All design decisions come from tokens.** Components read CSS custom properties
   (`var(--…)`) only. No hard-coded colors/spacing. This is what makes re-theming a
   token-file edit.
5. **Every component has a real `description` and a `preview`.** Descriptions gate AI quality;
   previews keep health green and power the live gallery.
6. **Keep a browser-safe runtime surface.** Export the render-time API (components, registry,
   `SpecView`, tokens, previews) from a Node-free subpath (`lighter-example` uses `./ui`;
   see [`src/ui.ts`](../../lighter-example/src/ui.ts)). Build-time code (`node:fs`,
   `zod-to-json-schema`) must **not** be reachable from it, or consumers' bundles break.
7. **The build emits exactly `catalog.json` + `tokens.json`** into the artifact dir. Nothing
   else is part of the contract.

**Naming / stability:**

8. **Component names are the join key.** A spec references components by name; renaming or
   removing one marks every spec that used it **stale** (`GET /specs`). Treat catalog names
   like a public API — additive changes are safe, renames/removals are breaking.

If you can honor 1–8, application complexity on the other side of the line is unbounded.

---

## 5. Structuring application logic so it never leaks into the catalog

The recurring question: *"my app has real logic — data, auth, state — how do I keep that from
breaking Lighter?"* Answer: **enforce the seam.** Two concrete patterns:

### Pattern A — Presentational catalog / smart app wrappers

Every catalog component is **presentational**: it takes data as plain props and renders. All
"smarts" live in **app-side wrapper/container components** that fetch, compute, and pass plain
props down.

```tsx
// APP layer (Lighter never sees this): fetches + owns logic.
function OrderSummaryContainer({ orderId }: { orderId: string }) {
  const order = useOrder(orderId);              // data, effects, state — app-only
  return <Card title="Order summary">          // ← pure catalog component
    <Text content={`${order.items} items · ${order.total}`} size="md" />
  </Card>;
}
```

The `Card` and `Text` are catalog components with static-shaped props; `OrderSummaryContainer`
is app code that never enters the catalog. Lighter's spec of this screen references `Card` +
`Text` with concrete prop *values* (mocked during design); production swaps the mock values for
`useOrder` data. **Same components, same layout — only the data source differs.**

### Pattern B — Interactivity via json-render bindings, not code

When a *prototype* needs a little behavior (navigation between screens, showing a value),
express it through json-render's declarative surface — `data` bindings and `actions`/flow
links — **not** JavaScript in the spec. For screen-to-screen journeys use Lighter **flows**
(`PUT /screens/:id/flow`), which the deployed mock renders as a click-through bar. Real event
handling stays in the app layer (Pattern A). This keeps every spec serializable, reviewable,
and safe to store in git.

### Directory shape (suggested)

```
your-app/
  design-system/            # ← the catalog. Lighter-compatible. Emits dist/{catalog,tokens}.json
    tokens/*.tokens.json
    src/components/*         # pure, prop-driven
    src/registry, previews  # json-render wiring
  app/                      # ← the product. Composes the design system.
    routes/pages            # smart containers (Pattern A)
    lib/data, auth, state   # all business logic
```

The design system can live in its own package (as `@lighter/design-system` does) or its own
repo (as `lighter-example` does). Either way, the **artifact contract** — not a shared import
graph — is what couples it to Lighter, so the two evolve independently.

---

## 6. Cleaner design-system ingestion (a CLI + a connected repo)

You asked whether ingestion has to go through the API by hand, and whether GitHub or a CLI
could be cleaner. Here's the honest state and a recommendation.

### What exists today

| Path | Mechanism | Friction |
| --- | --- | --- |
| **Manual** `POST /ingest {repoPath, artifactDir}` | API reads the repo **from its own filesystem** by path | Couples the DS repo to the API host; you pass server-side paths over HTTP. Fine for local dev, awkward for CI/hosted. |
| **Push webhook** `/webhooks/design-system` | HMAC-signed; idempotent per commit | Still reads the repo off the API's disk, so the deploy must **pull-then-notify** (update the working copy, *then* curl). The sha is only an idempotency token, not the thing ingested. |
| **`lighter-ingest` CLI** ([`ingest-cli.ts`](../packages/ingestion/src/ingest-cli.ts)) | Runs `ingest()` locally, prints the `InventoryModel` | **Inspection only — it doesn't push.** So it can't actually sync Lighter today. |

The root awkwardness: ingestion is defined as *"the API reads a path on its own disk,"* which
forces the design system and the API to share a filesystem.

### Recommendation: push the **artifacts**, not a path

Decouple by having the producer send the two JSON artifacts *inline* to Lighter, so the API
never needs the repo on disk. Two thin pieces, building on what's already here:

1. **A real sync CLI** — extend the existing `lighter-ingest` with a push mode:

   ```bash
   # in the design-system repo's CI, after `build`:
   lighter sync --artifact-dir dist --to https://lighter.internal --token $LIGHTER_TOKEN
   ```

   It reads `dist/{catalog,tokens}.json` and POSTs their **contents** to a new
   artifact-body endpoint (e.g. `POST /inventory` accepting `{ catalog, tokens }`, reusing the
   same `ingest`/validation core). Now sync works from **any** machine or CI runner — no shared
   filesystem, no server-side paths.

2. **A GitHub Action** wrapping the CLI — the "connect GitHub" experience you asked about:

   ```yaml
   # .github/workflows/lighter-sync.yml (in the design-system repo)
   on: { push: { branches: [main] } }
   jobs:
     sync:
       steps:
         - uses: actions/checkout@v4
         - run: pnpm install && pnpm build          # emits dist/{catalog,tokens}.json
         - run: npx @lighter/cli sync --to ${{ secrets.LIGHTER_URL }} --token ${{ secrets.LIGHTER_TOKEN }}
   ```

   This is strictly cleaner than today's webhook: the Action already has the built artifacts in
   hand, so there's no pull-then-notify dance and no repo-on-the-API-box requirement. Every push
   to `main` re-syncs the inventory automatically.

**Why this over a full "Lighter clones your repo" model:** git-native connect (Lighter holds a
repo URL + deploy key and pulls/builds itself) is the nicest end-state UX, but it makes Lighter
responsible for cloning, credential storage, and running arbitrary repo builds — real infra and
a real attack surface. The artifact-push CLI gets you 90% of the DX for ~5% of the work and
keeps Lighter's core a pure function over two JSON files. Start there; graduate to git-native
connect later if hosted multi-tenant demands it.

> These two pieces (a `--push` mode on the CLI + an artifact-body ingest endpoint) are a small,
> well-scoped change to code that already exists. If you want, I can implement them.

---

## 7. Quick-start checklist

```
[ ] Clone lighter + lighter-example as siblings; pnpm install
[ ] Fork apps/starter as your product app
[ ] Edit tokens/*.tokens.json → your brand; pnpm --filter @lighter/design-system build
[ ] Add components the compatible way: pure + Zod props + description + preview + registry
[ ] Keep app logic in smart wrappers; catalog stays presentational (§4, §5)
[ ] Build → dist/{catalog,tokens}.json
[ ] Ingest into Lighter (POST /ingest today; CLI/Action once wired — §6)
[ ] Author screens (AI generate │ hand-write │ live edit), all catalog-validated
[ ] Deploy → review link → customer comments → refine → approve → export handoff
```

## See also

- [User Guide](./USER_GUIDE.md) — the pipeline, command by command
- [Developer Guide](./DEVELOPMENT.md) — architecture, dev loop, conventions
- [API Reference](./API.md) — every endpoint
- [`packages/ingestion/src/model.ts`](../packages/ingestion/src/model.ts) — the artifact schemas (the contract)
- [`apps/starter/README.md`](../apps/starter/README.md) — the consumer on-ramp
