# Execution Spec: H5.9 & H5.10 — Tests & Hardening

> **Status:** Completed ✅ (Merged PR #474)
> **Parent Spec:** `EXEC_SPEC_HIBRIDO_FASE5_MVP_PRODUTO.md`
> **Sprint Plan:** `EXEC_SPEC_HIBRIDO_H5_SPRINT_PLAN.md`
> **Architecture Review Reference:** `ARCHITECTURE_REVIEW_H5.md`

## 1. Goal
Complete Phase 5 (MVP) by ensuring the stability of the mobile package through automated tests and environment hardening.

---

## 2. Deliverables

### H5.9: Test Suite
- [x] **Polyfills Tests**: `apps/mobile/src/__tests__/polyfills.test.js` ✅
- [x] **Supabase Smoke Test**: `apps/mobile/src/__tests__/supabase.smoke.test.js` ✅
- [x] **Screen Tests**:
  - [x] `TodayScreen.test.jsx` ✅
  - [x] `TreatmentsScreen.test.jsx` ✅
  - [x] `StockScreen.test.jsx` ✅
- [x] **Hook Tests**:
  - [x] `useTodayData.test.js` ✅
  - [x] `useOnlineStatus.test.js` (coberto por Yesterday/Today logic) ✅

### H5.10: Hardening
- [x] **Dependency Pinning**: Set `@supabase/supabase-js` to `2.91.0` ✅
- [x] **Log Cleanup**: Proteção `__DEV__` aplicada ✅
- [x] **CI Integration**: `validate:agent` validado ✅
- [x] **Unused Code Removal**: `HomeScreen.jsx` removido ✅

---

## 3. Implementation Details

### 3.1 Polyfill Tests (Critical)
Test the following in `polyfills.test.js`:
- `URL.toString()` construction with `_searchPairs`.
- `URLSearchParams.set/append/get/delete`.
- Path normalization (removing trailing slash per R-168).

### 3.2 Supabase Smoke Test
Mock `fetch` and verify that a call to `supabase.from('protocols').select('*')` results in a `fetch` call with the expected URL string (proving the polyfill works as used by Postgrest).

### 3.3 Screen Testing Strategy
- Mock `@react-navigation/native`.
- Mock `nativeSupabaseClient`.
- Test:
  - Loading state.
  - Success state with data.
  - Error state with retry button.
  - Stale state (offline).

---

## 4. Quality Gates
1. `cd apps/mobile && npm run test` must pass all tests.
2. `npm run test:critical` (root) must pass.
3. `npm run build` (root) must pass.

---

## 5. Target Files
- `apps/mobile/package.json`
- `apps/mobile/polyfills.js`
- `apps/mobile/src/navigation/Navigation.jsx`
- `apps/mobile/src/__tests__/` (New directory)
- `apps/mobile/src/features/*/screens/__tests__/` (Conventional test locations)
- `apps/mobile/src/shared/hooks/__tests__/`
