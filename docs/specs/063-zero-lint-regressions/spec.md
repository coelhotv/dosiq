# Specification: Epic 063 — Zero Lint Regressions

> **Status**: IN_PROGRESS (Phases 1-5 Completed, Phases 6-9 Active)  
> **Goal**: Achieve **0 ESLint warnings** across the entire Dosiq monorepo (`apps/mobile`, `apps/web`, `server`, `api`, `packages`).

---

## 🎯 Objectives & Mandate

1. Eliminate 100% of ESLint warnings across the monorepo without swallowing exceptions or suppressing rules unnecessarily.
2. Maintain strict regression prevention (zero broken unit tests, zero TypeScript errors, green TS ratchet).
3. Follow pair-programming governance (R-060): 1 secondary branch per phase, 1 PR targeting `feat/063-zero-lint-regressions`, RC6 AI review, MetaSwarm check, user approval, squash merge, and branch deletion.

---

## 📊 Baseline & Progress Tracking

| Metric | Initial | Post-Phase 3B | Post-Phase 4A | Post-Phase 5 | Target |
|--------|---------|---------------|---------------|---------------|--------|
| **Total ESLint Warnings** | ~190 | 89 | 78 | **68** | **0** |
| **Mobile Warnings** | ~140 | 65 | 65 | **55** | **0** |
| **Web Warnings** | ~35 | 20 | 3 | **0** | **0** |
| **Server/Platform Warnings** | ~15 | 4 | 10 | **13** | **0** |

---

## 🚀 Execution Phases

### Completed Phases
- [x] **Phase 1: Infrastructure & Strict Islands** — ESLint config setup, script adjustments.
- [x] **Phase 2: Server & API Core Lints** — Cleaned initial API handler lints.
- [x] **Phase 3A: Mobile Navigation & UI** (PR #784) — Fixed `react-hooks/set-state-in-effect` and navigation warnings.
- [x] **Phase 3B: Mobile Complexity & Function Splitting** (PR #785) — Extracted `bulkDoseHelpers.ts`, decomposed `PrivacyConsentSection`, `ProtocolFormBody`.
- [x] **Phase 4A: Web Styling, Hooks & Component Cleanup** (PR #786) — Cleaned 14 unused disable comments, decomposed `TitrationTimeline.tsx` and `useVersionGateAdminState.ts`.
- [x] **Phase 5: Shared Hooks, Fast Refresh & Design Tokens** (PR #787) — Resolved Fast Refresh warnings, replaced color literals with design tokens.

---

### Active & Remaining Phases (Roadmap to ZERO)

#### Phase 6: Mobile Complexity & Screen Decomposition
- **Scope**: Resolve cyclomatic complexity and long function warnings in mobile screens and hooks.
- **Targets**:
  - `apps/mobile/src/features/dashboard/screens/TodayScreen.tsx` (`complexity`)
  - `apps/mobile/src/features/dashboard/components/HeroDoseCard.tsx` (`complexity`)
  - `apps/mobile/src/navigation/Navigation.tsx` (`complexity`)
  - `apps/mobile/src/features/dose/services/doseService.ts` (`complexity`)
  - `apps/mobile/src/features/_dev/screens/DevHubScreen.tsx` (`max-lines-per-function`)

#### Phase 7: Mobile Design Tokens & Color Literals
- **Scope**: Eliminate remaining hardcoded hex/color literals in mobile components.
- **Targets**:
  - `apps/mobile/src/features/dashboard/components/UpcomingDosesList.tsx`
  - `apps/mobile/src/features/dose/components/BulkDoseRegisterModal.tsx`
  - `apps/mobile/src/features/stock/screens/PurchaseFormScreen.tsx`
  - `apps/mobile/src/features/stock/components/StockIndicators.tsx`
  - Additional components identified by `react-native/no-color-literals`.

#### Phase 8: Server & Platform Services Refactoring
- **Scope**: Decompose server-side notification, LiveActivity, and telemetry dispatchers.
- **Targets**:
  - `server/notifications/dispatcher/dispatchLiveActivityStarts.ts` (`complexity`)
  - `server/notifications/dispatcher/dispatchNotification.ts` (`complexity`)
  - `server/notifications/outbox/enqueueReports.ts` (`complexity`)
  - `server/notifications/bot/_reminderHelpers.ts` (`complexity`)
  - `src/repositories/createDoseInstanceRepository.ts` (`complexity`)

#### Phase 9: Final Sweep & Absolute Zero Lock
- **Scope**: Resolve all remaining edge-case warnings across all sub-modules to achieve **0 warnings**.
- **Targets**:
  - `src/features/measures/components/ScatterTrend.tsx` (`react-hooks/exhaustive-deps`)
  - Residual warnings in treatments, stock, emergency, and shared components.
  - Final validation: `rtk lint` returns **0 errors, 0 warnings in 0 files**.

---

## 🛡️ Governance & Quality Gate Checklist
For every phase:
1. `rtk git checkout -b feat/063-phase-X-...` from `feat/063-zero-lint-regressions`.
2. Refactor code and verify: `rtk npm run test:critical` + `rtk npx tsc -p apps/web/tsconfig.json --noEmit`.
3. Verify ratchet: `rtk bash ./scripts/strict-island.sh` + `rtk bash .metaswarm/shims/run-swarm-check.sh`.
4. Commit with conventional commit header.
5. Push & create PR targeting `feat/063-zero-lint-regressions`.
6. Run RC6 AI Review: `rtk bash ~/SKILLS/devflow/scripts/ai-review.sh <PR#> --post`.
7. Update DEVFLOW C5 journal entry.
8. Request user approval for squash merge & branch deletion.
