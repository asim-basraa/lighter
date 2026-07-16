---
name: prd-update
description: >-
  Enrich PRD v1 into PRD v2 by analysing Figma frame data and any available
  Swagger/OpenAPI spec. PRD v2 is the complete feature spec that Gherkins and
  contracts are built from. Run after prd-author and human prd-review of v1.
---

# prd-update

Reads the human-approved `prd-v1.md` and enriches it with Figma frame
analysis + Swagger endpoint review to produce `prd-v2.md`. PRD v2 is the
final input for `spec-author` (Gherkins) and both contracts.

## Inputs
- `docs/features/<parent-id>/prd-v1.md` — approved PRD v1
- `features/<parent-id>/memory.md` — feature memory (read PRD v1 section)
- Figma frame data — if available, via the Figma URL in `brief.md`
- Swagger / OpenAPI spec URL — if available (may not exist yet at this stage)

## Procedure

### Step 0 — Read memory
Read `features/<parent-id>/memory.md`. Confirm PRD v1 section is present and
marked approved. If not approved yet, stop and ask the user to run `prd-review`
first.

### Step 1 — Analyse Figma (if available)
If `brief.md` contains a Figma URL:
- List every screen/frame the feature touches
- For each frame: note components, states, data-bound fields, layout patterns
- Identify every piece of data the UI displays that must come from the API

If Figma is not yet available, note "Figma not yet provided — FE contract will
require figma-extract before design-contract runs" and continue.

### Step 2 — Analyse Swagger (if available)
If a Swagger/OpenAPI spec URL is in `brief.md`:
- List relevant endpoints (method + path)
- Note request/response schemas for each
- Cross-reference with Figma data points: every field the UI displays should
  have a source endpoint

If Swagger is not yet available (this is normal — `openapi-author` creates it
later from Gherkins), note "Swagger not yet available — BE will produce it
via openapi-author" and continue.

### Step 3 — Write `docs/features/<parent-id>/prd-v2.md`

PRD v2 must include everything from PRD v1 plus these new sections:

```markdown
# PRD v2 — <Feature Name> (<parent-id>)

> Enriched from PRD v1 on <ISO date>. Approved PRD v1 at: docs/features/<parent-id>/prd-v1.md

## [All sections from PRD v1 — carry forward unchanged]

---

## Figma Analysis
<!-- Only if Figma was available -->
### Screens / frames reviewed
| Frame name | NodeId | Description |
|------------|--------|-------------|
| <name> | <id> | <what's on it> |

### Components identified
- <component name>: <state list — default / hover / empty / error>
- ...

### Static content (no API)
- <list of text, icons, layout elements that are always the same>

---

## Swagger Analysis
<!-- Only if Swagger was available, otherwise note it will be created by openapi-author -->
### Relevant endpoints
| Method | Path | What it does |
|--------|------|-------------|
| <METHOD> | <path> | <description> |

### Response fields used by UI
| Endpoint | Field | Where displayed in Figma |
|----------|-------|------------------------|
| <path> | <$.data.field> | <component name> |

---

## Data Points FE Needs from BE
<!-- The handshake table — FE depends on these fields being in the OpenAPI response -->
| UI Component | Data field | Source endpoint | Response path |
|-------------|-----------|-----------------|---------------|
| <Figma component> | <field name> | <METHOD /path> | <$.data.field> |

---

## Edge Cases
- <edge case 1 — what happens when data is missing/empty/invalid>
- <edge case 2>

---

## Updated Acceptance Criteria
<!-- Full list, refined from Figma + Swagger review. Each AC must be testable. -->
1. <AC — observable, specific>
2. ...

---

## Definition of Done
- [ ] All ACs have a Gherkin scenario
- [ ] All Figma data-bound fields have a source endpoint
- [ ] Empty states covered
- [ ] Error states covered
```

### Step 4 — Run `prd-checklist`
Verify PRD v2 completeness:
- Every screen has at least one AC
- Every data-bound Figma component has an endpoint in the Data Points table
- Empty and error states are covered
- If `prd-checklist` fails, fix the gap and re-run before continuing.

### Step 5 — Write to memory
Append the PRD v2 section to `features/<parent-id>/memory.md`:

```markdown
## PRD v2
<!-- Written by: prd-update on <ISO date> -->
<!-- Approved by: human via prd-review — pending -->
Full file: docs/features/<parent-id>/prd-v2.md

### Summary
- Screens: <count>
- ACs: <count>
- Data-bound fields: <count>
- Edge cases: <count>
```

### Step 6 — Run `prd-review`
Human must approve PRD v2 before `spec-author` or any contract work begins.

## Success criteria
- `prd-v2.md` exists with all required sections
- Data Points table has an entry for every Figma data-bound component
- `prd-checklist` passes
- Memory PRD v2 section written
- Human approval received via `prd-review`

## Hard rules
- Never skip the Data Points table — it is the FE/BE handshake contract at PRD level.
- If Figma is unavailable, document that and continue — do not block on it.
- PRD v2 does not invent endpoints. If Swagger is unavailable, the Data Points table lists field names only (without endpoint paths). `openapi-author` fills the endpoints later.
