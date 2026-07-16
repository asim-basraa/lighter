---
name: prd-review
description: >-
  Human-in-the-loop gate for PRD approval. Presents the PRD to the user for
  review and records their decision. Run after prd-author (for v1) and after
  prd-update (for v2). Nothing proceeds until this skill exits with approval.
---

# prd-review

Human approval gate. Presents the PRD and waits for explicit approval or
change requests before allowing the pipeline to advance.

## When to run
- After `prd-author` produces `prd-v1.md` — gate before `prd-update`
- After `prd-update` produces `prd-v2.md` — gate before `spec-author`

## Inputs
- `docs/features/<parent-id>/prd-v1.md` or `prd-v2.md` — the file to review
- `features/<parent-id>/memory.md` — to record the decision

## Procedure

### Step 1 — Present the PRD
Read the PRD file and display a concise summary to the user:
- Problem being solved
- Personas
- Screens and key ACs (v1) or full AC list (v2)
- Data Points table (v2 only)
- Any open questions or gaps flagged in the document

### Step 2 — Ask for decision
Ask the user:
> "PRD [v1/v2] for `<parent-id>` is ready for review.
> - **Approve** — pipeline continues
> - **Request changes** — describe what to change; skill stops and returns to [prd-author / prd-update]"

Wait for explicit response. Do not proceed on silence.

### Step 3 — Record decision in memory
Approved:
```markdown
<!-- Approved by: human on <ISO date> -->
```

Changes requested — append to PRD section in memory:
```markdown
<!-- Changes requested by: human on <ISO date> -->
<!-- Reason: <summary of requested changes> -->
<!-- Status: returned to [prd-author / prd-update] for revision -->
```

### Step 4 — If approved, update Jira
Run `jira-sync` to set status:
- PRD v1 approved → `prd-v1-approved`
- PRD v2 approved → `prd-v2-approved`

## Success criteria
- User explicitly approved the PRD
- Memory updated with approval record and date
- Jira status updated

## Hard rules
- Never self-approve. Only a human sets approval here.
- If changes are requested, do not advance status. Return to the relevant skill.
- This skill has no output file of its own — it only records a decision.
