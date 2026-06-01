# Implementation Plan: Expanded Adherence Dashboard

**Feature Directory**: `plans/specs/004-expanded-adherence-dashboard`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/004-expanded-adherence-dashboard/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §M1.2

---

## Technical Context

Esta feature é implementada inteiramente no lado do cliente (client-side) para evitar custos e limites de infraestrutura do Supabase. O módulo de cálculos de adesão consome o repositório local e cacheia os snapshots analíticos no AsyncStorage.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Leitura restrita local e cálculos independentes. |
| **II. Mobile-First Reliability** | ✅ PASS | Utiliza gráficos e matrizes construídas com views de baixo peso, evitando libs SVG pesadas que degradam a taxa de quadros (FPS). |
| **IV. Timezone Correctness** | ✅ PASS | Todo agrupamento por dia e fuso GMT-3 utiliza `parseLocalDate()` da biblioteca do core. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/features/adherence/components/RingGauge.jsx` | Componente de anel de progresso circular dinâmico. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/mobile/src/features/adherence/components/AdherenceSparkline.jsx` | Gráfico de linha leve da evolução da adesão. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/mobile/src/features/adherence/components/TemporalHeatmap.jsx` | Matriz de calor (Períodos x Dias) em blocos coloridos. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/mobile/src/features/adherence/screens/AdherenceDashboardScreen.jsx` | Tela agregadora com filtros de 7/30/90 dias e cache local SWR. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `packages/core/src/services/adherenceCalculator.js` | Funções de cálculo de adesão e streaks portadas/unificadas do PWA para o core. | `@dosiq/core` optimization |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> Devido ao uso de dependências estruturais do monorepo, todos os testes locais da tela analítica no simulador/dispositivo devem ocorrer via Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Agregação Baseada em Cache Local (R-111 a R-114)
* **Zero Network (R-111):** Os dados de `dose_instances` no fuso local já mapeados são lidos do repositório core em memória ou carregados do AsyncStorage snapshot. Se os dados já existem, nenhum request HTTP é feito ao carregar ou filtrar períodos no Dashboard.
* **Cálculos de Aderência (R-113):** O cálculo da taxa de adesão e sequências (streaks) baseia-se exclusivamente no array de objetos `dose_instances` com status literal `taken` e `missed`, expurgando instâncias pausadas ou ignoradas.
* **Sincronização reativa (R-114):** Após qualquer mutação efetuada em dose (ex: check-in retroativo em `003`), o hook invalidate deve disparar a limpeza de `@dosiq/adherence-snapshot` para reprocessamento na abertura da tela.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile** e **Shared/Core** (`packages/core`).
* **SemVer Impact:** Classificado como **minor** (painel estatístico analítico completo no mobile).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
* **Changelog:** Adicionar uma entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada do dashboard de aderência completo (Ring Gauge, Sparklines e Heatmap).
* **Quality Commands:**
  * Executar `rtk lint` no core e no mobile.
  * Executar `rtk npm run validate:agent` e garantir sucesso total antes do commit final.
