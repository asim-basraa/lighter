---
name: orm-schema-author
description: >-
  Generate db/schema.ts (Contract 3 of 3) for the BE feature by reading the
  OpenAPI spec and @be Gherkins. Produces the Drizzle ORM schema — all tables,
  columns, types, and relations. Run after business-logic-author. be-implement
  reads this directly; no DB introspection at implementation time.
---

# orm-schema-author

Produces `db/schema.ts` — the third of three BE contracts. Derives all tables
and relations from the OpenAPI response schemas and request body schemas.
`be-implement` reads this file directly instead of introspecting the database.

## Inputs
- `docs/openapi/paths/<be-jira-id>.yaml` — OpenAPI spec (Contract 1)
- `docs/features/<be-jira-id>/business-logic.md` — Business Logic (Contract 2)
- `features/<parent-id>/<parent-id>.feature` (`@be` scenarios) — for data
  shape confirmation
- Existing `db/schema.ts` if present — to merge without overwriting other features

## Procedure

### Step 0 — Validate feature branch
```bash
git rev-parse --abbrev-ref HEAD
```
Must equal `feature/<be-jira-id>`. If it is `main` or anything else, stop:
> "Wrong branch. Switch with: `git checkout feature/<be-jira-id>`"

### Step 1 — Read memory
Confirm Contract 1 (OpenAPI) and Contract 2 (Business Logic) exist.
If either is missing, stop.

### Step 2 — Extract data shapes
From the OpenAPI spec, collect all:
- Request body schemas (`requestBody.content.application/json.schema`)
- Successful response schemas (`responses.2xx.content.application/json.schema`)
- Reusable schema components (`components/schemas`)

For each schema object:
- Map its properties to DB columns
- Identify required vs optional fields
- Identify ID fields (UUID vs integer serial)
- Identify timestamp fields (createdAt, updatedAt)
- Identify foreign key relationships between schemas

### Step 3 — Cross-check with business logic
Read `business-logic.md` State Machines section. For any entity with lifecycle
states, add a `status` column (or equivalent) with an enum or check constraint.

### Step 4 — Generate `db/schema.ts`
Use Drizzle ORM syntax. For each table:

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const <tableName> = sqliteTable("<table_name>", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  // ... columns
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date()),
});
```

Column type mappings:
- `string` → `text("col")`
- `number` (integer) → `integer("col")`
- `number` (decimal/price) → `real("col")`
- `boolean` → `integer("col", { mode: "boolean" })`
- `date/timestamp` → `integer("col", { mode: "timestamp" })`
- `enum` → `text("col", { enum: ["val1", "val2"] })`
- UUID foreign key → `text("other_id").references(() => other.id)`

If the project uses PostgreSQL/MySQL instead of SQLite, use the equivalent
Drizzle table factory (`pgTable`, `mysqlTable`) and adapt column types.

### Step 5 — Write or merge into `db/schema.ts`
If `db/schema.ts` already has other feature tables: append new tables at the
bottom with a comment block:
```typescript
// ── <feature-name> (<be-jira-id>) ──────────────────────────────────────────
```

If `db/schema.ts` does not exist, create it with the import boilerplate and
new tables.

### Step 6 — Run migrations
```bash
npm run db:generate
npm run db:migrate
```

Both must exit 0. If either fails, fix the schema and re-run before continuing.

### Step 7 — Update memory
Append to BE Contract section in `features/<parent-id>/memory.md`:
```markdown
### ORM Schema (Contract 3)
<!-- Written by: orm-schema-author on <ISO date> -->
<!-- db:generate + db:migrate: passed -->
Full file: db/schema.ts

Tables added:
- <tableName>: <columns list>
```

### Step 8 — Run `jira-sync`
All 3 BE contracts are now complete. Set BE ticket to `be-contract-ready`.

## Success criteria
- `db/schema.ts` updated with all tables for this feature
- All columns typed correctly with Drizzle ORM syntax
- No existing tables overwritten
- `db:generate` and `db:migrate` exit 0
- Memory BE Contract section complete with all 3 contracts noted

## Hard rules
- Never drop or modify columns from tables belonging to other features.
- Never invent tables that don't correspond to an OpenAPI schema.
- `db:generate` and `db:migrate` must pass — a schema that can't migrate is not done.
- `be-implement` reads `db/schema.ts` directly. It never introspects the DB.
  The schema must be complete and correct before be-implement starts.
