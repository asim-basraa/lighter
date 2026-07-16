---
name: design-tokens
description: Validate and compile W3C DTCG design tokens into CSS variables and a Tailwind theme partial. Use this skill whenever the user mentions design tokens, DTCG, a tokens.json export, "build tokens", "validate tokens", "compile tokens", or wants the design contract refreshed after a Figma export — even if they don't explicitly say "skill".
---

# design-tokens

Step 3 of the agentic SDLC loop. Turns a raw DTCG token export into the
verified, machine-consumable design-contract source that every later step
depends on.

## Inputs

A three-file W3C DTCG token set under `tokens/`:
- `tokens/primitives.json` — raw scale tokens (`$extensions.layer = "primitive"`).
- `tokens/semantics.json` — intent-named aliases (`$extensions.layer = "semantic"`, every `$value` is a `{group.token}` reference).
- `tokens/typography.json` — compound `$type: typography` tokens (`$extensions.layer = "semantic"`).

The shape matches the Tokens Studio for Figma export convention. See
`tokens/templates/` for the reference and the `figma-extract` skill for the
authoring contract.

## Outputs
- `tokens/build/tokens.css` — CSS custom properties (`:root { --... }`) with
  `outputReferences: true` so semantic aliases compile to `var(--primitive)`
  references. Compound typography is expanded into one CSS var per
  sub-property (e.g. `--typography-heading-lg-bold-font-size`).
- `tokens/build/tailwind-tokens.js` — Tailwind theme partial covering
  `colors / spacing / borderRadius / fontSize / fontFamily / fontWeight /
  lineHeight / boxShadow / typography`.
- `reports/tokens-report.md` — human-readable validation + build report.

## Procedure

1. **Parse & structurally validate** every leaf across all three files.
   - Each file must be valid JSON.
   - Every leaf token must have both `$value` and `$type`.
   - `$type` must be one of: `color`, `dimension`, `fontFamily`, `fontWeight`,
     `number`, `duration`, `shadow`, `typography` (extend as needed).
   - Every leaf must carry `$extensions.layer` set to `"primitive"` or
     `"semantic"`. Anything missing or set to another value is a FAIL.
   - DTCG **object value forms** are required:
     - `color.$value`: `{ colorSpace, components: [r,g,b], alpha }` (not hex strings).
     - `dimension.$value`: `{ value, unit }` (not `"16px"` strings).
     - `shadow.$value.{offsetX,offsetY,blur,spread}`: `{ value, unit }` objects.
     - `typography.$value`: object with `fontFamily / fontSize / fontWeight /
       lineHeight` sub-properties (sub-properties may be aliases).
     Any string-form `"#xxxxxx"` or `"16px"` value is a FAIL — it indicates
     the source file drifted from the agreed shape.
   - **No file may have a top-level `$description`** — Style Dictionary
     merges all three sources into one document and reports collisions on
     duplicate top-level keys. Per-file documentation lives here in the
     report.
2. **Resolve aliases.** Any `$value` of the form `{group.token}` (including
   alias sub-properties inside compound typography tokens) must resolve to a
   real token. Fail on unresolved references or circular aliases. Also fail
   if a `"semantic"` leaf's `$value` is **not** an alias — semantic tokens
   must point at a primitive (or, for compound typography, at primitive
   sub-properties), never carry a raw value.
