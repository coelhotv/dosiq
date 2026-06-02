# Implementation Plan: Dashboard de Aderência Expandida (Mobile)

**Feature Directory**: `plans/specs/004-expanded-adherence-dashboard`
**Spec**: `spec.md` · **Revised**: 2026-06-02 · **Tier**: 1

---

## Technical Context

UI analítica client-side no **mobile**, reusando `@dosiq/core/utils/adherenceLogic.js` (cálculo) + `createDoseInstanceRepository` (leitura) + cache AsyncStorage. Vive em `features/dashboard` (não novo dir).

**Paths reais verificados:**
- Cálculo: `packages/core/src/utils/adherenceLogic.js` (+ `adherenceFromInstances`, paridade testada). ✅ **Reusar — não criar `adherenceCalculator.js`.**
- Mobile dashboard: `apps/mobile/src/features/dashboard/{services/dashboardService.js, hooks/_useTodayDerived.js, hooks/useTodayData.js}` — já importam `@dosiq/core`. ✅
- Datas: `@dosiq/core`. ✅

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| dry-principles | ✅ | Cálculo só em `adherenceLogic.js`; UI consome. |
| Mobile-First | ✅ | Views leves (sem SVG pesado); ≥55fps. |
| Timezone (multi-tz) | ✅ | `parseLocalDate` core. |
| R-111..114 | ✅ | Client-side, zero network em cache, streak por `dose_instances.status`, invalidação pós-mutação. |
| R-221 SQP | ✅ | Minor mobile. |

---

## Target Files

| Path | Purpose | Evidence |
|------|---------|----------|
| `apps/mobile/src/features/dashboard/components/AdherenceRingHero.jsx` | anel hero 148px + meta 90% + delta pp (`mock-adesao-30d.png`). | [NEW] |
| `apps/mobile/src/features/dashboard/components/AdherenceLineChart.jsx` | ~30 pts (verde-escuro >100%). | [NEW] |
| `apps/mobile/src/features/dashboard/components/AdherenceHeatmap.jsx` | matriz período×dia (pior horário). | [NEW] |
| `apps/mobile/src/features/dashboard/components/AdherenceKpis.jsx` | Doses tomadas + Pontualidade. | [NEW] |
| `apps/mobile/src/features/dashboard/screens/AdherenceDashboardScreen.jsx` | segmented 7/30/90 (def 30d) + insights + cache SWR. | [NEW] |
| `apps/mobile/src/features/dashboard/...` (anel "Hoje") | entry point drill-down: affordance visual (sombra+chevron) → AdherenceDashboard (PO-1, `mock-dashboard-entrypoint-adesao.png`). | [MOD] |
| `apps/mobile/src/features/dashboard/services/dashboardService.js` | + agregações de período consumindo `adherenceLogic`. | [MOD] |
| `packages/core/src/utils/adherenceLogic.js` | reuso; estender só se faltar agregação bloco/dia-da-semana. **Gate G2/G3**: decidir factory vs utils + paridade web. | verificado |

> **Removido** o alvo `packages/core/src/services/adherenceCalculator.js` (duplicaria `adherenceLogic.js`).

---

## Architectural Approach

### 1. Reuso do cálculo (R-111..114)
- Leitura de `dose_instances` (cache `@dosiq/adherence-snapshot` / repo core), zero network se já em cache.
- Agregações (taxa por período, série semanal, matriz bloco×dia) computadas a partir de `adherenceLogic` — se faltar uma agregação específica (heatmap bloco×dia-da-semana), **adicionar função pura em `adherenceLogic.js`**, não em arquivo paralelo.
- Streak/adesão sobre `status ∈ {taken,missed}`, expurgando `skipped_*`/`pending`.
- Invalidação de `@dosiq/adherence-snapshot` após mutação de dose (integra com a 003).

### 2. UI leve
RingGauge/Sparkline/Heatmap em `View`/`react-native-svg` mínimo; sem libs de chart pesadas (FPS).

## SQP (R-221)
Mobile (+ possível função pura em core). Minor. Bump `app.config.js` + CHANGELOG.

## Risks
- **Duplicação de cálculo**: proibido `adherenceCalculator.js` — usar/estender `adherenceLogic.js`.
- **Agregação heatmap**: confirmar se `adherenceLogic` já expõe bloco×dia; senão, função pura nova no core (testada por paridade).
- **Sobreposição com `dashboardService`**: estender o existente, não criar serviço paralelo.
