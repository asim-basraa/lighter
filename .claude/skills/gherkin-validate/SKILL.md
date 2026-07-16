---
name: gherkin-validate
description: >-
  Automated validation of the shared Gherkin feature file. Checks syntax,
  @fe/@be tag coverage, AC traceability against PRD v2, and that component
  paths and endpoint paths are well-formed. Run after scenario-review and
  before any contract work. Exit 0 = pass, exit 1 = fail.
---

# gherkin-validate

Automated gate that validates the shared `.feature` file before contracts are
written. Both `scenario-review` (human) and this skill (automated) must pass
before the pipeline can advance.

## Inputs
- `features/<parent-id>/<parent-id>.feature` — the file to validate
- `docs/features/<parent-id>/prd-v2.md` — for AC traceability check
- `features/<parent-id>/memory.md` — to record results

## Checks

### Check 1 — Syntax
Every `Scenario:` block has:
- At least one `Given` step
- At least one `When` step
- At least one `Then` step
- No orphaned steps (steps outside a Scenario block)
- No duplicate scenario names within the file

### Check 2 — Tag coverage
Every `Scenario:` has exactly one of `@fe` or `@be` (not both, not neither).
Flag any scenario missing a tag or carrying both.

### Check 3 — AC traceability
Every acceptance criterion listed in `prd-v2.md` under "Updated Acceptance
Criteria" must have at least one scenario whose name or comment references it.
Flag any AC with no matching scenario.

### Check 4 — Vertical slice check
No `Given` step may reference "the previous scenario", "existing data from
above", or any state that would only exist if another scenario ran first.
Check that every `Given` is self-contained.

### Check 5 — Component path format (@fe)
All `@fe` `Then` steps that reference a component path must use the format
`` `component.<lowerCamelCase>.<lowerCamelCase>` `` or
`` `screen.<lowerCamelCase>` ``.
Flag any component reference that uses spaces, PascalCase, or slashes.

### Check 6 — Endpoint format (@be)
All `@be` `When` steps that reference an HTTP call must use the format
`a <METHOD> request is made to "<path>"` where METHOD is uppercase
(GET, POST, PUT, PATCH, DELETE) and path starts with `/`.

## Procedure

Run all six checks in sequence. Collect all failures — do not stop at the
first failure. After all checks:

**If all pass:**
- Write to memory:
  ```markdown
  ## Gherkins
  <!-- Validated by: gherkin-validate on <ISO date> — all checks passed -->
  <!-- @fe scenarios: <count> | @be scenarios: <count> -->
  Full file: features/<parent-id>/<parent-id>.feature
  ```
- Update Jira ticket to `gherkins-ready` via `jira-sync`
- Report: "gherkin-validate passed — <N> scenarios, <fe> @fe, <be> @be"

**If any fail:**
- List every failure with check number, scenario name, and what's wrong
- Do NOT update memory or Jira
- Report exit 1 with full failure list
- Return to `spec-author` to fix and re-run

## Success criteria
- All 6 checks exit 0
- Memory Gherkins section updated
- Jira status `gherkins-ready`

## Hard rules
- This skill never modifies the `.feature` file — it only validates.
- A human approval from `scenario-review` does not waive any check here.
- Both must pass independently.
