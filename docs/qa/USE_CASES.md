# Lighter — Use Cases (End-to-End Journeys)

These are the real journeys the features compose into. Use them for **acceptance / exploratory** testing:
each one is a story a persona completes start-to-finish. Detailed step-level cases live in
`TEST_PLAN.md`; here we describe the *flow* and the *observable outcome*. Commands assume scoped mode
with `$API` and `$TOK` set (see `ENVIRONMENT_SETUP.md`).

Each use case lists the **features it touches** (feature IDs from `FEATURE_BRIEFS.md`) so you can trace
coverage.

---

## UC-1 — Maintainer onboards a design system and audits it

**Persona:** Design-system maintainer. **Features:** F-INGEST, F-DASH, F-HEALTH, F-USAGE.

1. Build the design system so it emits `dist/catalog.json` + `dist/tokens.json`.
2. Push it into a project (`lighter sync` or `POST /inventory`).
3. Open the dashboard: **Components** shows every component with a live preview + a props table generated
   from its schema; **Tokens** shows color/type/spacing/radius/shadow swatches; **Health** shows either
   "All healthy" or a list of findings; **Usage** shows which screens use each component.

**Outcome:** the maintainer sees the *real* system as it exists in code, with zero manual documentation,
and knows its health and blast-radius before anyone builds a screen.

**Try the unhealthy variant:** push a catalog with a component missing a description (or a token not in
`usedTokens`) and confirm Health flags exactly those.

---

## UC-2 — Designer authors a screen by hand and deploys it for review

**Persona:** Designer/PM + Customer. **Features:** F-SCREEN, F-VALIDATE, F-SHARE, F-REVIEW, F-COMMENT.

1. Create a screen (`POST /screens {name}`).
2. Save a version with a hand-written spec (`POST /screens/:id/versions {spec}`). The spec is validated
   against the catalog — a good spec saves as v1; a spec referencing an unknown component is **rejected
   `400`** with structured issues.
3. Deploy v1 to a share link (`POST …/versions/1/share`) → get a `token`.
4. Open `http://localhost:4000/share/<token>` — the mock renders live through the real design system with
   a **"Prototype" version banner**.
5. As the customer, pick an element and leave a comment; reply to build a thread.

**Outcome:** a customer with no account reviewed a real, catalog-true mock and left precise,
element-anchored feedback.

---

## UC-3 — Designer generates a screen with AI, iterates on feedback, and refines

**Persona:** Designer/PM. **Features:** F-GEN, F-VARIATIONS, F-REFINE, F-COMMENT.
**Requires:** funded `ANTHROPIC_API_KEY`.

1. Generate from intent (`POST /generate {intent}`) → a catalog-valid spec (only components you have,
   rooted at a page shell), with an `attempts` count.
2. Optionally generate variations (`POST /generate/variations {intent, count}`) to compare directions.
3. Save it as a screen version; deploy; collect comments (UC-2).
4. Refine (`POST /screens/:id/refine {instruction}`) — the current version's comments are folded into the
   prompt (fenced as untrusted data), and the result saves as a **new version**.

**Outcome:** idea → reviewable mock in minutes, and revision is conversational and feedback-aware.
**No-key variant:** confirm these three endpoints return **501** with no key, and **502** with an
unfunded key — the rest of the pipeline still works with hand-written specs.

---

## UC-4 — Team drives a version to approval with enforced sign-off

**Persona:** Designer/PM + Team lead + Customer. **Features:** F-APPROVE, F-SIGNOFF, F-NOTIFY.

1. Configure a sign-off set (`PUT …/sign-off-set`) with ≥1 `customer` + ≥1 `internal`.
2. Deploy the version (`draft → shared`). Optionally `request-changes` (`shared → changes-requested`).
3. Attempt `approve` before all parties have signed → **blocked `409 {missing:[…]}`**.
4. Record each party's sign-off (`POST …/sign-offs {party}`) until `complete:true`.
5. `approve` now succeeds (`→ approved`); an **approval notification** fires to `NOTIFY_WEBHOOK_URL`.

**Outcome:** "approved by all parties" is *enforced*, recorded, and terminal — a later change is a new
version, not a re-opened approval.

---

## UC-5 — Developer exports an approved screen as a hand-off bundle

**Persona:** Developer / coding agent. **Features:** F-EXPORT, F-INTENT.

1. (Optional but recommended) author an `INTENT.md` for the screen (`PUT …/intent`).
2. Export a **non-approved** version → **`403`** with the current state.
3. Approve it (UC-4), then export (`GET …/versions/:v/export`) → a bundle:
   `{ screen, version, spec, catalogPrompt, tokens, intent, reactExport }`.
4. Drop the `reactExport` `.tsx` into a project that has the design system — it renders the approved
   screen.

**Outcome:** an engineer/agent has everything needed to build the screen with zero Figma access.

---

## UC-6 — Customer clicks through a multi-screen journey

**Persona:** Customer. **Features:** F-FLOW, F-SHARE, F-REVIEW.

1. Author two screens (e.g. Checkout → Receipt), each with a deployed version.
2. Set a flow on Checkout (`PUT …/flow {links:[{label:"View receipt", target:"receipt"}]}`).
3. Open Checkout's share link — a **Flow** bar appears. The "View receipt" link navigates to Receipt's
   current deployed mock. If Receipt isn't deployed, the link renders **disabled** ("Not deployed yet").

**Outcome:** reviewers evaluate a *journey*, not just isolated screens; dead links are visibly disabled,
never broken.

---

## UC-7 — Design system changes; maintainer sees drift and re-ingests automatically

**Persona:** Maintainer. **Features:** F-WEBHOOK, F-STALE, F-USAGE.

1. Configure the re-ingest webhook (`DESIGN_SYSTEM_REPO` + `WEBHOOK_SECRET`).
2. Change the design system (e.g. rename/remove a component) and rebuild it.
3. CI delivers a **signed** push webhook → the server re-ingests (idempotent per commit sha).
4. `GET /specs` now flags any saved spec that references the removed/renamed component as **stale**; the
   Usage view reflects the new component set.

**Outcome:** the inventory never drifts from code, and the team knows exactly which mocks a component
change breaks.

---

## UC-8 — Operator onboards a new tenant (project)

**Persona:** Admin/operator. **Features:** F-AUTH, F-INGEST, F-CLI.

1. Boot with `LIGHTER_BOOTSTRAP_PROJECT` → a project + token is minted and logged once.
2. Hand the token to that team; they `lighter whoami`, `lighter sync`, and author screens — all scoped to
   their project.
3. Confirm a second project's token cannot read the first project's screens/inventory.

**Outcome:** multiple design-system teams share one Lighter deployment with isolated data.

---

## Journey coverage matrix

| Feature | UC-1 | UC-2 | UC-3 | UC-4 | UC-5 | UC-6 | UC-7 | UC-8 |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| F-INGEST | ● | | | | | | ● | ● |
| F-DASH / F-HEALTH / F-USAGE | ● | | | | | | ● | |
| F-SCREEN / F-VALIDATE | | ● | ● | | | ● | ● | |
| F-GEN / F-VARIATIONS / F-REFINE | | | ● | | | | | |
| F-SHARE / F-REVIEW / F-COMMENT | | ● | ● | | | ● | | |
| F-APPROVE / F-SIGNOFF | | | | ● | ● | | | |
| F-EXPORT / F-INTENT | | | | | ● | | | |
| F-FLOW | | | | | | ● | | |
| F-WEBHOOK / F-STALE | | | | | | | ● | |
| F-NOTIFY | | | | ● | | | | |
| F-AUTH / F-CLI | | | | | | | | ● |
