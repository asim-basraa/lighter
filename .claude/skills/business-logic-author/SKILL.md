---
name: business-logic-author
description: >-
  Write the Business Logic contract (Contract 2 of 3) for the BE feature.
  Reads @be Gherkins and the OpenAPI spec (Contract 1) to produce
  business-logic.md — all validation rules, state machines, calculations,
  and authorization logic that the OpenAPI spec does not capture. Run after
  openapi-author, before orm-schema-author.
---

# business-logic-author

Produces `docs/features/<be-jira-id>/business-logic.md` — the second of three
BE contracts. The OpenAPI spec defines WHAT the API exposes; this document
defines HOW it behaves internally. `be-implement` reads all three contracts
together to implement each endpoint correctly.

## Inputs
- `features/<parent-id>/<parent-id>.feature` (only `@be` scenarios) — the
  shared Gherkins file, read from memory
- `docs/openapi/paths/<be-jira-id>.yaml` — Contract 1, already written by
  `openapi-author`
- `features/<parent-id>/memory.md` — to read BE Contract section

## Procedure

### Step 0 — Validate feature branch
```bash
git rev-parse --abbrev-ref HEAD
```
Must equal `feature/<be-jira-id>`. If it is `main` or anything else, stop:
> "Wrong branch. Switch with: `git checkout feature/<be-jira-id>`"
> `openapi-author` creates the branch — if it does not exist yet, that skill must run first.

### Step 1 — Read memory
Read `features/<parent-id>/memory.md`. Confirm:
- Gherkins are finalised (gherkin-validate passed)
- openapi-author has produced Contract 1

If Contract 1 is missing, stop. `openapi-author` must run first.

### Step 2 — Extract business rules from Gherkins
Read every `@be` scenario. For each:
- `Given` steps → initial state, preconditions, data setup
- `When` steps → the operation being triggered
- `Then` steps → expected outcome, state change, response content

Group by endpoint (match to OpenAPI paths). Within each endpoint, identify:
- **Validation rules** — what input values are allowed/required
- **State transitions** — what changes in the DB as a result
- **Calculations** — any derived values (totals, scores, dates)
- **Authorization** — who is allowed to call this and under what conditions
- **Error conditions** — what causes 4xx responses and which error code/message

### Step 3 — Write `docs/features/<be-jira-id>/business-logic.md`

```markdown
# Business Logic — <be-jira-id>: <Feature Name>

> Contract 2 of 3. Companion to OpenAPI spec at docs/openapi/paths/<be-jira-id>.yaml

## Endpoints covered
<list of METHOD + path with one-line description>

---

## Validation Rules

| Endpoint | Field | Rule | Error code | Error message |
|----------|-------|------|-----------|---------------|
| POST /path | fieldName | required, non-empty string, max 255 chars | 400 | "fieldName is required" |
| POST /path | email | valid email format | 422 | "Invalid email format" |
| ... | | | | |

---

## State Machines
<!-- For any entity that has lifecycle states (e.g. order: pending → confirmed → shipped) -->

### <Entity name>
States: <list>

| From state | Event / action | To state | Side effects |
|-----------|---------------|---------|-------------|
| pending | user confirms | confirmed | send confirmation email |
| ... | | | |

---

## Calculations
<!-- Any derived values, formulas, rounding -->

| Field | Formula | Notes |
|-------|---------|-------|
| totalPrice | sum(items[].price * items[].qty) | Round to 2 decimal places |
| ... | | |

---

## Authorization

| Endpoint | Who can call it | Conditions |
|----------|----------------|-----------|
| GET /items | any authenticated user | — |
| DELETE /items/:id | owner only | req.user.id === item.userId |
| ... | | |

---

## Error Catalogue

| Code | Scenario | HTTP status | Response body |
|------|---------|------------|--------------|
| ERR_NOT_FOUND | Resource does not exist | 404 | `{ "error": "not_found", "message": "..." }` |
| ERR_UNAUTHORIZED | User not allowed | 403 | `{ "error": "unauthorized" }` |
| ... | | | |

---

## Edge Cases and Special Behaviours
<!-- Non-obvious behaviours that aren't captured by the OpenAPI spec or the table above -->

1. <edge case — what happens and why>
2. ...
```

### Step 4 — Update memory
Append to BE Contract section in `features/<parent-id>/memory.md`:
```markdown
### Business Logic (Contract 2)
<!-- Written by: business-logic-author on <ISO date> -->
Full file: docs/features/<be-jira-id>/business-logic.md
Key rules:
- <rule 1>
- <rule 2>
```

## Success criteria
- `business-logic.md` exists with all sections populated
- Every `@be` Gherkin scenario is accounted for in at least one table
- Error catalogue covers all 4xx cases from the OpenAPI spec
- Memory BE Contract section updated

## Hard rules
- Never invent business rules. Every rule must trace to a `@be` Gherkin scenario.
- Never duplicate what the OpenAPI spec already says (schemas, status codes
  are already there). This document covers WHY and HOW, not WHAT.
- If a `@be` scenario has ambiguous behaviour, flag it and ask the user
  before writing the rule.
