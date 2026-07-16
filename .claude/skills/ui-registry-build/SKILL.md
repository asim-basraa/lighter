---
name: ui-registry-build
description: >-
  Build tokens/ui-registry.json from the Figma spec.json for the FE feature.
  Catalogues every component, state, and token binding found in the Figma
  frame. Run after figma-extract and design-tokens, before design-contract.
---

# ui-registry-build

Reads `features/<fe-jira-id>/figma/spec.json` and the compiled token
vocabulary (`reports/tokens-report.md`) to produce `tokens/ui-registry.json`.
This registry is the component catalogue that `design-contract` and
`fe-implement` use to know what exists, what states it has, and which tokens
it uses.

## Inputs
- `features/<fe-jira-id>/figma/spec.json` — Figma frame extract
- `features/<fe-jira-id>/figma/motion-chains.json` — animation chains (when
  `*-animation` twins exist; used for motion path registration)
- `features/<fe-jira-id>/figma/motion-diffs.json` — per-layer deltas (when
  motion extract complete; cross-check `testId` bindings)
- `reports/tokens-report.md` — compiled token vocabulary
- `features/<fe-jira-id>/memory.md` — to read Gherkins section for component paths

## Procedure

### Step 1 — Read spec.json
Parse every named element in spec.json, capturing **both** its `name` and its
`nodeId`:
- `sections[].name` + `sections[].nodeId`
- `sections[].layers[].name` + `nodeId`
- `sections[].widgets[].name` + `nodeId`
- `sections[].columns[].name` + `nodeId`
- `sections[].banners[].name` + `nodeId`
- Any nested sub-elements with `name` fields (+ their `nodeId`)

Build a flat list of every named Figma element with its `nodeId`.

**Coverage rule (NON-NEGOTIABLE):** every named Figma element MUST receive a
`component.*` slug. The registry is the slug vocabulary that `build-layout.mjs`
maps every `layout.json` leaf onto and that `validate:layout` checks — a Figma
element with no slug becomes an unresolvable leaf and breaks the composition
tree. Cross-check against `features/<id>/figma/component-checklist.md`: every
row there must have a corresponding registry entry. No element may be skipped as
"static" or "decoration".

### Step 2 — Map to component paths (+ bind the Figma node)
For each Figma element, derive a `component.*` path using lowerCamelCase and
record the `nodeId` it came from as a `$figmaNode` binding on that entry:
- Screen-level containers → `screen.<featureName>`
- Top-level sections → `component.<featureName>.<sectionName>`
- Sub-elements → `component.<featureName>.<sectionName>.<elementName>`

Path rules:
- All segments lowerCamelCase (`[a-z][a-zA-Z0-9]*`)
- No spaces, no PascalCase, no slashes, no underscores
- Maximum 4 segments deep

**`$figmaNode` is MANDATORY on every component entry.** It is the `nodeId` from
spec.json for that element. This binding is what the single-session extraction
driver uses to resolve slice-roots, and what `build-layout.mjs` uses to swap a
`nodeId` leaf for its registry slug when generating `layout.json`. An entry
without `$figmaNode` is invisible to both — the layout leaf will not resolve.
For shared chrome (nav/footer) extracted into `features/_shared/figma/`, also set
`"$shared": true` so the driver and `validate:figma-extract` look there.

### Step 2b — Register motion paths (`component.*.motion.*`)

When `motion-chains.json` / `motion-diffs.json` exist (after step 12b
`build:motion-from-cache`), register **every moving layer** and the chain
trigger root:

- Path shape: `component.<feature>.<section>.motion.<elementName>` (lowerCamelCase)
- **Mandatory fields on each motion entry:**
  - `$figmaNode` — Figma node id (INSTANCE suffix or layer id from diff)
  - `$figmaLayerName` — exact layer `name` from `motion-diffs.json` (used by
    `build-motion-from-cache` for diff → testId binding)
  - `$states` — at minimum `["default", "hover"]` for interactive chains
  - `$screen` — parent screen path

