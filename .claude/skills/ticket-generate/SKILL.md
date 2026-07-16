---
name: ticket-generate
description: >-
  Create FE and BE child tickets from approved PRD v2. Works in two modes:
  local-only (default for testing — no Jira needed) and Jira-integrated.
  In local mode, ticket files are created under features/<parent-id>/tickets/.
  The IDs produced here are used in every file path, folder, and skill downstream.
  Run after prd-v2 is approved.
---

# ticket-generate

Reads approved `prd-v2.md` and creates two child tickets: FE (`<fe-jira-id>`)
and BE (`<be-jira-id>`). **Default mode is local-only** — no Jira needed.
Tickets are markdown files; IDs are simple strings you define.

## Inputs
- `docs/features/<parent-id>/prd-v2.md` — approved PRD v2
- `features/<parent-id>/memory.md` — to update Feature Identity

## Mode detection
- **No `JIRA_BASE_URL`** → local-only mode (default for testing)
- **`JIRA_BASE_URL` set** → Jira-integrated mode

---

## LOCAL-ONLY MODE (default)

### Step 1 — Assign ticket IDs
Ask the user for simple IDs to use, or propose defaults:

```
Parent ticket: <parent-id>   (already set in memory)
FE ticket:     <parent-id>-FE   e.g. FEAT-001-FE
BE ticket:     <parent-id>-BE   e.g. FEAT-001-BE
```

If the user approves, use these. If they provide different IDs, use those.
The IDs can be anything — they just need to be consistent across all files.

### Step 2 — Create FE ticket file
Write `features/<parent-id>/tickets/fe-ticket.md`:

```markdown
# FE Ticket — <fe-jira-id>
**Parent:** <parent-id>
**Status:** tickets-created
**Created:** <ISO date>

## What to build
<screens and UI behaviours from PRD v2>

## Figma frames
<list of frames and nodeIds from PRD v2>

## Data Points (fields this FE ticket needs from BE)
<Data Points table from PRD v2>

## Acceptance Criteria
<@fe-relevant ACs from PRD v2 Updated Acceptance Criteria>

## Dependencies
BE ticket (<be-jira-id>) must be be-implemented before FE starts.
```

### Step 3 — Create BE ticket file
Write `features/<parent-id>/tickets/be-ticket.md`:

```markdown
# BE Ticket — <be-jira-id>
**Parent:** <parent-id>
**Status:** tickets-created
**Created:** <ISO date>

## What to build
<endpoints and data behaviours from PRD v2>

## Data to expose
<Data Points table from PRD v2>

## Acceptance Criteria
<@be-relevant ACs from PRD v2>

## Gherkins
Shared file: features/<parent-id>/<parent-id>.feature
Run with --tags @be for BE-only execution.
```

### Step 4 — Create feature directories
```
features/<fe-jira-id>/
features/<be-jira-id>/
docs/features/<fe-jira-id>/
docs/features/<be-jira-id>/
```

### Step 5 — Update memory
```markdown
## Feature Identity
- **Parent ticket:** <parent-id>
- **FE ticket:** <fe-jira-id>
- **BE ticket:** <be-jira-id>
- **Status:** tickets-created
- **Last updated:** <ISO date>
```

### Step 6 — Run `jira-sync`
Creates `features/<parent-id>/tickets/status.md` with initial statuses.

---

## JIRA-INTEGRATED MODE

### Step 1 — Prepare ticket bodies
(Same content as local mode above)

### Step 2 — Create via Jira API
POST to Jira REST API to create child issues under `<parent-id>`.
Record the generated issue keys as `<fe-jira-id>` and `<be-jira-id>`.

### Step 3 — Continue as local mode
Steps 4–6 above apply identically.

---

## Success criteria
- FE and BE ticket files exist (local) or Jira issues created (integrated)
- `<fe-jira-id>` and `<be-jira-id>` written to memory
- Feature directories created
- `tickets/status.md` written

## Hard rules
- Never invent IDs without asking. User must confirm or provide them.
- IDs are immutable once written to memory.
- Local ticket files are a full substitute for Jira — the pipeline runs identically in both modes.
