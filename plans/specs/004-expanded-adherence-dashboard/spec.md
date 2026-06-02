# Feature Specification: Dashboard de Aderência Expandida (Mobile)

**Feature Directory**: `plans/specs/004-expanded-adherence-dashboard`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Tier**: 1 (UI mobile; reusa lógica de adesão de `@dosiq/core`)
**Artifacts**: `spec.md` + `plan.md` + `tasks.md`
**Legacy Source**: `PHASE_5_6_PARITY_AND_BEYOND.md` §M1.2

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

## Requirements

### Functional Requirements

- **FR-001**: Filtro rápido 7/30/90 dias no topo do dashboard.
- **FR-002**: **Ring Gauge Hero** — anel de adesão agregada do período (cor dinâmica), via `adherenceLogic` core.
- **FR-003**: **Sparkline/Line Chart** — curva semanal de adesão, leve (sem libs SVG pesadas).
- **FR-004**: **Heatmap Temporal** — matriz período × dia da semana.
- **FR-005**: Computação **client-side** reusando `@dosiq/core/utils/adherenceLogic.js` sobre cache local (R-111..114); invalidação após mutação de dose (integra com 003).

### Key Entities

- **dose_instances** (leitura via `createDoseInstanceRepository`).
- **adherenceLogic** (`@dosiq/core`): fonte única de cálculo (reuso).
- **AdherenceSnapshot**: cache AsyncStorage local.

---

## Success Criteria

- **SC-001**: Render < 150ms com dados em cache (zero network).
- **SC-002**: Zero chamada redundante ao Supabase p/ cálculo de adesão.
- **SC-003**: Zero duplicação de lógica — cálculo só em `@dosiq/core`.