Example entry:
```json
"component.landing.problem.motion.headerWrap": {
  "$description": "Problem section motion — header slide reveal target",
  "$screen": "screen.landing",
  "$figmaNode": "I5164:10344;5145:4201",
  "$figmaLayerName": "header-wrap",
  "$states": ["default", "hover"]
}
```

**Coverage rule:** every `testId` in `motion-diffs.json` must resolve to a
registry entry. Every chain `trigger.targetTestId` must exist. Re-run
`npm run build:motion-from-cache -- <id>` after adding motion paths so diffs
pick up bindings. Cross-check with `npm run validate:motion-chains -- <id>`.

**Ambient `gifRef` layers** use normal `component.*` paths (not `.motion.*`)
unless the layer is exclusively a motion decorative — document in anatomy per
`design-contract` skill.

Authoritative docs: `docs/motion-guideline.md` · `docs/motion-pipeline-plan.md`
steps 14–15. Web entrance idle enums live in contract / notes — not in
ui-registry paths; registry only covers `component.*.motion.*` moving layers.

### Step 3 — Identify states for each component
For each component, check spec.json for variant data or layer naming that
indicates states (hover, active, disabled, empty, error, loading).
Default state is always `default`.

### Step 4 — Map token bindings (STRICT — exact only)

**Pipeline order (NON-NEGOTIABLE) — do not start this step until true:**

1. Slice `figma-extract` complete (`validate:figma-extract` + `validate:layout` PASS)
2. Every Figma measurement for this slice has an **exact** token **or** new
   primitive + semantic were added (see `missing-tokens-report.md`)
3. `design-tokens` ran → `npm run tokens:build` → `reports/tokens-report.md`
   ends with `STATUS: PASS`
4. **Only then** write / enrich registry `$tokens`

If step 2–3 are incomplete → **STOP**. Do not bind `$tokens`. Instruct the
user to resolve missing tokens via `design-tokens` (extend + build), then
re-run this skill.

**Exact match rule (NON-NEGOTIABLE):**

- A token may be bound only when its **resolved** value equals the Figma
  measurement (spacing/radius within 1px; colour hex exact).
- **"Nearest" / "closest" / "visually close" / "reuse old section token" is
  FORBIDDEN.** Old token *names* from prior features/slices are allowed
  **only if** their resolved value still matches this frame exactly.
- Never remap a new Figma value onto an existing token whose resolved px/hex
  differs — that creates pixel-perfect gaps. Add a new primitive + semantic
  instead, rebuild tokens, then bind the new name.

For each component, look up which design tokens apply based on:
- **REST `boundVariables` (preferred):** after `build:spec-from-cache`, each
  spec node may carry `boundVariables` from the Figma cache. Run:
  ```bash
  npm run ui-registry:enrich-tokens -- <fe-jira-id>
  ```
  This maps `VariableID` aliases → semantic token paths via
  `tokens/build/figma-variable-index.json` (built from Figma `/variables/local`
  + `figmaPath` on DTCG primitives). Merges into each entry's `$tokens`.
  **PAT scope:** `file_variables:read` is required for live VariableID → name
  resolution; without it, only template `variableId` stubs and manual `$tokens`
  apply — the script warns when the API returns 403.
- After enrich (or on manual bind), **verify resolved value vs Figma** for
  every `$tokens` slot. If VariableID resolves to a semantic whose compiled
  value ≠ Figma → treat as missing token (do not keep the wrong binding).
- Background colour → `$background` token from `tokens-report.md` (**exact**)
- Text colour → `$color` token (**exact**)
- Border → `$border` token (**exact**) **and** Figma `strokeWeight` (width is part of the
  binding — e.g. SectionPill `0.3px`; colour alone is incomplete)
- Border radius → `$radius` token (**exact**)
- Spacing/padding → `$spacing` token (**exact**)

