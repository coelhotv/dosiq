# Analysis 033 — Reality Check (C1.5 focado)

**Tier:** 1 (single-platform mobile, sem migration, sem novo ADR/contrato — estende consumo de CON-025 aditivamente). Análise focada exigida por 3 riscos reais detectados no repo.

**Método:** evidência contra o repo real (find/grep/Read), não contra a narrativa da spec.

---

## Evidence Table

| Claim da spec 033 | Repo real (file:line) | Verificado? | Nota |
|---|---|---|---|
| `createTimelineService` mescla biomarkers (FR-001) | `packages/core/src/services/timelineService.js:252-264` — `getTimeline` só faz `doseInstancesToEvents(instances, logs)` + `buildTimeline`; **não** chama `biomarkersToEvents` | ❌ **GAP-1** | O merge de biomarker é feito FORA do core, no wrapper web `apps/web/src/services/api/timelineService.js:80-93`. Mobile precisa replicar esse merge, não esperar do core. |
| Output é `TimelineEvent[]` consumível direto pela UI mobile (FR-009) | payload é camelCase aninhado: `instanceToEvent` (`:66-87`) e `logToEvent` (`:90-106`) → `event.payload.{scheduledFor,medicineName,dosageUnit,quantityTaken,medicineId,protocolId,instanceId,logId,status,source}` | ❌ **GAP-2** | UI mobile lê **flat snake_case**: `DoseActionSheet`/`DoseHistoryList` usam `instance.scheduled_for`, `.medicine_name`, `.quantity_taken`, `.status`, `.source`, `.is_orphan`, `.protocol_name`, `.taken_at`. Shape + case divergem. |
| Payload carrega tudo p/ render de dose | enricher (`:54-62`) só adiciona `medicineName` + `dosageUnit` | ❌ **GAP-3** | Faltam no payload: `dosage_per_pill`, `dosage_per_intake`, `intake_unit`, `taken_at` (há `occurred_at`), `protocol_name`, `medicine_id` (em log há; em instance vem do linkedLog). Hint líquido (FR de 030) e dosagem na lista quebram sem eles. |
| `measuresRepo` existe no mobile (A2) | `apps/mobile/src/features/measures/services/measuresRepo.js:14` — `createBiomarkerRepository({client,getUserId})` | ✅ | `list({fromTs,toTs})` disponível. |
| `MeasureLogSheet` aceita edição (A4) | `MeasureLogSheet.jsx:56` — props `editItem`, `lockedType`; `key={editItem?.id||'create'}` (R-273) | ✅ | Integração de edit inline OK. |
| `biomarkersToEvents` exportado do core (A2) | `timelineService.js:169` + usado em web `:87` | ✅ | Adapter puro pronto. |
| KPIs só de `dose_instances` (ADR-054/US3) | `useHistoryData` separa `doseInstances` vs render | ✅ (a preservar) | Split `type==='dose'` vs `type==='biomarker'` antes de KPI. |

---

## Gaps & Resolução

### GAP-1 (HIGH) — core service não mescla biomarker
**Spec FR-001 impreciso.** `historyTimelineService` mobile DEVE espelhar o wrapper web (`getMonthTimeline`): chamar `coreTimeline.getTimeline` (doses) → `measuresRepo.list` (biomarkers) → `biomarkersToEvents` → `buildTimeline([...dose,...bio])`. Merge best-effort: falha de biomarker NÃO derruba doses (try/catch, igual web `:90-93`).
**Resolução:** tasks.md T003 implementa o merge no service mobile, não no core. CON-023/CON-025 intocados (consumo aditivo).

### GAP-2 (CRITICAL) — mismatch shape/case payload↔UI
TimelineEvent (`event.payload.camelCase`) ≠ shape lido pela UI (`instance.snake_case` flat). Duas opções:
- **(A)** Anti-corruption layer no service: mapear `TimelineEvent[]` → shape flat snake_case que a UI já consome (zero mudança em DoseActionSheet/DoseHistoryList além do branch biomarker).
- **(B)** Refatorar UI p/ ler `event.payload.camelCase`.

**Decisão: (A)** — menor diff, isola a tradução num ponto testável, preserva a UI estável de 030 (recém-mergeada/smoke-validada). O service expõe `getHistoryTimeline()` retornando itens flat (`{id, type, status, source, scheduled_for, taken_at, medicine_name, protocol_name, dosage_*, intake_unit, quantity_taken, is_orphan, logId, instanceId, ...}` p/ dose; `{id, type:'biomarker', measured_at, ...}` p/ bio). `localDay` derivado do `occurred_at` no tz.
**Trade-off:** diverge levemente do "TimelineEvent[] idêntico ao web" (FR-009) — mas o web também tem mapeamento próprio (`DoseEventCard` lê payload camelCase). Paridade real = mesma FONTE (core adapters), não mesmo consumo literal. Registrar como decisão no plan.

### GAP-3 (HIGH) — enrichment insuficiente
`protocolsById` enricher só dá `medicineName`+`dosageUnit`. Mobile precisa `dosage_per_pill`, `dosage_per_intake`, `intake_unit`, `medicine_name`, `protocol_name` p/ render de dosagem + hint líquido. O mapa `protocolsById` mobile DEVE ser construído com esses campos (de protocols+medicines) e o anti-corruption layer (GAP-2) projeta-os no shape flat. `taken_at` ← `occurred_at` quando `status==='taken'`/`source==='log'`.

---

## Behavioral Failure Modes — `historyTimelineService.getHistoryTimeline`

| Input / condição | Valor degenerado | Comportamento esperado | Coberto (teste) |
|---|---|---|---|
| `measuresRepo.list` lança | erro de rede | doses ainda renderizam; bio omitido (try/catch best-effort) | T009 |
| biomarkers vazios | `[]` | retorna só eventos dose, sem buildTimeline extra | T009 |
| protocolsById sem o protocol | lookup miss | enrich retorna `{}`; campos flat viram `null`, UI mostra '—' | T009 |
| dose líquida injetável | `intake_unit='UI'` | shape flat carrega `intake_unit` p/ hint `formatIntakeDose` | T009 |
| instância `taken` sem log linkado | `logId=null` | `quantity_taken=null`, `taken_at` ← occurred_at | T009 |
| janela cross-meia-noite (GMT-3) | dose 22h local | `localDay` correto via tz (não UTC) | T009 |
| KPI com biomarker na stream | 5 dose + 3 bio | `dosesThisMonth` conta só `type==='dose'` (ADR-054) | T010 |

---

## Cross-File Consistency
- spec.md FR-001/FR-009 ↔ analysis (GAP-1/GAP-2): **contradição** — spec assume core mescla bio e UI consome TimelineEvent direto. Plan.md corrige a arquitetura; spec.md a atualizar (nota de planning) p/ refletir merge-no-service + anti-corruption layer.
- Sem migration (nenhum schema/enum muda) → sem deliverable de data-migration.

## Gate
2 HIGH + 1 CRITICAL de DESIGN, **resolvidos no plano** antes de codar (não são blockers de implementação — são correções de rota da spec). Prosseguir p/ tasks com arquitetura corrigida. Nenhum gap não-resolvido remanescente.
