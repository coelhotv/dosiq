# Tasks — 030 Fix Dose History

**Spec**: `plans/specs/030-fix-dose-history/spec.md`
**Tier**: 1 — Standard
**Sprint**: 2026-W25

---

## Web — Histórico (US1, US2, US3)

- [ ] T001 [US1/US2] Web: estender `timelineService.getMonthTimeline` para unir `dose_instances` com `medicine_logs` onde `dose_instance_id IS NULL`, agrupando por dia de `taken_at` (timezone do usuário — `parseLocalDate`).
- [ ] T002 [US1/US2] Web: renderizar evento "dose avulsa" no componente de histórico com horário (`taken_at`), medicamento e quantidade; usar `formatIntakeDose`/`formatDoseItem` existentes (FR-002).
- [ ] T003 [US3] Web: garantir que logs com `dose_instance_id` não-nulo sejam excluídos da union (sem duplicação de instâncias agendadas, FR-003).
- [ ] T004 [US2] Web: cobrir o caso PRN (`frequency='quando_necessario'`) — quando não há `dose_instances`, o histórico lista os `medicine_logs` diretamente (FR-004).
- [ ] T005 Web: validar que filtro de período/timezone continua funcionando para eventos avulsos (FR-005).

## Mobile — Histórico (US1, US2, US3)

- [ ] T006 [US1/US2] Mobile: estender `useHistoryData` para unir `dose_instances` com `medicine_logs` órfãos (`dose_instance_id IS NULL`), agrupando por dia de `taken_at`.
- [ ] T007 [US1/US2] Mobile: renderizar evento "dose avulsa" na listagem mobile com horário, medicamento e quantidade (FR-002).
- [ ] T008 [US3] Mobile: filtrar `medicine_logs` com `dose_instance_id` não-nulo (FR-003).
- [ ] T009 [US2] Mobile: cobrir PRN — `medicine_logs` diretos quando não há `dose_instances` (FR-004).

## Mobile — Detalhe da Dose (US4, US5)

- [ ] T010 [US4] Mobile: corrigir `DoseDetailBottomSheet` (ou equivalente) para derivar o ícone do campo `status`, reusando o **mesmo mapa `status→ícone`** da listagem — proibido hardcodar check-mark para não-`taken` (FR-006).
- [ ] T011 [US4] Mobile: ícone para `status='taken'` → `circle-check-big` (Lucide), substituindo o check-mark genérico atual (FR-006).
- [ ] T012 [US5] Mobile: adicionar chip/legenda textual de status no bottom sheet: `taken`→"Tomada", `missed`→"Perdida", `pending`→"Pendente", `skipped`→"Pulada" (FR-007).

## Mobile — Editar/Excluir Dose Avulsa (US6)

- [ ] T022 [US6] Mobile: `DoseActionSheet` DEVE receber prop `logId` (ou detectar `source='log'` no item) e, quando presente, roteiar "Editar" → `onUpdateLog(logId, payload)` e "Excluir" → `onDeleteLog(logId)` (em vez de `onRegisterRetro`/`onUndo` que operam em `dose_instance_id`). Paridade com web (`DoseEventCard.canEdit = !!logId`).
- [ ] T023 [US6] Mobile: implementar callbacks `onUpdateLog`/`onDeleteLog` em `HistoryScreen.jsx` chamando o serviço de medicine_logs diretamente (equivalente mobile do `logService.update`/`logService.delete` web).

## Quality Gates [C4]

- [ ] T013 [C4/SC-001] Validar: log avulso Lantus (09/jun, `dose_instance_id=null`) aparece no histórico web E mobile.
- [ ] T014 [C4/SC-002] Validar: tratamento PRN com ≥1 tomada exibe histórico não-vazio em ambas plataformas.
- [ ] T015 [C4/SC-003] Validar: nenhuma dose agendada-e-tomada aparece duplicada no histórico.
- [ ] T016 [C4/SC-004] Validar: abrir detalhe de `pending`/`missed`/`skipped` mostra ícone do status (não check cinza).
- [ ] T017 [C4/SC-005] Validar: detalhe de qualquer dose exibe chip textual do status.
- [ ] T018 [C4/SC-006] Validar: editar dose avulsa Lantus mobile → persiste no medicine_log (não cria/altera dose_instance).
- [ ] T019 [C4] Lint (`rtk lint`) + `rtk npm run validate:agent` — zero erros.

## DEVFLOW C5

- [ ] T020 [C5] R-221 SQP: plataformas afetadas (Web + Mobile), impacto SemVer (patch web, patch mobile), atualizar `CHANGELOG.md [Unreleased]`, bump de versão quando aplicável.
- [ ] T021 [C5] Journal entry em `.agent/memory/journal/2026-W25.jsonl` com release log SQP.
- [ ] T022 [C5] Atualizar `state.json`: `session.status = "completed"`, incrementar `journal_entries_since_distillation`.