3. **Enforce the semantic layer.** The following semantic groups must exist
   with at least one leaf each; missing a required group is a FAIL:
   - `color.surface.*` (flat — no states)
   - `color.text.*` (flat)
   - `color.border.*` (flat)
   - `color.action.{variant}.{state}.{slot}` **with full state.slot
     nesting** — at minimum `variant ∈ {primary, secondary, tertiary,
     danger}`, `state ∈ {default, hover, active, focused, disabled}`,
     `slot ⊇ {background, label}`. Flat
     `color.action.primary-hover`-style keys are a FAIL — that form was
     replaced by nested state.slot in the v3 schema.
   - `color.input.*` modelling form-input states
     (`color.input.default.{empty | focused | filled | error | disabled}`
     with per-state slots).
   - `color.feedback.{severity}.{slot}` with at minimum `severity ∈
     {success, warning, error, info}` and `slot ⊇ {background, foreground,
     border, icon}`.
   - `color.focus.{ring, ring-error, ring-info}`.
   - `space.*` containing named-scale aliases (e.g. `xs/sm/md/lg/xl/...`).
   - `radius.*` containing semantic-role aliases (e.g. `control`,
     `surface`, `pill`).
   - `shadow.*` containing named-scale aliases (e.g. `sm/md/lg`).
   - `motion.duration.*` — semantic duration aliases (e.g. `default`, `stepDelay`,
     `autoAdvance`) pointing at primitive `duration` tokens; required when the
     feature has animation twins (`motion-chains.json` references
     `durationToken` / `delayToken`).
   - `motion.easing.*` — semantic easing aliases (e.g. `default`, `hero`) pointing
     at cubic-bezier or named easing primitives; required when motion-chains
     references `easingToken`.
   - `typography.{display | heading | body | label}.*` — at least one
     compound per role. Prefer **paired desktop + mobile** leaves for each
     named style (e.g. `heading.desktop.h1` and `heading.mobile.h1`).
   Every semantic leaf's alias target must exist as a primitive in the
   merged document and have a matching `$type` (or, for compound typography,
   matching atomic primitive types).
   - **Letter-spacing primitives must be `$type: dimension` with `unit: "px"`.**
     Unitless `$type: number` values (e.g. `0.2`) compile to bare CSS numbers
     and are treated as *em* by browsers — FAIL and require px before build.
   - **Font weight:** Bold = `{font.weight.700}`, Semi Bold = `600`,
     Medium = `500`, Regular = `400`. Do not invent parallel `font.style.*`
     string tokens for CSS — numeric weights are the source of truth.
4. **Check naming.** Token paths should be consistent (dotted
   `category.group.…`, kebab-case key suffixes like `inverse-muted`,
   `ring-error`). Decimal-keyed primitives (e.g. `spacing.0.5`) are allowed
   because the CSS pipeline normalises them (`--spacing-0-5`); the Tailwind
   partial preserves the dot in the key so `m-0.5` classes still work.
5. **Compile.** Run `npm run tokens:build` (Style Dictionary, config at
   `tokens/sd.config.mjs`). The config reads all three sources, registers
   DTCG-aware transforms (`color/dtcg-to-css`, `dimension/object-to-string`,
   `shadow/object-to-string`, `fontFamily/css`), and emits the two build
   artifacts. A clean build prints `✔︎ tokens/build/tokens.css` and
   `✔︎ tokens/build/tailwind-tokens.js` and reports zero collisions.
   **Post-build FE handoff:** remind that every `typography.json` leaf needs a
   matching `@utility` in `app/globals.css` (including `letter-spacing`). Token
   compile alone does not wire Tailwind utilities — that is `fe-implement`.
5b. **Extend from `missing-tokens-report.md` (MANDATORY when present).**
   After a slice `figma-extract`, if
   `features/<id>/figma/missing-tokens-report.md` lists unresolved rows
   (or status is not RESOLVED):

   1. For **each** row: add a **new primitive** whose `$value` equals the
      Figma measurement exactly (px / colour object form), then a **new
      semantic** alias pointing at that primitive.
   2. **Never** satisfy a row by pointing at an existing token whose
      resolved value differs (nearest / old section token). That is a
      fidelity bug.
   3. Re-run structural validation (steps 1–4), then `npm run tokens:build`.
   4. Mark the report **RESOLVED** with the new token paths.
   5. Only after `STATUS: PASS` may `ui-registry-build` bind `$tokens`.

   Pipeline order: **extract → exact-or-new tokens → `tokens:build` →
   registry `$tokens` → design-contract → fe-implement**.
