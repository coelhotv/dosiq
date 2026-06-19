# Analysis 035 — Refactor Dose-Log + Stock Service unificado no core

This analysis performs a pre-code verification of Spec 035 against the actual files, functions, and DB schemas in the repository.

---

## Evidence Table

| Spec claim / symbol | Real repo (file:line) | Verified? | Note |
|---|---|---|---|
| `logSchema` / `validateLogCreate` | `packages/core/src/schemas/logSchema.js:12` / `:121` | ✅ | Zod schema and canonical validator exist. |
| `validateLogUpdate` | `packages/core/src/schemas/logSchema.js:130` | ✅ | Validator exists. |
| `consume_stock_fifo` RPC | `packages/core/src/repositories/createStockRepository.js:226` | ✅ | Verified database RPC signature and parameters. |
| `restore_stock_for_log` RPC | `packages/core/src/repositories/createStockRepository.js:260` | ✅ | Verified database RPC signature and parameters. |
| `createDoseInstanceRepository` | `packages/core/src/repositories/createDoseInstanceRepository.js:39` | ✅ | Exposes `markTaken`, `revertToUnregistered`, `getById`, `findAnchorInstance`. |
| `apps/mobile/.../doseService.js` | `apps/mobile/src/features/dose/services/doseService.js` | ✅ | Exposes mobile `registerDose`, `undoDose`, etc. |
| `apps/web/.../logService.js` | `apps/web/src/shared/services/api/logService.js` | ✅ | Exposes web `create`, `update`, `delete`, `createBulk`. |

---

## Behavioral Failure Modes

For each of the new service methods, the following degenerate inputs and boundary conditions must be handled:

| Function / Handler | Input / Condition | Degenerate Value | Expected Behavior | Covered in Tests? |
|---|---|---|---|---|
| `registerDose` | Zod validation fail | invalid schema (e.g. quantity = 0) | Throws Validation Error detailing issues | Yes (T003) |
| `registerDose` | Stock insufficient | `consume_stock_fifo` throws or errors | Deletes created log (rollback) & throws error | Yes (T003) |
| `registerDose` | Double-click race condition | `instanceId` already has status `taken` | `markTaken` returns false; log is registered as PRN/avulso without double-marking | Yes (T003) |
| `undoDose` | Occurrence missing | invalid/non-existent `instanceId` | Throws error "Registro não encontrado." | Yes (T003) |
| `undoDose` | Stock restore fail | `restore_stock_for_log` RPC fails | Throws database error; halts deletion and status revert | Yes (T003) |
| `updateOrphanLog` | Missing log record | invalid/non-existent `logId` | Throws error "Registro não encontrado." | Yes (T003) |
| `updateOrphanLog` | Stock reconsume fail | `consume_stock_fifo` fails on update | Reverts log to old values, re-consumes original stock, throws error | Yes (T003) |
| `deleteOrphanLog` | Log not found | invalid `logId` | Throws/returns error | Yes (T003) |
| `registerDoseMany` | Partial stock failure | 1st dose OK, 2nd insufficient | Rollback of 2nd log only; returns status list | Yes (T003) |

---

## Cross-File Consistency & Gaps

- **Schema Check (R-270 / AP-214)**: Verification of Zod schemas in `packages/core/src/schemas/logSchema.js` confirms that all fields like `dose_instance_id` are optional/nullable and correctly handled.
- **Data Migration (N/A)**: No data migration is required because all platforms are already aligned on the database RPC model.
- **Analysis Verdict**: **PASS** (Zero critical blockages or contradictions detected. Ready for implementation gateway).
