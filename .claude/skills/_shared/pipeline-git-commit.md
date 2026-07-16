# Pipeline git — branch + commit (shared by FE skills)

> Include this block at the end of every FE pipeline skill (after success criteria).
> Agents **must** run it — do not defer commits to the user or the next skill.

## Branch rule

- First FE skill for a feature: `design-contract` Step 0 creates `feature/<fe-jira-id>`.
- All later skills: verify current branch before writing files:
  ```bash
  git rev-parse --abbrev-ref HEAD
  ```
- **Never commit on `main`.** If on `main`, create/switch branch first.

## Commit rule (end of every skill)

After all checkpoints / success criteria pass:

```bash
git add <paths listed in the skill's commit table>
git status
git commit -m "<type>(<id>): <short summary>"
```

| Skill | Stage paths | Message pattern |
|-------|-------------|-----------------|
| `figma-extract` | `features/<id>/figma/` `features/<id>/memory.md` | `chore(<id>): figma-extract <slice or feature>` |
| `design-contract` | `features/<id>/contract.md` `features/<id>/memory.md` `features/backlog.yaml` | `chore(<id>): design-contract` |
| `design-tokens` | `tokens/` `features/<id>/memory.md` | `chore(<id>): design-tokens build` |
| `ui-registry-build` | `tokens/ui-registry.json` `tokens/build/` `reports/ui-registry-glossary.md` | `chore(<id>): ui-registry-build` |
| `registry-validate` | only if registry changed | `chore(<id>): registry-validate fixes` |
| `bdd-scaffold` | `tests/steps/` `playwright.config.ts` `package.json` `package-lock.json` | `chore(<id>): bdd-scaffold` |
| `visual-regression` | `tests/visual/` `reports/<id>-visual.md` `reports/<id>-screenshots/` | `chore(<id>): visual-regression baselines` |
| `fe-implement` (per slice, after APPROVE) | `app/` `components/` `constants/` `types/` `features/<id>/memory.md` | `feat(<id>-FE): implement <slice> (GH#<N>)` |
| `fe-implement` (final) | all feature paths + `tests/` | `feat(<id>-FE): <feature> complete` then push + PR (Step 11) |

**Exception:** `fe-implement` Step 7 blocks commit until the user says **APPROVE** for the current slice. After APPROVE, run the per-slice commit row immediately (before the next slice).

**Never** skip commit because of Cursor "only commit when asked" — pipeline skills override that for these steps.
