# PRD: Lighter, design-in-code prototyping and design system inventory

## Problem Statement

Our design iteration loop is slow because it runs through Figma three times: once to maintain the design system, once to compose mock screens, and once to build prototypes for customer feedback. Mocks drift from what the code can actually render, customer feedback arrives as vague references to static frames, and when a design is approved we still have to translate Figma into something a coding agent can consume. We want to design directly in code: our design system lives in a repo, mock screens are composed from real components, customers review deployed URLs and comment on actual elements, and approval produces artifacts a coding agent can implement from without ever opening Figma.

## Solution

Lighter is a web tool connected to our design system repo. The repo contains design tokens, React components, and a json-render catalog that defines what components exist and how they may be composed. Lighter ingests that repo and presents three surfaces: an inventory dashboard (browse components, tokens, usage, and health), an ideation surface (describe a screen in natural language, Claude generates a json-render spec constrained to our catalog, rendered live with streamed variations), and a review surface (each spec version deploys to a shareable URL on our dev domain where customers leave comments anchored to specific elements and approve versions). Approval produces a handoff bundle: the approved spec, the catalog with schemas and descriptions, the token files, an intent document, and a standalone React export, sufficient for a coding agent to implement the screen with no Figma access.

## User Stories

1. As a design system maintainer, I want Lighter to ingest the catalog, tokens, and components directly from our git repo, so that the dashboard always reflects what is actually in code and never drifts.
2. As a design system maintainer, I want a component gallery with a live rendered preview of every cataloged component, so that I can see the real system at a glance.
3. As a design system maintainer, I want each component's props displayed as a table generated from its Zod schema, so that documentation is always accurate without manual writing.
4. As a design system maintainer, I want a token inventory showing color ramps, type scale, spacing, radii, and shadows rendered visually, so that I can audit the system's foundations.
5. As a design system maintainer, I want health indicators flagging components with missing descriptions, missing preview specs, or unused tokens, so that I can keep the catalog agent-ready.
6. As a design system maintainer, I want to see which screens and spec versions use each component, so that I can assess the blast radius of a component change.
7. As a designer or PM, I want to describe a screen in natural language and watch Claude generate it live from our real components, so that I can go from idea to reviewable mock in minutes.
8. As a designer or PM, I want generation strictly constrained to the catalog, so that mocks never contain components or styles we cannot actually build.
9. As a designer or PM, I want to generate multiple variations of the same intent and view them side by side, so that I can explore directions cheaply.
10. As a designer or PM, I want to refine a generated screen with follow-up prompts, so that iteration is conversational rather than starting over.
11. As a designer or PM, I want to hand-edit the JSON spec with validation against the catalog, so that I can make precise adjustments AI prompting can't reach.
12. As a designer or PM, I want every spec saved as a version in git, so that variations and history are diffable and recoverable like code.
13. As a designer or PM, I want each screen composed inside one of a small set of layout-owning page shells, so that generations stay on-brand and structurally consistent.
14. As a designer or PM, I want to attach mock data to a spec, so that customer-facing screens look realistic rather than lorem ipsum.
15. As a designer or PM, I want to deploy any spec version to a URL on our dev domain with one action, so that sharing with a customer is trivial.
16. As a designer or PM, I want a version banner on every deployed mock showing version and date, so that reviewers always know what they are looking at and that it is a prototype.
17. As a customer, I want to open a shared link and view the mock in my browser without installing anything or creating an account, so that reviewing is frictionless.
18. As a customer, I want to click any element on the mock and leave a comment anchored to that element, so that my feedback is precise rather than "the blue button."
19. As a customer, I want to see and reply to existing comment threads, so that feedback is a conversation.
20. As a customer, I want to mark a version approved or request changes, so that my sign-off is explicit and recorded.
21. As a designer or PM, I want customer comments collected per element and per version, so that nothing gets lost across iterations.
22. As a designer or PM, I want to feed a version's comments back into Claude as context for the next variation, so that revision incorporates feedback automatically.
23. As a designer or PM, I want notifications in our tracker or chat when a customer comments or approves, so that I don't poll the tool.
24. As a team lead, I want an approval to require sign-off from defined parties (customer plus internal owner), so that "approved by all parties" is enforced, not assumed.
25. As a developer or coding agent, I want an exported handoff bundle containing the approved spec, catalog, tokens, intent doc, and standalone React export, so that I can implement the screen with zero Figma access.
26. As a developer or coding agent, I want the catalog's machine-readable prompt (component descriptions, prop schemas, actions) included in the bundle, so that I understand the system's vocabulary without asking anyone.
27. As a designer or PM, I want to author an INTENT.md per screen covering purpose, flows, edge states, and what data is mocked, so that the bundle captures intent HTML cannot express.
28. As an admin, I want customer-facing URLs protected by tokenized links or basic auth, so that unreleased product ideas are not publicly crawlable.
29. As an admin, I want internal surfaces (inventory, ideation) restricted to our team, so that only the review surface is customer-visible.
30. As a design system maintainer, I want re-ingestion triggered on push to the design system repo, so that the inventory updates without manual sync.
31. As a designer or PM, I want stale specs flagged when the catalog changes underneath them, so that I know which mocks reference renamed or removed components.
32. As a developer, I want the spec format wrapped behind a thin internal type with a serializer, so that we can emit A2UI or other formats later without a rewrite.
33. As a designer or PM, I want to duplicate an existing screen spec as a starting point, so that common patterns don't require regeneration from scratch.
34. As a customer, I want the mock to be click-through interactive where flows matter, so that I can evaluate journeys, not just single screens.

