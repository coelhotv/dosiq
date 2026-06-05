# Implementation Plan: Histórico de Doses do Paciente (Mobile)

**Feature Directory**: `plans/specs/003-patient-dose-history`
**Spec**: `spec.md` · **Revised**: 2026-06-04 · **Tier**: 1

---

## Technical Context

Leitura/mutação de `dose_instances` via `@dosiq/core` (`createDoseInstanceRepository`). Registro retroativo reusa `registerDose` (mobile `doseService.js`). `undoDose` = **novo método** a criar. UI nativa RN.

**Reality check (2026-06-04) — paths verificados no repo:**

| Claim | Real no repo | Status |
|---|---|---|
| `createDoseInstanceRepository` | `packages/core/src/repositories/createDoseInstanceRepository.js` | ✅ |
| `registerDose(logData,{instanceId})` | `apps/mobile/src/features/dose/services/doseService.js:136` | ✅ |
| `computeAdherenceFromInstances` | `packages/core/src/utils/adherenceLogic.js:663` | ✅ |
| `computeStreakFromInstances` | `packages/core/src/utils/adherenceLogic.js:722` | ✅ |
| `getDoseInstancesForPeriod` (14d, paginado) | `apps/mobile/src/features/dashboard/services/dashboardService.js` | ✅ |
| `splitDayTimeline`, `classifyDose`, `DEFAULT_TZ` | `@dosiq/core` (usados em `_useTodayDerived.js`) | ✅ |
| `getWindow(userId, fromTs, toTs)` no repo | `createDoseInstanceRepository.js` — select `*`, paginado (AP-186) | ✅ |
| `markTaken(instanceId, logId)` | `createDoseInstanceRepository.js:391` — aceita pending/missed | ✅ |
| `undoDose` | **NÃO EXISTE** — criar em `doseService.js` | ⚠️ novo |
| `revertToUnregistered` no repo | **NÃO EXISTE** — criar no factory | ⚠️ novo |
| `getById(instanceId)` no repo | **NÃO EXISTE** — criar no factory | ⚠️ novo |
| `ROUTES.DOSE_HISTORY` | **NÃO EXISTE** — adicionar em `routes.js` | ⚠️ novo |
| Seção "FERRAMENTAS" no ProfileScreen | **NÃO EXISTE** — ProfileScreen tem AVISOS/SOBRE/MINHA CONTA | ⚠️ novo |
| `@dosiq/dose-instances-snapshot` | Nome de spec legada; cache real = `useTodayData` w/ `refresh()` | ⚠️ confirmar chaves em C1 |
| `unconsumeStockFifo` RPC | **VERIFICAR no Supabase antes de implementar `undoDose`** | ⚠️ C1 gate |

---

## Constitution Check

| Princípio | Status | Notas |
|---|---|---|
| Health Data Safety | ✅ | Mutação via `registerDose` (log + consumo); RLS por usuário |
| Mobile-First | ✅ | `FlatList`, `minHeight 60`, bottom sheet nativa |
| Timezone (multi-tz) | ✅ | `parseLocalDate`/`getTodayLocal` de `@dosiq/core`; timestamptz absoluto |
| R-221 SQP | ✅ | Minor mobile + core; bump `app.config.js`; CHANGELOG + store-note |

---

## Arquitetura

### Novo diretório

```
apps/mobile/src/features/history/
  components/
    WeekCalendar.jsx       — semanal navegável (setas + swipe PanGestureHandler)
    DoseHistoryKpis.jsx    — 3 cards: Adesão·30d, Sequência, Doses·mês
    DoseHistoryList.jsx    — lista por período, chips por status, empty PO-3
    DoseActionSheet.jsx    — sheet Editar / Excluir (PO-5)
  hooks/
    useHistoryData.js      — fetch dose_instances (janela 30d), KPIs, dia selecionado
    useHistoryMutation.js  — registerDose retroativo + undoDose + invalidação
  screens/
    HistoryScreen.jsx      — orquestra KPIs + WeekCalendar + DoseHistoryList
```

### Novos métodos no factory (core)

