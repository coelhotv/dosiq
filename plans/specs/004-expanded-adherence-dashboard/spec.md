# Feature Specification: Dashboard de Aderência Expandida (Mobile)

**Feature Directory**: `plans/specs/004-expanded-adherence-dashboard`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: draft — não entregue como spec'ado (PO 2026-06-10)
**Tier**: 1 (UI mobile; reusa lógica de adesão de `@dosiq/core`)
**Artifacts**: `spec.md` + `plan.md` + `tasks.md`
**Legacy Sources**:
- `PHASE_5_6_PARITY_AND_BEYOND.md` §M1.2 (consolidação unificada)
- `plans/backlog-native_app/EXEC_SPEC_FASE5_ANALITICAS.md` §2 (**fonte original CRUD + decisões PO + mocks**)
**Mocks (PO-aprovados)**: `plans/backlog-native_app/MOCKS_APP_CRUD/export/fase-5/` — `mock-adesao-30d.png` (default), `mock-adesao-90d.png`, `mock-dashboard-entrypoint-adesao.png`; código: `dosiq-mocks/analytics-screens.jsx`.

> **Recuperado da fonte CRUD:** entry-point por drill-down do anel do Dashboard (PO-1), anel hero/KPIs/line-chart/heatmap/insights detalhados, e o **gate de paridade web G2/G3** (decisão `createAdherenceRepository` + regressão web 0%) — todos perdidos na consolidação.

---

## Context

Expandir o indicador básico de adesão no **mobile** com Ring Gauge, Sparkline e Heatmap temporal, filtros 7/30/90 dias, computação client-side sobre cache local. Empodera paciente crônico e família a ver tendência e padrões de esquecimento.

> **Reality-check (revisão 2026-06-02):**
> - **A lógica de adesão JÁ existe em `@dosiq/core`**: `packages/core/src/utils/adherenceLogic.js` (+ `adherenceFromInstances`, testes de paridade). **NÃO criar `packages/core/src/services/adherenceCalculator.js`** — reusar `adherenceLogic.js` (DRY/R-231). O mobile já consome `@dosiq/core` no `dashboardService.js`.
> - **Esta feature vive em `apps/mobile/src/features/dashboard`** (onde estão `dashboardService.js`, `_useTodayDerived.js`, `useTodayData.js`), **não** num novo `features/adherence` (que não existe). Evita fragmentar a superfície de dashboard.
> - **Datas via `@dosiq/core`** (`parseLocalDate`), não `@utils/dateUtils`.
> - Adesão lida de `dose_instances` (status `taken`/`missed`; expurga `skipped_*`/`pending`) — R-111..114.

---

## User Scenarios & Testing

### User Story 1 — Acompanhamento por Período (P1)
**Why**: ver tendência em 7/30/90 dias.
**Independent Test**: alternar filtros; Ring Gauge + Sparkline atualizam sobre cache local (zero network).

**Acceptance Scenarios**:
1. Given a aba de saúde aberta, When toca "Últimos 30 dias", Then o Ring Gauge recalcula a taxa exata das doses programadas no período (via `adherenceLogic` core).

### User Story 2 — Padrões de Esquecimento (P2)
**Why**: ajuste clínico de horários.
**Independent Test**: Heatmap exibe adesão por período do dia × dia da semana.

**Acceptance Scenarios**:
1. Given esquecimento recorrente da dose da noite aos sábados, When vê o Heatmap, Then "Sábado × Noite" aparece em cor de baixa adesão vs. verde dos períodos perfeitos.

---

## Edge Cases

- **Timezone (multi-tz)**: agrupamento diário via `parseLocalDate`; sem vazamento p/ dia adjacente.
- **Cold start (sem histórico)**: gráficos não quebram/NaN; estado vazio guiado ("Sem dados suficientes para este período").

---

## UX & Decisões PO (recuperado da fonte CRUD)

- **PO-1 — Entry point = drill-down do anel do Dashboard "Hoje".** O anel de adesão ganha **affordance VISUAL** (sombra raised + chevron-right, **sem** texto "ver detalhes") → navega p/ esta tela. Não recria o anel — evolui o existente como entry point. Mock `mock-dashboard-entrypoint-adesao.png`.
- **Anel hero 148px** com % + `Últimos Nd` + `meta 90%` + delta `+X pp vs período anterior` (verde).
- **Period segmented** `7d / 30d / 90d` (default **30d**). Mocks `mock-adesao-30d.png`/`-90d.png`.
- **KPIs:** `Doses tomadas (ex.: 404/411)` · `Pontualidade (ex.: 98%)`.
- **Line chart** ~30 pontos (1 ponto = 1 dia; verde-escuro = adesão >100% = recuperou dose atrasada) — espelha o gráfico web.
- **Heatmap dia×período** destacando o pior horário.
- **Insights acionáveis** (lista; mock pode esconder via flag).

---

## Requirements

### Functional Requirements

- **FR-001**: Entry point — anel do Dashboard "Hoje" com affordance visual (sombra + chevron, sem texto) navega p/ esta tela (PO-1).
- **FR-002**: Period segmented `7d/30d/90d` (default 30d).
- **FR-003**: **Anel hero 148px** — adesão agregada do período (cor dinâmica) + `meta 90%` + delta `±X pp vs período anterior`, via `adherenceLogic` core.
- **FR-004**: **KPIs** — Doses tomadas (N/total) · Pontualidade (%).
- **FR-005**: **Line Chart** ~30 pts (1 dia/ponto; verde-escuro >100%), leve (sem libs SVG pesadas).
- **FR-006**: **Heatmap Temporal** — matriz período × dia da semana (destaca pior horário).
- **FR-007**: **Insights acionáveis**.
- **FR-008**: Computação **client-side** reusando `@dosiq/core/utils/adherenceLogic.js` sobre cache local (R-111..114); invalidação após mutação de dose (integra 003).
- **FR-009**: **Gate de paridade web (G2/G3):** auditar `adherenceService` web + `adherenceLogic` core; decidir agregação canônica (`createAdherenceRepository` OU manter `adherenceLogic` estendido) e, se factory, web adota com **regressão 0%** (`validate:agent` green). Documentar a escolha.

### Key Entities

- **dose_instances** (leitura via `createDoseInstanceRepository`).
- **adherenceLogic** (`@dosiq/core`): fonte única de cálculo (reuso).
- **AdherenceSnapshot**: cache AsyncStorage local.

---

## Success Criteria

- **SC-001**: Render < 150ms com dados em cache (zero network).
- **SC-002**: Zero chamada redundante ao Supabase p/ cálculo de adesão.
- **SC-003**: Zero duplicação de lógica — cálculo só em `@dosiq/core`.
