---
name: figma-extract
description: Pull design data out of Figma via the Figma MCP — design tokens (Variables) and per-feature frame specs with measurements and a reference screenshot. Use this skill whenever the user wants to extract, sync, or import anything from Figma — tokens, variables, a frame, component specs, measurements, or a reference image — even if they don't say "skill". Requires the Figma Dev Mode MCP server to be connected.
---

# figma-extract

Connects the agentic SDLC loop to Figma. It has two modes; pick the one the
user is asking for.

## Prerequisite

The **Figma Dev Mode MCP server** must be connected (see the project
`GUIDE.md`). Verify a Figma MCP tool is available before doing anything. If it
is not, **stop and tell the user how to enable it** — never fabricate design
data, measurements, or screenshots.

## HARD RULE — Screenshots are visual reference only. NEVER a data source.

`get_screenshot` / `reference.png` exists to give the developer a visual
baseline. It is **never** a substitute for structured design data.

**If `get_design_context` fails or returns no structured data:**
- **STOP immediately.** Do not fall back to screenshots.
- Do not proceed to `spec.json`, `design-contract`, or any downstream skill.
- Report the exact MCP error to the user.
- Tell the user what to fix (MCP disconnected, wrong node ID, access issue,
  frame too large — follow the Large Frame Protocol below instead).

A screenshot-only extraction produces zero measurements, zero token mappings,
and zero component anatomy. Any implementation built from it will deviate from
the Figma design. **This is forbidden.**

The only exception: after structured data is successfully extracted, screenshots
are taken as visual reference (step 2 / step 1d). They accompany `spec.json`,
not replace it.

---

## Mode A — `tokens`  (refresh the design system)

Use when the user wants to (re)build the design tokens from Figma.

The token set lives in **three sibling files** under `tokens/`, matching the
Tokens Studio for Figma plugin export convention (see
`tokens/templates/` for the reference shape):

1. **`tokens/primitives.json`** — raw scale tokens. Every leaf carries
   `$extensions.layer = "primitive"`.
2. **`tokens/semantics.json`** — intent-named DTCG aliases pointing into
   primitives. App code, BDD steps, and design contracts reference *these*,
   not primitives. Every leaf carries `$extensions.layer = "semantic"` and
   `$extensions.aliasOf = "<primitive.path>"`. Every alias `$value` is a
   `{group.token}` reference into a primitive.
3. **`tokens/typography.json`** — compound `$type: typography` tokens. Each
   `$value` composes aliases into `font.family / weight / size / lineHeight`
   from `primitives.json`. Layer marker is `"semantic"`.

### Required value forms (W3C DTCG, latest draft)

Use the **object** value forms, not the older string forms. They round-trip
cleanly to Figma Variables and survive future DTCG spec moves.

- **color**: `{ "colorSpace": "srgb", "components": [r, g, b], "alpha": 1 }`
  with r/g/b normalised to `0..1`. Not `"#rrggbb"` strings.
- **dimension** (spacing, radius, font size, line height): `{ "value": 16,
  "unit": "px" }`. Not `"16px"` strings. (Tokens Studio uses `"number"`
  type for unitless spacing — we use `"dimension"` with `"px"` instead, more
  DTCG-correct.)
- **shadow**: `{ "color": "rgba(...)", "offsetX": {value, unit},
  "offsetY": {value, unit}, "blur": {value, unit}, "spread": {value, unit} }`
- **fontFamily**: array of strings (e.g. `["Inter", "system-ui",
  "sans-serif"]`).
- **typography** (compound): `$value` object with
  `fontFamily / fontSize / fontWeight / lineHeight` (and optionally
  `letterSpacing`). **Sub-properties SHOULD be aliases** (e.g.
  `"fontSize": "{font.size.xl}"`) — Tokens Studio's export inlines literals
  because of plugin limits; we prefer aliases for single-source-of-truth.

### Required token groups

**`primitives.json`** must contain:
- `color.{primary, secondary, tertiary, error, success, warning, info,
  typography, outline, background, indicator}` — colour ramps. `background`
  also carries the literal swatches (`error/warning/success/info/muted/
  light/dark`); `typography` carries `white/gray/black`.
- `colorDark.*` — dark-mode mirror of the colour ramps. (CSS-only; see
  W-1 in the report.)
- `spacing` — numeric scale, keys preserve the consumer convention
  (e.g. Tailwind `"0", "px", "0.5", "1", …, "96"`).
- `radii.{none, sm, base, md, lg, xl, 2xl, 3xl, full}`.
- `font.family` / `font.weight` / `font.size` / `font.lineHeight`.
- `shadows.{hard-1..5, soft-1..4}`.

