# EXEC SPEC — Fase 5: Features Analíticas (Histórico · Aderência · Modo Consulta)

> **Versão**: v1 — 2026-05-23
> **Duração estimada**: 2-3 sprints semanais
> **Branch base (mãe)**: `feat/analytics` (a criar; sai de `main` após Fase 4)
> **Pré-condição**: ✅ Fases 1-3 + Fase 4 (Perfil/Onboarding) entregues
> **Quality Gates**: Aderência (agregação compartilhada) segue G1 → G2 → G3; Histórico (leitura de logs) e Modo Consulta (visualização) = read-heavy (G1-equivalente)
> **SQP vinculante**: v2.0 ([INDEX_EXEC_SPECS.md](INDEX_EXEC_SPECS.md))
> **Referência mestra**: [MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md](MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md) §9 (Fase 5)
> **Mocks aprovados (PO)**: `MOCKS_APP_CRUD/export/fase-5/` + protótipo `Dosiq · Fase 5 - Analíticas.html` (`dosiq-mocks/analytics-screens.jsx` + `analytics-screens-2.jsx`)
> **Handoff designer canônico**: `MOCKS_APP_CRUD/project/dosiq-mocks/HANDOFF_FASE_4_EM_DIANTE.md` §2.5

---

## §0 — Cuidados Aprendidos + Decisões PO

### 0.1 Arquitetura compartilhada (web↔mobile)
- **Aderência é agregação pesada** — fonte canônica web: `apps/web/src/services/api/adherenceService.js` (`calculateAdherence(period)`, `getDailyAdherence(days)`, `getCurrentStreak()`, `getAdherenceSummary(period)`, `calculateProtocolAdherence`). Lógica pura compartilhada já em `@dosiq/core/utils/adherenceLogic.js`. **Verificar com find/grep no C1** o que já é canônico vs web-only.
- **Histórico de doses** = leitura de `medicine_logs` (logs de doses registradas). Web: feature `healthHistory` / navegação histórica diária.
- Mobile dashboard já tem anel + streak (`apps/mobile/src/features/dashboard/.../TodayScreen.jsx` + `_useTodayDerived.js`) — Fase 5 evolui o anel como **entry point** (drill-down), não recria.

### 0.2 Mobile patterns
- R-010 (States→Memos→Effects→Handlers) · R-020 (parseLocalDate) · R-117 (lazy + ViewSkeleton) · R-233 (Modal statusBarTranslucent) · ADR-036 (stack JS).
- **Safe touch ≥44px** obrigatório (regra fixada Fase 5): calendário compacto = coluna inteira (DOM + número + dot) é botão único `minHeight 60px`.
- **Affordance VISUAL, nunca textual** (Nielsen Norman): anel do Dashboard ganha sombra raised + chevron, **sem** texto "ver detalhes/toque aqui".
- **Toda tela tem empty state** — mas Histórico usa estado "Nada por aqui" (ícone + 3 palavras), NÃO empty state global (ver PO-3 abaixo).

### 0.3 Decisões PO absorvidas (HANDOFF §2.5 + esclarecimentos 2026-05-23)

