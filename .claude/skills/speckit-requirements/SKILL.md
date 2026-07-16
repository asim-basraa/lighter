---
name: speckit-requirements
description: >-
  Per sub-feature Spec Kit phase (Section B in docs/workflow.mmd): specify, plan,
  optional clarify/analyze. Writes docs/specs/<id>/spec.md — markdown requirements
  only; Gherkin is still authored by api-spec-author / spec-author.
  Run after backlog exists, before feature-split or before (re)writing Gherkin.
---

# speckit-requirements

**When:** Each Level 2 sub-feature (`F-001a`, `F-002`, …) before build.  
**Diagram:** `docs/workflow.mmd` subgraph **B — Spec Kit IN markdown only**.

## Inputs

- `features/backlog.yaml` — target sub-feature `id` (not `.1` / `.2`, not epic)
- `docs/prd.md`
- `.specify/memory/constitution.md` (from **pipeline-bootstrap**)
- Optional Figma frame refs from backlog AC

## Outputs (canonical paths)

| Artifact | Path |
|----------|------|
| Feature spec | `docs/specs/<id>/spec.md` |
| Implementation plan | `docs/specs/<id>/plan.md` |
| Clarify / analyze notes | `docs/specs/<id>/research.md` or checklists under `docs/specs/<id>/checklists/` |
| Handoff report | `reports/<id>-speckit.md` |

Also update `.specify/feature.json`:

```json
{ "feature_directory": "docs/specs/<id>" }
```

## Procedure (one sub-feature per invocation)

### 1. Resolve `<id>`

- Must be `slice` absent or parent-level row (`status: pending` or `decomposed`).
- Read persona, story, AC from backlog + PRD section for that screen.

### 1a. **Grilling session** (required before speckit-specify)

Before writing any spec, run an intensive interrogation of the feature to build
a shared understanding. This is not requirements writing — it is requirements
*discovery*. The output feeds directly into `speckit-specify` as primary input.

Generate and answer **15–20 pointed questions** that challenge every assumption
in the backlog AC and PRD section. Cover:

- **Scope edges** — what is explicitly out of scope? What looks in-scope but isn't?
- **Empty / zero states** — what does the user see when there is no data?
- **Error states** — what happens when the API fails, times out, or returns unexpected data?
- **Auth boundaries** — what requires authentication? What happens if an unauthenticated user hits this route?
- **Data ownership** — who creates, reads, updates, deletes this data?
- **Definition of done per AC item** — what is the exact, measurable condition that makes each AC item complete?
- **Cross-feature dependencies** — what does this feature assume already exists?
- **Edge cases not mentioned in AC** — concurrent edits, duplicate submissions, large data sets, empty strings, special characters
- **Ambiguous language** — any term like "prominent", "fast", "clear", "relevant" must be quantified

For each question, answer it from PRD context, backlog AC, and constitution.
Flag any question that **cannot be answered** from available sources — these are
real gaps that must be resolved before `speckit-specify` runs.

Write all questions + answers to `docs/specs/<id>/grilling-notes.md`.
This file is a permanent artifact — it records *why* the spec says what it says.

Only proceed to `speckit-specify` when all critical gaps are resolved.

### 2. **speckit-specify**

- Feature description = backlog `story` + `acceptance_criteria` + PRD excerpt + Figma frame id if any.
- **Directory:** `docs/specs/<id>/` (not `specs/NNN-name` — backlog id is the folder name).
- Create `docs/specs/<id>/spec.md` from resolved spec template.
- Resolve all `[NEEDS CLARIFICATION]` (use **speckit-clarify** if needed; max 3 in specify).

### 3. **speckit-plan** (recommended)

- Input: `docs/specs/<id>/spec.md`
- Output: `docs/specs/<id>/plan.md` (tech choices, data model notes, risks).
- Plan must respect constitution: API-first, token-backed UI, SQLite/Drizzle for PoC.

### 4. **speckit-analyze** + **speckit-clarify** (recommended before Gherkin)

- Cross-check `spec.md` vs `plan.md` vs backlog AC.
- Document findings in `reports/<id>-speckit.md`.

### 4a. **speckit-checklist** (required before Gherkin handoff)

Run after analyze/clarify to catch vague or missing requirements that would
produce imprecise Gherkin. This is "unit tests for the English" — it validates
the spec itself, not the implementation.

Run **two passes**, one per slice type:

- **API slice (`.1`)** — focus `api`: error response formats, auth consistency
  across endpoints, retry/timeout requirements, rate limiting quantified,
  pagination requirements explicit.
  → `docs/specs/<id>/checklists/api.md`

- **UI slice (`.2`)** — focus `ux`: visual/interaction states (hover, focus,
  active, disabled, loading, empty) defined for every interactive element,
  accessibility requirements present, responsive breakpoints explicit,
  vague terms ("prominent", "fast", "clear") quantified.
  → `docs/specs/<id>/checklists/ux.md`

After each checklist is generated, **fix every `[Gap]` and `[Clarity]` item
in `spec.md`** before proceeding. Do not advance to Gherkin with open gaps —
a vague spec produces vague scenarios that cannot be gated objectively.

### 5. Optional AC sync

If spec adds/changes requirements:

- Update matching lines in `features/backlog.yaml` for `<id>`, `<id>.1`, `<id>.2` **only** (do not restructure ids).
- Or prompt user to run **story-author** for full backlog sync.

### 6. Write `reports/<id>-speckit.md`

- Links to `spec.md`, `plan.md`
- Checklist: constitution gates, open clarifications, ready for feature-split / Gherkin
- Explicit note: **Spec Kit does not write `.feature` files**

## What this skill does NOT do

| Out of scope | Owner skill |
|--------------|-------------|
| Gherkin `.feature` | **api-spec-author** (`.1`), **spec-author** (`.2`) |
| OpenAPI | **openapi-author** |
| UI contract | **design-contract** |
| Implementation | **api-implement** / **feature-implement** |
| **speckit-implement** | Do not use — agentic loop implements via existing skills |

## Integration with feature-loop

**feature-loop** runs this skill instead of feature-split when:

- Target is sub-feature `<id>` with `status: pending` (not yet `decomposed`), and
- `docs/specs/<id>/spec.md` is missing.

**feature-loop** runs this skill instead of api-spec-author / spec-author when:

- Target is `<id>.1` or `<id>.2` in `pending`, and parent’s `docs/specs/<id>/spec.md` is missing.

User may waive with: `Skip speckit-requirements for <id>` (document waiver in report).

## Rework (Section G in workflow.mmd)

| Change | Action |
|--------|--------|
| AC / scope change on same id | Re-run this skill → human resets affected slice status → **feature-loop** |
| Gate failure only | **api-implement** / **feature-implement** — no speckit |
| Major new scope | New backlog id — full pipeline from B |

## Hard rules

- One sub-feature per invocation.
- Never write Gherkin here.
- Never self-approve backlog.
- Never fabricate Figma measurements.

## Success criteria

`docs/specs/<id>/spec.md` exists and passes specify quality checklist, `plan.md` exists (recommended), `docs/specs/<id>/checklists/api.md` and/or `ux.md` exist with all `[Gap]` and `[Clarity]` items resolved back into `spec.md`, `reports/<id>-speckit.md` states ready for split or Gherkin, constitution referenced.
