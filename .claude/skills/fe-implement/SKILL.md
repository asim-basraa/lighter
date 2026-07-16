---
name: fe-implement
description: >-
  Implement the FE feature by reading the FE contract (contract.md), Figma
  frame data, @fe Gherkins, and the published OpenAPI spec from BE. Uses
  speckit internally — one task per @fe scenario, component by component.
  Figma is the visual reference; contract.md is the boundary; OpenAPI is the
  data contract. Run only after BE ticket is be-implemented. After each
  vertical slice (GitHub issue), STOP for mandatory human review before
  memory, commit, or the next slice.
---

# fe-implement

Implements the FE feature — React components, pages, and API integration —
using the FE contract as the build checklist and Figma as the visual reference.
BE must be fully implemented and the OpenAPI spec published before this starts.

## Inputs
- `features/<fe-jira-id>/contract.md` — FE implementation boundary
- `features/<fe-jira-id>/figma/nodes/<nodeId>.json` — the cached
  `get_design_context` payloads (exact values per slice-root + leaves). **Read
  these instead of calling the Figma MCP.**
- `features/<fe-jira-id>/figma/layout.json` — the composition tree (where each
  component sits on the page)
- `features/<fe-jira-id>/figma/` — `spec.json`, `reference-<section>.png`,
  `reference-*-animation-state-*.png` (per-state motion baselines),
  `asset-manifest.json`, `run-report.json`
- `features/<fe-jira-id>/figma/motion-chains.json` — timing, pattern, runner,
  every chain state (when feature has animation twins)
- `features/<fe-jira-id>/figma/motion-diffs.json` — per-layer Smart Animate
  deltas per transition (when feature has animation twins)
- `features/<fe-jira-id>/figma/motion-spec.json` — when present (Track B):
  keyframe targets + designer-confirmed timing per `componentPath`
- `features/<parent-id>/<parent-id>.feature` (`@fe` scenarios only)
- `docs/openapi/paths/<be-jira-id>.yaml` — the published BE API contract
- `tokens/ui-registry.json` — component paths and token bindings
- `reports/tokens-report.md` — allowed token vocabulary
- `features/<parent-id>/memory.md`

## Smart zone check (run before anything else)

Count the `@fe` scenarios in the feature file:
```bash
grep -c "^\s*@fe" features/<parent-id>/<parent-id>.feature
```

- **≤ 10 scenarios** → proceed normally.
- **11–20 scenarios** → warn: _"⚠️ This feature has N @fe scenarios — you may hit the smart zone limit mid-run. Consider starting a fresh chat for each group of ~10 scenarios, or split the feature further with `/to-issues`."_ Then ask: _"Continue in this chat or split first?"_
- **> 20 scenarios** → warn strongly: _"⚠️ This feature has N @fe scenarios — too large for reliable output in one context window. Recommended: split the feature using `/to-issues` into smaller slices, then implement each slice in a fresh chat. Continue anyway?"_ Wait for the user to decide.

Each scenario = one component task. Never implement more than one component per task pass.

## Pre-flight checks (mandatory before any code)

Before writing a single line of UI code:

1. Confirm BE ticket is `be-implemented` in memory. If not, stop — FE
   cannot start until BE is complete.
2. Verify `features/<fe-jira-id>/contract.md` exists and both
   `validate:figma-coverage` and `validate:contract` passed.
3. Verify the extraction cache exists: `features/<fe-jira-id>/figma/nodes/`
   has at least one `<nodeId>.json`, `layout.json` is present, and a real
   `reference-<section>.png` exists. If the cache is absent, the feature was not
   extracted — run `figma-extract` (which runs the single-session driver) first.
   `npm run validate:figma-extract -- <fe-jira-id>` must exit 0.
4. Read `contract.md` §2 anatomy completely — build a checklist of every
   named element. Every element in §2 must be rendered. No gaps.
5. **Verify every named component in §2 has a nodeId.** Scan every anatomy
   line that carries a `[component.*]` tag. Each one must have `(nodeId X:Y)`
   beside its name. If any nodeId is missing → **STOP**. Do not implement.
   Report which components lack nodeIds and instruct the user to re-run
   `design-contract` (which will trigger `figma-extract` to backfill them).
   A missing nodeId means per-component Figma extraction cannot run, which
   means implementation will produce drift from the Figma design.

## Procedure

### Step 0 — Validate feature branch
```bash
git rev-parse --abbrev-ref HEAD
```
Must equal `feature/<fe-jira-id>`. If it is `main` or anything else, stop:
> "Wrong branch. Switch with: `git checkout feature/<fe-jira-id>`"
> `design-contract` creates the branch — if it does not exist yet, that skill must run first.