| ID | Decisão | Implicação spec |
|----|---------|-----------------|
| PO-1 | **Entry points = proposta C**. Aderência mora no Dashboard (drill-down do anel "Hoje"); Perfil concentra ferramentas pontuais (Histórico · Modo Consulta) | Anel Dashboard navega → Aderência; Perfil hub lista Ferramentas |
| PO-2 | **Perfil hub ordenado por frequência de uso decrescente**: Notificações → Ferramentas (Histórico, Modo Consulta) → Outros (Privacidade e dados) → Minha Conta → Sair → versão | Reordenar hub da Fase 4 |
| PO-3 | **Empty state global do Histórico DESCARTADO** (conflita com tratamentos não-diários). Em vez disso: estado "Nada por aqui" (ícone + 3 palavras). Calendário marca dias com 3 estados de dot (full/partial/none) | Sem CTA de empty global |
| PO-4 | **Calendário compacto = coluna inteira clicável** (`minHeight 60px`, safe touch >44px) | Padrão de toque |
| PO-5 | **Sheet de dose = 2 ações**: `Editar registro` (ajustar hora E dose tomada) · `Excluir registro` (motivo opcional). "Marcar não tomada" REMOVIDA (DB não tem status 'pendente'; excluir log já reverte) | — |
| PO-6 | **Modo Consulta = só tabs** (densa descartada): 4 tabs `Meds · Aderência · Prescrições+Titulação · Estoque`. Footer fixo `padBottom 88`. Titulação agrupa com Prescrições (prescrita pelo médico) | — |
| PO-7 | **Modo Apresentação** = full-bleed alto contraste sem chrome (faixa teal + aderência "Excelente" 36px + 3 KPIs + prescrições críticas). "Deslize pra ver mais · toque no x pra sair" | — |
| PO-8 | **PDF médico e Exportar dados (LGPD) → FASE 6** (esclarecimento PO 2026-05-23). Fase 5 entrega **apenas a VISUALIZAÇÃO** da ficha (Modo Consulta + Apresentação) + share nativo do sistema. O botão "Gerar PDF" no share sheet fica **desabilitado/placeholder** apontando "em breve (Fase 6)" | Sem geração de PDF nem export LGPD na F5 |
| PO-9 | **Affordance visual, nunca textual** (regra geral) | Sem hints de clique |

> **Divergência consciente vs HANDOFF §2.5**: o handoff colocou "Exportar dados (LGPD)" e o sheet de export dentro da Fase 5 (Privacidade e dados). Por decisão do PO (2026-05-23), **tanto a geração de PDF quanto o export de dados brutos migram para a Fase 6**. A Fase 5 mantém só a *visualização* da ficha médica (Modo Consulta/Apresentação). A linha "Privacidade e dados" no Perfil permanece sem destination até a Fase 6.

---

## Objetivo

Levar o app nativo a expor as **camadas analíticas** que hoje só existem na web:

1. **Histórico de Doses** — navegação histórica diária com calendário compacto + KPIs + lista de doses por dia + sheet de editar/excluir registro.
2. **Aderência expandida** — tela dedicada com períodos 7/30/90d, anel hero, KPIs (doses tomadas, pontualidade), gráfico de evolução, heatmap dia×período, insights acionáveis. Entry point = drill-down do anel do Dashboard.
3. **Modo Consulta / Apresentação** — ficha médica **read-only** para mostrar ao médico: tabs (Meds · Aderência · Prescrições+Titulação · Estoque) + Modo Apresentação full-bleed + share nativo.

**Exclusões v1 (→ Fase 6)**:
- **Geração de PDF médico** (share sheet "Gerar PDF" = placeholder "em breve").
- **Exportar dados brutos (LGPD)** + sub-tela Privacidade e dados funcional.
- Cartão de Emergência, Chatbot.

---

## Contexto Técnico: data layer analítico

| Camada | Fonte canônica | Observação |
|--------|----------------|------------|
| Aderência (agregada) | `apps/web/src/services/api/adherenceService.js` | Candidato a `createAdherenceRepository` (G2) se houver paridade limpa; senão `adherenceService` mobile thin |
| Lógica pura aderência | `@dosiq/core/utils/adherenceLogic.js` | Reusar `calculateDailyIntake`, `calculateDaysRemaining` etc. — NÃO duplicar |
| Histórico de doses | tabela `medicine_logs` (registros de dose) | Leitura por dia/período; editar = update; excluir = delete (reverte ao pendente) |
| Streak / daily | `getCurrentStreak`, `getDailyAdherence(days)` | Já consumidos no dashboard mobile |
| Prescrições / Titulação | `protocols` (+ titration_schedule) | Modo Consulta lê; Titulação agrupa com Prescrições |
| Estoque (Modo Consulta) | `medicine_stock_summary` + `createStockRepository` (Fase 3) | Reuso direto |

> **Schema**: nenhuma tabela nova esperada (leitura de `medicine_logs`/`protocols`/`stock`). Editar registro de dose = update em `medicine_logs` (validar via schema de log existente). **Confirmar no C1** se há trigger de estoque ao editar/excluir log (FIFO restore) — reusar contrato da Fase 3 (`restore_stock_for_log`).

---

## Especificação de Telas

