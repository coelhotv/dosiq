# Tasks: Histórico de Doses do Paciente (Mobile)

**Feature Directory**: `plans/specs/003-patient-dose-history`
**Input**: `spec.md`, `plan.md` · **Revised**: 2026-06-04 · **Status**: Dev Ready · **Tier**: 1

---

## Phase 0 — C1 Reality Gates (ANTES de qualquer código)

- [ ] T001 [C1] Verificar se RPC `unconsumeStockFifo` existe no Supabase (MCP `list_tables` + `execute_sql`). Resultado determina implementação de `undoDose`.
- [ ] T002 [C1] Grep `AsyncStorage.set\|dosiq_today_data` em `apps/mobile/src/features/dashboard/hooks/useTodayData.js` — identificar chave de cache a invalidar após mutação.
- [ ] T003 [C1] Ler `logSchema` em `packages/core/src/schemas/logSchema.js` — confirmar payload mínimo de `registerDose` (especialmente `taken_at` formato esperado).
- [ ] T004 [C1] Ler `Navigation.jsx` — confirmar estrutura do `ProfileStack` para registrar nova tela.

## Phase 1 — Core (packages/core)

- [ ] T010 Adicionar `getById(instanceId)` em `createDoseInstanceRepository.js` — retorna linha completa incluindo `medicine_log_id`, `status`, `scheduled_for`, `tolerance_minutes`.
- [ ] T011 Adicionar `revertToUnregistered(instanceId, newStatus)` em `createDoseInstanceRepository.js` — UPDATE `status=newStatus, medicine_log_id=null`. Aceita `'pending'|'missed'`.

## Phase 2 — Service Layer (mobile)

- [ ] T020 Adicionar `undoDose(instanceId)` em `doseService.js`:
  - Buscar instância via `getById`
  - Se `medicine_log_id`: rollback estoque + delete `medicine_logs`
  - Determinar `newStatus` por hora local vs `scheduled_for + tolerance_minutes`
  - Chamar `revertToUnregistered`
  - Retornar `{ success, error }`
- [ ] T021 Criar `useHistoryData.js` — fetch `dose_instances` janela 30d via `getDoseInstancesForPeriod` (ou novo fetch dedicado), KPIs via `computeAdherenceFromInstances` + `computeStreakFromInstances`, agrupamento por dia selecionado.
- [ ] T022 Criar `useHistoryMutation.js` — wrapper de `registerDose` retroativo + `undoDose` + invalidação de cache (chamar `refresh` do dashboard ou limpar AsyncStorage).

## Phase 3 — UI Components

- [ ] T030 [US1] Criar `WeekCalendar.jsx`:
  - 7 dias navegáveis (setas ← →)
  - Swipe horizontal (`PanGestureHandler`, threshold 10px)
  - Coluna inteira clicável `minHeight: 60` (PO-4, a11y idoso)
  - Dot 3 estados: full teal / partial amarelo / none cinza
  - Dia selecionado = pill teal
  - Ref: `mock-historico-doses.png`

- [ ] T031 [US1] Criar `DoseHistoryKpis.jsx`:
  - 3 cards: `Adesão · 30d`, `Sequência (dias)`, `Doses · mês`
  - Dados via `useHistoryData`

- [ ] T032 [US1] Criar `DoseHistoryList.jsx`:
  - Lista cronológica por período (Manhã/Tarde/Noite/Madrugada)
  - Chips por status (`taken`/`missed`/`pending`/`skipped_user`)
  - Header `<dia>, <data> · N doses`
  - Empty state "Nada por aqui" quando dia sem doses (PO-3, `mock-historico-semdoses.png`)
  - `FlatList` para listas longas (R-115 threshold 30+)

- [ ] T033 [US2] Criar `DoseActionSheet.jsx` (PO-5, `mock-historico-doses-sheet.png`):
  - Modal com `statusBarTranslucent` + spacer (R-233)
  - Ação "Editar registro" → abre sub-form (hora + dose tomada)
  - Ação "Excluir registro" → abre sub-sheet de confirmação (`mock-historico-doses-sheet-apagar.png`)
  - Sub-sheet excluir: motivo opcional; confirmar → `undoDose(instanceId)` + invalidar cache
  - Sub-form editar: `taken_at` + `quantity_taken` retroativo → `registerDose` + invalidar cache
  - Sem "Marcar não tomada" (PO-5 removida)
  - `flexShrink: 1` na lista interna (AP-180)

## Phase 4 — Navegação & Entry Point

- [ ] T040 [FR-006] Adicionar `ROUTES.DOSE_HISTORY = 'DoseHistory'` em `routes.js`
- [ ] T041 Registrar `HistoryScreen` no `ProfileStack` em `Navigation.jsx` com rota `ROUTES.DOSE_HISTORY`
- [ ] T042 [FR-006] Criar `HistoryScreen.jsx` — orquestra `DoseHistoryKpis` + `WeekCalendar` + `DoseHistoryList` + `DoseActionSheet`
- [ ] T043 [FR-006] Adicionar seção "FERRAMENTAS" + item "Histórico de Doses" + `ChevronRight` em `ProfileScreen.jsx` (navega para `ROUTES.DOSE_HISTORY`)

## Phase 5 — Validação (C4)

- [ ] T050 [C4] [US2] Teste unitário `undoDose`: mock `getById` + delete log + `revertToUnregistered`; caso dose sem log (skip) → só revert status
- [ ] T051 [C4] [US2] Teste `revertToUnregistered`: status correto (pending vs missed) baseado em hora
- [ ] T052 [C4] Teste `useHistoryMutation`: `registerDose` retroativo cria log + ancora; `undoDose` reverte
- [ ] T053 [C4] `rtk lint` — zero erros
- [ ] T054 [C4] `rtk npm run validate:agent` (kill switch 600s)
- [ ] T055 [C4] Smoke PO: ≥55fps na rolagem/troca de dias; sync <200ms pós-mutação retroativa

## Phase 6 — Record (C5)

- [ ] T060 [C5] SQP R-221: bump versão mobile (`app.config.js` + `package.json`), CHANGELOG [Unreleased] PT, store-note: "Nova tela Histórico de Doses"
- [ ] T061 [C5] Atualizar `events.jsonl` + journal DEVFLOW
- [ ] T062 [C5] Atualizar `state.json` (status=completed, journal_entries++)
- [ ] T063 [C5] Push + PR (aguardar Gemini review + aprovação humana — R-060)

---

## Traceability

| FR | Tasks |
|---|---|
| FR-001 WeekCalendar | T030 |
| FR-002 Lista dose_instances | T021, T032 |
| FR-003 KPIs | T031 |
| FR-004 Bottom sheet Editar/Excluir | T033 |
| FR-005 Empty state "Nada por aqui" | T032 |
| FR-006 Entry point Perfil › Ferramentas | T040–T043 |
| FR-007 Invalidação snapshots | T022 |
| SC-001 ≥55fps | T055 |
| SC-002 <200ms sync | T055 |
