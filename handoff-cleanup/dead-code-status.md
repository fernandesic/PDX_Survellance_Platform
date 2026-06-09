# Dead-code status (Phase 2 item 6)

**As of:** 2026-06-08, after enabling ESLint's `unused-imports` plugin and
running one autofix pass.

## TODO / FIXME triage

Task.md baseline cited **48 TODO/FIXME**. Current count, full tree
(case-insensitive, excluding tests / migrations / venv / scripts):

| Where | Count |
|---|---:|
| `frontend-main/src/` | **0** (the 5 grep hits all match the substring "todo" inside `autodownload`) |
| `backend-main/` app code | **0** |

The 48 had been triaged before this branch existed. **This sub-item is
already at target.**

## Commented-out code

Not measured as a single metric. Pre-commit's Ruff + ESLint catch
common cases on every commit; full audit deferred.

## `noUnusedLocals` / `noUnusedParameters`

Currently **OFF** in `frontend-main/tsconfig.app.json` because turning
them ON surfaces ~300 fallout errors. Plan:

1. ✅ Add `eslint-plugin-unused-imports` (installed, wired in
   eslint.config.js as `unused-imports/no-unused-imports` and
   `unused-imports/no-unused-vars`). This catches **newly-introduced**
   unused imports/vars on every lint pass — regressions stop here.
2. ✅ One `eslint --fix` pass auto-stripped unused imports across the
   src tree (~140 cleaned in one shot).
3. ⏳ **Residual:** `npx eslint 'src/**/*.{ts,tsx}'` currently reports
   **158** `unused-imports/no-unused-vars` errors that need manual
   judgment (unused destructured props, unused function parameters,
   dead local consts). Auto-fix is unsafe for these because the right
   move differs case-by-case (prefix with `_`, remove from destructure,
   delete declaration, …). Plan for a dedicated grind session per
   file.
4. ⏳ Flip both tsconfig flags to `true` once the 158 reach 0. The
   inline comment in `tsconfig.app.json` records this.

## Acceptance criterion for closing this item

```bash
# Both must report zero:
cd frontend-main
npx eslint 'src/**/*.{ts,tsx}' 2>&1 | grep -c "unused-imports"
# … and …
# (after flipping tsconfig flags)
npx tsc -b --noEmit 2>&1 | grep -cE "TS6133|TS6196"
```