### Step 1 — Read all inputs
Read these completely before writing any code (all on disk — 0 MCP):
1. `contract.md` — full component anatomy, layout, tokens, states, API bindings
2. `figma/nodes/<nodeId>.json` — the cached exact values per slice-root/leaf
3. `figma/layout.json` — the composition tree (where each component sits)
4. `figma/reference-<section>.png` — open and keep as visual reference throughout
5. `figma/spec.json` — exact measurements, colours, spacing, **`instanceVariants`**
   per INSTANCE (+ `$meta.figmaLastModified` for the freshness check)
6. `figma/component-checklist.md` — confirm `(variants: …)` on every component-set
   INSTANCE; if missing → STOP, re-run `/figma-extract` MCP gap-fill
7. `docs/openapi/paths/<be-jira-id>.yaml` — know every endpoint and response field
8. `tokens-report.md` — know which token names to use

### Step 2 — Plan with speckit
Run `speckit-plan` with:
- `@fe` Gherkin scenarios as the task source
- FE contract as the context document
- Output: one task per `@fe` scenario

Task naming: `fe-<component-slug>-<scenario-slug>`
Example: `fe-feedback-form-happy-path`, `fe-feedback-form-empty-state`

### Step 3 — Create task list
Run `speckit-tasks`. Each task must state:
- Which component it builds
- Which `@fe` scenario it covers
- Which `contract.md` anatomy sections it implements
- Which API field bindings apply

### Step 4 — Implement component by component
Run `speckit-implement` one task at a time.

**⚠ MANDATORY: Per-component design-data gate — CACHE-FIRST (runs before writing any code for each component)**

This is a hard gate. It runs once per component, in order, before the first line
of code for that component is written. It is not optional and cannot be deferred.

**The data already exists on disk.** `figma-extract` ran the single MCP session
for this feature and wrote the recursive `get_design_context` payload for every
slice-root to `features/<fe-jira-id>/figma/nodes/<nodeId>.json` (the §5 cache).
That payload contains the exact values (px, colour, typography, token bindings)
for the slice-root **and all its leaves**. `fe-implement` reads that cache — it
does **NOT** re-call the Figma MCP per component (that duplication is exactly
what this plan removed; see `docs/figma-single-pass-extract-plan.md` §6).

```
FOR EACH component in the current slice/task:
  1. Read the component's nodeId from contract.md §2
     (format: `ComponentName  (nodeId X:Y, WxH)  [component.*]`)
  2. Read the cache, NO MCP:
       features/<fe-jira-id>/figma/nodes/<nodeId>.json  (or its slice-root's
       file — the recursive payload contains this node's leaf values), or the
       features/_shared/figma/nodes/<nodeId>.json pointer for shared chrome.
     - if present AND its $meta.figmaLastModified matches spec.json $meta
       → use it. This is the normal path → 0 MCP calls.
     - if MISSING or STALE (figmaLastModified differs) → refresh ONLY that node:
         npm run figma:refresh-node -- --feature <fe-jira-id> --refresh-node <nodeId>
       then read the rewritten cache file. (This is the only path that touches
       MCP, and only for a genuinely missing/changed node.)
  3. From the cached payload, record EVERY value before opening any .tsx file:
       - Exact px dimensions (width, height)
       - Exact padding, gap, margin values
       - Font size, weight, line-height per text element
       - Color token for every fill, stroke, background
       - Border width, border-radius / shadow tokens
       - Icon sizes and exact SVG asset URLs
       - **Figma INSTANCE `componentProperties`** (e.g. `Size: Wide`,
         `Accent: Navy`) — one record per card/row, not one value for all
       - **Container `layout.direction` / `justify` / `align`** for footers,
         grids, and header stacks (from `spec.json` or cache)
  4. Read layout.json to know WHERE this component sits on the page
     (its slot in the composition tree) so a stub/replace slice drops the real
     component into a known position — do not re-derive page composition.
  5. Map every recorded value to its exact design token from tokens-report.md
     (and registry `$tokens` for this component). Resolved value must equal
     Figma (within 1px / exact hex). **Never** use a nearest or prior-slice
     token whose value differs — that is a fidelity bug.
     If ANY value has no exact token match → STOP. Follow the missing-tokens
     protocol: `design-tokens` adds primitive + semantic → `tokens:build` →
     `ui-registry-build` rebinds `$tokens` → then resume implement.
     Do not approximate. Do not proceed to code with wrong tokens.
  6. **Motion (dual track — use A when available, else B):**
     - **Track A (primary):** closed chain in `motion-chains.json` for this slice
       → follow "Motion implementation" checklist below (runners, helpers, fixtures).
     - **Track B (supplementary):** no closed chain but `motion-spec.json` +
       contract §5b defines this `componentPath` → implement keyframes using
       `timing.durationToken` / `easingToken` (or confirmed `durationMs` when
       `designerConfirmed: true`); honour `implementation.reducedMotion` via
       `prefers-reduced-motion`; BDD asserts outcome not ms timing.
     - **Both present:** Track A is authoritative for code; §5b is designer timing
       reference only — do not contradict closed chain diffs.
  7. ONLY after steps 1–6 are complete → open the .tsx file and implement

  BLOCK conditions (do not write code if any apply):
  - nodeId is missing from contract.md §2 → re-run design-contract
  - the cache file is missing AND figma:refresh-node cannot fetch it → STOP,
    report to user (the feature was not fully extracted; re-run figma-extract)
  - A measurement has no exact token and allow_raw_values is not set → STOP
  - Registry entry for this slice has `tokenMissing: true` → STOP; run
    design-tokens (exact new tokens) → tokens:build → ui-registry-build first
  - Any `$tokens` bind whose resolved value ≠ Figma (nearest/old reuse) → STOP;
    same fix path as missing tokens
  - **INSTANCE `componentProperties` missing** for a named component set card
    (FeatureCard, AccentBar, etc.) in cache → STOP; re-run `/figma-extract`
    MCP gap-fill with Timeout Split on that slice-root — do not guess variants
  - **Variant matrix row count ≠ implementation card count** → STOP; fix contract
    or re-extract before coding
```

