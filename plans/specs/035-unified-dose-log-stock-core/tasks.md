# Tasks 035 — Refactor Dose-Log + Stock Service unificado no core

**Tier 2 · refactor · Shared Core** · Spec/Plan/Tasks em `plans/specs/035-unified-dose-log-stock-core/`
Branch sugerida: `refactor/w25/035-unified-dose-log-stock-core`.

## Wave 1: Core Service Implementation (US1)

- [ ] **T001 [US1]** Criar `packages/core/src/services/doseLogService.js` com a factory `createDoseLogService({ client, getUserId })`.
  - Instanciar `createDoseInstanceRepository` internamente.
  - Implementar `registerDose(logData, { instanceId })` com validação `logCreateSchema` (do Zod), insert, `consume_stock_fifo` RPC, rollback em caso de falha de estoque, e âncora best-effort (direta se `instanceId` presente, tolerância via `findAnchorInstance` se ausente).
  - Implementar `undoDose(instanceId)` obtendo o log, chamando `restore_stock_for_log` RPC, deletando o log, calculando `newStatus` (scheduled_for + tolerance_minutes vs `Date.now()`), e chamando `revertToUnregistered`.
  - Implementar `updateOrphanLog(logId, updates)` com `validateLogUpdate`, controlando mudanças de estoque se `quantity_taken` ou `medicine_id` mudarem (reverter estoque do antigo, salvar updates, e consumir do novo; com rollback resiliente).
  - Implementar `deleteOrphanLog(logId)` estornando o estoque (RPC) e excluindo o log, com fallback para restaurar o status da instância vinculada para pending/missed se houver `dose_instance_id`.
  - Implementar `registerDoseMany(logsData)` realizando inserção em batch e iteração de controle de estoque FIFO / rollback individual por log.
- [ ] **T002 [US1]** Exportar a factory `createDoseLogService` em `packages/core/src/services/index.js` e em `packages/core/src/index.js`.
- [ ] **T003 [US1]** Criar `packages/core/src/services/__tests__/doseLogService.test.js` cobrendo 100% dos fluxos e comportamentos da factory (Vitest, mocks de client e repositórios). Garantir testes verdes rodando `rtk vitest`.

## Wave 2: Mobile Refactor & Adapters (US3)

- [ ] **T004 [US3]** Refatorar `apps/mobile/src/features/dose/services/doseService.js` para usar `createDoseLogService({ client: supabase, getUserId: _getAuthUser })`.
  - Delegar operações de escrita (`registerDose`, `undoDose`, `updateOrphanLog`, `deleteOrphanLog`, `registerDoseMany`) para o core service.
  - Preservar os gates de rede offline (`_ERR_OFFLINE`), o side-effect nativo de alarmes `_cancelAlarmBestEffort` e chamadas Firebase Analytics `logEvent`.
- [ ] **T005 [US3]** Remover o arquivo de testes redundante `apps/mobile/src/__tests__/doseService.undoDose.test.js`.
- [ ] **T006 [US3]** Refatorar `apps/mobile/src/features/dose/services/__tests__/doseService.test.js` para mockar `createDoseLogService` e focar nas validações locais de rede, alarmes e analytics. Rodar testes com Jest.

## Wave 3: Web Refactor & Adapters (US2)

- [ ] **T007 [US2]** Refatorar `apps/web/src/shared/services/api/logService.js` para importar e instanciar `createDoseLogService({ client: supabase, getUserId })`.
  - Mapear os métodos mutantes (`create`, `update`, `delete`, `createBulk`) para delegar ao core service.
  - Preservar normalizações de timestamps e logs de analytics se houver.
- [ ] **T008 [US2]** Atualizar os testes unitários do web logService em `apps/web/src/shared/services/api/__tests__/logService.test.js`. Garantir testes rodando em Vitest.

## Wave 4: Validation & Release Documentation (DoD & SQP)

- [ ] **T009 [C4]** Executar linting `rtk lint` em todo o monorepo e corrigir quaisquer avisos ou erros.
- [ ] **T010 [C4]** Executar suite crítica completa de testes via `rtk npm run validate:agent`.
- [ ] **T011 [C5]** Atualizar índices e documentação de specs:
  - Marcar a Spec 035 como `planned` na tabela de status de [plans/specs/README.md](file:///Users/coelhotv/git/dosiq/plans/specs/README.md) e no header de `spec.md`.
- [ ] **T012 [C5]** Atualizar a memória do DEVFLOW:
  - Definir `session.plan` e `session.tasks` em `.agent/state.json` e marcar status da sessão como `planned`.
  - Inserir evento `planning_complete` em `.agent/sessions/events.jsonl`.
  - Adicionar entrada de planejamento no journal da semana `.agent/memory/journal/2026-W25.jsonl`.
- [ ] **T013 [C5]** Aplicar governança SQP (R-221):
  - Classificar impacto das mudanças e bumps de versão necessários no CHANGELOG.md (esta refatoração centraliza lógica, mantendo comportamento idêntico).
