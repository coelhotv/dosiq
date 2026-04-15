---
id: AP-H06
title: React and React-DOM version mismatch (range vs exact)
summary: Runtime error when React/React-DOM pair doesn't have exact same version (19.2.5 vs 19.2.3)
applies_to:
  - react
  - dependency
  - npm
  - test
tags:
  - dependency
  - react
  - version-mismatch
  - test-failure
trigger_count: 1
last_triggered: 2026-04-12
expiry_date: 2027-04-12
status: active
related_rule: R-160
layer: warm
bootstrap_default: False
pack: react-hooks
---

# AP-H06 — React and React-DOM version mismatch (range vs exact)

**Trigger count:** 1 (2026-04-12)  
**Related Rule:** R-160 (pin React/React-DOM to exact versions)  
**Wave:** H4 (Mobile Scaffold, Phase 4)  
**Pack:** react-hooks  

---

## Problem

When `react` and `react-dom` are declared with semver ranges (e.g., `^19.2.0`), npm can install different patch versions:

- Root `package.json`: `"react": "^19.2.0", "react-dom": "^19.2.0"`
- npm resolves:
  - `react@19.2.5` (most recent)
  - `react-dom@19.2.3` (not latest)
- Result: **Runtime error in tests**

```
Error: Incompatible React versions: The "react" and "react-dom" packages 
must have the exact same version. Instead got:
  - react:      19.2.5
  - react-dom:  19.2.3
```

**Why?**
- React and React-DOM are a paired package — they MUST share identical versions
- Unlike most libraries, they cannot tolerate patch version differences
- Different patch versions can have incompatible internals
- npm ranges allow patch version divergence

---

## Root Cause

**Using semver ranges on React/React-DOM pair:**

```json
// ❌ WRONG — allows version drift
{
  "react": "^19.2.0",      // Can resolve to 19.2.5
  "react-dom": "^19.2.0"   // Can resolve to 19.2.3
}

// ✓ CORRECT — forces exact match
{
  "react": "19.2.5",
  "react-dom": "19.2.5"
}
```

---

## Symptoms

### In Tests (Vitest/Jest)
```
Smoke Tests FAIL
src/shared/hooks/__tests__/useCachedQuery.smoke.test.jsx

Error: Incompatible React versions: ... react: 19.2.5, react-dom: 19.2.3
  at node_modules/react-dom/cjs/react-dom-client.development.js:27935
```

### On GitHub Actions
- ❌ Smoke test job: failed (blocks Lint, Build, Critical)
- ❌ Entire CI chain blocked on version mismatch

### Timeline (H4 incident, 2026-04-12)
| Time | Event |
|------|-------|
| 15:54 | Code pushed with `^19.2.0` ranges |
| 19:18 | GitHub Actions runs `npm install` |
| 19:18 | npm resolves react@19.2.5, react-dom@19.2.3 |
| 19:18 | Smoke test fails: version mismatch |
| 19:22 | **Fix:** pinned both to `19.2.5` (exact) |
| 19:22 | ✅ Smoke test passes |

---

## Solution

**Pin both to exact same version (no ranges):**

```bash
# 1. Identify latest version
npm view react@latest

# 2. Update package.json (EXACT, no ^)
{
  "react": "19.2.5",       # ← Exact
  "react-dom": "19.2.5"    # ← Exact (same as react)
}

# 3. Install
npm install

# 4. Verify versions match
npm list react react-dom
# Should show both @ 19.2.5

# 5. Commit
git add package.json package-lock.json
git commit -m "fix: pin React and React-DOM to exact same version"
```

---

## Prevention

### React/React-DOM Specific Rule

Whenever touching React versions (root or workspace):

1. **ALWAYS use exact versions (no ranges):**
   ```json
   "react": "19.2.5",        // ✓ CORRECT
   "react-dom": "19.2.5"     // ✓ CORRECT
   
   "react": "^19.2.5",       // ❌ WRONG (allows drift)
   "react-dom": "^19.2.0"    // ❌ WRONG (different ranges = different versions)
   ```

2. **Verify they're identical** before committing:
   ```bash
   grep '"react"' package.json
   # "react": "19.2.5",
   # "react-dom": "19.2.5"
   # ✓ Both are 19.2.5
   ```

3. **Test locally before push:**
   ```bash
   npm install
   npm run test:smoke
   npm run test:critical
   ```

4. **If tests fail with "version mismatch":**
   - Check both versions in package.json
   - Update to same version (exact, no range)
   - Delete `node_modules` and `package-lock.json` if needed
   - `npm install` again
   - Retest

---

## Checklist (React Version Updates)

- [ ] Updated react to newer version?
- [ ] Updated react-dom to SAME version (exact match)?
- [ ] Both declared without ranges (no `^`, no `~`)?
- [ ] Ran `npm install` locally?
- [ ] Smoke tests pass? `npm run test:smoke`
- [ ] Critical tests pass? `npm run test:critical`
- [ ] `npm list react react-dom` shows both @ same version?
- [ ] Committed both package.json and package-lock.json?
- [ ] GitHub Actions passed on first try (no smoke test failure)?

---

## Related Rules

- **R-160** (React/React-DOM exact pinning): always use exact versions, not ranges
- **R-158** (dependency ranges): ranges OK for most libs, NOT for React
- **AP-H04** (peer dep mismatch): related dependency conflict pattern

---

**Last Updated:** 2026-04-12  
**Status:** Active (1 trigger, resolved)  
**Wave Introduced:** H4 (Mobile Scaffold)
