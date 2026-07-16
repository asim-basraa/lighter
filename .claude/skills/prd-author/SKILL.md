---
name: prd-author
description: >-
  Write docs/prd.md using a grill-first approach. Two modes: Figma-first (URL
  already in brief.md — skip screen grilling, derive screens from Figma via
  prd-update) and Figma-absent (no Figma yet — full grilling required).
  Run after feature-brief, before prd-update.
---

# prd-author

Writes `docs/prd.md`. Every downstream skill depends on it:
`spec-author` → Gherkins, `openapi-author` → Swagger,
`figma-extract` → frame measurements, `design-contract` → UI contract.

**Do not skip the grilling phase.** The mode determines how much grilling is
needed — not whether to grill. Writing without grilling produces a document
that paraphrases the user's first prompt back at them.

---

## Before starting — detect mode

Read `docs/features/<parent-id>/brief.md`. Check the `Figma:` line:

- `Figma: none yet` → **Mode A2 — Figma-absent** (full grilling, scroll down)
- `Figma: <url>` → **Mode A1 — Figma-first** (short grilling, continue below)

---

## Mode A1 — Figma-first (Figma URL present in brief.md)

Figma already encodes the full screen map, component states, and UI flows.
Grilling about screens, actions per screen, and data per screen is redundant
— skip it entirely. `prd-update` runs after this skill and extracts all
screen-level detail from Figma. This PRD is v1: a thin skeleton that gives
`spec-author` enough to write high-level Gherkins. Figma fills in the rest.

### Phase 1 — Short grilling (HITL, mandatory even in Figma-first mode)

Ask these questions **one group at a time**. Do not compress into a single list.

**Group 1 — Problem and persona**
- What problem does this feature solve? What pain exists today without it?
- Who is the primary user? Describe them specifically (not just "users").
- Are there secondary personas who need something different?

**Group 2 — Scope**
- What is explicitly out of scope for this version?
- Which parts of the feature are BE-only (no UI at all)?
- Any known constraints — legal, performance, security?

**Group 3 — Tech stack and quality**
- What tech stack? (framework, database, test tools) — skip if already in CLAUDE.md
- Any accessibility requirements beyond WCAG AA?
- Security or auth requirements?

**Group 4 — Definition of done (high level)**
- What is the exact, observable thing a user does to prove this feature works end-to-end?
- What does success look like from the user's perspective?

After all groups are answered, tell the user:
> "I have enough to write PRD v1. Screen enumeration, component states, and
> data bindings will be added to PRD v2 by `prd-update` once Figma is extracted."

Summarise: feature identity, out of scope, high-level acceptance.
Get explicit confirmation before writing.

### Phase 2 — Write `docs/prd.md` (Figma-first skeleton)

```markdown
# Product brief (PRD) — <feature name>

> **Version:** v1 (Figma-first skeleton)
> **Screen detail:** To be added by `prd-update` after `figma-extract` runs.

**Product:** <one-line description from brief.md>
**Design source:** Figma file — <url from brief.md>
  (frames and nodeIds to be mapped by `figma-extract` + `prd-update`)
**Parent ticket:** <parent-id>
**Consumers:** `spec-author` → Gherkins; `openapi-author` → Swagger;
  `figma-extract` → frame measurements; `design-contract` → UI contract.

---

## Problem

<2–3 sentences from Group 1 answers>

---

## Goals

- <goal derived from problem statement>
- <measurable success criterion from Group 4>
- API-first mandatory: feature-split → F-NNN.1 (API) then F-NNN.2 (UI).

---

## Users

| Persona | Needs |
|---------|-------|
| **<name>** | <what they need> |

---

## Scope

### In scope

<User capabilities, not screens. Screens enumerated in v2 after Figma extraction.>

### Out of scope

- <item from Group 2>

---

## Feature requirements

### <parent-id> — <Feature name>

**Story intent:** As a <persona> I want <action> so <outcome>.

**Must deliver:**
- <user-observable capability 1>
- <user-observable capability 2>

**Acceptance (high-level — vertical slices, detailed in v2):**
- "Given <complete state>, when <action>, then <observable outcome>"
- "Given empty state, when page loads, then empty state is visible"
- "Given error state, when action fails, then error is visible"

**Figma:** <url> — frames and nodeIds mapped after figma-extract
**API-first:** <which capabilities need BE data? which are UI-only?>

---

## Requirements (cross-cutting)

### Design and tokens
- All UI uses design tokens — no raw hex or px.
- Per feature: figma-extract → design-contract before implement.

### API and data
- HTTP contracts in `docs/openapi/` for data-backed features.

### Quality gates
- governance-gate (or api-gate for API slices) per feature.

---

## Non-functional

- **Stack:** <from Group 3>
- **Accessibility:** <from Group 3>
- **Security:** <from Group 3>

---

## Appendix — Figma screen catalog

> To be populated by `prd-update` after `figma-extract` runs.
> See `features/<parent-id>/figma/spec.json` once extraction is complete.
```