### §0 — Entry Points (proposta C)
Mocks: `mock-dashboard-entrypoint-adesao` · `mock-perfil-entrypoints-historico_modoconsulta`.
- **Dashboard "Hoje"**: anel de adesão ganha affordance VISUAL (sombra raised + chevron-right, sem texto) → navega para **Aderência expandida**.
- **Perfil hub** (reordenado PO-2): seção **Ferramentas** com linhas `Histórico de Doses` → Histórico · `Modo Consulta` → Modo Consulta.

### §1 — Histórico de Doses · `DoseHistoryScreen` (rota `DoseHistory`)
Mocks: `mock-historico-doses` · `mock-historico-semdoses` · `mock-historico-doses-sheet` · `-sheet-apagar`.
- Header `Histórico de Doses` + ícone share.
- **KPIs** (3 cards): `Adesão · 30d` · `Sequência (dias)` · `Doses · mês`.
- **Calendário compacto semanal** navegável (setas + swipe "Deslize entre semanas"). Cada dia = **coluna inteira clicável** (DOM + número + dot, `minHeight 60px`). Dot 3 estados: full (todas tomadas) · partial · none (sem doses programadas). Dia selecionado = pill teal.
- **Lista de doses do dia** (`Sábado, 23 de maio · N doses`): cada item = horário + check verde + nome + DosagePill + tipo/uso + chevron → sheet.
- **Dia sem doses programadas** (mock `-semdoses`): estado "Nada por aqui" minimalíssimo (ícone + 3 palavras), NÃO empty global.
- **Sheet de dose** (`-sheet`): 2 ações — `Editar registro` (ajustar hora E dose tomada; subtitle "Ajustar a hora ou a dose que você efetivamente tomou") · `Excluir registro` (→ sheet confirmação `-apagar`, motivo opcional). Excluir reverte ao pendente (sem status 'pendente' no DB).

### §2 — Aderência Expandida · `AdherenceDetailScreen` (rota `AdherenceDetail`)
Mocks: `mock-adesao-30d` (default) · `mock-adesao-90d`.
- Header `Aderência ao Tratamento` + share.
- **Period segmented** `7d / 30d / 90d` (default 30d).
- **Anel hero 148px** com % + `Últimos Nd` + `meta 90%`. Delta `+X pp vs período anterior` (verde).
- **KPIs**: `Doses tomadas (404/411)` · `Pontualidade (98%)`.
- **Line chart** ~30 pontos (1 ponto = 1 dia; verde escuro = adesão >100%, recuperou dose atrasada). Espelha o gráfico web.
- **Heatmap dia×período** destacando pior horário.
- **Insights acionáveis** (tweak `showInsights` no mock pode esconder).

### §3 — Modo Consulta · `ConsultationModeScreen` (rota `ConsultationMode`)
Mocks: `mock-modoconsulta-meds/aderencia/prescricoes/estoque/sharesheet/telacheia`.
- **4 tabs** (PO-6): `Meds` · `Aderência` · `Prescrições + Titulação` · `Estoque`. Footer fixo `padBottom 88`.
  - Meds: lista de medicamentos em uso (read-only).
  - Aderência: resumo (reusa cálculo do §2).
  - Prescrições + Titulação: tratamentos prescritos + `ConsultationTitrationCard` (titulação agrupa aqui — prescrita pelo médico).
  - Estoque: saldos (reusa `createStockRepository` Fase 3).
- **Share sheet** (`-sharesheet`): 3 opções — `Apresentação` (→ Modo Apresentação) · `Gerar PDF` (**placeholder desabilitado "em breve · Fase 6"** — PO-8) · `Compartilhar (sistema)` (share nativo do payload textual).
- **Modo Apresentação** (`-telacheia`, `ConsultationPresentationScreen`): full-bleed alto contraste sem chrome — faixa teal (nome + idade + data/hora) + anel adesão "Excelente" 36px + 3 KPIs grandes (Sequência · Pontualidade · Em uso) + "ATENÇÃO · N prescrições vencidas" + footer "Deslize para ver mais · Toque no x para sair".

---

## Sprint Breakdown

### Sprint S5.1 — Histórico de Doses — Semana ~14

