# Tasks: Expanded Adherence Dashboard

**Feature Directory**: `plans/specs/004-expanded-adherence-dashboard`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/004-expanded-adherence-dashboard/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/004-expanded-adherence-dashboard/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Verificar se a engine de histórico do `003` já está em conformidade e se o AsyncStorage possui o snapshot de `dose_instances`.
- [ ] **T002** [C1] Configurar os aliases de importação do core no mobile para `adherenceCalculator`.

## Phase 2: Implementation

### Shared / Core Services
- [ ] **T003** [US1] Portar a lógica analítica de cálculo de taxa de adesão por período (7/30/90 dias) e streaks em `packages/core/src/services/adherenceCalculator.js` utilizando `parseLocalDate` de forma rigorosa (GMT-3).
- [ ] **T004** [US2] Implementar algoritmo de agrupamento matricial para a geração do Heatmap Temporal (periodo do dia x dia da semana).

### Mobile Components
- [ ] **T005** [US1] Desenhar o componente circular de progresso `RingGauge.jsx` usando elementos visuais fluidos nativos.
- [ ] **T006** [US1] Desenhar o componente de linha minimalista `AdherenceSparkline.jsx` para a curva semanal de adesão.
- [ ] **T007** [US2] Desenhar o grid matricial colorido `TemporalHeatmap.jsx` exibindo as faixas de adesão agregadas.
- [ ] **T008** [US1] Construir a tela agregadora `AdherenceDashboardScreen.jsx` com os filtros temporais (7/30/90 dias) e integrar a invalidação reativa de cache.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T009** [C4] Executar `rtk lint` e garantir zero infrações no core e mobile.
- [ ] **T010** [C4] Criar testes unitários para a engine `adherenceCalculator.js` validando limites de dia (timezone local) e streaks.
- [ ] **T011** [C4] Executar `rtk npm run validate:agent` e garantir sucesso de regressões.
- [ ] **T012** [C4] **Verificação de DoD Independente:** Confirmar que ao alterar dinamicamente o filtro de dias (7 para 90 dias) na UI do simulador, a taxa de Ring Gauge atualiza de imediato em < 150ms sem solicitações HTTP para o Supabase.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T013** [C5] Incrementar a versão em `apps/mobile/app.config.js`.
- [ ] **T014** [C5] Adicionar entrada no topo do arquivo `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T015** [C5] Gravar a evidência SQP nos registros finais.
- [ ] **T016** [C5] Concluir o journal DEVFLOW e marcar no status.
