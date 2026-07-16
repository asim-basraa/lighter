---
name: design-contract
description: Build the enriched design contract for a feature — component anatomy, layout, spacing, states, responsive behaviour, and accessibility — from the Figma frame extract and design tokens. Use this skill whenever the user wants a design contract, design spec, component spec, UI spec, or to "spec the UI" for a feature — even if they don't say "skill". Run after spec-author (and figma-extract frame mode) and before bdd-scaffold.
---

# design-contract

Produces `features/<id>/contract.md` — the boundary `feature-implement` must
build within, and the fidelity reference `governance-gate` checks against.

This is the **enriched** contract. Raw design tokens give you a correct
*vocabulary* (which blue, which spacing step) but not *composition* — layout,
anatomy, states, responsive behaviour. Near-faithful UI needs that intent
written down. That is this skill's job.

## Inputs
- `features/<id>/<id>.feature` — the Gherkin spec.
- `features/<id>/figma/` — the Figma frame extract from `figma-extract` (mode B).
  **This is mandatory.** Before doing anything else, verify that ALL of the
  following exist and are non-empty for every frame listed in the feature's
  `figma_frames` in `backlog.yaml`:
  - `features/<id>/figma/spec.json`
  - `features/<id>/figma/nodes/<nodeId>.json` — the extraction cache (at least
    one per slice-root, or a `features/_shared/figma/nodes/` pointer)
  - `features/<id>/figma/layout.json` — the composition tree
  - `features/<id>/figma/reference-<section>.png` — at least one real screenshot
  - `features/<id>/figma/notes.md`
  - `features/<id>/figma/motion-spec.json` — **required when** the linked
    Figma file has an Animations page with variant sets for in-scope
    components and Track B inventory was run during `figma-extract`. Optional
    otherwise (Track A `motion-chains.json` may be sufficient alone).
  If any **mandatory** file is missing or empty → **STOP immediately**. Do not write
  `contract.md`. Do not advance status. Report exactly which files are missing
  and instruct the user to run `figma-extract` (frame mode) for the feature
  with the Figma MCP connected. There is no fallback to PRD prose or invented
  measurements. `design-contract` itself makes **0 MCP calls** — it reads the
  cache `figma-extract` produced.
- **Extraction-cache gate (MANDATORY, run as a Bash tool call before writing
  the contract):**
  ```bash
  npm run validate:figma-extract -- <id>   # every checklist nodeId is cached; no placeholder reference; figmaLastModified consistent
  npm run validate:layout        -- <id>   # every layout.json leaf slug resolves; gaps/padding are tokens
  npm run validate:motion-chains -- <id>   # all *-animation chains closed; motion-diffs token-mapped (skip if no animation twins)
  npm run validate:motion-spec -- <id>      # when motion-spec.json exists: variants + keyframes (Track B)
  ```
  If any exits non-zero → **STOP**. The extract is incomplete or the
  composition tree is invalid; re-run `figma-extract` / `build:layout` /
  `figma:motion-chain-walk` + `build:motion-from-cache`. Do not
  write `contract.md` against a partial extract.
- **Motion inputs (0 MCP, read from disk):**
  - **Track A (primary):** `features/<id>/figma/motion-chains.json`,
    `motion-diffs.json`, `motion-state-poses.json`, and `chain-walk-report.json`.
    Copy per-slice **Motion** blocks into `contract.md` §2 (pattern, runner,
    trigger testId, key diff rows). List `ambientMotion[]` gifRef rows in anatomy.
  - **Track B (supplementary):** `features/<id>/figma/motion-spec.json` when
    present — copy into §5b (designer-confirmed timing; variant keyframe inventory).
  - **Authoritative docs:** `docs/motion-guideline.md` · `docs/motion-pipeline-plan.md`
    step 16 · project `tokens/templates/motion-spec.*.json` (Track B shape).
  - **Never** read `tokens/MOTION-SPEC.md`. When both tracks exist for a component,
    **Track A §2 Motion blocks win for `fe-implement`**; §5b is timing sign-off only.
