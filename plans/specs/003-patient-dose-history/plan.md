# Implementation Plan: Histórico de Doses do Paciente (Mobile)

**Feature Directory**: `plans/specs/003-patient-dose-history`
**Spec**: `spec.md` · **Revised**: 2026-06-02 · **Tier**: 1

---

## Technical Context

Leitura/mutação de `dose_instances` via `@dosiq/core` (`createDoseInstanceRepository`), cache SWR no AsyncStorage. Registro retroativo reusa `registerDose` (mobile `doseService.js`). UI nativa virtualizada.

**Paths reais verificados:**
- Repo: `packages/core/src/repositories/createDoseInstanceRepository.js` (factory). ✅
- Datas: `@dosiq/core` (`parseLocalDate`,`getTodayLocal`,`addDays`). ✅
- `registerDose(logData,{instanceId})`: `apps/mobile/src/features/dose/services/doseService.js:136`. ✅
- Derivações de hoje: `apps/mobile/src/features/dashboard/hooks/_useTodayDerived.js`. ✅
- `features/history` = **[NEW]** no mobile.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Health Data Safety | ✅ | Mutação via `registerDose` (log + consumo); RLS por usuário. |
| Mobile-First | ✅ | Lista virtualizada; reusa derivações de dashboard. |
| Timezone (multi-tz) | ✅ | `parseLocalDate` de `@dosiq/core`; timestamptz absoluto. |
| R-221 SQP | ✅ | Minor mobile+core; bump app.config.js; CHANGELOG + store-note. |

---

## Target Files

| Path | Purpose | Evidence |
|------|---------|----------|
| `apps/mobile/src/features/history/screens/HistoryScreen.jsx` | calendário + lista. | [NEW] |
| `apps/mobile/src/features/history/components/AdherenceCalendar.jsx` | calendário em linha (toque ≥60px). | [NEW] |
| `apps/mobile/src/features/history/components/DoseHistoryList.jsx` | lista virtualizada por status. | [NEW] |
| `apps/mobile/src/features/history/components/DoseActionSheet.jsx` | sheet de retroativo/desfazer. | [NEW] |
| `apps/mobile/src/features/dose/services/doseService.js` | reuso `registerDose`; **adicionar** `undoDose(instanceId)` (delete log ancorado + revert status) se ainda não existir. | `:136` |
| `packages/core/src/repositories/createDoseInstanceRepository.js` | leitura (listByRange/status). Estender se faltar método de range. | verificado |

---

## Architectural Approach

### 1. Leitura materializada (SWR)
Mobile lê via `createDoseInstanceRepository` e cacheia `@dosiq/dose-instances-snapshot`. Reusar derivações de `_useTodayDerived.js` para agrupar por período.

### 2. Mutação
- **Retroativo**: `registerDose({ protocol_id, medicine_id, quantity_taken, taken_at: <retroativo> }, { instanceId })`. Confirmar payload mínimo do `logSchema` em C1.
- **Desfazer**: localizar `medicine_log_id` ancorado na instância → deletar o log (o service já tem rollback de estoque) → reverter `dose_instances.status`. Implementar `undoDose` no `doseService` se inexistente.
- Invalidar `@dosiq/dose-instances-snapshot` + `@dosiq/adherence-snapshot`.

---

## SQP (R-221)
Mobile + Shared/Core. Minor. Bump `apps/mobile/app.config.js`. CHANGELOG `[Unreleased]` + store-note.

## Risks
- **`undoDose` pode não existir** no `doseService` — confirmar em C1; criar reusando o rollback existente, não duplicar.
- **Payload `registerDose`** casar com `logSchema`. C1 gate.
- **Método de range no repo core** — confirmar/estender `createDoseInstanceRepository`.
