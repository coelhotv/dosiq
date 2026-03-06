# Spec de Execução — Evolução UX Meus Remédios

**Data:** 04/03/2026
**Versão:** 1.0
**Visão base:** `plans/UX_VISION_EXPERIENCIA_PACIENTE.md` v0.5
**Modelo:** Opus produz specs → Sonnet/agentes executam código

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Ondas de Execução](#2-ondas-de-execução)
3. [Inventário de Tasks Atômicas](#3-inventário-de-tasks-atômicas)
4. [Specs Atômicas (arquivos separados)](#4-specs-atômicas-arquivos-separados)
5. [Regras para Agentes Executores](#5-regras-para-agentes-executores)
6. [Progresso (TODO List)](#6-progresso-todo-list)
7. [Riscos e Mitigações](#7-riscos-e-mitigações)

---

## 1. Resumo Executivo

### O que estamos construindo
Evolução da UX do Meus Remédios: de navegação por entidade (Remédios, Protocolos, Estoque, Histórico) para navegação por atividade (Hoje, Tratamento, Estoque, Perfil). Inclui componentes visuais novos, zonas temporais deslizantes, progressive disclosure, e reorganização de navegação.

### Números
- **3 ondas** de execução
- **~25 tasks atômicas** (cada uma = 1 PR)
- **0 views novas** (tudo evolui de telas existentes)
- **4 tabs** no BottomNav (de 5 atuais)
- **8 evoluções visuais** (EV-01 a EV-08)

### Decisões fechadas
| Decisão | Valor |
|---------|-------|
| Threshold complexidade | ≤3 meds = simples, 4-6 = moderado, 7+ = complexo |
| Badges de plano | Usuário escolhe emoji+cor. Defaults sugeridos no wizard |
| Janela "atrasadas" | 2h fixo (reavaliar com uso) |
| Executor de código | Sonnet (Claude Code) / Kimi K2.5 / Roo Code |
| Spec producer | Opus |

---

## 2. Ondas de Execução

### Onda 1 — Componentes Visuais (Risco: BAIXO) ✅ CONCLUÍDA

**Objetivo:** Criar componentes visuais isolados que não dependem de mudanças estruturais. Cada componente é independente e testável.

**Pré-requisitos:** Nenhum (não mexe em routing, navigation, ou data flow existente).

**Entrega:** PR #237 mergeado em 05/03/2026. 8/8 tasks, 81 testes, lint 0 erros.

**Quality Gate para Onda 2:**
- [x] Todos os componentes renderizam com dados mock
- [x] Testes passam (`npm run validate:agent`) — 376/376 ✅
- [x] Sem regressão visual no Dashboard atual
- [x] Build produção passa (`npm run build`)

### Onda 2 — Lógica e Hooks (Risco: MÉDIO) ✅ CONCLUÍDA

**Objetivo:** Criar hooks e lógica que processam dados para os componentes da Onda 1 e preparam a estrutura para as zonas deslizantes.

**Pré-requisitos:** Onda 1 concluída (componentes visuais disponíveis).

**Entrega:** PR #240 mergeado em 05/03/2026. 10/10 tasks, 387 testes, lint 0 erros.

**Quality Gate para Onda 3:**
- [x] Hook `useDoseZones()` retorna zonas corretas para diferentes horários
- [x] Hook `useComplexityMode()` retorna modo correto por quantidade de meds
- [x] Toggle hora/plano funciona com dados reais
- [x] Integração com DashboardProvider validada
- [x] Testes unitários cobrem edge cases temporais

### Onda 3 — Navegação (Risco: ALTO)

**Objetivo:** Reestruturar a navegação de 5→4 tabs, criar tab Tratamento (fusão), evoluir Settings→Perfil, criar wizard de cadastro.

**Pré-requisitos:** Ondas 1+2 concluídas. Componentes e hooks prontos.

**Quality Gate final:**
- [ ] Navegação 4 tabs funcional sem dead-ends
- [ ] Todas as views existentes acessíveis pelo novo layout
- [ ] Wizard cadastro substitui window.confirm chain
- [ ] Nenhuma funcionalidade perdida na reorganização
- [ ] Testes E2E passam (se existirem)

---

## 3. Inventário de Tasks Atômicas

### Onda 1 — Componentes Visuais ✅ CONCLUÍDA (PR #237 — 05/03/2026)

| ID | Task | Componente | Prioridade | Deps | Status |
|----|------|-----------|------------|------|--------|
| W1-01 | Ring Gauge de Health Score | `RingGauge.jsx` | P0 | — | ✅ DONE |
| W1-02 | Barras de Estoque com Projeção | `StockBars.jsx` | P0 | — | ✅ DONE |
| W1-03 | Sparkline Interativa (evolução) | `SparklineAdesao.jsx` | P1 | — | ✅ DONE |
| W1-04 | Micro-animações de Dose | `SwipeRegisterItem.jsx` | P1 | — | ✅ DONE |
| W1-05 | Custo Mini-Chart | `CostChart.jsx` | P2 | — | ✅ DONE |
| W1-06 | Pulse em Itens Críticos | `animations.css` | P2 | — | ✅ DONE |
| W1-07 | Prescrições Timeline Visual | `PrescriptionTimeline.jsx` | P2 | F5.9 ✅ | ✅ DONE |
| W1-08 | Calendário Heat Map (evolução) | `Calendar.jsx` | P1 | — | ✅ DONE |

### Onda 2 — Lógica e Hooks ✅ CONCLUÍDA (PR #240 — 05/03/2026)

| ID | Task | Arquivo | Prioridade | Deps | Status |
|----|------|---------|------------|------|--------|
| W2-01 | Hook useDoseZones() | `useDoseZones.js` | P0 | — | ✅ DONE |
| W2-02 | Hook useComplexityMode() | `useComplexityMode.js` | P0 | — | ✅ DONE |
| W2-03 | Componente DoseZoneList | `DoseZoneList.jsx` | P0 | W2-01 | ✅ DONE |
| W2-04 | Toggle Hora/Plano | `ViewModeToggle.jsx` | P1 | W2-01 | ✅ DONE |
| W2-05 | Badge de Plano (emoji+cor) | `PlanBadge.jsx` | P1 | — | ✅ DONE |
| W2-06 | Lote inteligente (hora + plano) | `BatchRegisterButton.jsx` | P1 | W2-04 | ✅ DONE |
| W2-07 | Progressive Disclosure wrapper | `AdaptiveLayout.jsx` | P1 | W2-02 | ✅ DONE |
| W2-08 | Integrar RingGauge no Dashboard | `Dashboard.jsx` | P0 | W1-01, W2-02 | ✅ DONE |
| W2-09 | Integrar StockBars no Dashboard | `Dashboard.jsx` | P1 | W1-02 | ✅ DONE |
| W2-10 | Integrar DoseZoneList no Dashboard | `Dashboard.jsx` | P0 | W2-03, W2-07 | ✅ DONE |

### Onda 3 — Navegação

| ID | Task | Arquivo | Prioridade | Deps | Status |
|----|------|---------|------------|------|--------|
| W3-01 | BottomNav 5→4 tabs | `BottomNav.jsx` + `App.jsx` | P0 | — | ⬜ TODO |
| W3-02 | Tab "Tratamento" (fusão Meds+Prots) | `Treatment.jsx` (view) | P0 | W3-01 | ⬜ TODO |
| W3-03 | Tab "Perfil" (evolução Settings) | `Profile.jsx` (view) | P0 | W3-01 | ⬜ TODO |
| W3-04 | Sub-view "Minha Saúde" | `HealthHistory.jsx` | P1 | W3-03, W1-08, W1-03 | ⬜ TODO |
| W3-05 | Wizard de Cadastro Unificado | `TreatmentWizard.jsx` | P1 | W3-02 | ⬜ TODO |
| W3-06 | Migrar History→Saúde | `HealthHistory.jsx` | P1 | W3-04 | ⬜ TODO |
| W3-07 | Cross-navigation (alertas→telas) | Múltiplos | P2 | W3-01..03 | ⬜ TODO |

---

## 4. Specs Atomicas (arquivos separados)

Cada onda tem suas specs atomicas em arquivo dedicado dentro de `plans/specs/`. O formato padrao de cada spec esta documentado nos proprios arquivos.

| Onda | Arquivo | Tasks | Status |
|------|---------|-------|--------|
| **Onda 1** — Componentes Visuais | [`plans/specs/wave-1-visual-components.md`](specs/wave-1-visual-components.md) | W1-01 a W1-08 | Specs prontas |
| **Onda 2** — Logica e Hooks | [`plans/specs/wave-2-logic-hooks.md`](specs/wave-2-logic-hooks.md) | W2-01 a W2-10 | Specs prontas |
| **Onda 3** — Navegacao | [`plans/specs/wave-3-navigation.md`](specs/wave-3-navigation.md) | W3-01 a W3-07 | Specs prontas |

### Como usar os arquivos de spec

**Para agentes executores:**
1. Ler este master doc para entender contexto, ondas, dependencias e regras
2. Abrir o arquivo de specs da onda sendo executada
3. Localizar a task atomica pelo ID (ex: W1-01)
4. Seguir a spec ao pe da letra — se nao esta na spec, nao implementar

**Para agentes produtores de spec (Opus):**
1. Criar/editar o arquivo de specs da onda correspondente
2. Seguir o formato padrao (documentado no topo de cada arquivo)
3. Atualizar o progresso na secao 6 deste master doc

---

## 5. Regras para Agentes Executores

### Regras obrigatórias (incluir no system prompt do agente)

```
ANTES de começar qualquer task:
1. Ler CLAUDE.md (raiz do projeto)
2. Ler src/CLAUDE.md
3. Confirmar path aliases em vite.config.js
4. Buscar duplicatas: find src -name "*NomeComponente*" -type f

DURANTE a implementação:
5. Hook order: States → Memos → Effects → Handlers
6. Imports: React → Components → Hooks → Services → CSS
7. CSS: usar tokens (--color-*, --space-*, --font-size-*, --transition-*)
8. Framer Motion: respeitar prefers-reduced-motion
9. Accessibility: aria-label, role, tabindex, keyboard nav
10. Zod enums em português

DEPOIS de implementar:
11. Rodar: npm run validate:agent
12. Verificar que testes existentes não quebraram
13. Commit semântico em português: feat(dashboard): implementa ring gauge
```

### Guardrails específicos por onda

**Onda 1:** Componentes recebem dados por props. NUNCA importar DashboardProvider/useDashboardContext diretamente. São componentes puros.

**Onda 2:** Hooks podem usar useDashboardContext. Integração com Dashboard.jsx deve ser feita em edits mínimos (adicionar import + JSX, não reescrever o componente).
- **Princípio 2 da visão (crítico):** O TreatmentAccordion funciona — PRESERVAR. No DoseZoneList modo Plano, o TreatmentAccordion é renderizado DENTRO de cada zona temporal. Não remover accordion do projeto.
- **Toggle hora/plano em modo simple:** `hasTreatmentPlans={treatmentPlans.length > 0 && complexityMode !== 'simple'}` — esconder toggle para pacientes com ≤3 meds.
- **PlanBadge no modo Hora:** cada DoseCard deve mostrar `PlanBadge` (W2-05) ao lado do nome do medicamento quando o protocolo pertence a um plano de tratamento. Contexto clínico sempre visível.

**Onda 3:** Mudanças em App.jsx e BottomNav devem ser feitas em edits atômicos. Testar cada tab individualmente antes de integrar.

---

## 6. Progresso (TODO List)

### Onda 1 — Componentes Visuais ✅ CONCLUÍDA

- [x] **W1-01** Ring Gauge de Health Score — spec ✅ | código ✅ | teste ✅ | review ✅
- [x] **W1-02** Barras de Estoque — spec ✅ | código ✅ | teste ✅ | review ✅
- [x] **W1-03** Sparkline Interativa — spec ✅ | código ✅ | teste ✅ | review ✅
- [x] **W1-04** Micro-animações Dose — spec ✅ | código ✅ | teste ✅ | review ✅
- [x] **W1-05** Custo Mini-Chart — spec ✅ | código ✅ | teste ✅ | review ✅
- [x] **W1-06** Pulse Críticos — spec ✅ | código ✅ | teste N/A | review ✅
- [x] **W1-07** Prescrições Timeline — spec ✅ | código ✅ | teste ✅ | review ✅
- [x] **W1-08** Calendar Heat Map — spec ✅ | código ✅ | teste ✅ | review ✅

### Onda 2 — Lógica e Hooks ✅ CONCLUÍDA

- [x] **W2-01** useDoseZones() — spec ✅ | código ✅ | teste ✅ (21 testes) | review ✅
- [x] **W2-02** useComplexityMode() — spec ✅ | código ✅ | teste ✅ (12 testes) | review ✅
- [x] **W2-03** DoseZoneList — spec ✅ | código ✅ | teste ✅ (10 testes) | review ✅
- [x] **W2-04** ViewModeToggle — spec ✅ | código ✅ | teste ✅ (5 testes) | review ✅
- [x] **W2-05** PlanBadge — spec ✅ | código ✅ | teste ✅ (6 testes) | review ✅
- [x] **W2-06** BatchRegisterButton — spec ✅ | código ✅ | teste ✅ | review ✅
- [x] **W2-07** AdaptiveLayout — spec ✅ | código ✅ | teste ✅ (4 testes) | review ✅
- [x] **W2-08** Integrar RingGauge — spec ✅ | código ✅ | build ✅ | review ✅
- [x] **W2-09** Integrar StockBars — spec ✅ | código ✅ | build ✅ | review ✅
- [x] **W2-10** Integrar DoseZoneList — spec ✅ | código ✅ | build ✅ | review ✅

**Onda 2 concluída em 2026-03-05 — PR #240 mergeado — validate:agent: 387/387 testes | build: ✅**
**Revisão Gemini: 5 HIGH + 3 MEDIUM endereçados (4 ciclos de review)**

Decisões arquiteturais documentadas:
- D-01: Adapters em Dashboard.jsx (handleRegisterFromZone, handleBatchRegisterDoses, handleToggleDoseSelection) — ver R-098
- D-02: selectedMedicines hook em posição irregular (line ~535) — NÃO movido em Wave 2, pendente Wave 3 — ver R-099
- D-03: Múltiplas chamadas useDashboard() aceitas — ver R-100

### Onda 3 — Navegação

- [ ] **W3-01** BottomNav 5→4 — spec ✅ | código ⬜ | teste ⬜ | review ⬜
- [ ] **W3-02** Tab Tratamento — spec ✅ | código ⬜ | teste ⬜ | review ⬜
- [ ] **W3-03** Tab Perfil — spec ✅ | código ⬜ | teste ⬜ | review ⬜
- [ ] **W3-04** Sub-view Minha Saúde — spec ✅ | código ⬜ | teste ⬜ | review ⬜
- [ ] **W3-05** Wizard Cadastro — spec ✅ | código ⬜ | teste ⬜ | review ⬜
- [ ] **W3-06** Migrar History→Saúde — spec ✅ | código ⬜ | teste ⬜ | review ⬜
- [ ] **W3-07** Cross-navigation — spec ✅ | código ⬜ | teste ⬜ | review ⬜

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Dashboard.jsx (932 linhas) difícil de editar | Alta | Médio | Ondas 2 fazem edits mínimos (import + JSX). Não reescrever |
| SVG ring gauge difícil de acertar | Média | Baixo | Spec inclui código SVG exato. Sonnet copia e ajusta |
| Zonas deslizantes com bugs de timezone | Alta | Alto | Todos os cálculos usam parseLocalDate(). Testes com vi.useFakeTimers() |
| Migração 5→4 tabs quebra navegação | Alta | Crítico | Onda 3 faz em steps: primeiro adiciona novas tabs, depois remove velhas |
| Agente inventa props/estado | Média | Médio | Specs definem props exatas. Regra: "se não está na spec, não adicionar" |
| Regressão visual | Média | Alto | Cada Onda termina com validate:agent + build. Dashboard atual intocado até Onda 2 |

---

## Apêndice A — Mapa de Dependências

```
W1-01 RingGauge ──────────────────────┐
W1-02 StockBars ──────────────────────┤
W1-03 Sparkline (edit) ──────────────┤
W1-04 Micro-anims (edit) ────────────┤  Onda 1
W1-05 CostChart ─────────────────────┤  (independentes)
W1-06 Pulse CSS ─────────────────────┤
W1-07 PrescTimeline ─────────────────┤
W1-08 Calendar HeatMap (edit) ───────┘
                                      │
                               ═══════╪═══════ Quality Gate 1
                                      │
W2-01 useDoseZones ──────────────┐    │
W2-02 useComplexityMode ────────┤    │
W2-05 PlanBadge ─────────────────┤   │
                                  │   │
W2-03 DoseZoneList ←── W2-01 ────┤   │
W2-04 ViewModeToggle ←── W2-01 ──┤   │  Onda 2
W2-06 BatchRegister ←── W2-04 ───┤   │
W2-07 AdaptiveLayout ←── W2-02 ──┤   │
                                  │   │
W2-08 Integrar Ring ←── W1-01+W2-02 ┤│
W2-09 Integrar Bars ←── W1-02 ──┤   │
W2-10 Integrar Zones ←── W2-03+07 ──┘
                                      │
                               ═══════╪═══════ Quality Gate 2
                                      │
W3-01 BottomNav 5→4 ─────────────┐   │
W3-02 Tab Tratamento ←── W3-01 ──┤   │
W3-03 Tab Perfil ←── W3-01 ──────┤   │  Onda 3
W3-04 Minha Saúde ←── W3-03 ─────┤   │
W3-05 Wizard ←── W3-02 ──────────┤   │
W3-06 Migrar History ←── W3-04 ──┤   │
W3-07 Cross-nav ←── W3-01..03 ───┘   │
```

## Apêndice B — Componentes Existentes Referenciados

| Componente | Path | Status Onda 1 | Próxima ação |
|-----------|------|---------------|--------------|
| HealthScoreCard | `src/features/dashboard/components/HealthScoreCard.jsx` | — | Substituir por RingGauge (W2-08) |
| SparklineAdesao | `src/features/dashboard/components/SparklineAdesao.jsx` | ✅ Evoluído (W1-03) | Integrar inline no RingGauge (W2-08) |
| SwipeRegisterItem | `src/features/dashboard/components/SwipeRegisterItem.jsx` | ✅ Editado (W1-04) | — |
| StockAlertsWidget | `src/features/dashboard/components/StockAlertsWidget.jsx` | — | Complementar com StockBars (W2-09) |
| Calendar | `src/shared/components/ui/Calendar.jsx` | ✅ Evoluído (W1-08) | Conectar adherenceData real (W2-08) |
| BottomNav | `src/shared/components/ui/BottomNav.jsx` | — | Reestruturar 5→4 tabs (W3-01) |
| Dashboard | `src/views/Dashboard.jsx` | — | Edits mínimos: import + JSX (W2-08,09,10) |
| TreatmentAccordion | `src/features/dashboard/components/TreatmentAccordion.jsx` | — | Integrar com DoseZoneList (W2-10) |
| SmartAlerts | `src/features/dashboard/components/SmartAlerts.jsx` | — | Adicionar pulse-critical (W2-10) |
| InsightCard | `src/features/dashboard/components/InsightCard.jsx` | — | Migrar para Minha Saúde (W3-04) |
| DashboardWidgets | `src/features/dashboard/components/DashboardWidgets.jsx` | — | Avaliar absorção ou manutenção (W2) |
| PrescriptionTimeline | `src/features/stock/components/PrescriptionTimeline.jsx` | ✅ Criado (W1-07) | Exibir na tab Estoque (W3-02) |
| CostChart | `src/features/stock/components/CostChart.jsx` | ✅ Criado (W1-05) | Conectar dados reais de estoque (W2) |
| StockBars | `src/features/dashboard/components/StockBars.jsx` | ✅ Criado (W1-02) | Integrar no Dashboard (W2-09) |
| RingGauge | `src/features/dashboard/components/RingGauge.jsx` | ✅ Criado (W1-01) | Integrar no Dashboard (W2-08) |

---

*Última atualização: 05/03/2026*
*Onda 1 concluída (PR #237). Próximo passo: iniciar execução da Onda 2 — Lógica e Hooks.*
