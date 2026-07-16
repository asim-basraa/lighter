---
name: be-implement
description: >-
  Implement the BE feature by reading all 3 BE contracts (OpenAPI spec,
  Business Logic, ORM schema) and the @be Gherkins. Swagger is the enforced
  API contract; business-logic.md is the rules reference; db/schema.ts is the
  data model. Run after be-contract-ready. When complete, triggers FE flow.
---

# be-implement

Implements the BE feature — NestJS controller, service, DTOs, and tests —
using all three BE contracts as the source of truth.

## Stack
- **NestJS** (controllers + services + modules)
- **Drizzle ORM** + better-sqlite3 (inject via `@Inject('DRIZZLE_DB')`)
- **class-validator** DTOs for request validation
- **Jest + supertest** for API tests

## Inputs
- `docs/openapi/paths/<be-jira-id>.yaml` — Contract 1: endpoints and schemas
- `docs/features/<be-jira-id>/business-logic.md` — Contract 2: rules and logic
- `db/schema.ts` — Contract 3: data model (read directly, no introspection)
- `features/<parent-id>/<parent-id>.feature` (`@be` scenarios only)
- `features/<parent-id>/memory.md`

## File layout

All files produced by this skill are scoped to the feature ID:

```
src/
  <resource>/
    <resource>.module.ts
    <resource>.controller.ts     ← HTTP routing only
    <resource>.service.ts        ← all business logic
    dto/
      <action>.dto.ts            ← class-validator DTOs
lib/<be-jira-id>/                ← shared helpers (auth, crypto, etc.)
tests/api/<be-jira-id>/          ← ALL test files for this feature
  <endpoint>.test.ts
```

Keeping test files under `tests/api/<be-jira-id>/` is mandatory — it allows
`npm run test:api -- --testPathPattern=tests/api/<be-jira-id>` to run only
this feature's tests during development.

## Procedure

### Step 0 — Smart zone check (run before anything else)

Count the `@be` scenarios in the feature file:
```bash
grep -c "^\s*@be" features/<parent-id>/<parent-id>.feature
```

- **≤ 10 scenarios** → proceed normally.
- **11–20 scenarios** → warn: _"⚠️ This feature has N @be scenarios — you may hit the smart zone limit mid-run. Consider starting a fresh chat for each group of ~10 scenarios, or split the feature further with `/to-issues`."_ Then ask: _"Continue in this chat or split first?"_
- **> 20 scenarios** → warn strongly: _"⚠️ This feature has N @be scenarios — too large for reliable output in one context window. Recommended: split using `/to-issues` and implement each slice in a fresh chat. Continue anyway?"_ Wait for the user to decide.

Each scenario = one isolated task. Never batch multiple scenarios in one pass.

### Step 1 — Validate feature branch
```bash
git rev-parse --abbrev-ref HEAD
```
Must equal `feature/<be-jira-id>`. If not, stop:
> "Wrong branch. Switch with: `git checkout feature/<be-jira-id>`"

### Step 2 — Read memory and contracts
Read `features/<parent-id>/memory.md`. Confirm all three BE contracts exist
and `be-contract-ready` status is set. If not, stop.

Then read completely before writing any code:
1. `docs/openapi/paths/<be-jira-id>.yaml` — every endpoint, request/response shape
2. `docs/features/<be-jira-id>/business-logic.md` — every validation rule, state machine, auth rule
3. `db/schema.ts` — every table and column by name (never query the DB to discover schema)

### Step 3 — Plan implementation
List every endpoint in the OpenAPI path file. For each, record:
- Method + path
- Which `@be` scenario(s) cover it
- Which business logic rules apply (from business-logic.md)
- Which DB tables it reads/writes (from db/schema.ts)
- Which DTO it needs
- Which test file it goes in

Group by resource: endpoints sharing a resource go in the same module.

### Step 4 — Wire the NestJS module

**Check if the resource module already exists** in `src/<resource>/`. If not, create:

```typescript
// src/<resource>/<resource>.module.ts
import { Module } from '@nestjs/common';
import { <Resource>Controller } from './<resource>.controller';
import { <Resource>Service } from './<resource>.service';

@Module({ controllers: [<Resource>Controller], providers: [<Resource>Service] })
export class <Resource>Module {}
```

Register it in `src/app.module.ts` imports array.

### Step 5 — Write DTOs
One DTO per request body. Use class-validator decorators:

```typescript
// src/<resource>/dto/<action>.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class <Action>Dto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### Step 6 — Implement controller (routing only)

```typescript
// src/<resource>/<resource>.controller.ts
import { Controller, Post, Get, Body, Query, HttpCode } from '@nestjs/common';
import { <Resource>Service } from './<resource>.service';
import { <Action>Dto } from './dto/<action>.dto';

@Controller('<resource>')
export class <Resource>Controller {
  constructor(private readonly <resource>Service: <Resource>Service) {}

