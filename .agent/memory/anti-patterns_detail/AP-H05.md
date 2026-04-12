# AP-H05 — Monorepo workspace: lock file out of sync with package.json

**Trigger count:** 1 (2026-04-12)  
**Related Rule:** R-159 (always commit updated lock file)  
**Wave:** H4 (Mobile Scaffold, Phase 4)  
**Pack:** infra-api  

---

## Problem

When adding a new workspace package to a monorepo (npm workspaces), if you:

1. Create `apps/mobile/package.json` with dependencies
2. Run `npm install` locally to install/resolve dependencies
3. **BUT** do not commit the updated `package-lock.json`
4. Push to GitHub

Then GitHub Actions fails with:

```
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json 
and package-lock.json or npm-shrinkwrap.json are in sync.
npm error Missing: <hundreds of packages> from lock file
```

**Why?**
- `npm ci` (CI-safe install) requires **exact synchronization** between package.json and package-lock.json
- Locally, you have the updated lock file after `npm install`
- On CI/CD, the lock file in git is the old one (doesn't include new workspace deps)
- Result: CI job fails on dependency install, blocks all downstream jobs (lint, build, test)

---

## Root Cause

**Incomplete Git workflow:** 

```bash
# ❌ Wrong workflow
git add apps/mobile/package.json
npm install  # Updates package-lock.json locally
git commit    # Missing package-lock.json!
git push      # CI finds outdated lock file
```

**Should be:**

```bash
# ✓ Correct workflow
git add apps/mobile/package.json
npm install   # Updates package-lock.json locally
git add package-lock.json  # ← DO NOT SKIP!
git commit
git push      # CI finds correct lock file
```

---

## Symptoms

### On GitHub Actions
```
Run npm ci
  error code EUSAGE
  error Missing: react@19.2.5 from lock file
  error Missing: @react-navigation/native@7.2.2 from lock file
  error Missing: expo@53.0.27 from lock file
  ... (hundreds more)
```

### Impact
- ❌ Lint job: skipped (dependency install blocked)
- ❌ Smoke test job: skipped
- ❌ Build job: skipped
- ❌ Critical tests: skipped
- ❌ Entire CI chain broken

---

## Solution

**Immediately commit the lock file:**

```bash
# After resolving any ERESOLVE issues locally
npm install

# Verify local build works
npm run lint
npm run build
npm run test:critical

# Stage the lock file (CRITICAL)
git add package-lock.json

# Commit
git commit -m "chore: update package-lock.json for mobile workspace"

# Push
git push
```

**Timeline (H4 incident, 2026-04-12):**

| Time | Event |
|------|-------|
| 15:54 | Fixed ERESOLVE: `react@^19.2.5` in package.json |
| 15:54 | Ran `npm install` locally → lock file updated |
| 15:55 | Committed & pushed code + memory docs |
| 15:55 | ❌ GitHub Actions: `npm ci` fails (lock file not committed) |
| 16:25 | **Fix:** committed package-lock.json in commit 078a81b |
| 16:25 | ✅ GitHub Actions: `npm ci` succeeds |

---

## Prevention

### For New Workspace Packages

1. **Create package.json** for new workspace
2. **Run `npm install`** (resolves deps, creates/updates lock file)
3. **Validate locally:**
   ```bash
   npm run lint
   npm run build
   npm run test:critical
   ```
4. **Stage BOTH files BEFORE committing:**
   ```bash
   git add apps/mobile/package.json package-lock.json
   git commit -m "feat(workspace): add mobile app"
   git push
   ```

5. **Verify CI passes** before merging

### Pre-Commit Checklist

When touching `package.json` (new workspace, dependency changes):

- [ ] `package.json` modified? → run `npm install`
- [ ] `npm install` succeeded? → check `package-lock.json` was updated
- [ ] `git status` shows both `package.json` AND `package-lock.json` as modified?
- [ ] Staged BOTH files? (`git add package.json package-lock.json`)
- [ ] Lint, build, tests pass locally? → `npm run validate:agent` or full suite
- [ ] Pushed to branch?
- [ ] GitHub Actions passed on first run (not blocked on npm ci)?

---

## Keywords for Future Scanning

When a new agent encounters:
- `npm error code EUSAGE` on GitHub Actions → **AP-H05**
- `npm ci` + `Missing:` errors → **AP-H05**
- Workspace added but CI blocked → check AP-H05
- `package-lock.json` not committed: **AP-H05**

---

## Related Rules

- **R-159** (monorepo lock file sync): always commit lock file with workspace changes
- **R-158** (dependency ranges): prevent ERESOLVE before you hit lock sync issues
- **R-090** (Vercel function budget): separate concern, but part of workspace planning

---

**Last Updated:** 2026-04-12  
**Status:** Active (1 trigger, resolved)  
**Wave Introduced:** H4 (Mobile Scaffold)
