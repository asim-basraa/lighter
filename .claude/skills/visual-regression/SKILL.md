---
name: visual-regression
description: Set up and run visual regression tests for a feature using Playwright screenshots, and produce a Figma-vs-app comparison for human review. Use this skill whenever the user wants visual testing, screenshot tests, pixel or visual diffing, UI fidelity checks, or to compare the build against the Figma design — even if they don't say "skill".
---

# visual-regression

Adds the visual-fidelity pillar. It is deliberately honest about what
automation can and cannot do, and splits into two jobs.

## Inputs
- A feature `id` and its `features/<id>/contract.md`.
- `features/<id>/figma/reference.png` — the Figma baseline, if it exists.
- `features/<id>/figma/reference-*-animation-state-*.png` — per-state motion
  baselines from figma-extract (when animation twins exist).
- `features/<id>/figma/motion-chains.json` — pattern and state list (optional;
  for motion test scaffolding; Track A).
- `features/<id>/figma/motion-spec.json` — keyframe inventory (optional;
  Track B; used when contract §5b exists without closed chains).
- The implemented, running feature.

## Job 1 — Golden-master regression  (the automated gate check)

Catches **drift between runs**. It does *not* prove a match to Figma.

1. Create `tests/visual/<id>.spec.ts`. For each key view and state listed in
   the feature's `contract.md`, navigate to it and call
   `await expect(page).toHaveScreenshot()`.
2. Use the contract's **Fidelity tolerance** as `maxDiffPixelRatio`
   (default `0.02`).
3. **First run** for a feature: no baseline exists, so Playwright *creates*
   one. This is **not a pass** — it means a human must approve the initial
   render (see Job 2). Report it as "baseline established, pending approval".
4. **Later runs:** any diff beyond tolerance is a real regression → fail.

## Job 2 — Figma fidelity review  (a human aid, not an automated assertion)

A browser render and a Figma export are never byte-identical, so app-vs-Figma
**cannot** be a hard pass/fail. Instead, produce a structured review artifact:

1. Capture the current app screenshot for each view/state.
2. Place it beside `features/<id>/figma/reference.png`.
3. Write `reports/<id>-visual.md` with a **section-by-section comparison**:
   - Walk every named section and element in `contract.md` §2 (anatomy).
   - For each one, explicitly note: **Present** (matches Figma), **Differs**
     (present but visually wrong — describe the difference), or **Missing**
     (visible in Figma / contract but absent from the app screenshot).
   - "Missing" is a hard finding that must be resolved before approval.
     Do not write "out of scope" or "deferred" — every element in the
     contract is in scope and must be present.
   - Flag specific discrepancies: wrong column count, absent footer section,
     missing icon strip, truncated link list, placeholder text where real
     content is specified, incorrect token (wrong colour / spacing / radius).

The human uses this report during approval to verify the implementation
exactly matches the Figma design. Any "Missing" or "Differs" finding means
the feature is not ready for approval — return to `feature-implement`.

## Job 3 — Dimension and computed-style assertions (the precision gate)

Catches **spacing, element size, and typography gaps** that pixel screenshots cannot see.
A 22px gap and a 24px gap are visually identical in a screenshot — this job catches the
difference. Run this alongside Job 1 for every feature with a `spec.json`.

### When to create Job 3 tests
Always, if `features/<id>/figma/spec.json` exists and has dimension or typography values.

### What to assert

**Element dimensions** — use `boundingBox()`:
```ts
const box = await page.locator('[data-testid="..."]').boundingBox()
expect(box!.height).toBeGreaterThanOrEqual(expected - tol)
expect(box!.height).toBeLessThanOrEqual(expected + tol)
```
- ±2px for heights set by Tailwind utility classes (h-10, h-12, etc.)
- ±4px for widths and flex/grid-driven dimensions
- ±30px for heights emergent from content (not hardcoded)

For elements inside nested flex containers, avoid deep Playwright locator chains
(`> div > div > div`). Use `.evaluate()` with `:scope > div` querySelectorAll instead:
```ts
const height = await page.locator('[data-testid="..."]').evaluate(el => {
  const child = el.querySelector(':scope > div')!
  return child.getBoundingClientRect().height
})
```

**Typography font size** — use `getComputedStyle`:
```ts
const fontSize = await el.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
expect(fontSize).toBe(TOKEN_PX['font.size.section'])  // tokens always resolve to whole px
```
Build a `TOKEN_PX` map from `tokens/build/tokens.css` at the top of the test file.

**Font weight** — exact string match:
```ts
const fontWeight = await el.evaluate(el => getComputedStyle(el).fontWeight)
expect(fontWeight).toBe('600')  // semibold = 600, regular = 400, medium = 500
```

### Viewport strategy
- **Default viewport (1280px)** — nav heights, typography, fixed-size elements that do not
  depend on viewport width (arrow buttons, image dimensions, font sizes, font weights).
