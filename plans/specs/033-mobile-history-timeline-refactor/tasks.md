# Tasks 033 — Refactor Histórico Mobile (Service-First)

**Tier 1 · refactor · Mobile** · Spec/Plan/Analysis em `plans/specs/033-mobile-history-timeline-refactor/`
Dependência: spec 030 mergeada (PR #668) ✅. Branch sugerida: `refactor/w25/033-mobile-history-timeline`.

## Camada de Service (service-first — US1)

- [ ] T001 [US1] Criar dir `apps/mobile/src/features/history/services/` + `historyTimelineService.js` esqueleto (import `createTimelineService`, `biomarkersToEvents`, `buildTimeline`, `TIMELINE_ORDER` de `@dosiq/core`; `measuresRepo`; `supabase` nativo).
- [ ] T002 [US1] `buildProtocolsById(userId)`: monta mapa `{protocolId: {medicine_name, dosage_unit, dosage_per_pill, dosage_per_intake, intake_unit, protocol_name}}` (GAP-3) — fetch protocols+medicines; reaproveitar lógica do `enrichInstancesWithProtocol` que sai do hook.
- [ ] T003 [US1] `getHistoryTimeline(userId, {pastDays, futureDays, tz})`: janela UTC `getServerTimestamp`±dias (AP-194, R-252); `coreTimeline.getTimeline` (doses) + `measuresRepo.list`→`biomarkersToEvents` (best-effort try/catch, GAP-1) + `buildTimeline([...dose,...bio])`.
- [ ] T004 [US1] `mapToMobileShape(events)` (anti-corruption, GAP-2): dose → flat snake_case (`status,source,scheduled_for,taken_at←occurred_at,medicine_name,protocol_name,dosage_per_pill,dosage_per_intake,intake_unit,quantity_taken,medicine_id,protocol_id,is_orphan=(source==='log'),logId,instanceId,id`); bio → `{id,type:'biomarker',measured_at,bioType,value,value_secondary,unit,context,localDay}`. `localDay` via tz.

## Hook fino (US1 / US3)

- [ ] T005 [US1] Refatorar `useHistoryData.js`: remover `fetchOrphanLogs`/`normalizeOrphanLog`/`enrichInstancesWithProtocol`/janela manual; chamar `historyTimelineService.getHistoryTimeline(...)` no `load()`.
- [ ] T006 [US3] Split de estado p/ KPI (ADR-054): `doseInstances` = itens `type==='dose'`; `measureItems` = `type==='biomarker'`; `instances` (render) = todos. KPIs (`adherence30d`,`streak`,`dosesThisMonth`) filtram `type==='dose'` antes de calcular.
- [ ] T007 [US1] `instancesForDay`: filtrar por `item.localDay === selectedDay` (sem `utcToLocalDateStr` custom); ordem já do `buildTimeline`.

## Camada de UI (screen-second — US2)

- [ ] T008 [P][US2] `BiomarkerHistoryCard.jsx` (NOVO): ícone `Ruler`, label via `BIOMARKER_TYPE_LABELS` (core), valor+unidade, hora (`formatTimeInTz`), botões Editar/Excluir.
- [ ] T012 [US2] `DoseHistoryList.jsx`: branch `item.type==='biomarker'`→`BiomarkerHistoryCard`; senão layout dose atual (preservar ícone/chip/avulsa de 030); chip de contagem conta só `type==='dose'`.
- [ ] T013 [US2] `HistoryScreen.jsx`: montar `MeasureLogSheet` (`editItem`, `key`); callbacks `onEditMeasure`(abre sheet)/`onDeleteMeasure`(confirma+`measuresRepo.remove`) passados ao `DoseHistoryList`. `MeasuresScreen` intocada (FR-007/SC-006).

## Testes (C4) + Validação

- [ ] T009 [C4] `historyTimelineService.test.js`: cobrir mapToMobileShape (cada campo), merge bio best-effort, failure modes (analysis: measuresRepo throw, bio vazio, protocol miss, líquido `intake_unit`, taken sem log, cross-meia-noite). ≥80% (SC-007).
- [ ] T010 [C4] Teste isolamento KPI (ADR-054/SC-004): 5 dose taken + 3 bio → `dosesThisMonth==5`; adicionar bio não muda `adherence30d`/`streak`.
- [ ] T011 [C4] `npm test --workspace @dosiq/mobile` (sem regressão) + `rtk lint` 0 errors + `rtk npm run validate:agent` (core/web verdes).
- [ ] T014 [C4] DoD file-by-file SC-001..SC-007 (citar linha): doses não duplicadas (AP-193), bio intercalado por horário, edit medida abre sheet sem navegar p/ MeasuresScreen, scatter plot intacto.

## C5 (record)

- [ ] T015 [C5] SQP R-221: classificar bump mobile (biomarker na lista do dia = feature → avaliar minor 0.17.x→0.18.0 vs patch refactor; decidir no gate) + CHANGELOG [Unreleased] + APP_VERSION.
- [ ] T016 [C5] Atualizar CON-025: nota "adapter consumido só no web" → "web + mobile" (consumo aditivo); journal 2026-W25; state.json (status, journal++); R-NNN se padrão "anti-corruption layer payload→shape de plataforma" recorrer.
- [ ] T017 [C5] Atualizar spec.md 033 (FR-001/FR-009) refletindo merge-no-service + anti-corruption layer (corrigir imprecisão detectada no planning).

## Notas
- `[P]` = paralelo (T008 independe do service). Ordem C3: service (T001-T004) → hook (T005-T007) → UI (T008,T012,T013) → testes (T009-T014) → C5.
- Sem migration, sem novo ADR/contrato. CON-023/CON-025 consumo aditivo (não-breaking).
