# C1.5 Artifact Coverage Analysis — 031 (slice 031-A)

**Gerado**: 2026-06-21 (coding C1.5) · **Tier 2** · Verificado contra o repo real (find/grep/Read).

## 1. Evidence Table

| Spec/plan claim | Real repo (file:line) | Verified? | Note |
|---|---|---|---|
| Write via RPC `register_dose_atomic` (não INSERT direto) | docs/migrations/20260619_atomic_dose_logging.sql:32-66 | ✅ | INSERT cols: user_id, protocol_id, medicine_id, taken_at, quantity_taken, notes, dose_instance_id (7) → add `injection_site` (8ª) |
| Update via `update_dose_log_atomic` (COALESCE/p_has_*) | mesma migração:151-156 | ✅ | FR-011 (slice B) — não tocar em A além de já prever o param |
| Core `doseLogService.registerDose` monta p_* | packages/core/src/services/doseLogService.js:43-54,67 | ✅ | `callRegisterAtomic` add `p_injection_site` |
| Zod `logSchema` corta campo desconhecido | packages/core/src/schemas/logSchema.js:12-58 | ✅ | add `injection_site` enum `.nullable().optional()`; `logUpdateSchema=partial()` cobre update |
| **Detecção de injetável** | packages/core/src/schemas/medicineSchema.js:36-44 | ✅ **CORRIGIDO** | `PRESENTATIONS` inclui `injetavel`; `MEDICINE_TYPES=['medicamento','suplemento']` NÃO. **Detecção = `medicine.presentation==='injetavel'`**, não `.type` (plano estava errado) |
| Mobile write-path | apps/mobile/src/features/dose/services/doseService.js:67-77,178-198 | ✅ **SIMPLIFICA** | mobile `registerDose`→`doseLogCore.registerDose` (mesmo core/RPC do web). 1 ponto de schema |
| Web read-path detail | apps/web/src/shared/services/api/logService.js:74-139 | ✅ **SIMPLIFICA** | selects de detalhe usam `select('*, medicine:medicines(*))` → `injection_site` auto-incluído quando coluna existir |
| Web read-path otimizado (coluna explícita) | logService.js:271-340 (selects ~120B) | ✅ | esses NÃO usam `*` → add `injection_site` SE alimentam rotação/detalhe |
| util precedente `doseZones` (não R-231) | packages/core/src/utils/doseZones.js | ✅ | `injectionSites.js` mora ao lado |
| timelineService NÃO seleciona medicine_logs | apps/web/src/services/api/timelineService.js:40 (só `timezone`) | ✅ **CORRIGE plano** | history detail vem do `logService`, não do timelineService. Remover timelineService da Target Files |
| HistoryDayPanel exibe detalhe | apps/web/src/views/redesign/history/HistoryDayPanel.jsx | ✅ existe | consome logs do logService |
| mobile history detail | apps/mobile/src/features/history/ + dose/components | UNVERIFIED→C3 | `DoseRegisterModal.jsx`/`BulkDoseRegisterModal.jsx`/quickDoseRegistration.js |

## 2. Cross-file consistency

- **plan.md desatualizado em 2 pontos** (corrigidos aqui, não-bloqueante p/ C3):
  - detecção `medicine.type` → **`medicine.presentation`** (medicineSchema)
  - `timelineService` NÃO é alvo (não lê medicine_logs) → history detail = `logService` + `HistoryDayPanel`
- Resto (RPC, doseLogService, logSchema, injectionSites, migração) consistente spec↔plan↔repo.

## 3. Data-migration completeness

Migração aditiva: `ADD COLUMN injection_site TEXT` (nullable, sem default) + CHECK(8 valores). Sem
backfill (legado = NULL válido). Reversível `DROP COLUMN`. Verificação: `SELECT` filtrando
`injection_site IS NOT NULL` retorna 0 antes da feature. ✅ completo.

## 4. Coverage (FR→task, SC→PO)

FR-001..011 → T01-T19 (A) + T20-T23 (B). SC-001..007 → PO-1..9. Mapeamento em tasks.md. ✅
US4/US6 (PO-4,8) explicitamente em slice B — não cobrir em A.

## 5. Behavioral Failure Modes

### `register_dose_atomic` (+ p_injection_site) / `logSchema.injection_site`
| Input / condição | Degenerado | Comportamento esperado | Covered (test) |
|---|---|---|---|
| `injection_site` ausente (oral/legado/flow sem form) | NULL | grava NULL, dose normal | PO-1,6 (negative) |
| valor fora do enum (typo, caixa errada) | `'Coxa_D'`/`'xyz'` | Zod rejeita + CHECK rejeita (defense-in-depth) | PO-7 |
| presentation NULL/≠injetavel mas site enviado | site não-NULL | UI nem renderiza campo; se forçado, grava (CHECK só valida domínio) — aceitável | PO-1 |
| "último global" sem nenhum log com site | nenhuma row | retorna null → form não mostra "última:" | PO-2 (empty) |
| log retroativo `taken_at` antigo | taken_at < último | NÃO vira "último" (ORDER BY taken_at DESC) | PO-2a |
| `taken_at` NULL (legado) na ordenação | NULL | `NULLS LAST`; COALESCE fallback p/ legado | PO-2a |
| múltiplos injetáveis, último de outro med | cross-med | query SEM filtro medicine_id → pega global | PO-2 |

### `getLastInjectionSite` (nova query)
- divisor/denominador: n/a (sem cálculo). JOIN opcional: n/a (single-table).
- 3-valued SQL: `WHERE injection_site IS NOT NULL` (não `!= ''`) — evita excluir incorretamente. ✅

## Severity / Gate

- Achados: 2 correções de plano (detecção presentation; timelineService fora) = **MEDIUM** (path
  drift, resolvido aqui antes de C3). Nenhum CRITICAL/HIGH.
- **Gate: PASS com riscos** (MEDIUM documentados) → prossegue p/ C2.
