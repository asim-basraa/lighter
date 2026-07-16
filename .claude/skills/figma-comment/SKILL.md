---
name: figma-comment
description: >-
  Post a stage summary as a comment on the Jira ticket and/or Figma file for
  the current feature. Used to keep stakeholders informed at key pipeline
  milestones. Run after PRD v1, Gherkins, and major gate passes.
---

# figma-comment

Cross-cutting skill. Posts a concise summary of the current stage output as a
comment on the parent Jira ticket and (optionally) the Figma file. Keeps
product, design, and engineering in sync without manual updates.

## When to run
- After PRD v1 grilling is complete (prd-author)
- After Gherkins are finalised and validated
- After FE Contract is written (design-contract)
- After gate passes (impl-gate)

## Inputs
- Current stage output (PRD file, .feature file, contract.md, or gate report)
- `features/<parent-id>/memory.md` — for ticket IDs and Figma URL
- `docs/features/<parent-id>/brief.md` — for Figma URL if needed

## Procedure

### Step 1 — Identify the trigger
Determine which stage just completed and what summary to post:

| Trigger | Summary content |
|---------|----------------|
| After `prd-author` | Problem, goal, screen list, open questions |
| After `gherkin-validate` | Scenario count, @fe/@be split, AC coverage |
| After `design-contract` | Component list, API bindings, Figma coverage check result |
| After `impl-gate` pass | Gate result, test counts, visual diff status |

### Step 2 — Format the comment
```markdown
## Pipeline Update — <Stage Name> ✓
**Feature:** <parent-id> — <Feature Name>
**Date:** <ISO date>

<stage summary — 3-8 bullet points>

**Next step:** <next skill in pipeline>
```

### Step 3 — Write to local comment log (default / testing mode)
If `JIRA_BASE_URL` is not set: append the comment to
`features/<parent-id>/tickets/comments.md` with a timestamp.

```markdown
---
## <Stage Name> — <ISO date>
<formatted comment body>
```

This file is the local substitute for Jira comments. No manual action needed.

### Step 4 — Post to Jira (integrated mode only)
If `JIRA_BASE_URL` is set: POST comment via Jira API to `<parent-id>`.
On failure: fall back to local log. Never block the pipeline.

### Step 5 — Post to Figma (optional)
If `brief.md` has a Figma URL and the Figma MCP is available:
Post the same summary as a Figma comment on the relevant frame.
If Figma MCP is unavailable, skip silently — do not block.

## Success criteria
- Comment written to `tickets/comments.md` (local) or Jira (integrated)
- No pipeline blocking — this skill is informational only

## Hard rules
- Never block the pipeline. This skill is fire-and-forget.
- In local mode, `tickets/comments.md` captures the full comment history.
- Keep comments concise — use bullet points.
