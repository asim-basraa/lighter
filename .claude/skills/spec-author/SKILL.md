---
name: spec-author
description: Write a Gherkin feature spec for one backlog feature. Use this skill whenever the user wants a feature spec, Gherkin scenarios, a .feature file, or BDD scenarios for a feature — even if they don't explicitly say "skill". Run this after story-author and before design-contract.
---

# spec-author

Step 5a of the agentic SDLC loop. Turns one backlog story into an executable
Gherkin specification. (The *design contract* is a separate concern — the
`design-contract` skill owns it.)

## Inputs
- `features/backlog.yaml` — and a target feature `id` (ask the user if unclear,
  otherwise take the highest-priority `pending` feature).
- `docs/features/<parent-id>/prd-v2.md` — **primary input** (the approved PRD v2
  produced by `prd-update`). This is the authoritative requirements source for
  this pipeline. If missing, stop and tell the user to run `prd-update` first.
- `docs/features/<parent-id>/prd-v1.md` — fallback if prd-v2.md not yet present.
- `reports/tokens-report.md` — the allowed design-token vocabulary.

## Outputs
- `features/<id>/<id>.feature` — the Gherkin spec.

## Smart zone check (run before anything else)

Count the GitHub issues for `<parent-id>`:
- **≤ 15 issues** → proceed normally.
- **> 15 issues** → warn: _"⚠️ This feature has N vertical slice issues — the resulting Gherkin file may exceed the smart zone (~30+ scenarios). Consider splitting this feature into two smaller parent features, or grouping slices and writing Gherkin in batches across fresh chats. Continue anyway?"_ Wait for the user to decide.

Each issue maps to at most 2–3 scenarios (happy path + edge cases). If the issue count × 3 would exceed ~30 scenarios, the feature is too large — start a fresh chat per group.

## Procedure

0. **Gate — vertical slice issues must exist.** Before writing any Gherkin, check
   that GitHub issues have been created by `/to-issues` for this feature.
   - Look for open issues labelled with `<parent-id>` on the issue tracker, OR
     ask the user to confirm `/to-issues` has been run.
   - If no issues exist: stop and tell the user to run `/to-issues` first.
     Do not proceed. Gherkin scenarios must map 1:1 to the vertical slice issues.

1. Read `docs/features/<parent-id>/prd-v2.md` as the authoritative requirements source.
   Use the **Updated Acceptance Criteria** section as the scenario source.
   Use the **Data Points FE Needs from BE** table for field bindings in `@fe` scenarios.
   Use the **Edge Cases** section for error/empty state scenarios.
2. Write `features/<id>/<id>.feature` in Gherkin — **one scenario per vertical slice issue**.
   Each issue from `/to-issues` must map to at least one scenario. Do not write
   scenarios for behaviours that have no corresponding issue.
   - One `Feature:` block.
   - A `Scenario:` for the happy path plus scenarios for the key edge cases
     drawn from the story's `acceptance_criteria`.
   - **Component paths** — interactive UI uses `` `component.…` `` paths from the
     UI registry (backticks).
   - **Field bindings** — when UI displays API/server data, use field-path steps:
     `` Then `field.user.info.firstName` is displayed in `component.dashboard.overview.welcomeHeading` ``
     or slash aliases registered in `tokens/api-registry.json` (e.g.
     `` `/user/info.firstName` ``). See `reports/api-registry-glossary.md`.
   - **Token steps** — where appearance matters, use
     `Then … uses token "color.action.primary"` (tokens from `reports/tokens-report.md` only).
3. Update the feature's `status` in `backlog.yaml` to `specced`.

4. **Prompt for next skill (mandatory).** After writing the `.feature` file, tell the user:

   > "**`/spec-author` complete.** `features/<id>/<id>.feature` written with N scenarios.
   > Next: `/scenario-review` — human sign-off on the Gherkins before automated validation.
   > This is a required Day Shift gate. Run `/scenario-review` now.
   > Do NOT run `/gherkin-validate` directly — `/scenario-review` triggers it on approval."

   Do NOT run `/gherkin-validate` automatically. Do NOT advance to any contract skill.
   Wait for the user to run `/scenario-review` first.

## Success criteria
The `.feature` file is valid Gherkin, every referenced token exists in the
tokens report, the backlog status is `specced`, and the user has been told to run
`/scenario-review` next.

## Failure handling
If a scenario needs a token that does not exist, do not invent one — stop and
tell the user the design system is missing that token.

## Hard rules
- Never run `/gherkin-validate` directly after writing the `.feature` file.
- `/scenario-review` is the mandatory human gate between spec-author and gherkin-validate.
- Human sign-off and automated validation are both required — neither replaces the other.
