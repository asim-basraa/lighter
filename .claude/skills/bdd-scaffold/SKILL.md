---
name: bdd-scaffold
description: Generate BDD step definitions from a Gherkin .feature file so the tests run and fail red. Stack-agnostic dispatcher; reads .claude/stack.yaml and follows the matching driver (Playwright BDD for Next.js, adaptable for other stacks). Use this skill whenever the user wants test scaffolding, BDD steps, step definitions, or "wire up the tests" for a feature — even if they don't explicitly say "skill". Run this after spec-author and before feature-implement.
---

# bdd-scaffold

Step 6 of the agentic SDLC loop. Binds a Gherkin spec to executable BDD
tests. After this skill the tests exist and **fail** — that is correct (red
phase of test-first development).

## Inputs
- `features/<id>/<id>.feature` — the Gherkin spec from spec-author.
- `features/<id>/contract.md` — its UI registry entries (§1a) drive
  selector choice.
- `tokens/build/test-ids.ts` — UI registry test-id lookup.
- `tokens/build/api-fields.ts` — API field paths + `resolveFieldPath()`.
- `tests/steps/field-bindings.steps.ts` — shared steps for
  `` `field.…` is displayed in `component.…` `` (reuse; do not duplicate).

## Outputs
- `tests/steps/<id>.steps.ts` — BDD step definitions for this feature.

## Stack resolution (run before generating any step definitions)

1. Read `.claude/stack.yaml`. If the file does not exist, default to `stack: nextjs`.
2. Identify the `stack` value (e.g. `nextjs`, `express-react`).
3. Read `.claude/skills/bdd-scaffold/drivers/<stack>.md`.
4. If no driver file exists for this stack:
   **STOP.** Tell the user:
   > "No bdd-scaffold driver exists for `<stack>`.
   > Create `.claude/skills/bdd-scaffold/drivers/<stack>.md` following the
   > pattern in `drivers/nextjs.md`, then re-run bdd-scaffold."
5. Follow the driver file for the full step-generation procedure.

## Procedure

All step-generation steps (file location, BDD framework API, test-id selectors,
field-binding helpers, token assertion helpers, run command) are defined in the
stack driver loaded above. The driver is the procedure.

The fidelity mandate, anatomy coverage rule, and `validate:contract` requirement
defined above this section remain in force regardless of stack.

## Fidelity mandate
Step definitions must wire **every** registered `component.*` path from the
contract's §1a — do not silently skip a path because it has no Gherkin step
yet. If a registered path has no corresponding Gherkin step in the `.feature`
file, that is a gap in the spec: return to `spec-author` and add the missing
scenario rather than leaving the component untested.

The Gherkin spec must exercise all **named sections visible in the Figma
design** — not just interactive triggers. If the contract defines a thumbnail
carousel, a price badge, a quantity stepper, a wishlist row, or a safe-checkout
banner, at least one scenario must assert each is visible. A test suite that
only tests button clicks while layout sections go unverified will allow a stub
to pass the gate.

After writing step definitions, execute the two mandatory checkpoints below
**in order** as Bash tool calls. Do not run `test:e2e` until both exit 0.

---

> ### ✦ MANDATORY CHECKPOINT A — Contract anatomy
> **Run this Bash command now. Do not skip, do not defer to the user.**
> ```bash
> npm run validate:contract -- <id>
> ```
> Check 2 verifies every `component.*` path in §1a has ≥1 `` `component.*` is visible ``
> step in the `.feature` file.
>
> | Exit code | Action |
> |-----------|--------|
> | **0** | Proceed to Checkpoint B |
> | **non-zero** | **STOP.** For every path lacking a visibility step, add an anatomy scenario to the `.feature` file:<br>```gherkin<br>Scenario: <section> is rendered<br>  Given <minimal setup><br>  When the user navigates to "<route>"<br>  Then \`component.X.Y.elementName\` is visible<br>```<br>Add the matching step definition, then **re-run** before continuing. |

---

> ### ✦ MANDATORY CHECKPOINT B — BDD generation (no missing steps)
> **Run this Bash command now. Do not skip, do not defer to the user.**
> ```bash
> npm run bdd
> ```
> This runs `bddgen` and catches any step text in `.feature` files that has no
> matching step definition in the step definitions directory.
>
> | Exit code | Action |
> |-----------|--------|
> | **0** | Both checkpoints passed — proceed to `feature-implement` |
> | **non-zero** | **STOP.** The output lists every missing step definition. Add each one to the step file and **re-run** before continuing. Do not hand off to `feature-implement` with missing steps — they will be invisible failures during the gate. |

## Success criteria
- The step definitions file produced by the driver compiles (no TypeScript errors).
- `bddgen` generates test files without error.
- Every registered `component.*` path from the contract §1a is addressed by
  at least one step definition.
- `npm run validate:contract -- <id>` exits 0 (all three checks pass).
- The new feature's scenarios run and fail with "not implemented"-style
  failures (missing route, missing element), not crashes.

## Failure handling
If steps fail to compile, fix the step file. If a scenario can't be expressed
as a runnable step, return to `spec-author` — the spec, not the test, is wrong.

## Step final — Commit (mandatory)

After Checkpoint B exits 0:

```bash
git add tests/steps/ playwright.config.ts package.json package-lock.json features/<id>/memory.md
git commit -m "chore(<id>): bdd-scaffold"
```

See `skills/_shared/pipeline-git-commit.md`.
