---
name: scenario-review
description: >-
  Human-in-the-loop gate for Gherkin scenario review. Presents the shared
  .feature file for human inspection and records approval. Run after spec-author
  and before gherkin-validate. Nothing proceeds to contracts until approved.
---

# scenario-review

Human review gate for the shared Gherkin `.feature` file. The reviewer checks
that every AC is covered, scenarios are vertical slices, `@fe`/`@be` tags are
correct, and happy/empty/error states are present.

## Inputs
- `features/<parent-id>/<parent-id>.feature` — the Gherkin file to review
- `docs/features/<parent-id>/prd-v2.md` — for AC cross-check
- `features/<parent-id>/memory.md` — to record the decision

## Procedure

### Step 1 — Present the scenarios
Display a structured summary of the `.feature` file:
- Total scenario count
- `@fe` scenario list with one-line descriptions
- `@be` scenario list with one-line descriptions
- Any scenarios without `@fe` or `@be` tag (flag these — every scenario needs one)

### Step 2 — Show the review checklist
Present this checklist to the user and ask them to verify each item:

```
Gherkin Review Checklist — <parent-id>

[ ] Every AC from PRD v2 has at least one scenario
[ ] Every scenario is a vertical slice (Given sets up full state from scratch)
[ ] No scenario depends on state from a previous scenario
[ ] @fe scenarios reference component.* or screen.* paths in Then steps
[ ] @be scenarios reference HTTP method + path in When steps
[ ] Happy path covered for each feature behaviour
[ ] Empty state covered where relevant
[ ] Error state covered where relevant
[ ] @fe and @be tags are on the correct scenarios
```

### Step 3 — Ask for decision
> "Gherkin review for `<parent-id>` — approve or request changes?"

Wait for explicit response.

### Step 4 — Record in memory
Approved:
```markdown
## Gherkins
<!-- Written by: spec-author -->
<!-- Reviewed by: human on <ISO date> — approved -->
```

Changes requested:
```markdown
<!-- Changes requested by: human on <ISO date> -->
<!-- Reason: <summary> -->
<!-- Status: returned to spec-author for revision -->
```

### Step 5 — If approved, run `gherkin-validate`
Approved by human does not mean technically valid. After human approval,
immediately run `gherkin-validate` as the automated gate.

## Success criteria
- Human explicitly approved the scenarios
- Every checklist item confirmed
- Memory updated with approval record
- `gherkin-validate` is next step

## Hard rules
- Never self-approve.
- Human approval and `gherkin-validate` are both required — neither replaces the other.
