# Feature Specification: Expanded Adherence Dashboard

**Feature Directory**: `plans/specs/004-expanded-adherence-dashboard`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §M1.2

---

## Context

Para empoderar o paciente crônico e seus familiares, o indicador básico de adesão deve ser expandido. Esta feature traz ferramentas analíticas clínicas para o celular, exibindo a evolução temporal e permitindo detecção de padrões de esquecimento sem sobrecarregar o servidor ou degradar a performance mobile.

---

## User Scenarios & Testing

### User Story 1 - Acompanhamento Dinâmico por Período (Priority: P1)
**Why this priority**: Permite ao paciente e cuidador ver a tendência de adesão em intervalos clínicos significativos (7, 30 e 90 dias).
**Independent Test**: Alternar os filtros de tempo na UI do painel e verificar se o Ring Gauge e o Sparkline atualizam imediatamente sobre os dados em cache local.

**Acceptance Scenarios**:
1. Given que Dona Maria abriu a aba "Minha Saúde", When ela tocar no filtro de "Últimos 30 dias", Then o anel colorido de adesão agregada (Ring Gauge) deve recalculado para mostrar a taxa exata das doses programadas nesse período.

### User Story 2 - Identificação de Padrões de Esquecimento (Priority: P2)
**Why this priority**: Fundamental para ajuste clínico de dosagens e horários pelo médico.
**Independent Test**: Verificar se a matriz (Heatmap) exibe corretamente os índices de adesão agregados por período do dia (Manhã, Tarde, Noite, Madrugada) contra os dias da semana.

**Acceptance Scenarios**:
1. Given que Dona Maria costuma esquecer seu remédio da noite aos sábados, When ela visualizar a matriz de Heatmap temporal, Then a intersecção "Sábado x Noite" deve apresentar uma cor de baixa adesão (ex: vermelho/laranja claro) em contraste com o verde dos períodos com adesão perfeita.

---

## Edge Cases

- **Timezone Boundary (GMT-3):** A computação de streaks e adesão diária de doses na divisa de fusos deve usar `parseLocalDate()` para evitar vazamento estatístico para o dia seguinte ou anterior.
- **Falta de dados históricos (Cold Start):** Se o paciente começou o tratamento hoje, a UI de gráficos e sparklines não deve quebrar ou exibir NaN, mas sim mostrar placeholders elegantes ou estado vazio guiado ("Sem dados suficientes para este período").

---

## Requirements

### Functional Requirements

- **FR-001:** Exibir filtro rápido no topo do dashboard com as opções de 7, 30 e 90 dias.
- **FR-002:** Componente visual **Ring Gauge Hero**: anel dinâmico colorido de progresso indicando o percentual de adesão agregada no período filtrado.
- **FR-003:** Componente visual **Sparkline/Line Chart**: gráfico linear minimalista de alta performance indicando a curva semanal de adesão.
- **FR-004:** Componente visual **Heatmap Temporal**: matriz simplificada de blocos (períodos x dias da semana) indicando taxa de cumprimento de doses.
- **FR-005:** Toda computação analítica deve ser executada no lado do cliente (client-side) utilizando as regras R-111 a R-114 sobre o cache de dados local.

### Key Entities

- **DoseInstance:** Leitura direta de `dose_instances` para consolidação do status.
- **AdherenceSnapshot:** Cache AsyncStorage local de estatísticas calculadas.

---

## Success Criteria

- **SC-001:** Renderização instantânea do dashboard (< 150ms) ao carregar a tela quando os dados de `dose_instances` já estiverem em cache (Zero network).
- **SC-002:** Ausência total de chamadas redundantes de rede no Supabase para cálculo estatístico de adesão.