## Implementation Decisions

- Built on json-render (Vercel Labs) as the rendering and generation framework: catalog defined with Zod schemas, React renderer, streaming spec compiler for progressive rendering, and the standalone React export used for handoff bundles. Versions pinned; the project is pre-1.0.
- The design system repo is the single source of truth. It contains tokens (JSON or CSS variables), React components, json-render catalog definitions, and preview specs. Lighter holds no parallel component database; the inventory is a projection of the repo at a given commit.
- Catalog ingestion is a pure function and also exposed as a CLI: repo path in, normalized inventory model out (components, schemas, descriptions, tokens, health findings).
- One backend service exposes the full API: ingestion trigger, screen and spec CRUD, generation, versioning, deployment, comments, approvals, bundle export. The dashboard is a thin web client over this API.
- Generation calls the Anthropic API with the catalog's generated system prompt plus the user's intent and any prior version plus its comments; output is a json-render spec, validated against the catalog before saving. Invalid specs are rejected with the validation errors fed back for a retry.
- Screen specs are stored as versioned JSON files in git (one directory per screen, one file per version), not in a database. Comments, approvals, and share tokens are stored in the service's database since they are conversational state, not design artifacts.
- Specs are wrapped in a thin internal type with a serializer to and from json-render's format, preserving the option of an A2UI emitter later.
- Comments anchor to element IDs in the spec's flat element tree, not pixel coordinates, so they survive layout changes and can be attached mechanically to the next generation prompt.
- Deployment model: the review app is a static renderer plus a spec fetched by ID; publishing a version means making it addressable at a route on the dev domain behind a tokenized share link. No per-version build step.
- Approval is a per-version state machine: draft, shared, changes-requested, approved. Approved requires the configured sign-off set (at minimum one customer and one internal owner).
- The handoff bundle is a directory or archive per approved screen: spec JSON, catalog prompt output, tokens file, INTENT.md, and the standalone React export from json-render.
- Layout is owned by a small set of page-shell components in the catalog; generation is prompted to always start from a shell.
- Auth: internal surfaces behind team SSO; customer review links are unguessable tokens with optional expiry, no customer accounts in v1.
- Persistence: SQLite for v1, accessed exclusively through an ORM (Drizzle) whose query API is identical across SQLite and Postgres, so swapping to Postgres is a driver and config change with no query rewrites. No raw SQL outside migrations.
- A consumer example app lives at lighter-example inside the repo: a minimal design system (tokens, a handful of components, one page shell) plus a json-render catalog. It is the living integration target and doubles as the fixture design-system repo used by the test suite.

## Testing Decisions

- Tests exercise external behavior through the service API only: given a fixture design-system repo, ingestion produces the expected inventory model; given a prompt and catalog, generation produces a spec that validates against the catalog; given comments and an approval sequence, the version reaches the approved state and export produces a bundle with all required artifacts.
- Catalog ingestion is tested as a pure function against fixture repos, including unhealthy fixtures (missing descriptions, orphaned tokens) to assert health findings.
- Generation tests do not assert on exact AI output; they assert the invariants: spec validates, only cataloged components appear, a page shell is the root, and invalid model output triggers the retry path.
- No pixel or screenshot testing in v1; rendering correctness is delegated to json-render's validation and the spec-level invariants.
- Prior art: none, greenfield. The fixture-repo pattern establishes the convention for future tests.

## Out of Scope

- Figma sync or import. Extraction of the existing design system from Figma into the repo is a prerequisite project, not part of Lighter.
- Building or redesigning the design system components themselves.
- Real backend data in mocks; all data is mock JSON attached to specs.
- Customer accounts, roles, or a customer workspace; access is via share links only in v1.
- Pixel-diff visual regression tooling.
- A2UI protocol support (kept possible via the spec abstraction, not built).
- Production deployment of approved screens; Lighter's output is a handoff bundle, and implementation happens in the product repo.
- Multi-tenant or external productization; v1 is an internal tool for one design system repo.

## Further Notes

- Catalog description quality gates generation quality. Treat component descriptions as owned, first-class design system documentation from day one.
- The A2UI Composer (CopilotKit widget builder) is the reference UX for the ideation surface: palette, prompt, live preview, copy JSON.
- A worthwhile pre-build spike: run three real screens through the A2UI Composer or a raw json-render playground to calibrate generation quality before committing to the build.
- Name risk: "Lighter" collides with at least one existing crypto product; fine internally, worth checking before anything public.