**Why cache-first is correct:** the cache is a verified-fresh snapshot, not a
guess. `figma-extract` captured the exact recursive payload once; the
`figmaLastModified` stamp makes staleness explicit, and `figma:refresh-node`
re-fetches exactly the one node that drifted. So you keep live-Figma correctness
without the ~26 duplicate calls. If contract.md §2/§3/§4 and the cached payload
disagree on a value, **the cached Figma value wins** — implement from cache and
update the contract to match. Never extract the full frame; never loop
`get_design_context` per component.

**Anti-pattern: sibling-section cloning (BLOCKER).**
Do **not** implement the current slice by copying layout, class strings, or
motion logic from another landing section (Problem, Comparison, How-it-works,
etc.) without re-reading **this** slice's cache and `reference-<section>.png`.
Prior sections are reference for *code patterns* (hooks, test-id wiring), not
for dimensions, footer direction, accent colours, or card sizes. If you catch
yourself reusing `max-w-[424px]`, a shared accent-bar colour, or a centered
footer column from a sibling → stop and read the Feature grid (or current
slice) cache first.

**Motion implementation (animated desktop slices only).** Two tracks may coexist;
**Track A (`motion-chains.json`) wins when a closed chain exists.** Track B
(`motion-spec.json` + contract §5b) applies when no closed chain covers this
component. Authoritative docs: `docs/motion-guideline.md` (Track A) ·
`docs/motion-pipeline-plan.md` step 17 · project `motion-spec` templates (Track B).

**Pre-code motion checklist (write in chat before opening `.tsx` for this slice):**
```
□ Identify track: closed motion-chains chain? → Track A. Else motion-spec §5b? → Track B
□ Do NOT read tokens/MOTION-SPEC.md
□ Track A — motion-chains.json — chain for this slice: status "closed" (or subgraph closed)
□ Track A — motion-diffs.json — all diffs for this chain / subgraphId
□ Track A — motion-state-poses.json — per-state translateYpx; initialRender = qaIdle hint only
□ Contract / notes.md **Web entrance** row: productIdle + qaIdle + source + triggers
□ Track A — Every transition: trigger, delayMs, durationToken, easingToken from motion-chains
□ Track B — motion-spec.json entry for this componentPath; duration/easing from confirmed timing
□ Every moving layer: testId in ui-registry.json (component.*.motion.*)
□ Custom translateY px (custom: true) → constants/motion.constants.ts only — never inline in TSX
□ Production idle = contract productIdle exactly (staticTwin | entryPose | hidden) — do not invent empty states
□ If productIdle ≠ qaIdle: gate qaIdle behind NEXT_PUBLIC_E2E_MODE=1 (isStaticTwinIdleMode / equivalent)
□ Wire triggers listed in contract only (hover / inView / hash / load) — no extras
□ Staged-sequence timing: cumulative duration+delay between steps — not delay × stepIndex
□ If any state node missing from nodes/ → figma:refresh-node before coding
□ contract.md **Motion** + **Web entrance** match notes / motion-chains (Track A) OR §5b (Track B)
□ Bind each motion-diffs row → helper + data-testid — not sibling TSX
□ gifRef ambient → asset-manifest path + <Image unoptimized /> — no hover handler
□ reference-*-animation-state-*.png available for Step 7 spot-check
□ prefers-reduced-motion: show terminal state, skip runner (when useReducedMotion exists)
```