---

## Mode A2 — Figma-absent (no Figma URL in brief.md)

Full grilling required. Do not skip any group.

### Phase 1 — Full grilling session (HITL, mandatory)

Ask the user these questions **one group at a time**. Wait for full answers
before moving to the next group. Do not compress into a single list.

**Group 1 — Product identity**
- What is this product? Describe it in one sentence.
- What problem does it solve for the user? What pain exists today without it?
- Who is the primary user? Describe them specifically (not just "users").
- Are there secondary personas? What do they need differently?

**Group 2 — Screens and features**
- Walk me through every screen or page that exists in this product.
- For each screen: what can the user DO there? (actions, not just views)
- Which screens show data that comes from an API or database?
- Which screens are purely UI with no backend data?

**Group 3 — Feature grouping and dependencies**
- Which screens belong together as one deliverable feature?
- Which features depend on others being done first?
- What is the minimum the product needs to be useful at all?
- What is explicitly out of scope for this version?

**Group 4 — Figma and design**
- Is there a Figma file? What is the file URL or key?
- What is the canvas name where screens live?
- For each feature group: which Figma frames (by name or nodeId) belong to it?
- Are there design tokens / variables defined in Figma?

**Group 5 — Technical and quality**
- What tech stack? (framework, database, test tools)
- Any accessibility requirements?
- Performance expectations?
- Security or auth requirements?

**Group 6 — Definition of done per feature (vertical slice check)**
For each feature identified above, ask:
- What is the exact, observable thing a user does to prove this feature works?
- What does the empty state look like?
- What does the error state look like?
- What happens when the API is slow or fails?

After all groups are answered, summarise back to the user:
- Feature list with proposed IDs (F-001, F-001a, F-002…)
- Dependency chain
- Figma frame → feature mapping
- Any unanswered gaps flagged explicitly

Get explicit confirmation before writing the PRD.

---

### Phase 2 — Write `docs/prd.md`

Write the file using this exact structure (required by `story-author`):

```markdown
# Product brief (PRD) — <product name>

**Product:** <one-line description>
**Design source:** Figma file [<name>](<url>) — canvas **<canvas name>**
  (`tokens/figma-design-frames.json`, <N> screens).
**Consumers:** `story-author` → `features/backlog.yaml`; Gherkin uses
  `screen.*` / `component.*` paths; API-backed copy uses `field.*` per
  `tokens/api-registry.json`.

---

## Problem

<2–3 sentences. What pain exists today without this product?>

---

## Goals

- <measurable goal 1>
- <measurable goal 2>
- API-first mandatory: every parent runs feature-split → F-NNN.1 (API) then
  F-NNN.2 (UI); no unsplit implementation.

---

## Users

| Persona | Needs |
|---------|-------|
| **<name>** | <what they need> |

---

## Scope

### In scope — 3-level backlog

Policy: backlog-decompose · backlog-handoff · subfeature-loop · feature-loop.

<dependency diagram showing feature relationships>

| ID | Priority | Depends on | Theme | Figma frames |
|----|----------|------------|-------|-------------|
| **F-001** | 1 | — | Epic: <name> | (rollup) |
| **F-001a** | 2 | — | <sub-feature name> | <frame numbers> |
...

### Out of scope

- <item 1>
- <item 2>

---

## Feature requirements (for story-author)

### <F-NNN — Feature name>

**Story intent:** As a <persona> I want <action> so <outcome>.

**Must deliver:**
- <screen or behaviour 1>
- <screen or behaviour 2>

**Acceptance (examples — each is a self-contained tracer bullet):**
- "Given <complete state set up from scratch>, when <one action>, then <screen.*/component.* path> shows <specific outcome>"
- "Given <empty state from scratch>, when page loads, then <component.x.emptyState> is visible"
- "Given <error state from scratch>, when <action fails>, then <component.x.errorState.retryButton> is visible"

**Figma frames:**

| Frame | nodeId |
|-------|--------|
| <name> | `<nodeId>` |

**Suggested registry roots:** `screen.<feature>.*`, `component.<feature>.*`
**API-first:** <which data needs API? which is UI-only?>

---

## Requirements (cross-cutting)

### Design and tokens
- All UI uses design tokens from `tokens/primitives.json`,
  `tokens/semantics.json`, `tokens/typography.json`.
- No raw hex or px in `app/` or `components/`.
- Per feature: run figma-extract frame mode → design-contract before implement.

### Executable UI contracts
- Register screens and components in `tokens/ui-registry.json` per feature.

### API and data
- Document HTTP contracts in `docs/openapi/` for data-backed features.

### Quality gates
- Each feature: governance-gate (or api-gate for API slices).
- Human sets status: approved after reviewing gate + visual reports.

---

## Non-functional

- **Stack:** <framework>, <database>, <test tools>
- **Accessibility:** <requirements>
- **Performance:** <expectations>
- **Security:** <requirements>

---

## Appendix — Full Figma screen catalog

| # | Screen | nodeId | Feature |
|---|--------|--------|---------|
| 01 | <name> | `<nodeId>` | F-001a |
...
```

