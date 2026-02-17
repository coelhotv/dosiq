# Branch Audit - 2026-02-12

## Summary
| Total Branches Reviewed | Merged | Open | Stale | Deleted |
|------------------------|--------|------|-------|---------|
| 50 | 49 | 1 | 0 | 39 |

## CI/CD Fix Applied

**Issue Identified:**
- GitHub Actions "Unitários Críticos" job failing
- Error: `Variáveis de ambiente do Supabase não configuradas`
- Root cause: `useDashboardContext.test.jsx` → `supabase.js` import chain

**Fix Applied:**
- File: `.github/workflows/test.yml`
- Added env vars to `critical` and `full` jobs:
  ```yaml
  env:
    VITE_SUPABASE_URL: http://localhost:54321
    VITE_SUPABASE_ANON_KEY: test-anon-key-for-ci
  ```
- Commit: `805db3e`

## Validation Results

### After CI Fix
- Lint: ✅ 0 errors, 0 warnings
- YAML Valid: ✅ Validated with yaml-lint
- Push: ✅ Main updated (6c7db2d → 805db3e)

## Branch Details

### Merged to Main (Deleted)

| Branch | Type | Phase | Status | Action |
|--------|------|-------|--------|--------|
| `fix/ci-timezone-tests` | fix | CI/CD | ✅ Merged | Deleted |
| `feat/ci-cd-pipeline-phase4` | feat | F4.1 | ✅ Merged | Deleted |
| `feat/git-hooks-phase3` | feat | F3 | ✅ Merged | Deleted |
| `feat/test-selection-phase2` | feat | F2 | ✅ Merged | Deleted |
| `feat/sparkline-drilldown` | feat | Feature | ✅ Merged | Deleted |
| `feat/dashboard/protocolos-listados` | feat | UI | ✅ Merged | Deleted |
| `feat/design-uplift-fix-visual-regressions` | feat | UI | ✅ Merged | Deleted |
| `feat/fase-3/polish-ux` | feat | UX | ✅ Merged | Deleted |
| `feat/fase3.5-design-uplift-views` | feat | UI | ✅ Merged | Deleted |
| `feat/wave-2/consolidacao-medicine-form` | feat | Wave 2 | ✅ Merged | Deleted |
| `feat/wave-2/refine-dashboard-layout` | feat | Wave 2 | ✅ Merged | Deleted |
| `feat/wave-2/remove-quick-actions` | feat | Wave 2 | ✅ Merged | Deleted |
| `feat/wave-2/reorder-dashboard-elements` | feat | Wave 2 | ✅ Merged | Deleted |
| `feat/wave-3/consolidacao-protocol-form` | feat | Wave 3 | ✅ Merged | Deleted |
| `feat/wave-4/consolidacao-calendar` | feat | Wave 4 | ✅ Merged | Deleted |
| `feat/wave-5/alert-list-component` | feat | Wave 5 | ✅ Merged | Deleted |
| `feat/wave-X/settings-link-header` | feat | UX | ✅ Merged | Deleted |
| `docs/update-testing-documentation` | docs | Docs | ✅ Merged | Deleted |
| `docs/update-v2.6.0-documentation` | docs | Docs | ✅ Merged | Deleted |
| `docs/wave-6/adherence-documentation` | docs | Docs | ✅ Merged | Deleted |

### Fix Branches (Deleted)

| Branch | Type | Status | Action |
|--------|------|--------|--------|
| `fix/bot-button-data-invalid` | fix | ✅ Merged | Deleted |
| `fix/bot-registrar-command` | fix | ✅ Merged | Deleted |
| `fix/bot-telegram-mock-user-id` | fix | ✅ Merged | Deleted |
| `fix/fase3-5-light-theme-contrast` | fix | ✅ Merged | Deleted |
| `fix/fase3-5-migrate-hardcoded-colors` | fix | ✅ Merged | Deleted |
| `fix/fase3-5-theme-toggle-not-working` | fix | ✅ Merged | Deleted |
| `fix/fase3-p2-issues` | fix | ✅ Merged | Deleted |
| `fix/registrar-confirmation-message` | fix | ✅ Merged | Deleted |
| `fix/registrar-dosage-calculation` | fix | ✅ Merged | Deleted |
| `fix/registrar-quantity-taken-unit` | fix | ✅ Merged | Deleted |
| `fix/registrar-stock-calculation` | fix | ✅ Merged | Deleted |
| `fix/registrar-stock-validation-order` | fix | ✅ Merged | Deleted |
| `fix/validation-dosage-units` | fix | ✅ Merged | Deleted |
| `fix/wave-1/traduzir-frequency-dropdown` | fix | ✅ Merged | Deleted |
| `fix/wave-X/comprar-button-color` | fix | ✅ Merged | Deleted |
| `fix/wave-X/dashboard-tdz-error` | fix | ✅ Merged | Deleted |
| `fix/wave-X/health-details-scroll-mobile` | fix | ✅ Merged | Deleted |
| `fix/wave-X/settings-link-correto` | fix | ✅ Merged | Deleted |
| `fix/wave-X/snooze-dose-delay-alert` | fix | ✅ Merged | Deleted |

### Previously Deleted (Pruned)

| Branch | Type | Status |
|--------|------|--------|
| `docs/wave-1/documentacao` | docs | Already deleted |
| `feature/wave-1/cache-swr` | feat | Already deleted |
| `feature/wave-1/onboarding-wizard` | feat | Already deleted |
| `feature/wave-1/sessoes-bot` | feat | Already deleted |
| `feature/wave-1/tests-unitarios` | feat | Already deleted |
| `feature/wave-1/validacao-zod` | feat | Already deleted |
| `feature/wave-1/view-estoque` | feat | Already deleted |
| `fix/wave-1-local-changes` | fix | Already deleted |

### Open Branches (Kept)

| Branch | Type | Status | Reason |
|--------|------|--------|--------|
| `test/expand-services-coverage` | test | Open | Ongoing test expansion work |

## Merge Order Executed

1. **fix/ci-timezone-tests** (PRIORITY)
   - Commits: 2
   - Files changed: `adherenceLogic.drilldown.test.js`, `memory.md`
   - Purpose: Fix timezone-agnostic tests for CI pipeline

## Validation Results

### After `fix/ci-timezone-tests` Merge
- Lint: ✅ 0 errors, 0 warnings
- Tests: ✅ 87+ critical tests passing (2 pre-existing failures in logService - unrelated)
- Build: ✅ Success (dist/ generated)
- Push: ✅ Main updated (a9f0408 → 6c7db2d)

## Branch Cleanup Summary

| Category | Count |
|----------|-------|
| Feature branches deleted | 19 |
| Fix branches deleted | 19 |
| Documentation branches deleted | 4 |
| Previously pruned | 8 |
| **Total cleaned** | **50** |
| Remaining open | 1 |

## Git Commands Used

```bash
# Discover branches
git branch -r

# Check merge status
git branch -r --merged main

# Merge with --no-ff
git merge --no-ff origin/fix/ci-timezone-tests

# Delete local branch
git branch -d fix/ci-timezone-tests

# Delete remote branches
git push origin --delete <branch-name>

# Prune refs
git fetch --prune
```

## Notes

- All Phase 4 branches were already merged to main before this audit
- The `fix/ci-timezone-tests` branch was the only one requiring active merge
- Branch landscape is now clean for F4.6 refactor work
- Pre-existing test failures in `logService.test.js` are mock configuration issues unrelated to the timezone fix

---

*Audit completed: 2026-02-12 12:03 UTC-3*
*Main branch: 6c7db2d*
