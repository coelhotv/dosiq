# AP-H04 — Monorepo workspace: peer dependency mismatch on new subpackage

**Trigger count:** 1 (2026-04-12)  
**Related Rule:** R-158 (monorepo workspace dependency ranges)  
**Wave:** H4 (Mobile Scaffold, Phase 4)  
**Pack:** infra-api  

---

## Problem

When adding a new workspace package (e.g., `apps/mobile/`) to a monorepo, npm's ERESOLVE dependency resolver can fail if:

1. **Root project** has version `X` of a library (e.g., `react@19.0.0`)
2. **New subpackage** has peer dependency requirements that conflict (e.g., `react-test-renderer@19.2.5` requires `react@^19.2.5`)
3. **npm ci / npm install** fails with `ERESOLVE unable to resolve dependency tree`

**Example (H4 incident, 2026-04-12):**

```
apps/mobile/package.json: react@19.0.0
+-- @testing-library/react-native@^13.2.0
    +-- peer react-test-renderer@^19.2.5
        +-- peer react@^19.2.5  ← Does NOT match 19.0.0 ✗

npm error: Could not resolve dependency:
npm error: peer react@"^19.2.5" from react-test-renderer@19.2.5
```

This causes:
- ❌ Vercel deployment: `npm install` fails
- ❌ GitHub Actions CI/CD: build job skipped/blocked
- ❌ Local development: inconsistent behavior if developers use `--legacy-peer-deps`

---

## Root Cause

**Core Issue:** Declaring a fixed/exact version in new workspace package when peer dependencies of dev-only libs require a range.

**Why it happens:**
- Mobile dev tools (`jest-expo`, `@testing-library/react-native`) are pinned to React versions in their transitive deps
- Mobile's `react` version is pinned exactly (`19.0.0`) instead of using a compatible range (`^19.2.5`)
- npm ERESOLVE (default in npm 7+) rejects the mismatch during CI/CD

---

## Solution

**Immediate fix:** Update the new package's peer-dep-driven library to a compatible range.

```json
// apps/mobile/package.json (H4 fix, commit de370cb)
- "react": "19.0.0",
+ "react": "^19.2.5",
```

**Verification:**
```bash
npm install                # Must succeed locally
npm run lint              # Must pass
npm run test:critical     # Must pass (543/543)
npm run build            # Must succeed
```

**Vercel behavior after fix:**
- Deployment `npm install` succeeds
- GitHub Actions passes Lint → Smoke → Critical → Build
- Preview URL becomes accessible

---

## Prevention

### For New Workspace Packages

1. **Before creating package.json:**
   - Read root `package.json` for shared lib versions (React, TypeScript, testing libs)
   - Check transitive peer deps of your new packages' dev tools
   - Use **ranges**, not exact versions, for root-shared libraries

   ```json
   // ✓ CORRECT
   "react": "^19.2.5",
   "typescript": "^5.0.0"
   
   // ✗ WRONG (conflicts with peer deps)
   "react": "19.0.0",
   "typescript": "5.0.0"
   ```

2. **Validate before push:**
   ```bash
   npm install            # Trigger ERESOLVE early (local, not on Vercel)
   npm run lint
   npm run build
   ```

3. **If ERESOLVE appears on Vercel but not locally:**
   - Check `.npmrc`: is `legacy-peer-deps=true` set locally? (Don't use it!)
   - Always test `npm ci` (clean install) locally before push

### For Existing Packages

If adding new dev-only libraries:
- Always check their peer dep ranges
- Update your package's version to satisfy the range, not the other way around

```bash
# Use npm view to check peer deps
npm view jest-expo@53.0.0 peerDependencies
# → { react: '>=18.0', 'react-native': '0.79.0' }
```

---

## Checklist (Wave H4+)

- [ ] New workspace package created? → Check peer deps of all dev libs
- [ ] package.json written? → Use ranges (`^X.Y.Z`) for shared libs, not exact versions (`X.Y.Z`)
- [ ] Before commit: run `npm install` locally to catch ERESOLVE early
- [ ] If ERESOLVE appears on Vercel: **exact version mismatch** on a shared lib
- [ ] Fix: bump the exact version to match highest peer dep requirement
- [ ] Retest: `npm install`, lint, build, critical tests

---

## Timeline (H4 Incident)

| Time | Event |
|------|-------|
| 2026-04-12 15:51 | PR #464 commit b942839 pushed (review fixes) |
| 2026-04-12 15:52 | Vercel deploy fails: `ERESOLVE unable to resolve dependency tree` |
| 2026-04-12 15:52 | GitHub Actions: Lint, Smoke, Build jobs all skip (dependency failure blocks chain) |
| 2026-04-12 15:53 | Root cause identified: `react@19.0.0` vs `react@^19.2.5` mismatch |
| 2026-04-12 15:54 | Fix applied: `react: "^19.2.5"` in `apps/mobile/package.json` |
| 2026-04-12 15:55 | Commit de370cb pushed, Vercel re-triggers, **deployment succeeds** ✓ |

---

## Related Rules

- **R-158** (monorepo dependency ranges): always use compatible ranges in workspace packages
- **R-090** (Vercel function budget): check function count before/after new packages
- **R-091** (serverless file structure): use `_` prefixes for utilities, not function endpoints

---

## Keywords for Future Scanning

When a new agent encounters:
- `ERESOLVE unable to resolve dependency tree` → **AP-H04**
- `peer react@"^19.2.5" from react-test-renderer` → **AP-H04**
- Vercel deployment fails on `npm install` → check AP-H04
- New workspace package + test framework: validate peer deps early

---

**Last Updated:** 2026-04-12  
**Status:** Active (1 trigger, resolved)  
**Wave Introduced:** H4 (Mobile Scaffold)
