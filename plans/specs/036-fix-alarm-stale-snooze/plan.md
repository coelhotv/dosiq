# Plan 036 — Fix alarme obsoleto + transparência clínica (Tier 1)

**Spec:** `spec.md` · **Tier:** 1 · **Status:** planned · Mobile-only · sem migração/ADR/contrato.
**SQP (R-221):** Mobile, SemVer **patch** (bugfix), `APP_VERSION` 0.19.0→0.19.1; CHANGELOG `[Unreleased]` Mobile + store-note.

> Planning Tier 1: design óbvio, dobrado no C2. Este plan.md registra os **paths verificados**
> e a única decisão não-óbvia (revalidação de status na full-screen). `tasks.md` é a fonte durável.

## Approach (3 eixos, mesma tela/serviço)

1. **Cancel-on-resolve cross-superfície (US1):** `registerDose`/`registerDoseMany` chamam
   `alarmService.cancelAlarm(instanceId)` após sucesso `taken` (best-effort, R-245/246). Mata o
   trigger principal + `:nag:N` + soneca (id reusado).
2. **Auto-dismiss da full-screen (US2):** `AlarmFullScreen` revalida `status` no mount/focus; se
   nenhuma `instanceId` está `pending` → `cancelAlarm` + dismiss. Rede pra resoluções via web/bot
   (que não rodam código no device) e corridas.
3. **Transparência clínica (US3):** full-screen mostra concentração (`formatMedicineConcentration`)
   + quantidade a tomar (`formatDoseItem`) — single e grupo, via formatters do core (R-231),
   matando o `un.` hardcoded (cobre líquido/injetável da 012).

## Target Files (paths verificados — find/grep/Read)

| Arquivo | Ação | Verif |
|---------|------|-------|
| `apps/mobile/src/features/dose/services/doseService.js` | `registerDose`:321 / `registerDoseMany`:416 → `cancelAlarm` por instanceId resolvida | ✅ |
| `apps/mobile/src/features/dose/screens/AlarmFullScreen.jsx` | revalida status + auto-dismiss; render concentração+qty (single :112-114 / grupo :102-103) | ✅ |
| `apps/mobile/src/platform/alarms/useAlarmScheduler.js` | `scheduleAlarm` data (single :86-95) + `groupedDoses` (:100-111) ganham `concentrationVolumeMl/intakeUnit/unitsPerMl` | ✅ |
| `apps/mobile/src/platform/alarms/AlarmSchedulerBridge.jsx` | `openAlarmScreen` params (:43-57) forwarda os campos clínicos (single) | ✅ |
| `apps/mobile/src/platform/alarms/alarmService.js` | `cancelAlarm`:343 (já cobre principal+nag; reuso) | ✅ (sem alteração) |
| core `doseUnit.js` `formatMedicineConcentration`:61 / `formatDoseItem`:346 | reuso (sem alteração) | ✅ |
| core `doseZones.js` DoseItem :143-162 (expõe todos os campos) | fonte (sem alteração) | ✅ |

## Data-flow (campos clínicos)

```
dose_instances + protocols(intake_unit,critical_alarm) + medicines(dosage_per_pill,
  dosage_unit, concentration_volume_ml, units_per_ml)
  → buildDoseItemsFromInstances → DoseItem {dosagePerPill, dosageUnit, concentrationVolumeMl,
      intakeUnit, unitsPerMl, dosagePerIntake, ...}                       [doseZones.js:143-162]
  → syncAlarms scheduleAlarm.data / groupedDoses[]   (T013 add campos)    [useAlarmScheduler.js]
  → notification.data → openAlarmScreen route params (T014 add campos)    [AlarmSchedulerBridge.jsx]
  → AlarmFullScreen → formatMedicineConcentration({dosage_per_pill,dosage_unit,concentration_volume_ml})
                    + formatDoseItem({dosagePerIntake,intakeUnit,dosageUnit,dosagePerPill,unitsPerMl})
```
Bridge `load()` já seleciona todos os campos: `getActiveProtocols`(intake_unit,critical_alarm)
[dashboardService.js:24] + `getMedicinesData`(dosage_per_pill,dosage_unit,concentration_volume_ml,
units_per_ml) [:84]. **R-267 read-path coberto** — nenhum campo novo de persistência.

## Decisão não-óbvia — revalidação de status na full-screen

`createDoseInstanceRepository` **não** tem getById (só `getWindow`/`findAnchorInstance`/`countByStatus`).
Para revalidar 1-N ids no mount sem janela: **select direto** `supabase.from('dose_instances')
.select('id,status').in('id', ids)` (mobile já usa `supabase` raw em `quickDoseRegistration`).
Regra de dismiss: single → dismiss se `status!=='pending'`; grupo → dismiss só se **todas** ≠ pending.
Best-effort: falha de leitura **não** fecha a tela (não esconder um alarme legítimo por erro de rede).

## Risks + Gates
- **R1:** resolução via web/bot não roda no device → cobertura = `syncAlarms` no `AppState→active`
  (já existe) + auto-dismiss (FR-004). Suficiente p/ hotfix (sem push de invalidação cross-device).
- **R2:** `cancelAlarm` em `doseService` acopla feature→platform — OK (direção de dependência válida).
- **R3:** `un.` hardcoded no grupo era bug latente p/ líquido/injetável — corrigido junto (FR-007).
- Gates: `rtk lint` 0 erros · jest mobile (doseService + AlarmFullScreen) · smoke PO (SC-001..006).

## Clarifications (P1.5)
Nenhuma pergunta — markers resolvidos no Specifying; escopo, dados e UX determinados pelo repo.