**Idle flexibility (BLOCKER if wrong for *this* contract):** Implement the
**signed Web entrance row**, not a global “always hide” or “always staticTwin”
habit. If `productIdle: staticTwin`, first paint is finished layout (no empty
frame). If `entryPose` / `hidden`, do not flash the finished twin then snap.
If the row is missing or ambiguous → STOP and ask design — do not guess.
Designers are **not** required to use our variable names; FE only reads the
canonical contract enums after extract mapped their intent
(`/figma-extract` flexible naming). Do not fail implement because Figma used
`firstPaint` / prose instead of `productIdle`.

**Pattern → code (mechanical — from `motion-chains.json` `pattern` field):**

| `pattern` | Runner / wiring |
|-----------|-----------------|
| `simple-one-step` | `useOneWayMotion(() => setRevealed(true))` + `getMotionRevealStyle` / slide helpers from diffs |
| `rapid-four-step` | `useOneWayMotion(() => runRapidFourStepMotion([...]))` — step callbacks from motion-diffs `stepIndex` |
| `staged-sequence` | `useOneWayMotion(() => runHeroMotion(...))` or `runFeatureGridMotion(...)` per chain `runner` |
| `ambient-gif` | `<Image unoptimized src={…} />` — no `useOneWayMotion` |
| `custom` | Read full subgraph in motion-chains + step table in contract.md; **human APPROVE** before coding |

**Hybrid sections:** when one slice has multiple `chains[]` with different
`subgraphId` (e.g. SocialProof integrations + carousel), wire each subgraph
independently — do not collapse into one pattern.

**Token discipline for motion:** never emit `translateY(${fromPx}px)` or raw
`700ms` from diffs in TSX — use mapped `token` → `var(--spacing-*)` /
`var(--motion-duration-*)` or helpers in `constants/motion.constants.ts`.
When `motion-diffs` marks `custom: true` (no spacing token for 370/284 etc.),
define named constants in `motion.constants.ts` sourced from `motion-state-poses.json`.

**Step 7 motion review (mandatory for animated slices):** after automated gates,
review against the **contract Web entrance** (not a global preference):
1. **Production path:** reload → first paint matches `productIdle`
   (`staticTwin` = visible finished layout / no empty; `entryPose` / `hidden` =
   no finished-twin flash). Confirm listed triggers fire the chain.
2. **QA path** (when `productIdle ≠ qaIdle`): with `NEXT_PUBLIC_E2E_MODE=1`,
   pre-hover matches `qaIdle` (usually static twin); then hover and compare
   end-state to `reference-<slug>-animation-state-terminal.png`.
For multi-step patterns, spot-check intermediate `reference-*-animation-state-N.png`
if the cascade looks wrong. Static `test:visual` screenshots prove layout /
qaIdle only — APPROVE only if production matches the contracted `productIdle`.

**Violation routing (motion):** wrong timing, pattern, or layer binding →
`/figma-extract` chain walk + `build:motion-from-cache`, not ad-hoc CSS.
Wrong Motion block → `/design-contract`. Missing motion testId →
`/ui-registry-build` → `/registry-validate` then rebuild diffs.

**Pre-code variant checklist (write in chat before opening `.tsx`):**
For each repeated Figma component (FeatureCard, AccentBar, SectionPill, etc.):
```
| nodeId | Size variant | Accent/colour variant | WxH | padding |
```
If every row in the table is identical, one implementation class is fine.
If any column differs → per-instance props in `constants/` + conditional
classes; a single shared colour/size is wrong.

**Stale or missing cache protocol:** If a node's cache file is missing or its
`figmaLastModified` no longer matches `spec.json`:
1. `npm run figma:refresh-node -- --feature <fe-jira-id> --refresh-node <nodeId>`
   re-fetches exactly that one node (one small MCP call) and rewrites its cache.
2. Read the rewritten `nodes/<nodeId>.json` and continue from step 3.
3. If refresh cannot fetch it (whole frame changed), re-run `figma-extract`
   (one session) — never hand-build values from memory or a screenshot.

**Token discipline — enforced throughout:**
- No raw hex values. All colours from `var(--token-name)` or Tailwind token class.
- No raw `px` values. All spacing from token-backed Tailwind classes.
- Every token name must exist in `reports/tokens-report.md`.
- **Exact fidelity:** the token's resolved value must match Figma / `contract.md`
  §4. Reusing an old token name with a different resolved value is forbidden —
  same class of bug as raw hex. Fix via new tokens + rebuild, not nearest bind.
- Prefer registry `$tokens` + contract §4 over inventing bindings at implement
  time. If registry has `tokenMissing` → STOP; do not implement that slice.

