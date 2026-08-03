# Playbook: Epic 063 — Zero Lint Regressions

> **Canonical Execution Guide for AI Agents and Developers**  
> Spec Reference: [`docs/specs/063-zero-lint-regressions/spec.md`](file:///Users/coelhotv/git/dosiq/docs/specs/063-zero-lint-regressions/spec.md)

---

## 🛠️ Session Protocol & Execution Rules

1. **Isolation**: Never commit directly to `main` or directly to `feat/063-zero-lint-regressions`. Always branch off `feat/063-zero-lint-regressions` for each phase (`feat/063-phase-X-...`).
2. **Token Efficiency**: Use targeted file reads and `rtk lint` filters instead of reading entire directories.
3. **Fail-Fast Testing**: Run `rtk npm run test:critical` after every code modification.
4. **RC6 & R-060 Protocol**: Run `rtk bash ~/SKILLS/devflow/scripts/ai-review.sh <PR#> --post` after opening every PR. Never self-merge. Await explicit user approval.

---

## 📋 Phase-by-Phase Playbook

### Phase 6: Mobile Complexity & Screen Decomposition
- **Branch**: `feat/063-phase-6-mobile-complexity`
- **Goal**: Reduce cyclomatic complexity below 20 and function lines below 150/100 in mobile screens and hooks.
- **Tasks**:
  1. Decompose render branches in `TodayScreen.tsx` into sub-components.
  2. Extract sub-components from `HeroDoseCard.tsx`.
  3. Extract helper functions in `Navigation.tsx` (e.g. state handlers, deep link parsing).
  4. Decompose helper branches in `doseService.ts`.
  5. Split `DevHubScreen.tsx` sub-renderers.
- **Verification**: `rtk lint`, `rtk npm run test:critical`.

---

### Phase 7: Mobile Design Tokens & Color Literals
- **Branch**: `feat/063-phase-7-mobile-design-tokens`
- **Goal**: Replace all hardcoded hex strings in mobile components with `@shared/styles/tokens`.
- **Tasks**:
  1. Refactor `UpcomingDosesList.tsx` stylesheet.
  2. Refactor `BulkDoseRegisterModal.tsx` stylesheet.
  3. Refactor `PurchaseFormScreen.tsx` stylesheet.
  4. Refactor `StockIndicators.tsx` stylesheet.
  5. Verify zero `react-native/no-color-literals` warnings remain in `apps/mobile/src`.
- **Verification**: `rtk lint`, `rtk npm run test:critical`.

---

### Phase 8: Server & Platform Services Refactoring
- **Branch**: `feat/063-phase-8-server-platform-complexity`
- **Goal**: Refactor server-side notification & LiveActivity dispatchers to reduce cyclomatic complexity.
- **Tasks**:
  1. Split `dispatchLiveActivityStarts.ts` helper routines.
  2. Split `dispatchNotification.ts` channel handlers.
  3. Decompose `enqueueReports.ts` eligibility checks.
  4. Decompose `_reminderHelpers.ts` resync helpers.
  5. Refactor `createDoseInstanceRepository.ts` query builders.
- **Verification**: `rtk npm run test:critical`, `rtk bash ./scripts/strict-island.sh`.

---

### Phase 9: Final Sweep & Absolute Zero Lock
- **Branch**: `feat/063-phase-9-final-zero-sweep`
- **Goal**: Resolve all remaining edge-case warnings across all sub-modules to achieve **0 warnings**.
- **Tasks**:
  1. Fix `react-hooks/exhaustive-deps` in `ScatterTrend.tsx`.
  2. Sweep all residual feature files (`stock`, `treatments`, `medications`, `emergency`).
  3. Confirm `rtk lint` reports: `ESLint: 0 errors, 0 warnings in 0 files`.
  4. Run final MetaSwarm verification: `rtk bash .metaswarm/shims/run-swarm-check.sh`.
  5. Final PR into `feat/063-zero-lint-regressions`.

---

## 🔄 End-of-Phase Standard Commands Checklist

```bash
# 1. Verification
rtk npx tsc -p apps/web/tsconfig.json --noEmit
rtk npm run test:critical
rtk lint
rtk bash ./scripts/strict-island.sh
rtk bash .metaswarm/shims/run-swarm-check.sh

# 2. Git Commit & Push
rtk git add .
rtk git commit -m "refactor(<domain>): <description> (etapa X)"
rtk git push -u origin feat/063-phase-X-...

# 3. PR & Review
rtk gh pr create --base feat/063-zero-lint-regressions --head feat/063-phase-X-... --title "refactor(<domain>): <description> (etapa X)" --body-file ...
rtk bash ~/SKILLS/devflow/scripts/ai-review.sh <PR#> --post

# 4. DEVFLOW C5 Journal Entry
# Append JSONL entry in .agent/memory/journal/YYYY-WWW.jsonl
rtk git commit -am "docs(devflow): C5 journal entry for Phase X delivery (PR #<PR#>)" && rtk git push
```
