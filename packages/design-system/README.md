# @lighter/design-system

A comprehensive, **DTCG-token-driven** React component library that also ships a **json-render
registry** (so json-render specs render as this design system) and, at build, the `catalog.json` +
`tokens.json` artifacts **Lighter ingests**. Swap the DTCG tokens → your design system.

## Use it

```bash
pnpm add @lighter/design-system react react-dom
```

```tsx
import '@lighter/design-system/styles.css';
import { ThemeProvider, Button, Card, Stack } from '@lighter/design-system';

export default function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <Card title="Welcome">
        <Stack gap="3">
          <Button variant="primary">Get started</Button>
        </Stack>
      </Card>
    </ThemeProvider>
  );
}
```

## Theme it — DTCG tokens are the source of truth

Design tokens live as [DTCG](https://tr.designtokens.org/format/) files in `tokens/`:

- `primitives.tokens.json` — the raw scales (color ramps, spacing, radii, type, shadows, …).
- `semantic.tokens.json` — the themeable surface (aliases: `background`, `foreground`, `primary`,
  `border`, `radius`, typography styles, …). **Components reference only these.**
- `semantic-dark.tokens.json` — dark-theme overrides.

Re-point the semantic aliases (or swap the primitives) and **everything re-themes** — components never
hard-code a value. The transformer (`src/tokens/dtcg.ts`) resolves aliases + composite types and emits
CSS custom properties; `ThemeProvider` injects them (`:root` light, `:root[data-theme="dark"]` dark).

## Render json-render specs

```tsx
import { SpecView } from '@lighter/design-system/registry';
<SpecView spec={jsonRenderSpec} />; // renders a spec through this DS
```

## Build artifacts (for Lighter)

```bash
pnpm --filter @lighter/design-system build
```

Emits into `dist/`: `catalog.json` + `tokens.json` (Lighter's ingestion contract — point
`POST /ingest` at this package with `artifactDir: "dist"`), `theme.css`, and `styles.css`.

## What's inside

- **Layout**: Box, Stack/HStack/VStack, Grid, Container, Center, Spacer, Divider, AspectRatio, PageShell
- **Typography**: Heading, Text, Paragraph, Label, Link, Code, Kbd, Blockquote, List
- **Buttons**: Button (6 variants × 3 sizes), IconButton, ButtonGroup
- **Forms**: Input, Textarea, Select, Checkbox, Radio, RadioGroup, Switch, Slider, Field, Fieldset
- **Data display**: Card, Badge, Tag, Avatar(+Group), Progress, Spinner, Skeleton, EmptyState, Stat
- **Feedback**: Alert, Callout, Banner
- **Theme**: ThemeProvider, useTheme (light/dark/system)

The json-render **catalog** (what Lighter ingests + generates against) is the prop-driven subset.