  @Post('<action>')
  @HttpCode(200)
  async <action>(@Body() dto: <Action>Dto) {
    return this.<resource>Service.<action>(dto);
  }
}
```

Controllers contain NO business logic — only routing, DTO binding, and delegation to the service.

### Step 7 — Implement service (all business logic)

```typescript
// src/<resource>/<resource>.service.ts
import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema';

@Injectable()
export class <Resource>Service {
  constructor(@Inject('DRIZZLE_DB') private readonly db: BetterSQLite3Database<typeof schema>) {}

  async <action>(dto: <Action>Dto) {
    // 1. Validate input (per business-logic.md Validation Rules table)
    // 2. Authorize (per business-logic.md Authorization table)
    // 3. Execute DB operation (exact table/column names from db/schema.ts)
    // 4. Apply calculations / state transitions (per business-logic.md)
    // 5. Return response exactly matching OpenAPI response schema
  }
}
```

**Enforcement rules:**
- Every request field validated against the Validation Rules table in `business-logic.md`
- Every response shaped exactly as the OpenAPI spec defines
- Every DB query uses exact table/column names from `db/schema.ts` via Drizzle ORM
- Every error thrown as `new HttpException({ error: { message } }, HttpStatus.XXX)`
- No raw SQL — Drizzle ORM query builder only
- Error codes and messages match the Error Catalogue in `business-logic.md` exactly

### Step 8 — Write feature-scoped tests

Use supertest against a bootstrapped NestJS test app:

```typescript
// tests/api/<be-jira-id>/<endpoint>.test.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
});

afterAll(async () => { await app.close(); });

describe('<Endpoint>', () => {
  it('<@be scenario name>', async () => {
    const res = await request(app.getHttpServer())
      .post('/<resource>/<action>')
      .send({ /* ... */ });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ /* exact OpenAPI response shape */ });
  });
});
```

One test per `@be` scenario. Tests cover every happy path and every error case
from the Error Catalogue. Never test implementation details — test the HTTP contract.

### Step 9 — Run feature-scoped tests after each endpoint
```bash
npm run test:api -- --testPathPattern=tests/api/<be-jira-id>
```

Fix failures before moving to the next endpoint. Never modify tests to pass —
fix the service implementation.

### Step 10 — Final gate (full suite)
```bash
npm run gate:api
```

Runs `typecheck` + `openapi:validate` + full `test:api`. All must exit 0.

If `test:api` fails on a **different feature's tests** that were already failing
before this feature started — do not fix those. Document in memory and ask the user.

### Step 11 — Write to memory
```markdown
## Implementation Notes
### BE notes
<!-- Written by: be-implement on <ISO date> -->
- Endpoints implemented: <list of METHOD /path>
- NestJS files: src/<resource>/<resource>.{module,controller,service}.ts
- DTOs: src/<resource>/dto/
- Test files: tests/api/<be-jira-id>/ (<N> tests)
- gate:api: passed
- Deviations from contract: <none / list if any>
```

### Step 12 — Update ticket status
Set BE ticket to `be-implemented`.

### Step 13 — Commit, push branch, open PR
```bash
git add src/<resource>/ lib/<be-jira-id>/ tests/api/<be-jira-id>/ docs/ features/ db/
git commit -m "feat(<be-jira-id>): <short description>

- <endpoint 1>
- <endpoint 2>
- <N> tests, gate:api passed

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push origin feature/<be-jira-id>

gh pr create \
  --base main \
  --head feature/<be-jira-id> \
  --title "feat(<be-jira-id>): <Feature Name>" \
  --body "$(cat <<'EOF'
## Summary
- Implements <N> endpoints for <Feature Name>
- All @be Gherkin scenarios covered
- gate:api passed (typecheck + openapi:validate + <N> tests)

## Endpoints
<list of METHOD /path>

## Test coverage
tests/api/<be-jira-id>/ — <N> tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Hard rule: never push directly to `main`. The PR is the only merge path.**

## Success criteria
- All `@be` scenarios have a corresponding implemented endpoint
- NestJS module wired: module + controller + service + DTOs all exist
- `npm run test:api -- --testPathPattern=tests/api/<be-jira-id>` exits 0
- `npm run gate:api` exits 0 (full suite)
- Memory Implementation Notes written
- BE ticket `be-implemented`
- Feature branch pushed + PR opened

## Hard rules
- **Never modify test files to make them pass.** Fix the service.
- **Never modify the OpenAPI spec during implementation.** It is frozen.
- **Never modify `db/schema.ts` during implementation.** Run `orm-schema-author` again if schema changes are needed.
- **Never push directly to `main`.**
- `db/schema.ts` is read directly — never call `PRAGMA table_info` or any DB introspection at runtime.
- Test files always live under `tests/api/<be-jira-id>/` — never flat in `tests/api/`.
- Controllers contain NO business logic. All logic lives in services.