**Border / stroke width — mandatory (prevents SectionPill 1px vs Figma 0.3px drift):**
1. From cache (or §4 if it includes width), record exact `strokeWeight` for every
   stroked node (pills, cards, chips, strips). Do **not** assume 1px.
2. Map width → class: `0.3` → `border-[0.3px]`; `1` → `border` (or `border-[1px]`);
   other values → `border-[Npx]` with the Figma number. Colour stays on a separate
   `border-[var(--color-…)]` / token class.
3. **Forbidden:** plain `border` (Tailwind default **1px**) when cache/`§4` says
   anything other than 1. SectionPill hairlines are almost always **0.3px**.
4. If §4 lists border **colour only** (no width) → read `strokeWeight` from
   `figma/nodes/*.json` and implement that width; then fix §4 to include it.
5. §4 audit must check border **width and colour**, not colour alone.

**§4 Token Audit — mandatory after EVERY component, before moving on:**
`token-lint` only catches raw values — it cannot catch a wrong token. `bg-surface-warning`
and `bg-surface-brand` are both valid tokens; only `contract.md §4` says which is correct.

**Typography — cache wins over semantic names:**
Before picking `text-heading-desktop-h2`, `h4`, or `color.pill.*.text`, read the TEXT
node in `figma/nodes/<slice>.json` and record `fontSize`, `fontWeight`, and the fill
variable id (e.g. `3003:24` → `color.text.brand-navy`). Map **px → utility** via
`tokens/build/tokens.css` (40px/700 → `text-heading-desktop-h1`, not h2). If §4 says
"h2" but cache says 40px → implement h1 and fix §4. Pill labels often bind to
`color.text.brand-navy` even when the pill semantic token says white/teal.

**Typography utilities — mandatory (prevents Figma vs app size/weight drift):**

1. **Use compound utilities only.** Every text style comes from `app/globals.css`
   `@utility text-{role}-{breakpoint}-{variant}` (e.g. `text-body-mobile-md`,
   `text-heading-desktop-h1`). These set `font-family`, `font-size`, `font-weight`,
   `line-height`, and `letter-spacing` from `tokens/build/tokens.css`.
2. **One utility per breakpoint.** Desktop layouts use `*-desktop-*`; mobile
   layouts use `*-mobile-*`. Never put `text-body-desktop-md` on a mobile-only
   tree (or vice versa). Prefer separate desktop/mobile markup or a
   `variant` / `typography` prop — do not rely on desktop sizes “looking fine”
   on mobile.
3. **No ad-hoc typography class strings.** Forbidden in components and
   `constants/*.constants.ts`:
   - `[font-family:var(--typography-…)] [font-size:var(--typography-…)] …`
   - `text-[length:var(--font-size-…)]` / `[font-size:var(--font-size-…)]`
   If a compound utility is missing for a `typography.json` leaf, **add the
   matching `@utility` block to `globals.css` first** (copy an existing block; include
   `letter-spacing: var(--typography-…-letter-spacing)`), then use the class. Do not
   inline the CSS vars.
4. **No weight overrides on utilities.** Do not add `font-bold`,
   `font-semibold`, or `font-medium` on the same element as a typography
   utility — they fight the token weight (Bold = 700, Semi Bold = 600,
   Medium = 500, Regular = 400). Inline emphasis spans may use
   `[font-weight:var(--font-weight-700)]` only when Figma shows a mixed-weight
   run inside otherwise Regular body text.
5. **Utility coverage gate.** Before implementing a slice, confirm every
   `typography.json` leaf has a matching `@utility` in `globals.css`. Count
   should match. Missing utility = blocker, same as a §4 miss.
6. **Fonts must be loaded.** Brand faces (e.g. Inter via `next/font/google`,
   Satoshi via Fontshare) must be wired in `app/layout.tsx` / `globals.css`
   remaps. Never ship typography that depends on `system-ui` alone for brand text.

After writing each component, open `contract.md §4 Tokens per element` and walk every row
that applies to elements in that component. For each row, verify the exact token used in
the className matches §4 — background, text, border **colour and width**, radius, font size, font weight.

Example check:
```
§4 says: Promo Side Banner | bg: color.surface.brand | text: color.text.inverse
Component uses: bg-surface-brand ✓  text-text-inverse ✓  → pass

§4 says: Feature label | font: font.weight.semibold
Component uses: font-medium  → FAIL — fix before continuing
```

Do not move to the next component until every §4 row for the current component passes.
A §4 mismatch is a blocker, the same as a failing test.

**Shared component contract conflict check — mandatory before touching any `components/shared/` file:**
A shared component (e.g. `SiteNav`, `SiteFooter`) must be implemented **once** and then
reused. Never re-implement a shared component that already exists — just import and call it.

