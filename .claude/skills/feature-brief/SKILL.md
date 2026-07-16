---
name: feature-brief
description: >-
  PLANNING PHASE skill — runs before any BE or FE implementation work.
  Entry point for every new feature. Creates brief.md and memory.md.
  Can run in any repo that has skills installed (sdlc-be is the default
  when testing since BE implements first). Swagger does not exist yet at
  this stage — answer "none yet". Figma is optional.
---

# feature-brief

> **Phase: Planning** — This skill and the ones that follow
> (`prd-author` → `prd-update` → `ticket-generate` → `spec-author` →
> `gherkin-validate`) are **planning-phase skills**. They run before any
> BE or FE implementation work and can run in any repo.
>
> **In a real team with Jira:** a PM runs the planning phase before the
> BE dev opens their repo. The BE dev receives Gherkins + PRD v2 and
> starts directly at `openapi-author`.
>
> **When testing (no Jira, one person):** run the full planning phase
> inside `sdlc-be` — all skills are available there. Then continue with
> the BE implementation skills in the same repo.
>
> **Swagger:** does not exist at this stage. It is produced by
> `openapi-author` from the Gherkins. Always answer "none yet".
>
> **Figma:** optional. Provide a URL if available. "none yet" is fine —
> FE cannot start without it, but planning and BE can.
>
> **Pipeline position:**
> ```
> PLANNING (run in sdlc-be when testing)
>   feature-brief    ← start here
>   grill-me         ← REQUIRED: stress-test the idea before PRD
>   prd-author
>   prd-review       ← human gate (v1)
>   prd-update
>   prd-review       ← human gate (v2)
>   ticket-generate
>   to-issues
>   grill-me         ← REQUIRED: stress-test the slices before Gherkins
>   spec-author
>   scenario-review  ← REQUIRED: human gate on Gherkins
>   gherkin-validate ← automated gate (triggered by scenario-review)
>        ↓
> BE REPO (sdlc-be) — BE implements first
>   openapi-author  ← BE work starts here
>   business-logic-author
>   orm-schema-author
>   be-implement
>        ↓ BE done, Swagger published ↓
> FE REPO (sdlc-fe)
>   figma-extract   ← FE work starts here
>   design-contract
>   fe-implement
> ```

Creates `docs/features/<parent-id>/brief.md` and initialises
`features/<parent-id>/memory.md`. Everything downstream depends on these two
files existing.

## Inputs
- User's description of the feature (verbal or written — any form)
- A parent ID — ask the user if not provided.
  **No Jira?** Any short string works: `FEAT-001`, `login`, `checkout-flow`.
  This ID is used in every file path, folder, and skill from here on.

## Procedure

### Step 1 — Collect the brief
Ask the user for:
1. **What is the feature?** One sentence describing what it does.
2. **Who is it for?** The primary user or persona.
3. **What problem does it solve?** The pain without it.
4. **Any Figma frames or designs ready?** (yes/no — URL if yes, "none yet" if no)
5. **Any existing Swagger/API spec?** — for new features this is almost always "none yet". Only say yes if integrating with an existing external API.

Do not move to Step 2 until all five are answered.

### Step 2 — Write `docs/features/<parent-id>/brief.md`

```markdown
# Feature Brief — <parent-id>

**Feature:** <one sentence>
**Persona:** <who it's for>
**Problem:** <pain without it>
**Figma:** <URL or "none yet">
**Swagger:** <URL or "none yet">
**Created:** <ISO date>
```

### Step 3 — Initialise `features/<parent-id>/memory.md`

Create the file with this structure and populate Feature Identity:

```markdown
# Feature Memory — <parent-id>: <Feature Name>

## Feature Identity
- **Parent ticket:** <parent-id>
- **FE ticket:** TBD (set by ticket-generate)
- **BE ticket:** TBD (set by ticket-generate)
- **Status:** brief-created
- **Last updated:** <ISO date>

---

## PRD v1
<!-- To be written by: prd-author -->

---

## PRD v2
<!-- To be written by: prd-update -->

---

## Gherkins
<!-- To be written by: spec-author -->

---

## UI Registry
<!-- To be written by: ui-registry-build -->

---

## FE Contract
<!-- To be written by: design-contract -->

---

## BE Contract
<!-- To be written by: openapi-author + business-logic-author + orm-schema-author -->

---

## Implementation Notes
<!-- To be written by: fe-implement and be-implement -->

---

## Gate Results
<!-- To be written by: impl-gate -->
```

### Step 4 — Run `jira-sync`
Update parent ticket status to `brief-created`.

### Step 5 — Prompt for next skill (mandatory)
After completing, tell the user:

> "**`/feature-brief` complete.**
> Next: `/grill-me` — stress-test the feature idea before committing to the PRD.
> This is a required Day Shift step. Run `/grill-me` now, then `/prd-author`."

Do NOT proceed to `/prd-author` or any other skill automatically. Wait for the user to run `/grill-me` first.

## Success criteria
- `docs/features/<parent-id>/brief.md` exists and is non-empty
- `features/<parent-id>/memory.md` exists with Feature Identity populated
- Jira parent ticket status is `brief-created`
- User has been told to run `/grill-me` next

## Hard rules
- Never invent a `<parent-id>`. Ask — even a simple string like `FEAT-001` is fine.
- Never ask the user to provide Swagger — it does not exist yet. Record "none yet".
- Figma is optional at this stage. Record URL if given, "none yet" if not.
- Never skip Step 1 grilling. A brief written without answers is not a brief.
- `memory.md` must be created even if partially empty — all downstream skills depend on it.
- Never advance to `/prd-author` without `/grill-me` running first.
