# Plan 035 — Refactor Dose-Log + Stock Service unificado no core

**Tier:** 2 · **goal_type:** refactor · **Plataforma:** Core (shared) + Web + Mobile
**Spec:** [spec.md](./spec.md) · **Reality check:** inline findings in [spec.md](./spec.md)
**Linked:** ADR-071 · CON-026 · R-010 · R-020 · R-021 · R-060 · R-090 · R-221

---

## Summary

Esta refatoração unifica a orquestração de persistência de tomada/desfecho de dose e controle de estoque FIFO entre Web e Mobile.
A lógica de escrita migra de implementações JS ad-hoc duplicadas nas plataformas para uma factory centralizada no core: `createDoseLogService({ client, getUserId })`.

O estoque da Web já utiliza o RPC `consume_stock_fifo` via repositório. Portanto, a convergência não exige alterações de banco, apenas a unificação das regras de persistência, rollback transacional e âncoras na factory core. Side-effects como Analytics e Alarme (mobile) permanecem nos adaptadores de plataforma.

## Clarifications & Scope Boundaries

- **Gates locais de conectividade (offline check)**: Devem permanecer no adaptador de plataforma (mobile `doseService.js` lança `_ERR_OFFLINE` antes de chamar o core).
- **Side-effects de plataforma**:
  - Cancelamento de alarmes locais (`_cancelAlarmBestEffort`) e logs do Firebase Analytics (`logEvent`) permanecem no `doseService.js` mobile.
  - Analytics web permanecem no `logService.js` web.
- **Transação / Rollback**: A factory realiza o insert do log e o débito via `consume_stock_fifo` RPC. Em caso de erro no RPC, ela deleta o log e lança o erro de volta ao caller.

## Architecture

```
                       [Platform Boundary]
   +---------------------------------------+---------------------------------------+
   |             Web logService            |          Mobile doseService           |
   |   - Web Analytics                     |   - Offline check (_ERR_OFFLINE)      |
   |                                       |   - Native Alarms (Notifee)           |
   |                                       |   - Firebase Analytics                |
   +-------------------+-------------------+-------------------+-------------------+
                       |                                       |
                       +-------------------+-------------------+
                                           |
                                           v
                     +-------------------------------------------+
                     |            createDoseLogService           |
                     |         (@dosiq/core/services)            |
                     +---------------------+---------------------+
                                           |
                                           v
                             +-------------+-------------+
                             |                           |
                             v                           v
                    [medicine_logs DB]       [consume_stock_fifo RPC]
                    (Insert/Update/Delete)   (Atomic FIFO DB Stock)
```

## Target Files

| Arquivo | Mudança | Descrição |
|---|---|---|
| `packages/core/src/services/doseLogService.js` | **[NEW]** | Implementação da factory `createDoseLogService` conforme contrato **CON-026**. |
| `packages/core/src/services/__tests__/doseLogService.test.js` | **[NEW]** | Testes unitários com mock do Supabase client cobrindo rollback, âncora e updates. |
| `packages/core/src/services/index.js` | **[MODIFY]** | Exportar a nova factory. |
| `packages/core/src/index.js` | **[MODIFY]** | Certificar re-export de services. |
| `apps/mobile/src/features/dose/services/doseService.js` | **[MODIFY]** | Refatorar para virar casca fina chamando `createDoseLogService`. Preservar side-effects. |
| `apps/mobile/src/features/dose/services/__tests__/doseService.test.js` | **[MODIFY]** | Atualizar testes mockando a factory do core. |
| `apps/mobile/src/__tests__/doseService.undoDose.test.js` | **[DELETE]** | Testes de undoDose migrados/consolidados. |
| `apps/web/src/shared/services/api/logService.js` | **[MODIFY]** | Refatorar para delegar mutações ao `createDoseLogService`. |
| `apps/web/src/shared/services/api/__tests__/logService.test.js` | **[MODIFY]** | Atualizar testes mockando a factory do core. |
| `plans/specs/README.md` | **[MODIFY]** | Atualizar status da spec 035 para `planned`. |
| `plans/specs/035-unified-dose-log-stock-core/spec.md` | **[MODIFY]** | Atualizar status no header para `planned`. |

## Interfaces & Contracts

### CON-026 — `createDoseLogService`
Implementar métodos exatamente de acordo com [CON-026.md](file:///.agent/memory/contracts/data_and_schema/CON-026.md):
- `registerDose(logData, { instanceId })`
- `undoDose(instanceId)`
- `updateOrphanLog(logId, updates)`
- `deleteOrphanLog(logId)`
- `registerDoseMany(logsData)` (Batch op com rollback individual e âncora/alarmes)

## Risks & Mitigations

- **Race Conditions na Âncora**: Multiplos cliques na UI podem tentar associar a mesma ocorrência.
  *Mitigação*: `markTaken` usa o filtro `in('status', ['pending', 'missed'])` para garantir que apenas o primeiro clique reserve a instância.
- **Rollback Parcial no Batch (`registerDoseMany`)**: Se o insert em lote funcionar mas um dos consumos FIFO falhar, é crucial dar rollback no log específico de forma atômica.
  *Mitigação*: Implementar exclusão resiliente no catch por log e retornar resultados mapeados individuais `{ id, success, error }`.

## Quality Gates (C4)

- **Testes Unitários Core**: Suíte `@dosiq/core` em Vitest cobrindo 100% dos caminhos de sucesso, rollback e âncoras da factory.
- **Lint**: `rtk lint` deve retornar zero erros em todos os pacotes.
- **Validação E2E local**: `rtk npm run validate:agent` deve rodar e passar sem regressões.