Before writing or modifying any file under `components/shared/`:
1. Check git log: `git log --oneline -- components/shared/<file>`
   - **Has prior commits → already implemented. Stop. Import it where needed; do not touch the file.**
     Only modify it if the current feature's §4 requires a genuine addition (new slot, new prop)
     that the existing implementation does not support — and even then, follow steps 2–4 first.
   - **No prior commits → it needs to be implemented. Continue to steps 2–4.**
2. Find every contract.md that mentions this component:
   `grep -rl "<ComponentName>" features/*/contract.md`
3. Extract the §4 token rows for this component from each contract found.
4. Compare token values row by row. Any disagreement is a **conflict** — do not pick one
   arbitrarily. Open the Figma frame for each conflicting feature and resolve which value
   is correct before writing any code.

Example conflict:
```
HOME-002 §4 says: Middle Nav bg → color.surface.card    ← WRONG (bad extraction)
SHOP-003 §4 says: Middle Nav bg → color.surface.infoStrong  ← CORRECT
```
Shipping with the wrong value means every feature that uses the shared component is broken.
A conflict is a blocker — resolve it first, then update the incorrect contract.md to match.

**Shared component reuse rule (summary):**
- Exists → import it, do not rewrite it.
- Does not exist → implement it once using §4 from all contracts, then import it everywhere.

**globals.css — must import tokens before any code is written:**
`app/globals.css` MUST have `@import '../tokens/build/tokens.css';` as its first line,
before the Tailwind directives. Without it, every `var(--color-*)` / `var(--spacing-*)`
reference resolves to `unset` — the page renders with no colour, no spacing, no shadows.
Check this file exists and has the import before writing any component.

```css
@import '../tokens/build/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Layout shell — mandatory for every feature layout:**
Every `app/<group>/layout.tsx` that renders a nav + main + footer shell MUST use:
```tsx
<div className="flex flex-col min-h-screen">
  <SiteNav />
  <main className="flex-1">{children}</main>
  <SiteFooter />
</div>
```
Without `min-h-screen` + `flex-1`, short-content pages leave a large white gap
between the content card and the footer, and the footer floats in the middle
of the viewport instead of sitting at the bottom. Never use a bare fragment `<>`
as the layout root when the layout includes a header, main, and footer.

**Component anatomy enforcement:**
- Every element named in `contract.md` §2 must be rendered.
- Every element with a `[component.*]` tag gets `data-testid={ids.<path>}`.
- Every element with a `data-api-field` marker gets `data-api-field={fields.<path>}`.
- No placeholder text, no skeleton layouts, no "TODO: implement" comments.

**API integration:**
- Fetch from the exact endpoint paths defined in `docs/openapi/paths/<be-jira-id>.yaml`.
- Response fields accessed by their exact JSON paths from contract.md §1b.
- Handle loading, error, and empty states as specified in contract.md §5.

**Responsive design — mandatory on every component:**
Every page and component MUST be responsive across all screen sizes. Figma shows
desktop at a fixed width — that is the fidelity target for desktop, but the
implementation must also work at mobile (≥320px) and tablet (≥768px).
- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`) for layout changes.
- Fixed widths like `w-[424px]` that are wider than mobile viewport MUST get a
  mobile override: `w-full sm:w-[424px]`.
- Horizontal padding like `px-[300px]` (allow-raw) that would collapse content on
  mobile MUST have a responsive alternative: `px-4 sm:px-8 lg:px-[300px]`.
- Multi-column layouts (nav tiers, footer columns) MUST stack vertically on mobile.
- Never ship a component that clips or overflows horizontally on any viewport width.
- After implementing each component, resize the browser to 375px wide and verify
  nothing overflows before moving to the next component.

**Figma fidelity:**
- After implementing each component, compare visually against `reference.png`.
- Layout, spacing, typography, colours must match Figma within fidelity tolerance
  defined in contract.md §11.

### Step 5 — Run tests after each slice (MANDATORY before next GH issue)

