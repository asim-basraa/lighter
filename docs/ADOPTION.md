# Adopting Lighter — a projection of standards

Lighter is designed so that **you author nothing Lighter-specific**. Everything it ingests is a
projection of an artifact your team already produces with standard tools. If you use shadcn/ui,
Tailwind, Storybook, DTCG tokens, and MSW, you already have everything Lighter needs — you just point
it at them.

This guide covers the standard stack, the shadcn quick-start, and the compatibility rules.

---

## 1. The standard stack

| Concern | Standard Lighter reads | Lighter-specific authoring |
| --- | --- | --- |
| Components | **shadcn/ui** (Radix + Tailwind + `cva`) | none — you own the code |
| Component metadata (the catalog) | **Storybook CSF `argTypes`**, **`cva` variants**, **react-docgen** | none — *derived* |
| Design tokens | **DTCG** (W3C-track) via **Style Dictionary / Tokens Studio** | none |
| Mock/preview data | **MSW** (Mock Service Worker) | none |
| Rendering / isolation | **Shadow DOM** + a federated ES bundle (optionally **Custom Elements**) | none |
| Consumer API | **OpenAPI 3.1** | none |
| Agent interface | **MCP** (Model Context Protocol) | none |

The rule of thumb: **if it can't be read from a standard artifact, it doesn't belong in the layer
Lighter sees.**

---

## 2. Why shadcn is the recommended on-ramp

shadcn/ui lines up with Lighter's contract better than almost any other kit:

- **CSS-variable theming** — exactly Lighter's token model (`tokens.json` → CSS vars; components read
  only vars, so swapping tokens re-themes with no component edits).
- **You own the components** (copied into your repo) — so you can add Storybook stories and the thin
  presentational wrappers Lighter's catalog wants.
- **`cva` variants map 1:1 to catalog enum props.** A `variant`/`size` variant config *is* your prop
  schema — Lighter derives it for free (`@lighter/ingest-storybook`'s `buildCatalogFromCva`).

The one adaptation: shadcn primitives expose non-serializable props (`asChild`, `className`,
`onOpenChange`, `children` as nodes). Lighter's catalog only takes JSON-serializable props, so you wrap
primitives into a **curated set of presentational components** (Pattern A — see [Building on
Lighter](./BUILDING_ON_LIGHTER.md)). The interactivity/state stays on the app side, which is where
Lighter wants it anyway.

---

## 3. shadcn quick-start

```bash
# 1. Start (or bring) a shadcn project
npx shadcn@latest init && npx shadcn@latest add button card badge

# 2. Wrap primitives into presentational catalog components (JSON props only), e.g.
#    <Button label variant size />  (not raw Radix props). Keep className/handlers on the app side.

# 3. Add a Storybook story per component (CSF). Its argTypes + your cva variants ARE the catalog.

# 4. Author tokens in DTCG (or export from Tokens Studio / Style Dictionary).

# 5. Conformance-check, then push to the cloud:
lighter check          # (STD1) Storybook present, props extractable, tokens present, purity rules
lighter sync --tokens-dtcg tokens.dtcg.json   # derives tokens + catalog, pushes to $LIGHTER_URL
```

### Deriving the catalog from `cva` (no Storybook required)

```ts
import { buildCatalogFromCva } from '@lighter/ingest-storybook';

const catalog = buildCatalogFromCva([
  {
    name: 'Button',
    description: 'A shadcn button.',
    variants: {
      variant: { default: '', destructive: '', outline: '' }, // → { enum: [...] }
      size: { sm: '', default: '', lg: '' },                   // → { enum: [...] }
    },
    argTypes: { label: { type: { name: 'string', required: true } } }, // → required string
  },
]);
// catalog satisfies Lighter's ingestion contract directly.
```

### Tokens from DTCG

```ts
import { dtcgToTokens } from '@lighter/dtcg';

const tokens = dtcgToTokens({
  color: { primary: { $value: '#2563eb' }, cta: { $value: '{color.primary}' } }, // aliases resolved
});
// → { 'color.primary': '#2563eb', 'color.cta': '#2563eb' }  (a valid tokens.json)
```

Or just `lighter sync --tokens-dtcg <file>` — the CLI resolves DTCG for you.

---

## 4. Compatibility rules (recap)

The catalog components Lighter renders must be:

1. **Props are JSON-Schema data only** — strings, enums (`cva` variants), booleans, numbers, nullable.
   No functions, `className`, `asChild`, refs, or React-node children as props.
2. **Pure / presentational** — output is a function of props; no data fetching or side effects (data
   comes via an injected provider + **MSW** mocks).
3. **Token-driven** — read design decisions only from CSS variables (Tailwind maps them for you).
4. **A story + a mock per component** — Storybook CSF + MSW; these double as previews and test/AI
   fixtures.
5. **Ship the compiled Tailwind stylesheet** with the render bundle (scoped under Shadow DOM).

Honor these and the app on the other side of the line can be arbitrarily complex without ever breaking
Lighter compatibility.

---

## 5. Where this is going (standardization epic)

Tracked under the standardization epic:

- **Catalog derivation** from `cva` + react-docgen + CSF (shadcn preset).
- **DTCG / Style Dictionary** token ingestion.
- **OpenAPI 3.1** for the API → typed SDKs.
- **MCP server** → any coding agent (Claude Code, Cursor, …) drives Lighter.
- **Custom Elements + CEM** (spike) → framework-agnostic rendering beyond React.

## See also

- [Building on Lighter](./BUILDING_ON_LIGHTER.md) — the compatibility protocol + Pattern A
- [User Guide](./USER_GUIDE.md) · [Developer Guide](./DEVELOPMENT.md) · [API Reference](./API.md)