**`semantics.json`** must contain (extend as the system grows; never shrink):
- `color.surface.{canvas, raised, sunken, muted, inverse, inverse-muted}` —
  flat (surfaces don't carry interaction states).
- `color.text.{primary, secondary, tertiary, disabled, inverse,
  inverse-muted, link, accent, success, warning, error, info}` — flat.
- `color.border.{default, subtle, strong, focus, success, warning, error,
  info}` — flat.
- `color.action.{primary | secondary | tertiary | danger}` **nested by
  state then slot**:
  - state ∈ `{default, hover, active, focused, disabled}`
  - slot ∈ `{background, label}` (plus `border` on `focused`)
- `color.input` — flat slots (`surface, border, placeholder-dim`,
  `icon.{default, error, disabled}`) plus
  `color.input.default.{empty | focused | filled | error | disabled}` with
  per-state slots (`border, placeholder, value, helper, surface`).
- `color.feedback.{success | warning | error | info}.{background,
  foreground, border, icon}`.
- `color.focus.{ring, ring-error, ring-info}`.
- `space.{xs, sm, md, lg, xl, 2xl, 3xl, gap, gutter, section}`.
- `radius.{control, surface, panel, pill, sharp}`.
- `shadow.{sm, md, lg, focus}`.

**`typography.json`** must contain compound tokens for at least
`typography.{display | heading | body | label}.{size}.{weight}`. See
`reports/tokens-report.md` and `tokens/typography.json` for the current
catalogue.

### Steps

1. Ask which Figma file to read (or use the one the user supplied).
2. **Read primitives.** Use the Figma MCP's variable/styles capability
   (`get_variable_defs` or equivalent) to read every Variable and style.
   Map them to DTCG **object** value forms above, and emit them into
   `tokens/primitives.json`. If the Figma file is a published code-first
   system (e.g. gluestack-ui), prefer that system's canonical config over
   the partial Figma export and note the source in
   `$extensions.source` (cite the upstream commit).
3. **Read semantics from Figma if present.** If the Figma file has a
   *Semantic* (or *Alias*) Variable collection that points at the
   primitives, convert those to DTCG aliases with `{group.token}`
   references and emit them into `tokens/semantics.json`. Otherwise, skip
   to step 4.
4. **Synthesize any missing semantic groups.** For every required group
   listed above, if no semantic alias was extracted in step 3, add one
   keyed to the nearest primitive. Use **state.slot nesting** for
   `action.*` and `input.*` — do not flatten them. Pick alias targets
   deliberately and record the choice in `$extensions.aliasOf`; do not
   invent values.
5. **Build/preserve typography compounds.** If the Figma file has
   typography styles, convert them to `$type: typography` tokens with
   aliased sub-properties, and emit them into `tokens/typography.json`.
   Otherwise, leave the existing `tokens/typography.json` untouched.
6. **Write/overwrite the three files** with the matching layer markers.
   Every semantic leaf MUST have a `{group.token}` `$value` that resolves
   to an existing primitive — the **design-tokens** skill will fail the
   build if not.
7. **Tell the user to run the `design-tokens` skill next** to validate +
   compile.

**Honesty notes:**
- Figma Variable export via MCP can be incomplete (missing modes, partial
  collections). If the result is not clean DTCG, say so plainly and
  recommend the **Tokens Studio for Figma** plugin export as the more
  reliable path. Never silently emit malformed tokens.
- If the only source is a code-first system (e.g. gluestack-ui), say so
  and use the canonical TypeScript/JSON config from that system, not a
  scraped Figma cover file. Cite the upstream commit in `$extensions.source`.
- The semantic and typography files are the team's authored contract.
  **Never delete existing semantic groups or typography compounds** when
  refreshing primitives — instead, fail loudly if a refresh would orphan
  an alias (target primitive removed), and ask the user before changing
  the mapping.
- **Do not put a top-level `$description` in any of the three files.**
  Style Dictionary merges all sources into one document and reports
  collisions on duplicate top-level keys. Per-file documentation belongs
  in `reports/tokens-report.md`.

---

## Mode B — `frame`  (capture one feature's design intent)

Use per feature, after `spec-author`, to give `design-contract` real data.

Inputs: a feature `id`, and the Figma frame/node URL for that feature.

### ⚡ REQUIRED PATH — Dual-source extract (REST + MCP, reconciled)

**Neither REST nor MCP alone is sufficient for exact implementation.**

| Source | Strength | Weakness |
|--------|----------|----------|
| **REST** (`figma:extract:rest`) | Full geometry, `boundVariables`, scales without agent timeouts | May omit Dev Mode hints; large nodes are fine |
| **Desktop MCP** (`get_design_context` / driver) | `componentProperties` (Size/Accent/State variants), nested layout semantics | Timeouts on large slice-roots in programmatic clients |
| **REST images** (`figma:export-image`) | Reference PNGs + SVG/PNG assets | Never use for measurements |

**Rule:** Run **both** REST and MCP for every slice-root. Reconcile into one
`nodes/<nodeId>.json` cache per slice. Downstream skills read disk only — but
that disk must be the **merged** truth, not REST-only.

```bash
# ── Phase 1: REST bulk (always first — reliable geometry + boundVariables) ──
npm run figma:extract:rest -- --feature <id> --frame <frame-node-id>
npm run figma:export-image -- --feature <id>

# ── Phase 2: MCP gap-fill (componentProperties, layout semantics) ──
# Try driver first; on exit 2 use agent MCP per-slice (see Timeout Split below)
npm run figma:extract -- --feature <id> --frame <frame-node-id>

# Per slice-root that still lacks componentProperties after driver:
#   npm run figma:refresh-node -- --feature <id> --refresh-node <nodeId>
# On timeout → split to child nodes (Timeout Split Protocol below)

# ── Phase 3: Derive + validate (offline) ──
npm run build:spec-from-cache -- <id>
npm run validate:figma-extract -- <id>
npm run build:layout -- <id>
npm run validate:layout -- <id>
npm run validate:figma-coverage -- <id>
```

**Dual-source reconciliation (MANDATORY before handoff).** For each
`slice-roots.json` entry, verify in `nodes/<nodeId>.json`:

1. **Geometry** — width/height/padding/gap match REST (authoritative for px).
2. **Layout** — `layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems`
   present; if `spec.json` §3 disagrees with cache, cache wins.
3. **Instance variants** — every `INSTANCE` of a named component set
   (`FeatureCard`, `AccentBar`, `Button/Primary`, etc.) has
   `componentProperties` captured. If REST cache lacks them → MCP
   `get_design_context` on that instance node (or parent slice split).
4. **Checklist** — after `build:spec-from-cache`, every INSTANCE row in
   `component-checklist.md` shows `(variants: Size=Wide, Accent=Navy)` when
   applicable. Missing variant suffix on a known component set → incomplete
   extract → do not hand off.

Record reconciliation in `notes.md`:

```markdown
## Dual-source reconciliation
| slice-root | REST | MCP | instanceVariants | action |
|------------|------|-----|------------------|--------|
| 5164:6562  | ✓    | ✓   | 6× FeatureCard   | merged |
```

**Timeout Split Protocol (when MCP times out on a node).** Never retry the
same large node. Split recursively until each call succeeds:

```
extractNode(nodeId):
  1. Try get_design_context(nodeId) OR figma:refresh-node for nodeId
  2. ON timeout | truncated | empty componentProperties on known INSTANCEs:
     a. get_metadata(nodeId) → list direct children (id, name, type)
     b. FOR EACH child where visible !== false:
          extractNode(child.id)   # recurse — may split again
     c. Merge child payloads into nodes/<parent>.json OR add child ids to
        slice-roots.json as separate cache files (preferred when children are
        independent sections)
  3. Stop splitting when: call succeeds AND every INSTANCE in subtree has
     componentProperties OR node is a leaf TEXT/VECTOR
```

**Minimum chunk size:** split down to individual `FeatureCard`, `FooterBar`,
`SectionHeader`, and motion prototype roots — not smaller than one demoable
UI component. For LP-001-scale sections (~6 cards), each **card INSTANCE**
is a valid MCP target when the section root times out.

**Never hand off when:**
- Only REST ran and any checklist row is a `FeatureCard` / `AccentBar` INSTANCE
  without `(variants: …)` in component-checklist.md
- `validate:figma-extract` ≠ 0
- Reference PNG is placeholder (< 10 KB)
- Dual-source reconciliation table is missing from `notes.md`

---

### REST-only fast path (geometry refresh — not sufficient alone for new slices)

When DTCG tokens are already in `tokens/` and you only need to **refresh
geometry** on an already-reconciled slice (variants already in cache), REST
alone is OK **only if** `component-checklist.md` already shows variant suffixes
for every INSTANCE and `validate:figma-extract` exits 0. For **new** slices or
after Figma edits, run the full dual-source path above.

```bash
# 0. Document slice-roots (one REST call per in-scope section)
#    features/<id>/figma/slice-roots.json — frame + [{ nodeId, name, source }]
#    (auto-written by figma:extract:rest; edit when adding sections)

# 1. REST chunk extract — needs FIGMA_ACCESS_TOKEN (File content: Read-only) + FIGMA_FILE_KEY
npm run figma:extract:rest -- --feature <id> --frame <frame-node-id>

# 2. screenshots + assets via Figma REST (never MCP)
npm run figma:export-image -- --feature <id>

# 3. MANDATORY — derive spec.json + component-checklist.md from cache only (no legacy MCP spec)
npm run build:spec-from-cache -- <id>

# 4. derive the composition tree from the cache (offline, 0 MCP)
npm run build:layout -- <id>

# 5. MOTION — animation chain walk + motion artifacts (docs/motion-pipeline-plan.md)
npm run figma:motion-chain-walk -- --feature <id>
# refresh every missing destinationId from chain-walk-report, then re-run step 5
npm run build:motion-from-cache -- <id>
npm run validate:motion-chains -- <id>   # must exit 0 before design-contract
```

After step 3, `spec.json` carries `boundVariables` per node from REST. Run
`ui-registry-build` then `npm run ui-registry:enrich-tokens -- <id>` to map those
bindings to semantic `$tokens` in `ui-registry.json`.

**`slice-roots.json` (per feature, required).** Records which Figma sections are
extracted as separate REST/MCP chunks — one cache file per entry:

```json
{
  "frame": "394:8951",
  "frameName": "08_Product Detail",
  "sliceRoots": [
    { "nodeId": "394:9911", "name": "Breadcrumb", "source": "ui-registry" },
    { "nodeId": "399:4303", "name": "Product Detail", "source": "ui-registry" }
  ]
}
```

`figma:extract:rest` writes this file automatically. `build:spec-from-cache`
uses it for section order. Shared chrome (nav/footer) lives in
`features/_shared/figma/nodes/` — record `(shared)` rows in the checklist.

### Animation chain walk (mandatory when `*-animation` in slice-roots)

**Authoritative docs:** `docs/motion-guideline.md` (overview) · `docs/motion-pipeline-plan.md` (extract algorithms).

Motion is **not done** until every animation twin has a **closed** chain — meaning
**every variant state** is cached as its own `nodes/<nodeId>.json`, not just state 1.

#### Two motion kinds (extract both)

| Kind | Figma signal | Extract | FE (fe-implement) |
|------|--------------|---------|-------------------|
| **Interactive** | `interactions[]` on `*-animation` variant chain | Chain walk + `motion-chains.json` + `motion-diffs.json` | `useOneWayMotion` + pattern runner + helpers |
| **Ambient** | `gifRef` on IMAGE fill (often on **static** slice) | `asset-manifest.json` + disk file | `<Image unoptimized />` — no hover handler |

#### Dual motion tracks (both may coexist — do not pick one globally)

| Track | Artifacts | Role | Gate |
|-------|-----------|------|------|
| **A — Prototype chains (primary)** | `motion-chains.json`, `motion-diffs.json`, `motion-state-poses.json`, `chain-walk-report.json` | Machine-extracted Smart Animate from REST/MCP prototype `interactions[]`; **authoritative for `fe-implement`** when `status: "closed"` | `npm run validate:motion-chains -- <id>` |
| **B — Designer motion-spec (supplementary)** | `motion-spec.json` (+ optional `tokens/templates/motion-spec.*.json` in project) | MCP variant keyframe inventory on Animations page; **designer-confirmed** duration/easing when REST lacks timing or for inferred overlays | `npm run validate:motion-spec -- <id>` when file exists |

**Rules:**
- **Track A wins for code** when a closed chain exists for a component — implement runners/helpers from `motion-diffs.json`.
- **Track B** fills gaps: timing sign-off (`designerConfirmed: true`), pre-chain inventory, or components without REST interactions.
- **Never** read `tokens/MOTION-SPEC.md` — Tracks A + B JSON only.
- Human overview: `docs/motion-guideline.md` (Track A) · project `motion-spec` templates (Track B).

#### Web entrance idle (mandatory to specify — Figma/requirements decide the value)

Figma has **two twins**: static page frames (finished layout) and animation prototypes
(entry poses + hover chain). **Neither idle is hard-coded for production.** The
designer / PRD / Figma demand chooses `productIdle` per slice. The pipeline’s job
is to **capture and enforce that choice**, not to invent empty states.

| Idle | Purpose | Who sees it |
|------|---------|-------------|
| **`productIdle`** | What real users see before trigger | Production / staging |
| **`qaIdle`** | Snapshot / fixture idle (often static twin) | Playwright (`NEXT_PUBLIC_E2E_MODE=1`), golden snapshots, layout QA |

**Allowed `productIdle` values (pick one per slice — from Figma / designer):**

| Value | User sees before trigger | When to use |
|-------|--------------------------|-------------|
| `staticTwin` | Finished layout (no empty / hidden frame) | Designer wants content visible immediately; hover/chain only enriches; **no empty states** |
| `entryPose` | Animation state 1 offsets (partially visible) | Prototype idle is the intended first paint |
| `hidden` | Opacity 0 + entry transform until trigger | Marketing reveal / scroll entrance; avoid static-flash |

**Allowed `qaIdle`:** usually `staticTwin` for layout baselines. When
`productIdle === staticTwin`, product and QA idles **align** — no dual-mode
required for that slice.

**Do not assume `hidden`.** Empty/hidden first paint is only valid when the Web
entrance row (or designer) says so. Forcing hidden on every transition is a
skill gap of its own.

**Designer deliverable (mandatory intent — flexible naming):**
Design does **not** have to use the tokens `productIdle` / `qaIdle`. They may
write prose, Figma comments, Variables, or PRD bullets in any wording. Extract /
contract **must** map that intent into the canonical enums below before
`fe-implement`. If intent cannot be mapped → **STOP and ask** (do not invent).

| Canonical (notes.md / contract) | Designer may say (examples — not exhaustive) |
|---------------------------------|-----------------------------------------------|
| `productIdle: staticTwin` | “no empty state”, “always show content”, “match page frame”, “visible before hover” |
| `productIdle: entryPose` | “start like animation frame 1”, “idle = prototype idle”, “offset until scroll” |
| `productIdle: hidden` | “reveal on scroll”, “invisible until in view”, “empty until trigger” |
| triggers `hover` / `inView` / `hash` / `load` | “on hover”, “when section enters”, “Product nav / #product”, “on load” |

Aliases in JSON/Variables (if a file uses different keys) are fine — normalize on
write to notes/contract. Examples: `firstPaint`, `webIdle`, `initialRender`,
`idleMode` → map to `productIdle`; `e2eIdle` / `snapshotIdle` → `qaIdle`.

**How to decide (in order):**
1. Explicit note in Figma / `notes.md` / PRD / Variables (any naming — map to enum)
2. Ask designer: “Before hover/scroll, should this section look like the **static page frame**, **animation state 1**, or **fully hidden**?”
3. If still ambiguous: **STOP and ask** — do not silently pick `hidden` or `staticTwin`.

**Per animated slice — record in `notes.md` (blocks extract complete if missing):**
```markdown
### Web entrance — <SectionName>
| Field | Value |
|-------|-------|
| productIdle | staticTwin \| entryPose \| hidden |
| qaIdle | staticTwin \| (same as productIdle when aligned) |
| source | designer \| figma-comment \| prd \| asked-<date> \| Variable:<name> |
| designerWording | (optional verbatim — any keys/prose before canonical map) |
| triggers | inView \| hash(`#…`) \| hover \| load (list all that apply) |
| nav hash | `#product` / — |
```

**Anti-gap rule:** static twin = layout truth; animation chain = motion truth;
**product idle must be an explicit Figma/requirements choice.** Wrong defaults
(always static → flash; always hidden → empty states the designer rejected)
are both failures.

#### Track B — motion-spec inventory (MCP, when Animations page exists)

Figma prototype **timing is not in REST file content**. MCP **can** extract **variant keyframes** — static frames as `Property 1=Default`, `Property 1=2`, … on the Animations page.

**Procedure (MCP, during extract — runs alongside Track A, not instead of it):**
1. `get_metadata` on the Animations page canvas → list component-set frames and variant symbol `nodeId`s.
2. For each in-scope animated component (matches `component.*` in registry or checklist):
   - `get_design_context` on **each variant** `nodeId` (sequential).
   - Diff layout between variants: `top`, `left`, `opacity`, visibility of child layers.
   - Record trigger + duration/easing as **TBD** unless supplied in `notes.md` or Figma Variables (`motion.*`).
3. Write `features/<id>/figma/motion-spec.json` using `tokens/templates/motion-spec.template.json` (when present in project).
4. Append to `notes.md`:
   ```markdown
   ## Motion spec (Track B)
   | Component | Variants (nodeIds) | Keyframe summary | Timing confirmed? |
   ```
5. Run `npm run validate:motion-spec -- <id>` when any animated component is in scope and the file exists.

**Honesty:** `timing.designerConfirmed: false` is valid in `motion-spec.json` but **blocks `design-contract`** until the designer confirms duration/easing. Track A chain closure is still required for prototype-driven slices unless an approved `motion-inferred-overlays.json` closes the chain.

Reference pilot: `tokens/templates/motion-spec.example.json` (when present in project repo).

#### Mandatory extract checklist (per `*-animation` slice-root)

`/figma-extract` is **not complete** for a feature with animation twins until **every row** passes:

| # | Requirement | Output |
|---|-------------|--------|
| 1 | Slice-root cached | `nodes/<id>.json` state 1 + root `interactions[]` or `transitionNodeID` |
| 2 | **Every `destinationId` in chain** cached | `nodes/<dest>.json` for states 2…N |
| 3 | Chain closed | `chain-walk-report.json` + `motion-chains.json` `status: "closed"` |
| 4 | Every transition recorded | trigger, durationMs, easing, delayMs in `motion-chains.json` |
| 5 | Layer diffs built | `motion-diffs.json` per consecutive state pair |
| 6 | Reference PNG per state (min: state 1 + terminal) | `reference-<slug>-animation-state-N.png` |
| 7 | Registry paths for moving layers | `component.*.motion.*` in `ui-registry.json` |
| 8 | All `gifRef` downloaded | `asset-manifest.json` + `validate:assets` |
| 9 | `componentProperties` on animation INSTANCE (MCP gap-fill) | checklist `(variants: Property 1=1)` |
| 10 | Reconciliation table in `notes.md` | one row per state per twin |
| 11 | Nested `interactions[]` scanned on **full subtree** | `triggerNodeId` on each transition |
| 12 | Non-root entry triggers documented | e.g. hero CTA `ON_HOVER` → `trigger.targetNodeId` |
| 13 | `componentProperties` diff state 1 vs terminal | accent/size variant changes in notes.md |
| 14 | Unknown duration/delay flagged | `durationToken: null` → `validate:motion-chains` FAIL |
| 15 | Every Animations-page twin in `slice-roots.json` | no orphan `*-animation` frames |
| 16 | Web entrance row in `notes.md` | Map designer intent → `productIdle` (`staticTwin`\|`entryPose`\|`hidden`) + `qaIdle` + `triggers` + `source` — key names flexible, intent mandatory; no assumed empty states |

#### npm procedure (after REST steps 1–4)

```bash
# A. Discover chains + list missing variant nodes
npm run figma:motion-chain-walk -- --feature <id>
# writes features/<id>/figma/chain-walk-report.json

# B. Refresh EVERY missing destinationId (repeat until chain walk exits 0)
npm run figma:refresh-node -- --feature <id> --refresh-node <destinationId>
# Re-run A until: "All animation chains closed."

# C. MCP gap-fill when REST has transitionNodeID but empty interactions[]
#    (Navbar pattern) — merge prototype into nodes/<id>.json; set $meta.prototypeSource: "mcp"

# D. Per-state reference PNGs (minimum: state 1 + terminal per twin)
npm run figma:export-image -- --feature <id>
# Target naming: reference-<slug>-animation-state-<N>.png per motion-chains states[].referencePng

# E. Build motion artifacts (offline)
npm run build:motion-from-cache -- <id>
# writes motion-chains.json + motion-diffs.json

# F. Gate — full feature (all chains closed)
npm run validate:motion-chains -- <id>

# G. Gate — single slice while others incomplete (pilot testing)
npm run validate:motion-chains -- <id> --chain Pricing-animation
```

#### `notes.md` reconciliation block (append per animation twin)

```markdown
### Motion extract — ProblemSection-animation
| State | nodeId | Cached | interactions out | Reference PNG |
|-------|--------|--------|------------------|---------------|
| 1 | 5164:10344 | ✓ | → 5145:4440 MOUSE_ENTER 700ms | reference-problem-animation-state-1.png |
| 2 | 5145:4440 | ✓ | → 5145:4442 AFTER_TIMEOUT 120ms | reference-problem-animation-state-2.png |
| … | … | … | … | … |
Chain status: **closed** | motion-chains built | validate:motion-chains: pass
```

#### Trigger normalization (record in motion-chains.json)

| Figma trigger | Canonical | FE event |
|---------------|-----------|----------|
| `MOUSE_ENTER` | `MOUSE_ENTER` | `onMouseEnter` on `trigger.targetTestId` |
| `ON_HOVER` | `MOUSE_ENTER` | same (hero CTA child pattern) |
| `AFTER_TIMEOUT` | `AFTER_TIMEOUT` | `runSteppedMotion` / pattern runner timers |
| `MOUSE_LEAVE` | ignored | one-way product rule — do not wire reverse |
| `ON_CLICK` / unsupported | **STOP** | report — extend catalog first |

**Web entrance triggers:** list whatever the contract/`notes.md` requires
(`hover`, `inView`, `hash`, `load`). Figma prototypes are often hover-only —
add `inView` / `hash` **only when** designer, PRD, or nav anchors demand them,
not by default on every slice.

#### Hard rules

- **BLOCK** `design-contract` / `fe-implement` if any chain `status: incomplete` (full gate).
- **Never** read or depend on `tokens/MOTION-SPEC.md` — `motion-chains.json` + `motion-diffs.json` + `motion-state-poses.json` are the agent contract.
- **Never** guess timing or which layers move — rebuild from cache only.
- Scan **subtree** `interactions[]`, not only slice-root (nested triggers).
- **Desktop motion by default** — mobile static unless `*-mobile-animation` twin exists in slice-roots.

#### Artifacts written by motion extract

```
features/<id>/figma/
├── chain-walk-report.json      # missing destinationIds per twin
├── motion-chains.json          # timing, pattern, runner, every state nodeId
├── motion-diffs.json           # per-layer Smart Animate deltas per transition
├── motion-state-poses.json     # per-state translateYpx; initialRender / poses — feed Web entrance choice
├── nodes/<every-state>.json    # one file per variant state in chain
└── reference-*-animation-state-*.png
# notes.md also requires: ### Web entrance — productIdle (staticTwin|entryPose|hidden) + source + triggers
```

### MCP driver path (Phase 2 of dual-source — when get_design_context works)

`figma-extract` is the **only** skill in the FE branch that touches the Figma
MCP routinely. Per `docs/figma-single-pass-extract-plan.md`, the MCP session is
owned by a deterministic Node client when healthy; on driver exit 2, the agent
runs the **same slice list** via MCP tools with **Timeout Split Protocol**
(above). Payloads merge into `features/<id>/figma/nodes/<nodeId>.json` — REST
geometry is kept; MCP adds `componentProperties` and Dev Mode fields.

Run the driver after REST Phase 1. It makes one `get_metadata(frame)` call for
composition geometry, then one small `get_design_context` per **slice-root**
node, writing each payload to `features/<id>/figma/nodes/<nodeId>.json`:

```bash
# 1. THE ONE MCP SESSION — resumable, timeout-safe, concurrency = 1
npm run figma:extract -- --feature <id> --frame <frame-node-id>

# 2. screenshots + assets via Figma REST (never MCP) — needs FIGMA_ACCESS_TOKEN + FIGMA_FILE_KEY
npm run figma:export-image -- --feature <id>

# 3. MANDATORY — derive spec.json from cache (same as REST path)
npm run build:spec-from-cache -- <id>

# 4. derive the composition tree from the cache (offline, 0 MCP)
npm run build:layout -- <id>
```

After either path, you still author `notes.md` and the `ui-registry` seed from
the cached `nodes/*.json` payloads — read the cache, do **not** re-call MCP.

**Shared chrome (nav / footer) is extracted once across all features** into
`features/_shared/figma/nodes/`, never per feature. When a slice-root is shared
chrome, point at the `_shared/` cache instead of re-extracting; record it in the
`component-checklist.md` row as `(shared)` so `validate:figma-extract` looks in
`features/_shared/figma/nodes/` for it.

**Freshness stamp.** The driver stamps `figmaLastModified` into `run-report.json`
and every `nodes/*.json` `$meta`. Carry the same value into `spec.json` `$meta`
and `layout.json` so `fe-implement` can detect a stale cache (Layer D, §10b) and
`figma:refresh-node` exactly the drifted node.

**Fallback (Appendix A.9):** if the desktop MCP server cannot be driven by the
out-of-process client ("get_design_context never returns" / "No session found"),
the driver exits 2. Continue dual-source with the **agent-driven Timeout Split
Protocol** — same incremental `nodes/*.json` cache, one MCP call at a time,
splitting large nodes into children until each call succeeds. Screenshots/assets
still go through `npm run figma:export-image`. **Do not skip MCP** — REST-only
handoff is blocked for new slices (see reconciliation rules above).

Outputs, under `features/<id>/figma/`:
- `nodes/<nodeId>.json` — **NEW.** The raw `get_design_context` payload per
  slice-root (the §5 cache shape: `$meta` + `raw`). This is the source of truth
  every downstream skill reads instead of re-calling MCP. Resumable: a crash
  loses at most one node.
- `layout.json` — **NEW.** The composition tree (`stack`/`grid`/`spacer`/`slot`
  + token-ref gaps + registry-slug leaves) derived offline by `build:layout`
  from the cache geometry. Regenerated each run — never hand-edited.
- `run-report.json` — **NEW.** The "MCP touched once" audit trail: every call,
  its outcome (`ok`/`cached`/`split`/`timeout`/`failed`), duration, bytes.
- `spec.json` — structured design data: the element tree; layout per container
  (direction, gap, padding, alignment); per-element measurements; the component
  states present in the design. Assembled from the `nodes/*.json` cache (not a
  separate MCP pass).
- `component-checklist.md` — **mandatory human-readable list** of every named
  element in `spec.json` that `design-contract` must document in §2 anatomy.
  Format (append a row for each named entity, hierarchically indented):
  ```
  # Figma Component Checklist — <feature-id>
  Generated from spec.json. design-contract MUST cover every row below in §2.

  ## Navigation
  - [ ] Promo Bar
  - [ ] Top Nav  (content: Welcome text · Follow Us social icons · Eng/USD dropdowns)
  - [ ] Middle Nav  (content: Logo · Search bar · Cart/Wishlist/User icons)
  - [ ] Bottom Nav  (content: All Category dropdown · Track Order · Compare · ...)

  ## Hero Widgets
  - [ ] Main Hero — Xbox Consoles
  - [ ] Small Widget 1 — Google Pixel 6 Pro
  ...
  ```
  This file is the downstream "do not miss" contract for `design-contract`.
  `validate:figma-coverage` uses `spec.json` (not this file) for machine
  enforcement, but this checklist is the human-readable companion.
- `reference-<section>.png` — one real screenshot **per in-scope section**,
  exported via Figma REST by `npm run figma:export-image` (never the full frame,
  never an MCP screenshot). These are the **real** baselines the Phase 5b visual
  diff compares the app against — a placeholder/empty PNG is a hard fail in
  `validate:figma-extract`.
- `notes.md` — anything the structured data cannot capture.
- (per asset) downloaded SVG/PNG files saved to `public/icons/` or `public/images/`
  and listed in `notes.md` under "Downloaded assets".

## HARD RULE — No prose-collapsed sections (NON-NEGOTIABLE)

This is the single most common cause of Figma components being silently missed
in contract and implementation. **It is forbidden in all circumstances.**

**Prose-collapsing** means writing a section's visual sub-elements as a single
summary string in the `content` field instead of as named objects in structured
arrays. Example:

```json
// ✗ FORBIDDEN — prose-collapsed. Sub-elements are invisible to all downstream
// tools (design-contract, validate:figma-coverage, governance-gate).
{ "name": "Newsletter", "content": "Email form with brand logos" }

// ✓ REQUIRED — structured. Every sub-element is named and discoverable.
{
  "name": "Newsletter",
  "layers": [
    { "name": "Copy Block",  "content": "Heading text · body text" },
    { "name": "Form Card",   "content": "Email input · Subscribe button + arrow icon" },
    { "name": "Divider",     "content": "Horizontal rule 424px" },
    { "name": "Brand Logos", "content": "Google · Amazon · Philips · Toshiba · Samsung (72×72, opacity-60)" }
  ]
}
```

**The rule:**
- `content` as a **string** is allowed ONLY on leaf-level entries that represent
  a single TEXT node (e.g., a label, a heading, a caption). It must be the
  literal text string the node renders, or a `·`-separated list of the text
  strings inside a simple text group.
- `content` as a **string** is FORBIDDEN on any section or sub-element that
  contains multiple visual child frames, groups, or components. Those children
  MUST be enumerated as named objects in `layers`, `widgets`, `columns`, or
  `banners`.
- After writing spec.json, run `validate:figma-coverage` — its Check 2 scans
  for prose-collapsed sections and exits non-zero if any are found. A non-zero
  exit means the extraction is incomplete and must be re-done.

**How to know which array to use:**
| Child type in Figma | Array to use in spec.json |
|---------------------|--------------------------|
| Horizontal nav tiers, stacked content rows | `layers` |
| Side-by-side widgets (hero panels, banners) | `widgets` |
| Vertical grid/table columns | `columns` |
| Promotional banners | `banners` |
| Everything else | `layers` (default) |

---

Steps:
1. Use the Figma MCP context/metadata capability (`get_design_context`,
   `get_metadata`) to read the frame's structure and measurements. Walk the
   **entire node tree recursively** — every GROUP, FRAME, COMPONENT, INSTANCE,
   VECTOR, TEXT, RECTANGLE, and ELLIPSE. Do not skip hidden layers that are
   visible in the design (check `visible !== false`).
   For every section node, walk **one level deeper** to enumerate its named
   child frames/groups. Each named child becomes a named object in the
   appropriate structured array. Never collapse children into a prose string.

   ### ⚠ LARGE FRAME / TIMEOUT PROTOCOL — mandatory when MCP exceeds limits

   Full-page Figma frames and large slice-roots (FeatureGrid, Comparison,
   Hero) routinely exceed the `get_design_context` token budget. **Do not retry
   the same node ID.** Split recursively per **Timeout Split Protocol** (Mode B
   dual-source section above).

   When the full frame OR a slice-root fails, use this four-step approach:

   **Step 1a — Get section node IDs (never omit this step)**
   Call `get_metadata` on the failing node ID. This returns direct children with
   `id` and `name` without the deep subtree. If the failing node IS the full
   frame, extract every top-level child. If a slice-root timed out, extract its
   direct children (e.g. six `FeatureCard` INSTANCEs, `FooterBar`, `header-wrap`).

   **Step 1b — Call `get_design_context` per child (smallest viable chunk)**
   For each child node ID from step 1a, call `get_design_context` with that
   child's ID — **not** the parent. If a child still times out, repeat 1a–1b on
   that child (recursive split). Minimum chunk = one named component INSTANCE
   (one card, one footer bar, one header stack). Read complete output before
   moving on. Do not batch-read multiple sections.

   **Step 1c — Build the section inventory**
   From each section's cache / `get_design_context` response, extract:
   - Every named `data-name` element and its `data-node-id`
   - **`componentProperties`** on every INSTANCE (`Size`, `Accent`, `State`, …)
   - Layout classNames / `layoutMode` (flex direction, gap, padding, alignment,
     `justify-content: space-between`)
   - Typography classNames (font size, weight, line-height)
   - Colour variables (`var(--token-name, #fallback)` — extract the token name)
   - Dimensions from `width` / `height` inline styles
   Record these as named structured objects in `spec.json` — never as prose.
   INSTANCE entries MUST include `instanceVariants` in spec.json (via
   `build:spec-from-cache` when cache has `componentProperties`).

   **nodeId is MANDATORY on every named object in spec.json.**
   Every entry in `sections[]`, `layers[]`, `widgets[]`, `columns[]`, and
   `banners[]` MUST include a `"nodeId"` field taken from the `data-node-id`
   attribute on the corresponding element in the `get_design_context` response.
   This is the key that flows downstream: spec.json → contract.md §2 → fe-implement
   per-component extraction. Without it, `design-contract` cannot write nodeIds
   into §2, and `fe-implement` cannot call `get_design_context` per component.

   Required shape for every named spec.json entry:
   ```json
   {
     "name": "ProductCard",
     "nodeId": "394:7726",
     "width": 234,
     "height": 320,
     "layout": "flex column",
     "gap": "8px",
     "padding": "15px",
     "layers": [ ... ]
   }
   ```
   An entry without `"nodeId"` is incomplete. Do not write spec.json until
   every named element has its nodeId recorded.

   **Step 1d — Screenshot each section separately**
   Call `get_screenshot` with `contentsOnly: true` on each section node for
   a cropped visual reference. Do NOT screenshot the full frame — the image
   will be too small to read or will time out. Save one PNG per section:
   `features/<id>/figma/reference-<section-name>.png`.

   After completing steps 1a–1d for all sections, proceed to step 2 with the
   complete multi-section spec data. The output spec.json must cover every
   section; a section present in step 1a but absent from spec.json is a
   hard error — return to step 1b for that section before writing any outputs.
2. Use the Figma MCP screenshot capability (`get_screenshot`) to export
   `reference.png` at the frame's native resolution (2× if possible).
3. **Token mapping — exact, not approximate (NON-NEGOTIABLE).**
   For **every** measurement in the frame, map it to the **exact** matching
   semantic token from `reports/tokens-report.md`:
   - A match is exact when the token's resolved px value equals the Figma
     measurement to within 1px (floating-point rounding only).
   - **"Nearest token" is forbidden.** Never write a token whose resolved
     value differs from the Figma measurement. If `space.md = 16px` and
     Figma shows 20px, `space.md` is NOT a valid mapping — it is an
     approximation and will cause visual drift.
   - **Reusing old section / prior-feature token names is forbidden** when
     their resolved value ≠ this frame's Figma value. Same name is OK only
     on exact value match.
   - Prefer REST `boundVariables` / VariableID resolution when present; still
     verify the resolved CSS/px/hex equals Figma before accepting the bind.
   - For colours: the exact Figma colour hex must match the token's resolved
   hex exactly. No "visually close" substitutions.
   - Record in `notes.md` under "Token mapping" a table:
     `| Node path | Property | Figma value | Token used | Resolved value | Exact? |`
     Every row must have Exact? = YES.
   - **If ANY measurement has no exact matching token — STOP immediately.**
     Do not proceed to write outputs or advance to `design-contract` or
     `ui-registry-build`.
     Instead, produce a **Missing Tokens Action Report** in
     `features/<id>/figma/missing-tokens-report.md` using this format:

     ```
     # Missing Tokens — <feature id>
     Generated: <date>
     
     The following Figma measurements have no exact matching design token.
     The design system must be extended before this feature can be contracted.
     
     ## Action required (designer)
     
     For each row below, add the listed token to `tokens/semantics.json`
     (or `tokens/primitives.json` for a new scale step) via the
     **design-tokens** skill (extend from this report — exact Figma value
     only; never nearest), then run:
         npm run tokens:validate
         npm run tokens:validate-figma-alignment
         npm run tokens:build
     Once all rows are resolved, re-run **ui-registry-build** (not contract)
     so `$tokens` bind only after `tokens:build` PASS. Re-run figma-extract
     token-mapping notes if measurements changed.
     
     | # | Node path | Property | Figma value | Closest existing token | Closest resolved value | Recommended new token |
     |---|-----------|----------|-------------|------------------------|------------------------|-----------------------|
     | 1 | Footer/Col1 | gap | 20px | space.md | 16px | space.lg-alt = 20px |
     ...
     
     ## How to allow raw values (last resort)
     
     If the designer confirms these values are intentional one-offs and should
     NOT be added to the token system, a human may unblock the pipeline by
     setting in `features/backlog.yaml` for this feature:
         allow_raw_values: true
     
     This flag is a deliberate human override. It allows `design-contract`
     and `feature-implement` to proceed with `allow-raw` annotations for
     these exact values. The governance gate will verify every `allow-raw`
     comment matches this report.
     ```

     Then output to the user:
     ```
     ⚠ MISSING TOKENS — pipeline blocked

     <N> Figma measurement(s) in frame "<frame name>" have no exact design token:
       • <Node path>: <property> = <value> (closest: <token> = <resolved>)
       ...

     The design system is incomplete for this feature.

     Designer action: open features/<id>/figma/missing-tokens-report.md
     and run design-tokens to add the listed **exact** primitive + semantic
     tokens (never nearest/old section tokens), then:
       npm run tokens:build
       /ui-registry-build (bind $tokens only after build PASS)
       /figma-extract only if measurements need refresh

     To skip token addition and allow raw values instead (last resort):
       Set  allow_raw_values: true  in the feature's backlog.yaml entry.
       A human must set this flag — Claude Code will not set it automatically.
     ```
     **Do not write `spec.json`, `reference.png`, or `notes.md` until all
     tokens are resolved OR `allow_raw_values: true` is set in backlog.yaml.**
     If `allow_raw_values: true` is already set, proceed — record all
     unmapped measurements in `notes.md` under "Missing tokens (allow-raw
     approved)" with their exact Figma values, then continue to step 4.
4. **Download ALL visual assets — exhaustive scan (NON-NEGOTIABLE).**
   Scan the entire node tree from step 1. For every node of type IMAGE, VECTOR,
   COMPONENT, INSTANCE, or RECTANGLE-with-image-fill that represents a visual
   asset rendered in the final UI:
   - **Icons and SVG assets** (VECTOR, icon components, decorative graphics):
     Export as SVG via Figma REST API:
     `GET /v1/images/{file_key}?ids={node_id}&format=svg&svg_include_id=true`
     Save to `public/icons/<descriptive-name>.svg`.
   - **Photos and raster images** (RECTANGLE with image fill, product photos,
     hero images, banners):
     Export as PNG at 2× scale:
     `GET /v1/images/{file_key}?ids={node_id}&format=png&scale=2`
     Save to `public/images/<descriptive-name>.png` or `.jpg`.
   - **Brand marks, logos, badges** (App Store, Google Play, payment icons,
     social media icons, brand logos):
     Export as SVG. If rasterised, export as PNG at 2×.
     Save to `public/icons/` with a prefix matching the brand:
     `badge-google-play.svg`, `icon-visa.svg`, `logo-clicon.svg`.
   - **Naming convention:** kebab-case, descriptive, unique.
     `icon-truck.svg`, `icon-return-arrow.svg`, `badge-google-play.svg`,
     `hero-xbox-controller.png`. Never `node_123456.png`.
   - **Never substitute.** The following are all forbidden regardless of
     difficulty:
     - Unicode emoji or symbol characters (`🍎`, `★`, `✕`, `▶`, `→`)
     - Text labels in place of image files (`<span>Google Play</span>`)
     - Hand-coded SVG paths approximating a brand icon (the real SVG from
       Figma is always authoritative)
     - Colored `<div>` CSS shapes in place of a logo
     - Next.js `<Image>` pointing to a placeholder or missing file
   - **STOP** if any export call fails. Report the node ID, node name, and
     HTTP error. Do not use a substitute. Wait for the user to resolve the
     issue (e.g. access a shared library, grant API token scope).
   - Record every asset in `notes.md` under "Downloaded assets":
     ```
     | Node ID | Node name | Type | File saved | Dimensions |
     ```
   - If a node cannot be exported for a legitimate technical reason (master
     in inaccessible shared library, protected file), record it under
     "Assets requiring manual download" with instructions for the user.
     **STOP immediately** if this section is non-empty — do not proceed to
     `design-contract`.
5. **Verify completeness before writing outputs.**
   After downloading, re-read the node tree and the "Downloaded assets" table
   side by side. Every visual asset node must have an entry. If any visual
   asset node has no corresponding entry → the scan was incomplete → repeat
   step 4 for the missing nodes.
   Run `ls public/icons/ public/images/` and confirm every listed path exists.
   Any listed path that does not exist on disk → re-download before continuing.

5a. **Write `features/<id>/figma/asset-manifest.json` (MANDATORY).**
    After completing step 5, write a machine-readable manifest of every visual
    asset found in the frame. This file is the bridge between Figma extraction
    and the filesystem verification that runs at the governance gate.

    Format:
    ```json
    {
      "$meta": {
        "feature": "<id>",
        "frame": "<node-id>",
        "generatedAt": "<YYYY-MM-DD>"
      },
      "assets": [
        {
          "nodeId":     "<figma-node-id>",
          "nodeName":   "<human-readable name from Figma>",
          "figmaUrl":   "<http://localhost:3845/assets/... or REST API URL>",
          "localPath":  "public/icons/<name>.svg",
          "type":       "svg | png | jpg",
          "dataSource": "static | dynamic"
        }
      ]
    }
    ```

    `dataSource` rules:
    - `"static"` — the exact Figma asset is always rendered (logos, icons,
      badges, payment marks, app-store badges, decorative illustrations).
      `validate:assets` will verify these files exist on disk.
    - `"dynamic"` — the asset comes from a database / API at runtime (product
      photos, user avatars, category images). The Figma value is an example
      only. `validate:assets` skips these — they are listed so the contract
      knows what content type to expect at each location.

    **After writing the manifest, run the mandatory checkpoint:**

    > ### ✦ MANDATORY CHECKPOINT — Asset files on disk
    > **Run this Bash command now as a tool call. Do not hand off to
    > design-contract until it exits 0.**
    > ```bash
    > npm run validate:assets -- <id>
    > ```
    > Reads `asset-manifest.json` and verifies every static asset exists on
    > disk and is non-empty.
    >
    > | Exit code | Action |
    > |-----------|--------|
    > | **0** | All static assets confirmed — proceed to step 6 |
    > | **1 (missing/empty files)** | **STOP.** Re-download the flagged assets using the `figmaUrl` from the manifest, then re-run. Do not proceed to step 6. |
    > | **2 (no manifest)** | The manifest was not written — write it now, then re-run. |

6. **Populate `tokens/ui-registry.json`** with any new screens or components
   the frame introduces. See "UI registry — sibling contract" below for the
   shape and rules. The component states observed in step 1 become each
   entry's `$states` array. Re-run `npm run ui-registry:build` so the
   test-id constants in `tokens/build/test-ids.ts` and the glossary in
   `reports/ui-registry-glossary.md` are refreshed before the next skill
   consumes them. These paths flow downstream:
   - `design-contract` lists them in its §1a "UI registry entries"
     section (the contract's testable surface).
   - `feature-implement` renders `data-testid={ids.<path>}` on the
     corresponding element using the typed accessor.
   - `bdd-scaffold` selects elements by `getByTestId(ids.<path>)` in
     step definitions.
   - `governance-gate` runs `ui-registry:check-sync` to require that
     every path you register here is actually rendered by the end of
     implementation.
7. **Generate `component-checklist.md` (MANDATORY — do as a file write, not
   a note to self).** After walking the full node tree, write
   `features/<id>/figma/component-checklist.md` enumerating every named
   section and sub-element. Format:
   ```markdown
   # Figma Component Checklist — <feature-id>
   Auto-generated by figma-extract. design-contract MUST document every row
   below in §2 anatomy. validate:figma-coverage enforces this mechanically.

   ## <Section Name>  (nodeId: 391:6653)
   - [ ] <Layer/Widget/Column/Banner name>  (nodeId: 394:7726)  (content: "<content string verbatim>")
   ...
   ```
   Include every entry from `spec.json`'s `sections[].name`,
   `sections[].layers[].name`, `sections[].widgets[].name`,
   `sections[].columns[].name`, `sections[].banners[].name`.
   **Every checklist row MUST include `(nodeId: X:Y)` — this is what
   `design-contract` copies into §2 anatomy and what `fe-implement` uses to
   call `get_design_context` per component. A checklist row without a nodeId
   is incomplete and will cause drift during implementation.**
   For layers/widgets with a `content` field, quote it verbatim — this makes
   interactive sub-elements (dropdowns, buttons listed in content strings)
   explicit and uncollapsible for `design-contract`.

   After writing the file, print its full contents to the user output so the
   list is visible and cannot be silently skipped downstream. End with:

   > ⚠ design-contract MUST cover every unchecked item above.
   > `npm run validate:figma-coverage -- <id>` will enforce this mechanically.

8. Write the remaining output files under `features/<id>/figma/`
   (`spec.json`, `reference.png`, `notes.md`, `motion-spec.json` when Track B applies).

   If the feature has animation twins, also ensure Track A artifacts exist before handoff:
   `chain-walk-report.json`, `motion-chains.json`, `motion-diffs.json`, `motion-state-poses.json`.

9. **Self-validate spec.json before handing off — run now as a Bash tool call:**

   > ### ✦ MANDATORY CHECKPOINT — Prose-collapse detection
   > **Run this Bash command now. Do not hand off to design-contract until it exits 0.**
   > ```bash
   > npm run validate:figma-coverage -- <id>
   > ```
   > Check 2 of this script scans spec.json for prose-collapsed sections — sections
   > where visual sub-elements were collapsed into a `content` string instead of
   > being written as named objects in `layers`/`widgets`/`columns`/`banners`.
   >
   > | Exit code | Action |
   > |-----------|--------|
   > | **0** | spec.json is structurally sound — hand off to design-contract |
   > | **non-zero** | **STOP.** Every flagged section in the output must be re-walked in Figma. Enumerate each named child frame/group as a structured entry in the correct array. Then re-write spec.json, regenerate component-checklist.md (step 7), and re-run this command. Do not proceed to design-contract with prose-collapsed sections. |

   Note: contract.md does not exist yet at this stage, so Check 1 (named-entity
   coverage) will not run — only Check 2 (prose-collapse) fires here. That is
   the correct and expected behaviour.

10. **Validate the cache + composition tree — run now as Bash tool calls.**

   > ### ✦ MANDATORY CHECKPOINT — Extraction cache + layout + motion
   > **Run these now. Do not hand off to `ui-registry-build` / `design-contract`
   > until all exit 0.**
   > ```bash
   > npm run build:spec-from-cache -- <id>   # derive spec.json + checklist from nodes/*.json (mandatory after REST or MCP extract)
   > npm run validate:figma-extract -- <id>    # every checklist nodeId has a nodes/*.json (or _shared) cache; no placeholder reference.png; figmaLastModified consistent
   > npm run build:layout         -- <id>      # (re)derive layout.json from the cache, offline
   > npm run validate:layout      -- <id>      # every leaf slug resolves in ui-registry; every gap/padding is a token; only allowed node types/hints
   > npm run validate:motion-chains -- <id>   # when *-animation twins exist: all chains closed (Track A)
   > npm run validate:motion-spec -- <id>      # when motion-spec.json exists: variants + keyframes present (Track B)
   > ```
   >
   > | Exit code | Action |
   > |-----------|--------|
   > | **0** | The on-disk extraction is complete and the composition tree is valid — downstream skills can read disk-only (0 MCP). |
   > | **non-zero** | **STOP.** `validate:figma-extract` names the uncovered nodeIds — `figma:refresh-node` each (or point it at `_shared/`). `validate:layout` names bad slugs / raw-px gaps — fix `ui-registry` `$figmaNode` bindings or the spacing token, then re-run `build:layout`. |

---

## Mode C — `all-frames`  (bulk extraction of every frame in a file)

Use when the user wants to extract all frames from a Figma file at once, audit
what was missed, or ensure complete coverage before a full re-implementation.

Inputs: a Figma file key (e.g. `XZYoUnFtfWZJQJIJUIvqHs`).

Outputs:
- One set of `spec.json` + `reference.png` + `notes.md` per top-level frame,
  written to `features/<frame-slug>/figma/`.
- A `reports/figma-all-frames.md` coverage report listing every frame, its
  node ID, and extraction status (complete / partial / failed).

Steps:
1. Use `get_metadata` or equivalent to list every top-level FRAME in the file.
   Record the frame name, node ID, and approximate dimensions.
2. For each frame (process sequentially — one at a time to avoid MCP timeouts):
   a. Run Mode B steps 1–7 for that frame, writing outputs to
      `features/<slug>/figma/` where `<slug>` is the kebab-case frame name
      (e.g. `01-homepage`, `07-shop-page`, `15-checkout-form`).
   b. On any failure (MCP timeout, export error, missing asset), record the
      error in `reports/figma-all-frames.md` and continue to the next frame.
      Do not stop the entire run for a single frame failure.
3. Write `reports/figma-all-frames.md`:
   ```
   | Frame | Node ID | Status | Assets downloaded | Missing tokens | Notes |
   ```
4. Report summary to the user: total frames, successfully extracted, partially
   extracted (missing assets), failed.

**Hard limit:** Never process more than one frame per MCP call. If a frame's
node tree is very large (> 500 nodes), split it into sections and extract each
section separately, merging results into a single `spec.json`.

**Asset extraction honesty rules:**
- If the Figma file uses a node type of `RECTANGLE` with an image fill
  (a rasterised photo), export it as PNG at 2× scale.
- If a node is a component instance whose master is in a shared library
  file you cannot access, note it and ask the user for the SVG/PNG export.
- `notes.md` must list every visual element in the frame and explicitly say
  either "downloaded → public/..." or "not exportable — reason".
- `design-contract` (downstream) MUST reference the actual file paths, not
  describe icons in words. If no asset path is listed in `notes.md`, the
  contract cannot be written and `design-contract` must stop and report.

---

## UI registry — sibling contract

Beside the DTCG token files (`tokens/primitives.json`, `tokens/semantics.json`,
`tokens/typography.json`) lives **`tokens/ui-registry.json`** — the
versioned source of truth for **screen** and **component** paths used in
Gherkin scenarios. It is specified by
`tokens/templates/PRD-Executable-Requirements-Gherkin-Component-Paths.docx.md`.

**Why a sibling, not a token group:** a design token resolves to a *value*
(a colour, a number) and is processed by Style Dictionary. A component path
resolves to an *identity* (a thing with structure and states) — it is not a
value. Same path-as-contract discipline, different storage.

### Shape (PRD §4.2)

```json
{
  "$metadata": { "version": "x.y.z", "description": "...", "owner": "..." },
  "screen": {
    "<feature>": {
      "<screenKey>": { "$description": "..." }
    }
  },
  "component": {
    "<feature>": {
      "<screenKey>": {
        "<componentKey>": {
          "$description": "...",
          "$screen": "screen.<feature>.<screenKey>",
          "$states": ["default", "disabled", "loading"]
        }
      }
    }
  }
}
```

### Grammar (PRD §4.1, enforced by `npm run ui-registry:validate`)

```
<path>    ::= <domain> "." <segment> ( "." <segment> )+
<domain>  ::= "screen" | "component"
<segment> ::= [a-z][a-zA-Z0-9]*                 # lowerCamelCase, no underscores/dashes
```

Other validator rules: every leaf needs a `$description`; every component
`$screen` must resolve to a registered screen path; `$states` must be a
non-empty array of distinct lowerCamelCase strings.

### Build artifacts

`npm run ui-registry:build` emits:
- `tokens/build/test-ids.ts` — `testIds` (flat path→id map) and `ids` (nested
  tree). Component code imports these and renders them on the real element
  (`data-testid={ids.component.checkout.cart.checkoutButton}`).
- `reports/ui-registry-glossary.md` — human-readable table of every screen
  and component with description, parent screen, states, and generated
  test-id.

### Authoring contract

- **Never delete a registered path** without checking call sites. The path
  is a contract — Gherkin scenarios, tests, and component code reference it.
  Deprecate via `$deprecated: true` (future) before removal.
- **Do not write test-ids by hand.** They are derived from the path
  (dots → dashes). Always import from `tokens/build/test-ids.ts`.
- **When a feature is approved**, the example seeds (`[EXAMPLE] …` paths
  under `screen.checkout.*` and `component.checkout.*`) should be deleted
  once the registry has real entries — they exist only to keep the pipeline
  emitting non-trivial output during the PoC.

## Success criteria
- Mode B: `spec.json`, `notes.md`, `component-checklist.md`, and the
  `nodes/<nodeId>.json` cache (one per slice-root, or a `_shared/` pointer) all
  exist under `features/<id>/figma/`; `layout.json` and `run-report.json` are
  written; `reference-<section>.png` are **real** REST exports (not placeholders);
  **`notes.md` includes Dual-source reconciliation table** with REST ✓ MCP ✓;
  **every INSTANCE of a component set in checklist shows `(variants: …)`** when
  Figma uses variants; and `validate:figma-extract`, `build:layout`,
  `validate:layout` all exit 0.
- **Motion (when `*-animation` in slice-roots):** `chain-walk-report.json`,
  `motion-chains.json`, `motion-diffs.json` exist; **every chain state** has
  `nodes/<state-nodeId>.json` on disk; `notes.md` has per-twin motion
  reconciliation tables; `validate:motion-chains` exits 0 before downstream skills.
  See `docs/motion-guideline.md`.

## Failure handling
If the Figma MCP is unavailable, or the file/frame URL is wrong, **stop and
report**. Do not invent measurements, tokens, or images.

## Downstream order (NON-NEGOTIABLE)

After a successful slice extract (or after resolving missing tokens):

1. **Exact token or new token** — never nearest / old wrong-value names
2. **`design-tokens`** → `npm run tokens:build` → `tokens-report.md` PASS
3. **`ui-registry-build`** → bind `$tokens` (enrich from `boundVariables` when
   available; still verify resolved value = Figma)
4. **`registry-validate`** — `tokenMissing` is blocking
5. **`design-contract`** then **`fe-implement`**

Do **not** run `ui-registry-build` / `design-contract` / `fe-implement` while
`missing-tokens-report.md` has unresolved rows (unless `allow_raw_values: true`).

## Step final — Commit (mandatory)

After success criteria pass, on `feature/<fe-jira-id>` (create via `design-contract`
if this is the first FE skill and branch does not exist yet — see `design-contract`
Step 0):

```bash
git add features/<id>/figma/ features/<id>/memory.md
git commit -m "chore(<id>): figma-extract <slice-name or feature>"
```

See `skills/_shared/pipeline-git-commit.md` for branch rules. Do not leave extract
artifacts uncommitted.