6. **Write the report** to `reports/tokens-report.md`:
   - Per-file leaf counts (primitives / semantics / typography).
   - Token counts by `$type` and by `$extensions.layer`.
   - The full list of token names available to later steps, **organised by
     file**: PRIMITIVE vocabulary (`primitives.json`), SEMANTIC vocabulary
     (`semantics.json`), TYPOGRAPHY vocabulary (`typography.json`). This
     list IS the design-contract vocabulary — `spec-author` and
     `design-contract` should reference semantic tokens by default and fall
     back to primitives only when no semantic alias fits.
   - **Motion token section:** list all `motion.duration.*` and `motion.easing.*`
     semantic aliases and their resolved ms / cubic-bezier values — used by
     `build:motion-from-cache` token mapping and `constants/motion.constants.ts`.
     If `validate:motion-chains` reports `durationToken: null` → add the missing
     primitive + semantic alias here, rebuild, then re-run 12b. Same when
     `validate:motion-spec` (Track B) references `timing.durationToken` /
     `timing.easingToken` with no matching semantic leaf.
   - **Typography FE checklist:** count of compound leaves vs count of
     `text-*` `@utility` blocks in `app/globals.css` (must match; note gap
     if FE utilities lag the token file).
   - Any warnings (W-1..W-N).
   - A final line: `STATUS: PASS` or `STATUS: FAIL` with reasons.

## Success criteria
Both build artifacts exist, and `reports/tokens-report.md` ends with
`STATUS: PASS`.

## Failure handling
On any validation or build error: do **not** produce partial artifacts as if
they were valid. Write the precise error (file, token path, reason) into the
report, end it with `STATUS: FAIL`, and stop. Do not advance any feature.

## Notes
- **Extending tokens is required for fidelity.** When
  `features/<id>/figma/missing-tokens-report.md` has unresolved rows, this
  skill **must** add new primitive + semantic leaves for the exact Figma
  values, then rebuild. Do **not** leave the gap for registry to "pick
  closest".
- **Do not change resolved values of existing tokens** to make a new frame
  fit — that breaks prior features. Add new scale steps / aliases instead.
- Do not "fix" broken DTCG shape by inventing values unrelated to Figma;
  if a source file is malformed, report the path and reason.
  **Exception:** unitless `font.letterspacing.*` `$type: number` values may be
  normalised to `{ value, unit: "px" }` `$type: dimension` when the designer
  has confirmed letter-spacing is always px (browser unitless = em). Document
  the change in the tokens report.
- The Style Dictionary config at `tokens/sd.config.mjs` IS owned by this
  skill. If it lacks a transform/format needed by a new token type or value
  shape, update it (and document the change in the report).
- If `tokens/sd.config.mjs` is missing, create it per the project README
  before proceeding.
- Compiling tokens does **not** update `app/globals.css` typography utilities.
  After a typography sync, `fe-implement` (or a dedicated follow-up) must add
  any new `@utility` classes before UI work continues.

## Out of scope — UI registry (sibling)

The file `tokens/ui-registry.json` is **not** a design token file. It is the
versioned source of truth for **screen** and **component** paths used in
Gherkin scenarios, specified by
`tokens/templates/PRD-Executable-Requirements-Gherkin-Component-Paths.docx.md`
and owned by the `figma-extract` skill (Mode B populates it, Mode A leaves
it alone). Its build is a separate command:

```
npm run ui-registry:build      # validate + emit test-ids.ts + glossary.md
npm run ui-registry:validate   # validate only (used by npm run gate)
```

Per PRD §3, a token path resolves to a *value* (which is what this skill
handles); a component path resolves to an *identity* (which the UI registry
handles). Same path-as-contract discipline, different storage and tooling.
Do not merge them into one pipeline.
