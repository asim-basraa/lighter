---
name: token-validate
description: Validate active design tokens after Figma extract or Tokens Studio import. Skips empty placeholder files. Runs source gate (figma only) and strict DTCG lint. Use after figma-extract tokens mode and before design-tokens compile. Use tokens:validate:test to check DTCG shape against archive/scaffold copy.
---

# token-validate

Gate for **post-extract** token JSON. Does **not** run on empty `{}` placeholders.

## When to run

| Situation | Command | Result |
|-----------|---------|--------|
| Before figma-extract (`tokens/*.json` are `{}`) | `npm run tokens:validate` | **SKIP** (exit 0) |
| After figma-extract / Tokens Studio import | `npm run tokens:validate` | Source + DTCG must **PASS** |
| Test DTCG rules on reference scaffold | `npm run tokens:validate:test` | DTCG only (skips source gate) |
| Full compile + report | **design-tokens** skill (after this passes) |

## Procedure

1. Confirm active files are **not** empty:
   - `tokens/primitives.json`
   - `tokens/semantics.json`
   - `tokens/typography.json`
2. Run `npm run tokens:validate` (or `node scripts/validate-tokens.mjs`).
3. If **SKIP**: tell the user to run **figma-extract** tokens mode first — do not FAIL.
4. If **FAIL**: list every error with token path (`npm run tokens:validate:report` →
   `reports/tokens-validate-report.json`). Do **not** edit Figma hex values to
   satisfy lint — fix export shape or validators instead.
5. If **PASS**: run `npm run tokens:audit-figma` for Figma coverage gaps, then
   the **design-tokens** skill (compile). If
   `features/<id>/figma/missing-tokens-report.md` has unresolved rows, those
   must be extended as **exact** new primitive + semantic tokens during
   design-tokens — never cleared by binding nearest/old tokens in the registry.

## What is checked

### Source (`validate-token-source.mjs`)

- Blocked: `gluestack-ui-v2` (scaffold — lives in `tokens/archive/gluestack-scaffold/` only)
- Allowed: `figma`, `figma-mcp`, `tokens-studio`, `tokens-studio-for-figma`

### DTCG strict (`validate-tokens-dtcg.mjs`)

- Valid `$type` and `$extensions.layer` per file
- Primitives: DTCG color/dimension/shadow/font objects — **no** hex, no `"16px"` strings, no aliases
- Semantics: alias-only `{path}` values; resolvable, no cycles; `$type` matches target
- Typography compounds: sub-properties must be aliases to primitives
- Required semantic groups (surface, text, action state.slot, input, feedback, focus, space, radius, shadow, typography roles)
- Path segment naming; no duplicate paths; no top-level `$description`
- Color `colorSpace: srgb`; dimensions use `unit: "px"`

## Test mode (reference tokens)

To verify validators against the archived scaffold shape:

```bash
cp tokens/archive/gluestack-scaffold/*.json tokens/
npm run tokens:validate:test
```

This checks **DTCG shape only** — not valid as production source (still `gluestack-ui-v2`).

## Success criteria

- Empty files → **SKIP** (not FAIL)
- Populated Figma tokens → exit 0 from `npm run tokens:validate`

## Failure handling

On FAIL: stop. Do not overwrite with scaffold. Fix export or mapping, re-run.