- **1920px viewport** — widths of elements that use `2xl:` prefixes to match Figma's 1920px
  layout (e.g., `2xl:w-[424px]` small widgets, category card min-widths).

### File naming
Create `tests/visual/<id>-dimensions.spec.ts` — separate file so it can run alongside the
golden-master spec without inflating it.

### Mapping spec.json to assertions
Walk `figma/spec.json` and assert any node that has:
- `dimensions.width` or `dimensions.height` — use `boundingBox()` or `evaluate`
- `typography.size` — look up `TOKEN_PX[value]`, assert via `getComputedStyle().fontSize`
- `typography.weight` — assert via `getComputedStyle().fontWeight`

Prioritise fixed-size nodes (explicit Figma frame px values). Skip flex/auto-layout
dimensions that have no explicit constraint in the Figma file.

## Job 4 — Motion fidelity (human + optional automation)

**Static golden-master screenshots (Job 1) capture pre-hover layout only.** They
do **not** prove hover chains, cascades, or GIF loops match Figma.

| Responsibility | Who | How |
|----------------|-----|-----|
| End-state hover fidelity | Human at `fe-implement` Step 7 | Hover slice; compare to `reference-<slug>-animation-state-<N>.png` |
| Multi-step cascade | Human spot-check | Intermediate `reference-*-animation-state-2.png` etc. if cascade looks wrong |
| Ambient GIF | Human + `validate:assets` | GIF on disk matches `asset-manifest.json`; plays without hover |
| Optional automation (P2) | `tests/visual/motion-hover.spec.ts` | `page.hover('[data-testid=…]')` → wait `getDurationTokenMs(durationToken)` → screenshot |

When writing Job 2 (`reports/<id>-visual.md`), for animated sections add a
**Motion** subsection per `contract.md` **Motion** block (Track A) or §5b
(Track B when no §2 Motion block):
- **Pattern** from motion-chains (Track A) or trigger/keyframes from motion-spec (Track B)
- **Web entrance** from contract §5a-web / notes: `productIdle` /
  `qaIdle` / `source` — Job 1 baselines follow **qaIdle**; production behavior
  follows **productIdle** (may be `staticTwin` with no empty states when
  designer demands it). Designer may have used other Variable / prose names;
  contract holds the canonical mapping — judge against the contract, not Figma
  Variable spelling
- **Pre-hover screenshot** (Job 1 / qaIdle) vs **terminal state reference PNG** (Job 4)
- Verdict: **Matches** / **Differs** / **Not reviewed** (pending Step 7 APPROVE)
- Step 7 verifies production matches contracted `productIdle` — do not reject
  a slice for “not hidden” if the contract says `staticTwin`

Do not add motion hover screenshots to the golden-master baseline unless an
explicit `motion-hover.spec.ts` exists — mixing pre- and post-hover in the
default `lp-001.spec.ts` baselines would hide layout regressions.

Authoritative docs: `docs/motion-guideline.md` · `docs/motion-pipeline-plan.md`.

## Integration with governance-gate
`governance-gate` runs `npm run test:visual` as its fourth check:
- No baseline yet → record "visual baseline pending human approval"
  (neither pass nor fail; surfaces in the gate report).
- Baseline exists, no drift → pass.
- Baseline exists, drift beyond tolerance → fail.

## Hard rules

**Never delete or overwrite an approved baseline just to make a test pass.** A
failing visual test is either a real regression (fix the code) or an intended
change (a human runs `npm run test:visual:update` to re-baseline).

**Fresh clone / new machine rule:** Playwright baselines are machine-specific
(OS, GPU, font rendering, screen resolution). On a freshly cloned repo or a
new machine, `npm run test:visual` will fail because existing baselines were
generated on a different machine. The first action on any new environment is:

```bash
npm run test:visual:update   # re-baseline for this machine
```

This is mandatory before running `governance-gate` on a fresh clone. The
re-baselined snapshots must be committed. This is not a skip or a cheat — it
is a required environment-calibration step documented here as a hard rule so
no one silently disables visual tests when they fail on setup.

## Success criteria
- `tests/visual/<id>.spec.ts` exists and runs; baselines are generated or compared.
- `tests/visual/<id>-dimensions.spec.ts` exists if `figma/spec.json` has dimension/typography data.
- `reports/<id>-visual.md` is written with section-by-section Present/Differs/Missing verdicts.
- **Motion (when animation twins exist):** Job 2 report notes motion sections;
  Step 7 human review uses per-state reference PNGs (Job 4).

## Step final — Commit (mandatory)

After Jobs 1–3 complete (baselines created or verified, report written):

```bash
git add tests/visual/<id>*.spec.ts tests/visual/__screenshots__/visual/<id>*.spec.ts/ \
  reports/<id>-visual.md reports/<id>-screenshots/ features/<id>/memory.md
git commit -m "chore(<id>): visual-regression baselines"
```

See `skills/_shared/pipeline-git-commit.md`. First-run baselines are still
**pending human approval** — commit them anyway so the gate can compare drift.
