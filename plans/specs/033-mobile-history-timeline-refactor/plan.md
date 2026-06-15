# Plan 033 — Refactor Histórico Mobile (Service-First)

**Tier:** 1 · **goal_type:** refactor · **Plataforma:** Mobile (consome core; sem mudança de contrato)
**Spec:** [spec.md](./spec.md) · **Reality check:** [analysis.md](./analysis.md)
**Linked:** ADR-050 (FP-3 timeline) · ADR-054 (KPI=dose_instances) · ADR-060 (biomarkers) · CON-023 · CON-025 · R-252 · R-231 · R-267 · R-276

---

## Summary

Mobile histórico abandona o pipeline custom (`fetchOrphanLogs`/`normalizeOrphanLog`/`enrichInstancesWithProtocol` no hook) e passa a consumir `createTimelineService` (core, CON-023) via um adapter de feature `historyTimelineService` — espelhando o wrapper web. Ganha dedupe AP-193, doses avulsas/PRN no read-path do core (elimina o custom de 030), e biomarkers na lista do dia. KPIs seguem isolados em `dose_instances` (ADR-054).

## Clarifications
- Q: O core `getTimeline` mescla biomarkers? → A: **Não** (GAP-1). Merge replicado no service mobile, best-effort, igual web `getMonthTimeline`.
- Q: UI mobile consome `TimelineEvent` cru? → A: **Não** (GAP-2). Anti-corruption layer no service traduz `payload.camelCase` aninhado → shape flat snake_case que `DoseHistoryList`/`DoseActionSheet` já leem. Preserva a UI estável de 030.

## Architecture (corrigida vs spec)

```
useHistoryData (hook fino: estado + split KPI)
  └── historyTimelineService.getHistoryTimeline(userId, {pastDays, futureDays, tz})   ◄── NOVO (service-first)
        ├── coreTimeline.getTimeline({userId, fromTs, toTs, tz, protocolsById})   (CON-023: doses+logs+dedupe)
        ├── measuresRepo.list({fromTs, toTs}) → biomarkersToEvents               (CON-025: bio)
        ├── buildTimeline([...dose, ...bio], {tz, order})                        (R-252: merge idempotente)
        └── mapToMobileShape(events)  ◄── anti-corruption: payload camelCase → flat snake_case + localDay
              ├── dose  → {id,type:'dose',status,source,scheduled_for,taken_at,medicine_name,protocol_name,
              │            dosage_per_pill,dosage_per_intake,intake_unit,quantity_taken,is_orphan,logId,instanceId}
              └── bio   → {id,type:'biomarker',measured_at,bioType,value,unit,context,localDay}

DoseHistoryList: item.type==='biomarker' → BiomarkerHistoryCard (NOVO); senão layout dose atual
HistoryScreen:   monta MeasureLogSheet (editItem) p/ edit inline de medida
```

**Decisão de design (registrar):** paridade web↔mobile = **mesma fonte** (core adapters CON-023/CON-025), não mesmo consumo literal de `TimelineEvent`. Ambas as plataformas têm camada de tradução própria (web `DoseEventCard` lê payload; mobile `mapToMobileShape` achata). Isso resolve GAP-2 com diff mínimo.

## Target Files (verificados)

| Arquivo | Mudança | Verificado |
|---|---|---|
| `apps/mobile/src/features/history/services/historyTimelineService.js` | **NOVO** — adapter: getTimeline+bio merge+mapToMobileShape | path novo (dir `services/` a criar) |
| `apps/mobile/src/features/history/services/__tests__/historyTimelineService.test.js` | **NOVO** — unit (≥80% SC-007) | jest-expo |
| `apps/mobile/src/features/history/hooks/useHistoryData.js` | **REFACTOR** — hook fino; remove fetchOrphanLogs/normalizeOrphanLog/enrich; split KPI por type | `:141-179` ✅ |
| `apps/mobile/src/features/history/components/DoseHistoryList.jsx` | **MOD** — branch `type==='biomarker'`; chip conta só dose | ✅ |
| `apps/mobile/src/features/history/components/BiomarkerHistoryCard.jsx` | **NOVO** — card medida (Ruler, label, valor+unidade, hora, edit/del) | path novo |
| `apps/mobile/src/features/history/screens/HistoryScreen.jsx` | **MOD** — MeasureLogSheet + callbacks edit/delete medida | ✅ |
| `apps/mobile/src/features/history/hooks/useHistoryMutation.js` | **MOD (leve)** — manter updateOrphanLog/deleteOrphanLog (030/AP-231); +removeMeasure opcional | ✅ |

`measuresRepo.js:14` ✅ · `MeasureLogSheet.jsx:56` (editItem) ✅ · core exports CON-023/CON-025 ✅

## Contracts & ADRs
- **CON-023/CON-025:** consumo aditivo (mobile vira novo consumidor do adapter de bio). **Não-breaking** — nota em CON-025 ("adapter só web") fica desatualizada → atualizar no C5 pós-merge p/ "web + mobile".
- Sem novo ADR (reusa ADR-050/054/060).

## Risks
- **GAP-2 (mapToMobileShape):** ponto único de tradução — teste cobre cada campo (T009). Se um campo faltar no payload (GAP-3), shape flat projeta `null` → UI '—' (degradação graciosa, não crash).
- **KPI drift (ADR-054):** split `type` antes de calcular `dosesThisMonth`/`adherence`/`streak` (T010 teste de isolamento).
- **Regressão 030:** UI de dose (ícone/chip/avulsa/hint líquido) preservada — `mapToMobileShape` reproduz o shape que a UI de 030 espera.

## Quality Gates (C4)
- `npm test --workspace @dosiq/mobile` (jest-expo) — service unit ≥80% + isolamento KPI
- `rtk lint` 0 errors
- `rtk npm run validate:agent` (core/web não devem regredir)
- DoD: SC-001..SC-007 verificados file-by-file
- SQP: patch mobile (refactor sem feature nova de dose; biomarker na lista = minor? ver tasks T011) — classificar no C5
