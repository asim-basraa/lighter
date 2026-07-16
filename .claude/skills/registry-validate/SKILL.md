---
name: registry-validate
description: >-
  Validate tokens/ui-registry.json against the Figma spec.json and Swagger.
  Checks that every Figma component is registered, every data-bound component
  maps to a Swagger endpoint, and every entry has required fields. Exit 0 =
  pass, exit 1 = fail. Run after ui-registry-build, before design-contract.
---

# registry-validate

Automated gate. Validates `tokens/ui-registry.json` against two sources:
1. **Figma spec.json** — every named element must be registered
2. **Swagger / OpenAPI spec** — every data-bound component must map to an endpoint

## Inputs
- `tokens/ui-registry.json` — the registry to validate
- `features/<fe-jira-id>/figma/spec.json` — Figma source of truth
- `features/<fe-jira-id>/figma/motion-diffs.json` — motion layer testIds (when
  animation twins exist; optional)
- `features/<fe-jira-id>/figma/motion-chains.json` — trigger testIds (when
  animation twins exist; optional)
- `docs/openapi/` or Swagger URL — for data-binding check (optional if not yet available)

## Checks

### Check 1 — Figma coverage
Every named element extracted from spec.json (sections, layers, widgets,
columns, banners) must have a corresponding entry in `ui-registry.json`.
Flat list of all Figma names → cross-reference with registry keys.

**Failure output:** list of Figma element names with no registry entry.

### Check 2 — Required fields
Every registry entry must have:
- `$description` — non-empty string
- `$states` — array with at least `"default"`
- `$screen` — string pointing to a valid `screen.*` entry (except screen entries themselves)

**Failure output:** list of entries missing required fields.

### Check 3 — Path format
Every key must match the pattern `^(screen|component)\.[a-z][a-zA-Z0-9.]*$`
with all segments in lowerCamelCase.

**Failure output:** list of malformed keys.

### Check 4 — Data binding coverage (if Swagger available)
For every component entry that has a `$dataSource` field, verify that the
referenced endpoint path exists in the OpenAPI spec.

If Swagger is not yet available (BE contracts not written), skip this check
and note "data binding check deferred — run registry-validate again after
openapi-author completes".

**Failure output:** list of components with `$dataSource` pointing to
non-existent endpoints.

### Check 5 — Missing / inexact tokens (BLOCKING)
Any entry with `"tokenMissing": true` is a **hard failure** (exit 1) — not a
warning. Display the raw Figma values and instruct: add exact primitive +
semantic via `design-tokens`, run `tokens:build`, re-run `ui-registry-build`.

Also fail if `$tokens` are present but the skill notes / memory claim a
nearest-token bind was used. Approximations and reuse of old section tokens
whose resolved value ≠ Figma are fidelity bugs — same as `tokenMissing`.

### Check 6 — Motion path coverage (when motion JSON exists)
If `features/<fe-jira-id>/figma/motion-diffs.json` exists:

- Every `layers[].testId` in motion-diffs must resolve to a key in
  `ui-registry.json`.
- Every `chains[].trigger.targetTestId` in `motion-chains.json` must resolve.
- Motion entries should carry `$figmaLayerName` when the diff row has a `name`
  field (warning if missing — not blocking until P1 enforcement).

If motion JSON is absent (feature has no animation twins), skip this check.

**Failure output:** list of motion testIds with no registry entry.

## Procedure

Run all applicable checks. Collect all failures.

**If all checks pass:**
- Report: "registry-validate passed — <N> components, <N> screens"
- Update memory Gherkins section with: `<!-- registry-validate: passed <ISO date> -->`

**If any check fails:**
- List every failure with check number and entry name
- Exit 1 — pipeline does not advance
- Return to `ui-registry-build` to fix

## Success criteria
- Checks 1–5 all pass (`tokenMissing` must be zero)
- Check 6 passes when motion JSON exists (or skipped when no animation twins)
- Memory updated

## Hard rules
- **`tokenMissing` blocks the gate** — same severity as missing entries /
  malformed paths. Do not advance to `design-contract` until resolved.
- Never modify `ui-registry.json` — this skill only reads and reports.
- Never advise binding the nearest existing token to clear Check 5 — require
  new exact tokens + `tokens:build` instead.