If a Figma value has no exact token match → **STOP this skill**. Do **not**
write a "close enough" `$tokens` entry. Do **not** leave a silent wrong bind.
Write/update `features/<fe-jira-id>/figma/missing-tokens-report.md`, set
`"tokenMissing": true` only as a temporary marker that **blocks**
`design-contract` / `fe-implement`, and hand off to `design-tokens` to add
primitive + semantic for the exact Figma value, then `tokens:build`, then
re-run `ui-registry-build`.

### Step 5 — Write `tokens/ui-registry.json`

```json
{
  "screen.<featureName>": {
    "$description": "<what this screen is>",
    "$states": ["default"],
    "$tokens": {}
  },
  "component.<featureName>.<sectionName>": {
    "$description": "<what this component is>",
    "$screen": "screen.<featureName>",
    "$figmaNode": "<nodeId from spec.json, e.g. 394:9911>",
    "$states": ["default", "hover", "empty"],
    "$tokens": {
      "$background": "<token-name>",
      "$color": "<token-name>",
      "$radius": "<token-name>"
    }
  }
}
```

Merge into existing `tokens/ui-registry.json` if the file exists — do not
overwrite entries for other features.

### Step 6 — Run `registry-validate`
Run `registry-validate` immediately after writing. Fix any failures before
writing to memory.

### Step 6b — Enrich `$tokens` from REST boundVariables
After the registry skeleton is written, run:
```bash
npm run ui-registry:enrich-tokens -- <fe-jira-id>
```
This is mandatory when `spec.json` was produced by `build:spec-from-cache`
(REST extract path). Re-run `ui-registry:validate` after enriching.

### Step 7 — Write to memory
Append to `features/<parent-id>/memory.md`:
```markdown
## UI Registry
<!-- Written by: ui-registry-build on <ISO date> -->
<!-- Validated by: registry-validate — pending -->
Full file: tokens/ui-registry.json

### Components catalogued
- <component.path>: <description>
```

### Step 8 — Run `jira-sync`
Set FE ticket to `ui-registry-ready`.

## Success criteria
- `tokens/ui-registry.json` updated with all Figma components
- Every named Figma element has a `component.*` entry (no element skipped)
- Every component entry has `$figmaNode`, `$states`, and `$tokens`
- **Zero `tokenMissing`** on this feature's entries; every `$tokens` slot
  resolves to a value that **exactly** matches Figma (no nearest/old binds)
- **Motion (when animation twins exist):** every `motion-diffs.json` `testId`
  and every chain `trigger.targetTestId` has a registry entry with
  `$figmaLayerName` where applicable
- Every `component-checklist.md` row maps to a registry entry
- `registry-validate` exits 0
- Memory UI Registry section written

## Hard rules
- Never invent component paths. Every path must trace to a named Figma element.
- Every component entry must carry a `$figmaNode` binding (the spec.json nodeId).
  Without it, `build-layout.mjs` cannot resolve the `layout.json` leaf and the
  extraction driver cannot resolve slice-roots.
- Never merge-overwrite entries from other features in the registry.
- If spec.json is missing or empty → stop. Do not write the registry.
  Report and instruct user to run `figma-extract` first.
- **Token fidelity:** never bind a nearest/old token whose resolved value ≠
  Figma. Order is always: extract → exact-or-new tokens → `tokens:build` →
  registry `$tokens`. Binding `$tokens` before `tokens:build` PASS is forbidden.
- **`tokenMissing` blocks downstream.** Any entry with `tokenMissing: true`
  means this skill is incomplete — do not claim `ui-registry-ready` or advance
  to `design-contract` until every slot has an exact token after rebuild.
- **Motion paths:** never invent `component.*.motion.*` without a matching row
  in `motion-diffs.json` or `motion-chains.json` trigger — paths are contracts
  for `validate:motion-chains` and `fe-implement` wiring.