---

## Mode B — Update existing `docs/prd.md`

When `docs/prd.md` already exists:

1. Read the current file.
2. Ask the user: what changed? (new screens, revised features, new personas,
   changed dependencies, new Figma frames)
3. Run targeted grilling only on the changed areas — do not re-grill settled
   decisions.
4. Update the affected sections only. Never reset feature IDs that already
   exist in `backlog.yaml`.
5. After writing, run `story-author` to sync `backlog.yaml`:
   - Existing backlog entries with `status` other than `pending` are never reset.
   - Only new features or changed AC are updated.

---

## Vertical slice check (mandatory before finalising)

Before writing or finalising the PRD, verify every acceptance example follows
the vertical slice rule:

**Each example must be self-contained:**
- Has a complete `Given` state (does not assume anything from a previous example)
- Has one `When` action
- Has a `Then` on a specific `screen.*` or `component.*` path
- Can be independently implemented and tested

**Wrong (horizontal):**
```
- The homepage renders
- The product grid shows items
- Clicking a product opens PDP
```

**Correct (vertical slices):**
```
- Given I navigate to "/", then screen.home.hero is visible and
  component.home.hero.ctaButton links to "/shop"
- Given I navigate to "/shop" and 6 products exist, then
  component.shop.productGrid shows 6 product cards
- Given I navigate to "/shop" and no products exist, then
  component.shop.emptyState is visible
```

---

## Phase 3 — Constitution (immediately after writing PRD)

Run **speckit-constitution** with `docs/prd.md` + `CLAUDE.md` as inputs:
- Fills `.specify/memory/constitution.md` with project-specific principles
  (token discipline, API-first split, gate rules, no fabricated Figma data)
- Constitution must be non-template (no `[PRINCIPLE_N_NAME]` placeholders) before
  `pipeline-bootstrap` runs

Also run **speckit-git-remote** to detect the GitHub remote URL — stored for
`speckit-taskstoissues` and any later GitHub integration.

---

## Success criteria

- `docs/prd.md` exists and is non-empty
- Contains feature table with IDs, priorities, depends_on, Figma nodeIds
- Contains acceptance examples that follow the vertical slice rule
- Contains Figma screen catalog with nodeIds
- `story-author` can produce a valid `backlog.yaml` from it without gaps
- `npm run validate:backlog` passes after `story-author` runs

## Failure handling

If the user cannot answer Group 4 (Figma) — proceed without nodeIds but mark
every feature with `figmaNodeId: TBD` so `figma-extract` knows to ask.

If the user cannot answer Group 3 (dependencies) — default to sequential
order (each feature depends on previous) and flag for human review.

Never fabricate Figma nodeIds. Never invent feature IDs that conflict with
existing backlog entries.
