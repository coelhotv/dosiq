# Feature Specification: Histórico de Doses do Paciente (Mobile)

**Feature Directory**: `plans/specs/003-patient-dose-history`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Tier**: 1 (feature mobile; reusa `dose_instances` + `registerDose` + repo core)
**Artifacts**: `spec.md` + `plan.md` + `tasks.md`
**Legacy Source**: `PHASE_5_6_PARITY_AND_BEYOND.md` §M1.1

---

## Context

Paciente idoso multi-medicamento precisa acompanhar o que tomou/esqueceu hoje e em dias anteriores. Esta feature provê, no **mobile**, um calendário compacto em linha + lista cronológica de doses, com mutação retroativa (registrar atrasado) e desfazer. PWA já tem calendário (`apps/web/src/features/calendar` / `adherence`); aqui é o port nativo.

> **Reality-check (revisão 2026-06-02):**
> - Repo core real = **`packages/core/src/repositories/createDoseInstanceRepository.js`** (factory), **não** `doseInstanceRepository.js`. Já usado por `apps/mobile/.../dashboardService.js:7`.
> - **Datas via `@dosiq/core`** (`parseLocalDate`/`getTodayLocal`), não `@utils/dateUtils` (vazio no mobile).
> - **`dose_instances` não tem `taken_at`.** Registro retroativo de tomada = **`registerDose(logData,{instanceId})`** (`apps/mobile/.../dose/services/doseService.js:136`) — cria `medicine_log` + `consume_stock_fifo` + ancora `status='taken'`+`medicine_log_id`. **Desfazer** = deletar o `medicine_log` ancorado (há rollback no service) e reverter a instância p/ `pending`/`missed` conforme hora local.
> - `features/history` é **dir novo no mobile** (hoje existem: dashboard/dose/medications/notifications/onboarding/profile/stock/treatments). A timeline de hoje já vive em `features/dashboard` (`_useTodayDerived.js`) — reusar derivações onde fizer sentido, não duplicar.
> - Status válidos: `pending|taken|missed|skipped_paused|skipped_user`.

---

## User Scenarios & Testing

### User Story 1 — Doses do Dia por Período (P1)
**Why**: ver status atual sem atrito.
**Independent Test**: abrir a Home; lista exibe doses pendentes/tomadas/atrasadas por período (Manhã/Tarde/Noite/Madrugada), chips coloridos por status.

**Acceptance Scenarios**:
1. Given Dona Maria abre o app, When vê a timeline, Then lista as doses de hoje em ordem cronológica, com chips por `status` (`taken`/`missed`/`pending`/`skipped_user`).

### User Story 2 — Registro Retroativo e Reversão (P1)
**Why**: corrigir esquecimento/clique acidental.
**Independent Test**: clicar numa dose pendente histórica → "Tomei com atraso" (cria log retroativo); ou clicar numa tomada por engano → "Desfazer" (remove log, reverte status). Validar no Supabase.

**Acceptance Scenarios**:
1. Given a Losartana das 08:00 esquecida, When "Tomei com atraso", Then `registerDose(logData,{instanceId})` cria o `medicine_log` (taken_at retroativo no log), consome estoque, ancora `dose_instances.status='taken'`; o heatmap recalcula.
2. Given dose tomada por engano, When "Desfazer Registro", Then o `medicine_log` ancorado é removido (rollback de estoque) e a instância volta p/ `pending`/`missed` conforme hora local.

---

## Edge Cases

- **Timezone (multi-tz)**: instâncias no fuso do usuário; usar `parseLocalDate`/timestamptz absoluto — dose das 23:30 não migra de dia.
- **Conflito mutação local vs. cuidador**: invalidação SWR imediata após mutação (último write coerente com o cache).
- **Desfazer dose sem log ancorado** (skip): reverter só o status, sem tocar estoque.

---

## Requirements

### Functional Requirements

- **FR-001**: Calendário em linha na Home, toque ≥60px/dia (a11y idoso, R-137/138).
- **FR-002**: Lista cronológica baseada **exclusivamente** em `dose_instances` (via `createDoseInstanceRepository`), chips por status.
- **FR-003**: Bottom sheet nativa ao tocar numa instância: registro retroativo (`registerDose`) e desfazer (delete do `medicine_log` + revert status).
- **FR-004**: Toda mutação invalida snapshots locais (`@dosiq/dose-instances-snapshot`, `@dosiq/adherence-snapshot`).

### Key Entities

- **dose_instances** (`@dosiq/core` repo): status + `medicine_log_id` (elo de tomada). **Sem `taken_at`** (vive em `medicine_logs`).

---

## Success Criteria

- **SC-001**: ≥55fps na rolagem/alternância de dias.
- **SC-002**: Sincronização < 200ms após mutação retroativa (invalidação de cache).