- **Motion gate (MANDATORY when animation twins exist):**
  ```bash
  npm run validate:motion-chains -- <id>   # all chains closed before full contract
  ```
  For incremental slice work while other chains are incomplete, the implementor may
  use `npm run validate:motion-chains -- <id> --chain <AnimationName>` — but
  **design-contract must not be written** until `validate:motion-chains -- <id>`
  (no `--chain`) exits 0 unless the user explicitly approves a partial contract.
- **Downloaded assets check (MANDATORY).** After verifying `notes.md` exists,
  read it and check for a "Downloaded assets" section. For every IMAGE, ICON,
  LOGO, BADGE, ILLUSTRATION, or VECTOR node visible in the Figma frame:
  - Each must appear in `notes.md` under "Downloaded assets" with its `public/`
    file path (e.g. `public/icons/clicon-logo.svg`).
  - Each listed file must actually exist on disk — verify with `ls public/icons/`
    and `ls public/images/`.
  - If any visible asset is missing from `notes.md`, or listed but absent on
    disk → **STOP immediately**. Do not write `contract.md`. Report which assets
    are absent and instruct the user to re-run `figma-extract` to download them.
  - If `notes.md` has an "Assets requiring manual download" section → **STOP**.
    Those assets must be provided before the contract can be written.
- `reports/tokens-report.md` — the allowed token vocabulary. Must end with
  `STATUS: PASS` from a `tokens:build` that includes any new tokens required
  by this slice. If `features/<id>/figma/missing-tokens-report.md` has
  unresolved rows → **STOP**. Run `design-tokens` (exact-or-new) first.
- **Registry token gate (MANDATORY):** `tokens/ui-registry.json` entries for
  this feature must not carry `tokenMissing: true`. Run
  `npm run ui-registry:validate` / registry-validate — Check 5 is blocking.
  If any `$tokens` bind was a nearest/old token (resolved value ≠ Figma) →
  **STOP**; fix tokens + rebuild registry before writing `contract.md`.

## Procedure

**Step 0 — Create feature branch**

`design-contract` is the first FE skill — it owns branch creation for this feature.

```bash
git rev-parse --abbrev-ref HEAD
```

- If already on `feature/<fe-jira-id>`: continue.
- If on `main` or any other branch, create and switch:
  ```bash
  git checkout -b feature/<fe-jira-id>
  ```

**Hard rule: Never commit or write any file while on `main`.** All contract and
implementation work for a feature lives on `feature/<fe-jira-id>` until the PR merges.

**Step 1 — Mandatory spec.json enumeration (do this BEFORE writing §2):**

Read `features/<id>/figma/spec.json` and build an explicit checklist of every
named element the contract must cover. For each named element extract **both**
its name and its `nodeId`:

- Every `sections[].name` + `sections[].nodeId`
- Every `sections[].layers[].name` + `layers[].nodeId`
- Every `sections[].widgets[].name` + `widgets[].nodeId`
- Every `sections[].columns[].name` + `columns[].nodeId`
- Every `sections[].banners[].name` + `banners[].nodeId`
- Every `instanceVariants` object on INSTANCE nodes (e.g. `Size: Wide`,
  `Accent: Navy`) — **one §4 token row per variant value**, never collapsed

**Step 1b — Mandatory cache read for INSTANCE variants (before §3/§4):**

Read `features/<id>/figma/nodes/<slice-root>.json` for each slice in
`slice-roots.json`. Walk the raw tree for `type: "INSTANCE"` nodes with
`componentProperties`. Build a **Variant matrix** (write into contract appendix
or inline §2):

```
| nodeId | Component set | Size | Accent | Notes |
| I5164:6562;3113:38 | FeatureCard | Wide | Navy | badge <100ms |
```

If `component-checklist.md` lists a `FeatureCard` / `AccentBar` / `Button`
INSTANCE **without** `(variants: …)` and the cache also lacks
`componentProperties` → **STOP**. Extraction is incomplete. Instruct user to
re-run `/figma-extract` with MCP gap-fill (Timeout Split on that slice-root).
Do not write a contract that guesses one accent colour for all cards.

**Step 1c — Layout direction from cache (before §3):**