After **every** section slice (GH#N), run all three gates scoped to that slice.
Do not start the next slice until they pass.

```bash
# 1. E2E smoke — visibility, CTAs, navigation for this slice
npm run test:e2e -- --grep "GH#<N>"

# 2. Visual regression — screenshot baselines for this slice's desktop + mobile roots
npm run test:visual -- --grep "<slice-name>"

# 3. Typography precision — computed fontSize/fontWeight for this slice
npm run test:visual -- tests/visual/lp-001-typography.spec.ts --grep "<slice-name>"
```

If visual baselines for the slice do not exist yet, establish them once with
`npm run test:visual:update -- --grep "<slice-name>"` and note "baseline
pending human approval" in the Step 7 review card.

Also run after each slice:
```bash
npm run typecheck
```

Fix failures before moving to the next component. Never move on with a
failing scenario or failing visual/typography assertion.

### Step 6 — Final gate
After all components implemented, run a full §4 sweep across every implemented component:
re-open `contract.md §4` and check each row against the finished files. This is the last
chance to catch any wrong token that slipped through the per-component audit.

Then run:
```bash
npm run test:e2e && npm run test:visual
```

Both must exit 0.

If `test:e2e` fails: fix the component implementation, not the test.
If `test:visual` fails with a diff: compare against `reference.png`.
  If it's a real regression → fix the component.
  If the Figma design changed → re-run `figma-extract` and update the baseline.
  Never update the visual baseline to hide a real fidelity gap.

Also run:
```bash
npm run typecheck && npm run lint && npm run token-lint
```

All three must pass.

> **If Playwright is not yet scaffolded** (`test:e2e` / `test:visual` missing from
> `package.json`): report it explicitly in the gate summary, run every other gate
> that exists (`validate:*`, `ui-registry:validate`, `tokens:validate`, `build`,
> `typecheck`), and **still proceed to Step 7 (human review)** — do not skip
> review because BDD/visual is pending. Scaffold via `/bdd-scaffold` and
> `/visual-regression` in a separate pass when the user asks.

### Step 7 — Human slice review gate (MANDATORY — Day Shift)

**This step blocks everything after it.** Do not write memory, sync Jira, commit,
push, open a PR, or start the next GitHub issue until the user explicitly
approves the current slice.

After Step 6 automated gates pass (or are reported as partially scaffolded),
**STOP implementing** and present a structured review card to the user:

```markdown
## Slice review — GH#<N> <slice name>

**Implemented:** <component files + routes>
**Figma refs:** `features/<id>/figma/reference-<section>.png` (nodes <ids>)
**Check at:** 1440px desktop + 393px mobile (`npm run dev` → http://localhost:3000)

### Automated gates
| Gate | Result |
|------|--------|
| validate:figma-extract | pass / fail |
| validate:contract | pass / fail |
| validate:motion-chains (if animated slice) | pass / not applicable |
| test:e2e (`--grep GH#<N>`) | pass / not scaffolded |
| test:visual (slice screenshots — pre-hover) | pass / baseline pending / not scaffolded |
| test:visual (typography spec) | pass / not scaffolded |
| build + typecheck | pass / fail |

### Motion review (animated slices only)
- **Pattern:** `<from motion-chains.json>`
- **End-state ref:** `reference-<slug>-animation-state-<N>.png`
- **Action:** hover slice in browser; compare to reference PNG(s); note any layer drift

### Known deviations (from contract / Figma)
- <list each, or "none documented">

---

Please review this slice in the browser. Reply with:
- **APPROVE** (or "LGTM", "looks good", "move on") — to proceed to the next slice, or
- **Specific violations / improvements** — numbered list; I will fix them before re-asking.
```

**Wait for the user's reply.** Do not assume approval. Do not batch multiple
slices without a review between each one.

#### If the user reports violations or improvements

1. **One fix cycle per user message** — address their list completely before
   re-running gates and presenting the review card again.
2. **Route fixes through the correct skill** (turn by turn, in pipeline order):
   | Fix type | Skill to invoke |
   |----------|-----------------|
   | Stale or wrong Figma node data | `/figma-extract` or `npm run figma:refresh-node` |
   | Missing / wrong tokens | `/design-tokens` |
   | Registry path or test-id drift | `/ui-registry-build` → `/registry-validate` |
   | Contract anatomy / §4 token wrong | `/design-contract` |
   | Wrong motion timing / pattern / layer binding | `/figma-extract` chain walk + `build:motion-from-cache` (never `MOTION-SPEC.md`) |
   | Wrong Motion block in contract | `/design-contract` after rebuild 12b |
   | Component layout / styling / responsiveness | stay in `/fe-implement` |
   | BDD steps missing | `/bdd-scaffold` |
   | Visual baselines | `/visual-regression` |
3. After fixes: re-run **Step 6** automated gates, then present **Step 7** review
   card again. Repeat until the user says **APPROVE**.
4. **Never start the next GitHub issue** while the current slice is unapproved.

#### If the user says APPROVE

- Mark the slice approved in conversation (and optionally note in `memory.md`).
- **Step 7b — Commit approved slice (mandatory):**
  ```bash
  git add app/ components/ constants/ types/ features/<parent-id>/memory.md
  git commit -m "feat(<fe-jira-id>-FE): implement <slice name> (GH#<N>)"
  ```
- Tell the user what the **next slice** is (next GitHub issue) and which skill
  to invoke first (`/figma-extract` for the new slice's nodes).

See `skills/_shared/pipeline-git-commit.md`. Pipeline commit steps override
generic "only commit when asked" — APPROVE is the gate for per-slice commits.

### Step 8 — Write to memory
```markdown
## Implementation Notes
### FE notes
<!-- Written by: fe-implement on <ISO date> -->
- Components implemented: <list>
- test:e2e: passed (<N> scenarios)
- test:visual: passed
- typecheck: passed
- token-lint: passed
- Deviations from contract: <none / list if any>
- Human review: APPROVED on <date> (or: pending)
```

### Step 9 — Run `jira-sync`
Set FE ticket to `fe-implemented`.

### Step 10 — Run `figma-comment`
Post FE implementation complete notice to parent Jira ticket.

### Step 11 — Commit, push branch, open PR
```bash
# Stage all feature work
git add app/ components/ features/<fe-jira-id>/ docs/ tokens/

# Commit
git commit -m "feat(<fe-jira-id>): <short description of feature>

- <component 1>
- <component 2>
- test:e2e passed, test:visual passed

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# Push feature branch
git push origin feature/<fe-jira-id>

# Open PR targeting main
gh pr create \
  --base main \
  --head feature/<fe-jira-id> \
  --title "feat(<fe-jira-id>): <Feature Name>" \
  --body "$(cat <<'EOF'
## Summary
- Implements <Feature Name> FE
- All @fe Gherkin scenarios covered
- test:e2e passed, test:visual passed, typecheck passed

## Components
<list of components>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Hard rule: never push directly to `main`. The PR is the only merge path.**

## Success criteria
- Every element in `contract.md` §2 anatomy is rendered
- Every `[component.*]` tag has a corresponding `data-testid`
- `test:e2e` exits 0
- `test:visual` exits 0
- `typecheck`, `lint`, `token-lint` all pass (or reported not scaffolded)
- Human slice review: user said **APPROVE** for this GitHub issue
- No raw hex or px in `app/` or `components/`
- All pages render correctly at 375px, 768px, and 1280px+ viewport widths
- FE ticket `fe-implemented`
- Feature branch `feature/<fe-jira-id>` pushed to origin
- PR opened targeting `main`
- `main` branch unchanged — no direct commits to main

## Hard rules
- FE NEVER starts before BE ticket is `be-implemented`.
- Never modify test files to make them pass. Fix the component.
- Never update visual baseline to hide a fidelity gap. Fix the component.
- Every element in §2 anatomy is required — omitting any element is a blocker.
- **After every component: audit §4 (Tokens per element) row by row. `token-lint` cannot
  catch a wrong token — `bg-surface-warning` and `bg-surface-brand` are both valid tokens,
  only §4 says which is correct. A §4 mismatch is a blocker.**
- No `any`, no `@ts-ignore`, no disabled lint rules.
- **Never push directly to `main`.** Commit to `feature/<fe-jira-id>` and open a PR.
- Every component must be responsive — no horizontal overflow at any viewport width.
- **Shared components are implemented once and reused everywhere.** Before touching any
  `components/shared/` file: check git log. If it has prior commits → it is done, import it,
  do not rewrite it. If it is new → check §4 across all contracts that reference it, resolve
  any disagreement against Figma, then implement it once. Never re-implement a shared
  component that already exists. A shared component with the wrong token or a duplicate
  implementation breaks every feature that uses it.
- **Human slice review is mandatory after every GitHub issue / vertical slice.**
  Never skip Step 7. Never start the next slice until the user says APPROVE.
  Fix cycles use the correct upstream skill in pipeline order, one turn at a time.
- speckit is used internally — do not call speckit skills from outside this skill.
- **No code before the cache is read. Every component's exact values come from
  `features/<fe-jira-id>/figma/nodes/<nodeId>.json` (the cache `figma-extract`
  wrote), read before a single line of code. No approximations from memory or a
  screenshot. The gate runs per component, every time.**
- **`fe-implement` makes ZERO Figma MCP calls on a clean extract.** The only path
  that touches MCP is `figma:refresh-node` for a single node whose
  `figmaLastModified` no longer matches `spec.json` (Layer D freshness). Never
  call `get_design_context` per component, and never extract the full frame — the
  single-session driver in `figma-extract` already did that once and cached it
  (`docs/figma-single-pass-extract-plan.md` §6, §12).
- **Motion wiring comes from JSON only.** Never read `tokens/MOTION-SPEC.md`.
  **Track A (primary):** pattern, timing, and layer helpers trace to
  `motion-chains.json` + `motion-diffs.json`. Wrong Track A motion → re-extract +
  `build:motion-from-cache`, not sibling-section cloning or ad-hoc CSS.
  **Track B (supplementary):** when no closed chain, use `motion-spec.json` +
  contract §5b; wrong timing → update motion-spec + re-run design-contract.