| # | Task | Path | Agente | Cx |
|---|------|------|--------|----|
| H1 | `doseHistoryService` mobile (read `medicine_logs` por dia/período; editar/excluir registro reusando contrato F3 `restore_stock_for_log`) | `apps/mobile/src/features/history/services/` | 👤 Opus | ⭐⭐⭐ |
| H2 | `useDoseHistory` (calendário semanal navegável + dia selecionado + dots 3 estados) | `apps/mobile/src/features/history/hooks/` | 👤 Opus | ⭐⭐ |
| H3 | `DoseHistoryScreen` + `WeekCalendar` (coluna clicável ≥60px) + KPIs | idem screens/components | 👤 Opus | ⭐⭐⭐ |
| H4 | Sheet dose (Editar registro + Excluir registro c/ confirmação) + `useDoseLogMutation` | idem | 🤖 Sonnet | ⭐⭐ |
| H5 | Estado "Nada por aqui" (dia sem doses programadas) | idem | 🤖 Haiku | ⭐ |
| H6 | Entry point: linha "Histórico de Doses" no Perfil hub (Ferramentas) | `apps/mobile/src/features/profile/` | 🤖 Haiku | ⭐ |
| H7 | Rotas (`DoseHistory`) | `navigation/` | 🤖 Haiku | ⭐ |

### Sprint S5.2 — Aderência expandida (G1/G2/G3) — Semana ~15

| # | Task | Path | Agente | Cx |
|---|------|------|--------|----|
| A1 | Auditar `adherenceService` web + `adherenceLogic` core; decidir G2: `createAdherenceRepository` OU `adherenceService` mobile thin (documentar escolha) | análise | 👤 Opus | ⭐⭐ |
| A2 | Service/factory de aderência (calculate/daily/streak/summary por período) + tests | `packages/core/` ou `apps/mobile/.../adherence/services/` | 👤 Opus | ⭐⭐⭐ |
| A3 | `useAdherenceDetail` (period 7/30/90 + delta vs anterior) | hooks | 🤖 Sonnet | ⭐⭐ |
| A4 | `AdherenceDetailScreen` (anel hero + KPIs + line chart + heatmap + insights) | screens | 👤 Opus | ⭐⭐⭐ |
| A5 | `AdherenceLineChart` + `AdherenceHeatmap` (componentes RN, sem libs pesadas) | components | 🤖 Sonnet | ⭐⭐⭐ |
| A6 | Entry point: anel do Dashboard "Hoje" → drill-down (affordance visual) | `apps/mobile/src/features/dashboard/` | 👤 Opus | ⭐⭐ |
| A7 | **G3** — web adota factory de aderência (se A1 escolheu factory); `validate:agent` green | `apps/web/src/services/api/` | 👤 Opus | ⭐⭐⭐ |
| A8 | Rotas (`AdherenceDetail`) | `navigation/` | 🤖 Haiku | ⭐ |

### Sprint S5.3 — Modo Consulta + Apresentação — Semana ~16

| # | Task | Path | Agente | Cx |
|---|------|------|--------|----|
| C1 | `consultationService` (agrega meds + aderência + prescrições/titulação + estoque — reusa repositories existentes) | `apps/mobile/src/features/consultation/services/` | 👤 Opus | ⭐⭐⭐ |
| C2 | `ConsultationModeScreen` (4 tabs + footer fixo padBottom 88) | screens | 👤 Opus | ⭐⭐⭐ |
| C3 | Tab components (Meds · Aderência · Prescrições+Titulação c/ `ConsultationTitrationCard` · Estoque) | components | 🤖 Sonnet | ⭐⭐⭐ |
| C4 | Share sheet (Apresentação · Gerar PDF **placeholder Fase 6** · sistema) | components | 🤖 Sonnet | ⭐⭐ |
| C5 | `ConsultationPresentationScreen` (full-bleed alto contraste) | screens | 👤 Opus | ⭐⭐ |
| C6 | Entry point: linha "Modo Consulta" no Perfil hub | `apps/mobile/src/features/profile/` | 🤖 Haiku | ⭐ |
| C7 | Rotas (`ConsultationMode`, `ConsultationPresentation`) | `navigation/` | 🤖 Haiku | ⭐ |
| C8 | Smoke E2E iOS + Android API 24 (todos os fluxos) | Manual | 👤 Humano | — |