For every container named in §2 (`FooterBar`, `FeatureCardsGrid`, nav tiers),
copy `layout.direction`, `layout.justify`, and `layout.align` from `spec.json`
or the node's `layoutMode` / `primaryAxisAlignItems` in the cache. **Never
assume `column / center`** because a prior feature used that pattern. If
`FooterBar` is `row` + `space-between` in cache, §3 must say so.

If `spec.json` does not record `nodeId` on a named element → **STOP**. The
`figma-extract` run that produced this spec.json was written before the nodeId
requirement. Re-run `figma-extract` (frame mode) for this feature — it will now
record a `nodeId` on every named element. Do not write `contract.md` without nodeIds.

Write the checklist out **before** writing §2 anatomy text — name and nodeId on
every row. Tick off each item as you document it. A contract that skips any
checklist item is incomplete — `validate:figma-coverage` will catch it and block
the gate, but catching it BEFORE writing is far cheaper than fixing after.

**Common miss: content strings.** Some spec.json layers have a `content`
field listing interactive sub-elements separated by `·` (e.g.
`"Eng/USD dropdowns"`, `"All Category dropdown"`, `"Track Order · Compare"`).
These are Figma-defined interactive elements. Each one named in `content` must
be documented in §2 with its own entry and a `[component.*]` tag.