**`createDoseInstanceRepository`** — adicionar:
```js
// getById: busca instância completa (medicine_log_id, status, scheduled_for, etc.)
async getById(instanceId)

// revertToUnregistered: status = pending ou missed (conforme hora local vs scheduled_for+tolerance)
// medicine_log_id = null
async revertToUnregistered(instanceId, newStatus)
```

### Novo método de serviço (mobile)

**`doseService.js`** — adicionar `undoDose(instanceId)`:
1. `const inst = await doseInstanceRepo.getById(instanceId)`
2. Se `inst.medicine_log_id` existe:
   a. Verificar se RPC `unconsumeStockFifo` existe → usar para rollback de estoque
   b. Senão → delete de `stock_movements WHERE medicine_log_id = ?`
   c. Delete de `medicine_logs WHERE id = inst.medicine_log_id`
3. Determinar `newStatus`: se `scheduled_for + tolerance_minutes < now` → `'missed'` senão `'pending'`
4. `await doseInstanceRepo.revertToUnregistered(instanceId, newStatus)`
5. Retorno `{ success, error }`

### Integração na navegação

- `ROUTES.DOSE_HISTORY = 'DoseHistory'` em `routes.js`
- Registrar tela no stack de Perfil (dentro do `ProfileStack`) em `Navigation.jsx`
- Adicionar seção "FERRAMENTAS" + item "Histórico de Doses" em `ProfileScreen.jsx`

### Invalidação de cache (FR-007)

O dashboard usa `useTodayData` com `refresh()` (não uma chave de AsyncStorage nominal). Após qualquer mutação no history:
- Chamar `refresh()` exportado pelo `useTodayData` via context compartilhado ou prop drilling
- Confirmar em C1 se há chave persistida `dosiq_today_data_*` que precise ser limpa

---

## Target Files

| Arquivo | Ação | Evidence |
|---|---|---|
| `apps/mobile/src/features/history/screens/HistoryScreen.jsx` | CREATE | [NEW] |
| `apps/mobile/src/features/history/components/WeekCalendar.jsx` | CREATE | [NEW] |
| `apps/mobile/src/features/history/components/DoseHistoryKpis.jsx` | CREATE | [NEW] |
| `apps/mobile/src/features/history/components/DoseHistoryList.jsx` | CREATE | [NEW] |
| `apps/mobile/src/features/history/components/DoseActionSheet.jsx` | CREATE | [NEW] |
| `apps/mobile/src/features/history/hooks/useHistoryData.js` | CREATE | [NEW] |
| `apps/mobile/src/features/history/hooks/useHistoryMutation.js` | CREATE | [NEW] |
| `apps/mobile/src/features/dose/services/doseService.js` | MODIFY — add `undoDose` | `:136` ✅ |
| `packages/core/src/repositories/createDoseInstanceRepository.js` | MODIFY — add `getById`+`revertToUnregistered` | ✅ existe |
| `apps/mobile/src/navigation/routes.js` | MODIFY — add `DOSE_HISTORY` | ✅ existe |
| `apps/mobile/src/navigation/Navigation.jsx` | MODIFY — registrar no ProfileStack | ✅ existe |
| `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` | MODIFY — seção FERRAMENTAS + item | ✅ existe |

---

## SQP (R-221)

- Plataformas: Mobile + Shared/Core
- SemVer: minor
- Versão: bump `apps/mobile/app.config.js` + `apps/mobile/package.json`
- CHANGELOG `[Unreleased]` → seção `### Adicionado` (PT)
- Store-note: sim — nova tela de histórico de doses

## Riscos

| Risco | Sev | Mitigação |
|---|---|---|
| `unconsumeStockFifo` RPC não existe | ALTO | Verificar no Supabase via MCP antes de C3; fallback = delete direto `stock_movements` |
| Chave de AsyncStorage cache não identificada | MED | Grep `dosiq_today_data\|AsyncStorage.set` em `useTodayData.js` no C1 |
| Bottom sheet FlatList overflow (AP-180) | MED | `flexShrink:1` na lista interna do sheet |
| Swipe de semana conflitar com scroll vertical | MED | `PanGestureHandler` com threshold horizontal > 10px antes de absorver |
