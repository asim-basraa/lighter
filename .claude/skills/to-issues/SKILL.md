---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable issues on the project issue tracker using tracer-bullet vertical slices.
---

# To Issues

Break a plan into independently-grabbable issues using vertical slices (tracer bullets).

**Pipeline position:** Run after `/ticket-generate` and before `/spec-author`.
Gherkin scenarios are written 1:1 against these issues — so slices here directly
control the granularity of Gherkins and implementation tasks. Small slices = small,
focused scenarios. Do not skip this step; `spec-author` will block if issues are missing.

The issue tracker and triage label vocabulary should have been provided to you — run `/setup-matt-pocock-skills` if not.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes an issue reference (issue number, URL, or path) as an argument, fetch it from the issue tracker and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Issue titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the plan into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

<vertical-slice-rules>

- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Any prefactoring should be done first

**Granularity rules — slices must be small:**

- One slice = one user-visible element OR one API endpoint. Never a whole page.
- A page is a container, not a feature. Split it by its parts: navbar, sidebar, category list, hero image, footer — each is its own slice.
- The right question: "Can I demo THIS slice without building anything else on the page?" If yes, it's the right size. If it depends on other UI elements being present first, split further.
- Name slices by the element, not the page: "Navbar with logo and nav links" not "Homepage".
- The only exception: a page with a single responsibility and no sub-components (e.g. a bare login form) can be one slice.

**Anti-patterns to reject:**
- "Homepage feature" → too coarse, split into navbar / sidebar / categories / hero / footer
- "User dashboard" → too coarse, split by widget/panel
- "Product listing page" → split into filter sidebar / product grid / pagination / sort controls

</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories this addresses (if the source material has them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?

Iterate until the user approves the breakdown.

### 5. Publish the issues to the issue tracker

For each approved slice, publish a new issue to the issue tracker. Use the issue body template below. These issues are considered ready for AFK agents, so publish them with the correct triage label unless instructed otherwise.

Publish issues in dependency order (blockers first) so you can reference real issue identifiers in the "Blocked by" field.

<issue-template>
## Parent

A reference to the parent issue on the issue tracker (if the source was an existing issue, otherwise omit this section).

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it here and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- A reference to the blocking ticket (if any)

Or "None - can start immediately" if no blockers.

</issue-template>

Do NOT close or modify any parent issue.

### 6. Prompt for next skill (mandatory)
After all issues are published, tell the user:

> "**`/to-issues` complete.**
> Next: `/grill-me` — stress-test the slices before writing Gherkins.
> Check: Is each slice small enough? Can it be demoed standalone without anything else built first?
> This is a required Day Shift step. Run `/grill-me` now, then `/spec-author`."

Do NOT proceed to `/spec-author` automatically. Wait for the user to run `/grill-me` first.
