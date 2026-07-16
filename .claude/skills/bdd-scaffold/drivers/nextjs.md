# bdd-scaffold driver — Next.js 15 + Playwright BDD

This file is loaded by `bdd-scaffold/SKILL.md` when `.claude/stack.yaml` contains
`stack: nextjs`. Follow the procedure below. All fidelity mandates, anatomy
coverage rules, and registry selector rules defined in SKILL.md remain in force.

---

## Procedure

1. Read `features/<id>/<id>.feature` and the contract's UI registry
   entries (§1a). Every backtick path in a Gherkin step (e.g.
   `` `component.checkout.cart.checkoutButton` ``) is a registered
   component path, and `tokens/build/test-ids.ts` exposes both a typed
   nested `ids` accessor and a flat `testIds[path]` lookup.

2. In `tests/steps/<id>.steps.ts`, create a step definition for **every**
   `Given` / `When` / `Then` step in the feature, using `playwright-bdd`'s
   `createBdd()` API.

3. **Select elements by registry test-id only.** Import the typed lookup
   at the top of the file:
   ```ts
   import { ids, testIds, type RegistryPath } from '@/tokens/build/test-ids';
   ```
   Step definitions then use `page.getByTestId(ids.component.<feature>.<screen>.<component>)`
   (or `testIds['component.<feature>.<screen>.<component>']` if the path
   is dynamic). Do NOT select by visible text, CSS class, or DOM order:
   the registry path is the contract, not the visual or the styling.

4. For steps that parse a backtick path out of the Gherkin text
   directly (e.g. a generic `When the user taps {string}` step), assert
   the parsed string is a `RegistryPath` and look it up via
   `testIds[path]`. An unknown path is a test failure with a clear
   message — the same drift `ui-registry:check-sync` catches at the
   gate.

5. **Field-binding steps** — if the `.feature` uses
   `` `field.…` is displayed in `component.…` `` or
   `` `field.…` shown in `component.…` contains the text "…" ``,
   rely on `tests/steps/field-bindings.steps.ts` (already registered globally).
   Do not reimplement unless the feature needs a novel field assertion.

6. For design-contract steps that assert a token (e.g. *uses token
   "color.action.primary"*), implement a reusable helper that:
   - reads the element's computed style with `getComputedStyle`,
   - resolves the expected CSS variable (`var(--color-action-primary)`)
     against `tokens/build/tokens.css`,
   - asserts they match.

7. Regenerate and run the suite:
   ```
   npm run test:e2e
   ```
   (this runs `bddgen` then `playwright test`).

8. Confirm the new feature's scenarios **fail because the feature is not yet
   implemented** — not because of compile errors or unrelated breakage.