Fill in `contract-template.md` (in this skill's folder) for the feature:

1. **Routes** — URL paths the feature introduces or changes.
1a. **UI registry entries** — the screen and component paths the feature
   introduces. **Every named element in the §2 anatomy — interactive OR
   static — gets a `component.*` path.** Do not restrict this to buttons
   and inputs. Named sections (hero, carousel, meta row, safe-checkout
   banner, footer column) are layout contract — they must be registered so
   `bdd-scaffold` can assert their presence and `governance-gate` can
   verify they are rendered. Each entry needs a `$description`, parent
   `$screen`, and the `$states` it can be in.
   Naming follows the grammar in
   `tokens/templates/PRD-Executable-Requirements-Gherkin-Component-Paths.docx.md`
   §4.1 (`[a-z][a-zA-Z0-9]*` lowerCamelCase segments). `feature-implement`
   adds these entries to `tokens/ui-registry.json` before writing UI
   code; the same paths flow into Gherkin step text in backticks (per
   the PRD) and into Playwright step definitions as
   `data-testid={ids.<path>}` selectors.
1b. **API field bindings** — every API / server-sourced value shown in the UI
   gets a `field.*` path in `tokens/api-registry.json` with `$jsonPath`,
   `$source`, and `$displaysAt` component paths (see
   `tokens/templates/PRD-API-Field-Paths-and-Bindings.md`). Register slash
   aliases (e.g. `/user/info.firstName`) under `alias` when Product uses them.
   Run `npm run api-registry:build` after editing the registry.
2. **Component anatomy** — the complete element tree from the Figma frame;
   every element's role and content. **This is the implementation checklist
   for `feature-implement` — every line here will be built.** For the
   *arrangement* of these elements (nesting, direction, gaps, slot order) you
   may cite `features/<id>/figma/layout.json` — the composition tree whose leaf
   `slug`s are the `[component.*]` paths registered in §1a — instead of
   re-describing page composition in prose. The anatomy still enumerates every
   element; `layout.json` is the authority on how they stack. Include every
   visible element: interactive AND static. Mark leaves that render a
   registered **field** with `data-api-field={fields.…}` in addition to
   `data-testid` where applicable. Mark every leaf that is **registered**
   (per §1a) with `[component.X.Y.Z]  data-testid` so the implementor knows
   where `data-testid={ids.…}` belongs — and so the validate:contract script
   can enforce registry coverage.

   **nodeId is MANDATORY on every named element (non-negotiable).**
   Every section, component, and sub-component in §2 anatomy must include its
   Figma `nodeId` in parentheses after its name. This is what `fe-implement`
   uses to call `get_design_context` on exactly that node before writing code.
   Without nodeIds, `fe-implement` cannot do per-component Figma extraction
   and will be forced to approximate — which is how measurements get missed.

   Required format for every named anatomy line:
   ```
   ├─ ProductCard  (nodeId 394:7726, 234×320)  [component.shop.productCard]  data-testid
   ├─ FilterSidebar  (nodeId 391:5012, 312×716)  [component.shop.filterSidebar]  data-testid
   └─ Navigation  (nodeId 391:6653, 1920×220)  [component.shared.siteNav]  data-testid
   ```
   If a nodeId is not available from spec.json, stop and re-run `figma-extract`.
   A missing nodeId is treated the same as a missing element — it blocks the gate.

   **Tag format (mandatory):** every registered element must appear in the
   anatomy as `[component.X.Y.Z]  data-testid` on its line. This is the
   machine-readable anchor that `validate:contract` parses. Missing the tag
   means the element is invisible to the gate.
   Never use placeholders like "// links here" or "(same pattern)" without
   enumerating the actual items.
   **Asset references — mandatory.** Every IMAGE, ICON, LOGO, BADGE, or
   ILLUSTRATION node in the anatomy MUST reference its exact `public/` file
   path from the "Downloaded assets" section of `notes.md` (e.g.
   `src="/icons/clicon-logo.svg"`). Never describe an asset in words (e.g.
   "orange circle logo", "Google Play icon"). The anatomy entry for an asset
   node must be: `<Image src="/icons/badge-google-play.svg" alt="..." width={N}
   height={N} />` — an implementable spec, not a prose description.

   **Motion blocks (mandatory for every animated section).** Read
   `features/<id>/figma/motion-chains.json`, `motion-diffs.json`,
   `motion-state-poses.json`, and `chain-walk-report.json` (0 MCP). For **each**
   chain with `status: "closed"` (and each `subgraphId` when a section is hybrid),
   append the following **inside §2** beside that section's anatomy — sourced
   from JSON only, never from `tokens/MOTION-SPEC.md` or memory:

   **Per interactive chain — copy from `motion-chains.json`:**
   ```markdown
   **Motion (motion-chains · `<sliceRootNodeId>`):** pattern `<pattern>` ·
   status `closed` · subgraph `<subgraphId>` (omit line if single graph) —
   `<trigger.event>` on `<trigger.targetTestId>` → state N;
   `<durationToken>` + `<easingToken>`; one-way, no mouse-leave.
   Runner: `<runner>`.
   ```

   **Per interactive chain — summarize key rows from `motion-diffs.json`:**
   ```markdown
   **Motion bindings (motion-diffs):**
   | Step | testId | Helper | Change |
   |------|--------|--------|--------|
   | 0 | `component.landing.pricing.motion.mainGroup` | `getMotionRevealStyle` | translateY spacing.24 → 0 |
   ```
   List only layers with non-empty `changes` — do not paste full JSON.

   **Per interactive chain — state pose table from `motion-state-poses.json`:**
   ```markdown
   **Motion state poses (motion-state-poses):**
   | State | Layer | translateYpx | testId |
   |-------|-------|--------------|--------|
   | 1 | Frame 1561553827 | 370 | component.landing.hero.motion.textColumn |
   ```
   Include pose matrix / `initialRender` when present. Always add a **Web
   entrance** line from `notes.md`. **Mandatory intent, flexible naming:** design
   need not use the keys `productIdle` / `qaIdle` (prose, Figma comments,
   Variables, PRD are fine). Extract maps intent → canonical enums
   (`staticTwin` \| `entryPose` \| `hidden`). Aliases like `firstPaint` /
   `webIdle` / `idleMode` → `productIdle`; `e2eIdle` / `snapshotIdle` →
   `qaIdle`. See `/figma-extract` “Designer deliverable (mandatory intent —
   flexible naming)”.

   ```markdown
   **Web entrance:** productIdle=`staticTwin|entryPose|hidden` ·
   qaIdle=`staticTwin|(aligned)` · source=`designer|figma|prd|asked-…` ·
   triggers=`hover` [, `inView`] [, `hash(#…)`] [, `load`].
   Implement production idle = productIdle exactly. When productIdle ≠ qaIdle,
   gate qaIdle behind `NEXT_PUBLIC_E2E_MODE=1` (or equivalent).
   ```

   **BLOCK:** animated slice missing resolvable Web entrance intent (including
   `source`) — do not write / APPROVE until idle + triggers are mapped from
   Figma/requirements. Do **not** invent `hidden` empty states when the designer
   wants `staticTwin` (visible content, no empty frame). Do **not** invent
   `staticTwin` first paint when the designer wants a reveal. Do **not** require
   designers to adopt our key names — require mappable intent only.

   **Hybrid sections (e.g. SocialProof):** when `motion-chains.json` has
   multiple `chains[]` entries for one slice-root, write **one Motion block
   per `subgraphId`** — integrations strip (`simple-one-step`) and carousel
   (`custom`) are independent; do not collapse into one pattern.

   **`pattern: custom`:** add a step table in the Motion block (step index,
   delayMs/durationToken, layers affected) copied from `motion-chains` +
   `motion-diffs`; note "requires human APPROVE before fe-implement codes
   custom runner".

   **Per `ambientMotion[]` / `gifRef` layer (ambient — often on static slice):**
   ```markdown
   ├─ Route plane  (nodeId I5164:6564;5151:11817;5147:6155)
   │  — ambient GIF `public/images/pricing-route-plane-desktop.gif` (gifRef …)
   │  — autoplay; `<Image unoptimized />`; not hover-driven
   ```
   List every `gifRef` from `asset-manifest.json` with `type: gif` in anatomy.

   **BLOCK:** any chain `status: "incomplete"` in `chain-walk-report.json` or
   `motion-chains.json` → do not write `contract.md` (re-run step 12 chain
   walk). If `motion-chains` disagrees with legacy `tokens/MOTION-SPEC.md` →
   **motion-chains wins**.

3. **Layout & spacing** — direction, gaps, padding, alignment, sizing.
   Every value expressed as an **exact** design token from
   `reports/tokens-report.md`. "Exact" means the token's resolved px value
   equals the Figma measurement to within 1px.

   **Layout direction is per-container — read from cache, never assume.**
   For every named container in §3, copy `layout.direction`, `layout.justify`,
   and `layout.align` from `spec.json` or the slice-root `nodes/<nodeId>.json`
   cache. Do **not** default footers, CTAs, or toolbars to `column / center`
   because an earlier slice used that pattern. Example: if Figma `FooterBar`
   is `row` + `space-between`, §3 must say `row` + `space-between`, not
   `column` + `center`.

   **Component-set instance variants — one §4 row per instance, never collapsed.**
   When the cache shows `componentProperties` on a Figma INSTANCE (e.g.
   `FeatureCard` with `Size: Wide|Narrow`, `AccentBar` with
   `Accent: Navy|Teal|Orange|Red`), document **each instance** in §2 anatomy
   with its variant values in parentheses, and give **each instance its own §4
   token row** (accent colour, size, padding if they differ). Forbidden:
   writing one generic row such as “Accent bar → `color.action.primary`” for
   all cards when Figma uses different `Accent` variants per card. The
   implementor must be able to build from §4 alone — if variants are missing,
   first-run UI will be wrong even when extraction is correct.
   **Never substitute a token whose resolved value differs from the Figma
   value** — approximations create invisible drift that compounds across
   components.

   **If any Figma measurement has no exact token — STOP before writing the
   contract.** Check `features/<id>/figma/notes.md` for a "Missing tokens"
   section and `features/<id>/figma/missing-tokens-report.md`. Then check
   `features/backlog.yaml` for this feature's entry:
   - If `allow_raw_values: true` is **not** set → **STOP**. Output:
     ```
     ⚠ MISSING TOKENS — contract blocked

     <feature id> has <N> Figma value(s) with no exact design token.
     See: features/<id>/figma/missing-tokens-report.md

     The contract cannot be written until either:
       (a) the designer adds the missing tokens and figma-extract is re-run, OR
       (b) a human explicitly sets  allow_raw_values: true  in backlog.yaml

     Claude Code will not set allow_raw_values. This is a human gate.
     ```
     Do not write `contract.md`. Do not advance status.
   - If `allow_raw_values: true` **is** set → proceed. For every measurement
     with no exact token, write the raw Figma value in the contract with a
     clear label: `gap: 136px (allow-raw — no token; approved in backlog.yaml)`
     and list it under a **"Missing tokens (allow-raw approved)"** section in
     `contract.md`. These exact values must propagate unchanged into
     `feature-implement`.

4. **Tokens** — per element: which token for background / text / border /
   radius / spacing / font size / **font weight**. All token names must
   exactly match entries in `reports/tokens-report.md`. When the cache gives
   per-instance variant props, §4 must list tokens **per instance** (see step 3
   variant rule) — not one token for all siblings of the same component name.

   **Border / stroke width — mandatory in every §4 border cell.** Read
   `strokeWeight` from the cached node (not from memory). Write it next to the
   border colour token, e.g. `` `color.pill.problem.border` 0.3px `` or
   `` `color.border.default` 1px ``. Never list colour alone. SectionPills and
   similar hairline strokes are often **0.3px** in Figma — omitting the width
   causes FE to default to Tailwind `border` (1px) and drift. If `strokeWeight`
   is absent / 0 and there is no stroke → write `none`, not a colour token.

   If a Figma colour or radius has no exact token match:
   - If `allow_raw_values: true` in backlog.yaml → record the exact hex/px
     value in the "Missing tokens (allow-raw approved)" section and use the
     raw value in the contract.
   - If `allow_raw_values: true` is NOT set → **STOP** (same as step 3 above).
   Never substitute the closest token — approximations are fidelity bugs.
5. **States & motion**
   - **5a. Interaction states** — default, hover, focus, active, disabled,
     loading, empty, error — include only those that apply. Each state for a
     registered component should also appear in its `$states` array in §1a.
   - **5b. Motion-spec (Track B — supplementary)** — when the Figma file has an
     **Animations** page (variant storyboard frames), or when
     `features/<id>/figma/motion-spec.json` exists, copy every animated
     component into §5b. MCP extracts keyframe targets only (position/opacity
     diffs between `Property 1=*` variant symbols); duration and easing are
     **not** in Figma file content unless supplied via `motion.*` tokens or
     designer sign-off.

     **Motion-spec procedure (during design-contract, 0 MCP if motion-spec exists):**
     1. Read `features/<id>/figma/motion-spec.json` if present.
     2. If absent but the feature uses animated components **and** the Animations
        page exists with in-scope variant sets → **STOP** and instruct the user to
        re-run `figma-extract` Track B inventory (see `figma-extract` SKILL).
        If Track A closed chains already cover all animated slices, §5b may be
        omitted.
     3. For each `components[]` entry, write a §5b table row: `componentPath`,
        `trigger`, summarized keyframes, `timing.durationToken` (or
        `durationMs` when `designerConfirmed: true`), `timing.easingToken`,
        and `implementation.reducedMotion`.
     4. Every keyframe `element` must map to a §2 anatomy sub-element or be
        noted as affecting the whole `[component.*]` root.
     5. If `timing.designerConfirmed` is `false` for any component → **STOP**
        before `status: contracted`. Ask the designer to confirm duration/easing
        (Figma prototype panel or `motion.*` tokens), update
        `motion-spec.json`, then re-run design-contract.

     Reference shape: `tokens/templates/motion-spec.template.json` and
     `tokens/templates/motion-spec.example.json` (when present in project repo).

     **Dual-track rule:** prototype-driven motion is already documented in §2
     **Motion** blocks from `motion-chains.json` (Track A). Do **not** duplicate
     full keyframe geometry in §5b when §2 covers it — use §5b for designer-confirmed
     timing when Track A has `durationToken: null`, or for inventory-only components
     without closed chains yet.
6. **Responsive** — breakpoints and what changes at each.
7. **Accessibility** — roles, labels, focus order, keyboard interaction,
   contrast expectations.
8. **Data model** — tables/columns the feature reads or writes.
9. **AC mapping** — each acceptance criterion → the scenario covering it.
10. **Visual reference** — path to `features/<id>/figma/reference.png` if present.
11. **Fidelity tolerance** — the allowed visual-diff ratio used by
    `visual-regression` (default `0.02`).

After writing all sections, execute the two mandatory checkpoints below **in
order** as Bash tool calls. Do not advance to the next step until the current
one exits 0. Do not mark `status: contracted` until both pass.

---

> ### ✦ MANDATORY CHECKPOINT A — Figma coverage
> **Run this Bash command now. Do not skip, do not defer to the user.**
> ```bash
> npm run validate:figma-coverage -- <id>
> npm run validate:figma-extract -- <id>
> ```
> `validate:figma-coverage` Check 1: every checklist entity in §2.
> `validate:figma-extract`: cache complete, no placeholder PNGs, reconciliation
> prerequisites (every slice-root has `nodes/*.json`).
> | Exit code | Action |
> |-----------|--------|
> | **0** | Proceed to Checkpoint B |
> | **non-zero** | **STOP.** Every item in the output is a Figma element absent from §2. Add each one (with layout, tokens, content, and `[component.*]` tag) and **re-run this command** before continuing. Do not write `status: contracted`. |
>
> Refer to `features/<id>/figma/component-checklist.md` and the Step 0 checklist
> to locate missing elements. The script output names exactly what is missing.

---

> ### ✦ MANDATORY CHECKPOINT B — Contract anatomy
> **Run this Bash command now. Do not skip, do not defer to the user.**
> ```bash
> npm run validate:contract -- <id>
> ```
> Checks three invariants simultaneously:
> - Every `[component.*]` in §2 is registered in `tokens/ui-registry.json`
> - Every §1a path has ≥1 `is visible` BDD step in the `.feature` file
> - Every §2 tagged path appears in the §1a registry table
>
> | Exit code | Action |
> |-----------|--------|
> | **0** | Both checkpoints passed — advance status |
> | **non-zero** | **STOP.** Fix every reported gap (registry entries, BDD scenarios, or missing tags) and **re-run** before continuing. Do not write `status: contracted`. |

---

Only after both checkpoints exit 0: write `features/<id>/contract.md`, set the
feature's `design_contract` field in `backlog.yaml`, and advance its `status`
`specced` → `contracted`.

## Hard rules
1. **Figma extract is required.** If `features/<id>/figma/spec.json`,
   the `nodes/` cache, `layout.json`, a real `reference-<section>.png`, or
   `notes.md` are missing — or `validate:figma-extract` / `validate:layout` exit
   non-zero → stop, report, do not write the contract. No fallback. No
   PRD-derived estimates. `design-contract` makes 0 MCP calls; it reads the cache.
1b. **nodeId is required on every §2 anatomy component.** A contract line
   without a nodeId cannot be implemented faithfully — `fe-implement` will
   have no target for `get_design_context` and will fall back to approximation.
   Missing nodeIds are a contract defect. Re-run `figma-extract` to obtain them.
2. **All frames, not just one.** If the backlog lists multiple `figma_frames`
   for this feature, all of them must be extracted before proceeding. A partial
   extract is treated the same as no extract.
3. **Token discipline — exact, never approximate.** Every visual measurement
   must resolve to a design token whose resolved value **exactly matches** the
   Figma measurement (within 1px / exact hex). Approximations are forbidden
   even if "close". **Reusing an old section/feature token name whose resolved
   value differs from this frame is forbidden** — add a new primitive +
   semantic, `tokens:build`, re-bind registry, then contract. If no exact
   token exists, the pipeline is blocked: do NOT write the raw value into the
   contract unless `allow_raw_values: true` is set in backlog.yaml by a human.
   "Nearest token" is a fidelity bug. Automatically falling back to a raw
   value without human approval is also a bug — it hides design-system gaps
   from the designer. Order: extract → exact-or-new tokens → `tokens:build` →
   registry `$tokens` → this skill → `fe-implement`. **Stroke width is a
   measurement:** every §4 border cell must include Figma `strokeWeight`
   (e.g. `0.3px`), not colour alone — hairline pills defaulting to 1px in CSS
   is a fidelity bug.
4a. **Asset paths are mandatory in §2 anatomy.** Every IMAGE, ICON, LOGO, BADGE,
   or ILLUSTRATION node MUST be referenced by its actual `public/` path in the
   anatomy, not described in words. If you find yourself writing "brand logo" or
   "app store badge" without a file path → stop. Check `notes.md` "Downloaded
   assets". If the file is not there, stop and request figma-extract to re-run.
   Word-descriptions of visual assets are forbidden in `contract.md` anatomy.
5. **Full Figma capture — no simplification, no omission.** The §2 anatomy
   must document **every visible element** in the Figma frame — every column,
   row, section, icon, label, link, image placeholder, and static text block.
   Do NOT summarise or collapse. Rules:
   - If Figma shows a 4-column footer, document 4 distinct named columns with
     their exact content (title, links list, contact details, etc.).
   - If Figma shows a multi-tier nav, document every tier with every item.
   - If Figma shows static marketing copy, banners, or icon strips, document
     each one — they are part of the design, not optional decoration.
   - Never write "etc." or "…and similar items" in an anatomy element list —
     enumerate every item explicitly.
   - Non-interactive elements that are visible in Figma are required in the
     implementation. Registering them as `component.*` paths is optional;
     rendering them is NOT optional.
   A contract that omits visible Figma elements is incomplete. `feature-implement`
   will use this contract as the complete build checklist — any element absent
   from §2 is likely to be missing from the implementation too.
6. **Component-set variants must not be collapsed in §4.** If the cache shows
   different `componentProperties` on sibling instances (e.g. six `FeatureCard`s
   with different `Accent` values), §4 needs one token row per instance — not
   one generic row for the component name. Collapsing variants is a contract
   defect that causes first-run orange-accent-on-everything bugs even when
   extraction is correct.
7. **`notes.md` must include Dual-source reconciliation.** If the figma-extract
   reconciliation table is missing or shows MCP ✗ for any slice-root → **STOP**.
   Re-run `/figma-extract` before contracting. A REST-only extract cannot
   produce an exact contract for component-set variants.
8. **Dual motion tracks — both may coexist.** Never read `tokens/MOTION-SPEC.md`.
   - **Track A (primary):** every animated section's §2 **Motion** block must trace
     to `motion-chains.json` + `motion-diffs.json` + `motion-state-poses.json`.
     Incomplete chains block the contract unless user approves partial contract.
   - **Track B (supplementary):** when `motion-spec.json` exists, §5b must be
     populated and `designerConfirmed: true` before `status: contracted`.
     Track B does not replace Track A for prototype-driven slices.

## Success criteria
- `contract.md` exists with all sections populated.
- Every visual value is a design token.
- §2 anatomy accounts for **every visible element** in every Figma frame —
  no sections, columns, or elements are absent or summarised with "etc."
- Every named element in §2 carries a `[component.*]  data-testid` tag.
- Every `[component.*]` tag in §2 is registered in `tokens/ui-registry.json`.
- `npm run validate:contract -- <id>` exits 0.
- Every IMAGE, ICON, LOGO, BADGE, or ILLUSTRATION in §2 anatomy references
  an actual `public/` file path — no word-only descriptions of visual assets.
- Every `public/` path referenced in the anatomy exists on disk.
- **Motion Track A (when `*-animation` twins exist):** every closed chain has a §2
  **Motion** block + **Motion bindings** table; every `gifRef` is in anatomy;
  `npm run validate:motion-chains -- <id>` exits 0.
- **Motion Track B (when `motion-spec.json` exists):** §5b populated for every
  `components[]` entry; `timing.designerConfirmed: true` for all; 
  `npm run validate:motion-spec -- <id>` exits 0.
- Backlog status is `contracted`.

## Step final — Commit (mandatory)

After Checkpoint B exits 0 and `status: contracted` is written:

```bash
git rev-parse --abbrev-ref HEAD   # must be feature/<fe-jira-id>
git add features/<id>/contract.md features/<id>/memory.md features/backlog.yaml
git commit -m "chore(<id>): design-contract"
```

If Step 0 created the branch, this is the first commit on that branch. See
`skills/_shared/pipeline-git-commit.md`.
