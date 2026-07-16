---
name: jira-sync
description: >-
  Update ticket status at a pipeline stage completion. Works in two modes:
  local-only (default for testing — no Jira needed) and Jira-integrated.
  In local mode, status is tracked entirely in memory.md and a local
  tickets/ status file. Cross-cutting skill run after every stage.
---

# jira-sync

Tracks pipeline status after every stage. **Default mode is local-only** —
no Jira account or integration required. All status is stored in
`features/<parent-id>/memory.md` and `features/<parent-id>/tickets/status.md`.

Switch to Jira mode only when `JIRA_BASE_URL` and `JIRA_TOKEN` are set in
the project environment.

## Status values by stage

| Stage completed | Ticket | Status to set |
|----------------|--------|---------------|
| feature-brief | parent | `brief-created` |
| prd-author + prd-review (v1) | parent | `prd-v1-approved` |
| prd-update + prd-review (v2) | parent | `prd-v2-approved` |
| ticket-generate | parent + FE + BE | `tickets-created` |
| gherkin-validate | parent | `gherkins-ready` |
| figma-extract (FE) | FE ticket | `figma-extracted` |
| design-tokens (FE) | FE ticket | `tokens-compiled` |
| ui-registry-build (FE) | FE ticket | `ui-registry-ready` |
| design-contract (FE) | FE ticket | `fe-contract-ready` |
| orm-schema-author (BE) | BE ticket | `be-contract-ready` |
| be-implement (BE) | BE ticket | `be-implemented` |
| fe-implement (FE) | FE ticket | `fe-implemented` |

## Procedure

### Step 1 — Determine mode
Check for `JIRA_BASE_URL` in the environment:
- **Not set (default / testing)** → local-only mode. Skip Jira API entirely.
- **Set** → Jira-integrated mode.

### Step 2 — Update `features/<parent-id>/memory.md`
Always — in both modes. Open the file and update the Feature Identity block:
```markdown
- **Status:** <new status>
- **Last updated:** <ISO date>
```

### Step 3 — Update local status file (local-only mode)
Write or update `features/<parent-id>/tickets/status.md`:
```markdown
# Ticket Status — <parent-id>

Last updated: <ISO date>

| Ticket | ID | Status |
|--------|-----|--------|
| Parent | <parent-id> | <status> |
| FE | <fe-jira-id> | <fe-status> |
| BE | <be-jira-id> | <be-status> |
```

This file is the local substitute for Jira. Any skill that needs to check
ticket status reads this file in local mode.

### Step 4 — Jira API call (Jira-integrated mode only)
If `JIRA_BASE_URL` is set: PATCH the ticket status via Jira REST API.
On API failure: log the error, fall back to local file update, continue.
Never block the pipeline on a Jira API failure.

## Success criteria
- Memory Status field updated
- `tickets/status.md` updated (local mode) OR Jira status patched (integrated mode)

## Hard rules
- Never blocks the pipeline. Status tracking is informational.
- Never sets `approved` — only humans do that.
- In local mode, `tickets/status.md` IS the source of truth for status.