---

## Quality Gates — Fase 5

### Aderência → G1 / G2 / G3
- **G1**: service de aderência mobile retorna por período (7/30/90); testes; tela funcional no simulador; `validate:agent` web green.
- **G2**: lógica de agregação canônica em `@dosiq/core` (factory ou utils estendido); mobile adota; parity tests.
- **G3**: web adota o canônico (se aplicável); **regressão web 0%**; build + expo export OK.

### Histórico / Modo Consulta → read-heavy (G1-equivalente)
Leitura/visualização sem nova lógica de domínio compartilhável (consomem repositories já extraídos: stock, protocol, adherence). Entrega em PR único por sprint, com smoke iOS+Android + `validate:agent` web green. Editar/excluir registro de dose reusa contrato F3 (`restore_stock_for_log`) — **não** cria RPC nova.

---

## Brief padrão cavecrew (R-230)
Refs read-only absolutas (esta spec + mock + arquivo análogo) · path absoluto · contrato exato · regras críticas (R-010, R-020, R-233, ADR-036, safe-touch ≥44px, affordance visual) · output + integração · sem commits.

---

## PR Strategy

| Sprint | PR contra | Reviewer humano | Reviewer LLM |
|--------|-----------|-----------------|--------------|
| S5.1 Histórico | `feat/analytics` | PO smoke iOS+Android | Gemini |
| S5.2 Aderência | `feat/analytics` | PO smoke (+G3 web) | Gemini |
| S5.3 Modo Consulta | `feat/analytics` | PO smoke | Gemini |
| PR-mãe | `main` | PO fluxo completo | Gemini |

R-060/R-065: PO faz merge na main.

---

## Critérios para encerramento da Fase 5
- [ ] G1/G2/G3 da aderência aprovados (humano)
- [ ] Histórico + Modo Consulta smoke OK (iOS + Android API 24)
- [ ] Calendário compacto = coluna clicável ≥60px (verificado)
- [ ] Sheet dose = Editar + Excluir (sem "marcar não tomada")
- [ ] Share sheet: "Gerar PDF" = placeholder "em breve · Fase 6" (sem geração real)
- [ ] `validate:agent` web 100% green pós-G3
- [ ] PR-mãe mergeado em main
- [ ] DEVFLOW C5 + journal; MASTER §12 atualizado se houver factory de aderência
- [ ] MASTER_PLAN + INDEX atualizados (cross-ref)
- [ ] `/devflow distill` pós-fase

---

## Evolução / Fase 6 (o que sai daqui)
- **Gerar PDF médico** (share sheet) — real em Fase 6.
- **Exportar dados brutos (LGPD)** + sub-tela Privacidade e dados funcional + sheet de export (Formato JSON/CSV · Período · 4 checkboxes) — Fase 6.
- Cartão de Emergência · Chatbot — Fase 6 (fecha paridade).
- Spikes mobile-only (camera/HealthKit/widgets) — Fase 7.

---

## Changelog
- **v1 — 2026-05-23**: Spec criada. Escopo: Histórico de Doses + Aderência expandida + Modo Consulta/Apresentação (visualização). Fundamentada no HANDOFF §2.5 + mocks `export/fase-5/`. **Divergência vs handoff**: PDF médico e Export LGPD movidos para Fase 6 (decisão PO 2026-05-23) — Fase 5 entrega só visualização da ficha.

---

## Cross-References
- ⬆️ [MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md](MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md) §9 Fase 5
- ⬅️ Fase anterior: [EXEC_SPEC_FASE4_PERFIL.md](EXEC_SPEC_FASE4_PERFIL.md)
- ➡️ Próxima fase: Fase 6 (Avançadas — Emergência, Chatbot, PDF, Export LGPD; **fecha a paridade web↔app**) — spec a criar. Mobile-only (camera/HealthKit/widgets) = Fase 7
- 📐 SQP v2.0: [INDEX_EXEC_SPECS.md](INDEX_EXEC_SPECS.md)
- 🎨 Mocks: `MOCKS_APP_CRUD/export/fase-5/` · Handoff `dosiq-mocks/HANDOFF_FASE_4_EM_DIANTE.md` §2.5
