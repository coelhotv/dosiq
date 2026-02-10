# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

## [2.6.0] - 2026-02-10

### Fase 3.5 - Design Uplift: Glassmorphism e Micro-interações

Esta release introduz um sistema de design visual moderno com glassmorphism hierárquico, gradientes temáticos e micro-interações refinadas, aplicando os conceitos de design em todas as views da aplicação.

### Adicionado

#### Sistema de Design Visual
- **Glassmorphism Hierárquico**: 4 níveis de intensidade (light, standard, heavy, hero) com diferentes opacidades e blur
- **Gradientes Temáticos**: Gradientes para insight (cyan→purple), hero, alert-critical e success
- **Micro-interações**: Scale effects, glow transitions, hover/active states em todos os componentes interativos
- **Tokens CSS Completos**: Sistema de tokens para colors, borders, shadows, spacing e transitions

#### Novos Componentes
- **InsightCard**: Componente com 11 variantes de insight dinâmico
  - streak_motivation - Motivação de sequência
  - stock_alert - Alerta de estoque baixo
  - adherence_drop - Queda de adesão
  - improvement_celebration - Celebração de melhoria
  - weekly_reflection - Reflexão semanal
  - medicine_reminder - Lembrete de medicamento
  - perfect_week - Semana perfeita
  - recovery_encouragement - Incentivo de recuperação
  - consistency_reward - Recompensa de consistência
  - health_tip - Dica de saúde
  - upcoming_milestone - Milestone próximo

#### Novos Hooks
- **useAdherenceTrend**: Hook para cálculo de tendência de adesão
- **useInsights**: Hook para geração dinâmica de insights do usuário

#### Novos Serviços
- **adherenceTrendService**: Serviço para processamento de dados de tendência
- **insightService**: Serviço com 11 variantes de insight

### Modificado

#### Views da Aplicação
- **Medicines View**: Aplicado glassmorphism standard e micro-interações em banners e empty state
- **Protocols View**: Aplicado glassmorphism standard e gradient hero em treatment plans
- **Stock View**: Aplicado glassmorphism standard e text-shadow em títulos de seção
- **History View**: Aplicado glassmorphism standard e glow em stat cards e timeline
- **Settings View**: Aplicado glassmorphism standard e micro-interações em inputs e botões

#### Componentes
- **SmartAlerts**: Aplicado glassmorphism standard, micro-interações e border-left dinâmico
- **HealthScoreCard**: Reduzido para 80px, aplicado SVG glow effects e glassmorphism hero
- **HealthScoreDetails**: Aplicado glassmorphism hero e gradient hero em overview
- **Button**: Aplicado scale effects, glow transitions e focus-visible
- **MedicineCard**: Aplicado glassmorphism standard e hover effects
- **ProtocolCard**: Aplicado glassmorphism standard e glow em badges e time badges
- **StockCard**: Aplicado glassmorphism standard e glow em expiration badges
- **LogEntry**: Aplicado glassmorphism standard e glow em badges

### Corrigido
- **Smart Alerts Snoozing**: Implementado expiração de 4 horas com estrutura Map-based
- **Contraste WCAG AA**: Cores de texto otimizadas para dark mode (4.5:1)

### Documentação
- Atualizado `docs/CSS_ARCHITECTURE.md` para v1.1 com correção de regressões visuais
- Adicionado `docs/past_deliveries/DESIGN_UPLIFT_FASE_3_5.md` com resumo de implementação
- Atualizado `plans/roadmap_2026_meus_remedios.md` com Fase 3.5 marcada como entregue

### Métricas da Release

| Métrica | Valor |
|---------|-------|
| Versão Anterior | 2.5.0 |
| Versão Atual | 2.6.0 |
| Tipo | Minor |
| Arquivos Modificados | 11 |
| Linhas Adicionadas | 454 |
| Linhas Removidas | 161 |
| Build Time | ~5s |
| Lint | 0 erros, 2 warnings não críticos |
| Testes Críticos | 67 passando |

## [2.5.0] - 2026-02-05

### Health Command Center (Onda 2.5)

Esta release introduz o **Health Command Center**, transformando o dashboard em um assistente proativo inteligente com foco em UX mobile-first e engajamento.

### Adicionado

#### Dashboard - Score Engine & Health Score (Task 3.1)
- Novo componente `HealthScoreCard` com visualização circular de progresso (SVG).
- Algoritmo de cálculo de score (0-100) baseado em adesão (60%), pontualidade (20%) e estoque (20%).
- Indicadores de tendência e streaks integrados.
- Processamento totalmente client-side para custo zero e performance instantânea.

#### Dashboard - Swipe to Register (Task 3.2)
- Implementação de gestos laterais (swipe) em itens de medicamento para registro rápido.
- Feedback tátil e visual (haptic feedback) durante o gesto.
- Optimistic UI: atualização instantânea do estado local com rollback automático em caso de falha.
- Redução do tempo de registro de dose para menos de 2 segundos.

#### Dashboard - Smart Alerts (Task 3.3)
- Sistema de alertas inteligentes com priorização dinâmica por severidade.
- Cores de estado semânticas: Neon Pink (crítico), Amber (atenção), Cyan (info).
- Cards contextuais no topo do dashboard para ações imediatas (Tomar Agora, Comprar).

#### Dashboard - Treatment Accordion & Seleção Granular
- Componente `TreatmentAccordion` para agrupamento lógico de medicamentos por protocolo.
- Suporte a ações em lote (Batch Actions) para protocolos complexos.
- Visualização compacta e expandida para otimização de espaço em tela.

### Modificado
- `Dashboard.jsx`: Refatoração completa da hierarquia para suportar o Health Command Center.
- `src/components/dashboard/`: Adicionados novos componentes de UI especializados.
- `src/hooks/useDashboardContext.jsx`: Centralização da lógica de estado do dashboard.

### Documentação
- Adicionado `docs/PRD_HEALTH_COMMAND_CENTER.md`: Especificação completa da visão de produto.
- Adicionado `docs/GUIA_IMPLEMENTACAO_DASHBOARD.md`: Guia técnico para os novos componentes.
- Adicionado `docs/ESPECIFICACAO_TECNICA_DASHBOARD.md`: Detalhes dos algoritmos de score e alertas.

## [2.4.0] - 2026-02-04

### Onda 2 - Fases A e B: Engajamento e Adesão

Esta release foca em aumentar o engajamento do usuário e melhorar a adesão ao tratamento através de notificações ricas, widgets de dashboard e visualização de titulação.

### Adicionado

#### Bot - Confirmação ao Pular Dose (Task 2.5)
- Diálogo de confirmação antes de pular dose no Telegram
- Timeout de 30 segundos para confirmação expirar automaticamente
- Handlers para confirmar, cancelar e timeout
- Integração com state.js para gerenciamento de estado
- Mensagens claras sobre a ação irreversível

#### Bot - Notificações Ricas (Task 2.6)
- Formatação MarkdownV2 para todas as mensagens do bot
- Emojis e layout visual aprimorado em todas as notificações
- Função `escapeMarkdown()` para escapar caracteres especiais do Telegram
- Botões inline melhorados com emojis (✅ Tomar, ⏰ Adiar, ⏭️ Pular)
- Formatadores dedicados:
  - `formatDoseReminderMessage()` - lembretes de dose
  - `formatSoftReminderMessage()` - lembretes suaves (30min depois)
  - `formatStockAlertMessage()` - alertas de estoque
  - `formatTitrationAlertMessage()` - alertas de titulação

#### Dashboard - Score de Adesão e Widget (Task 2.1)
- Componente `AdherenceWidget` com score de adesão calculado
- `AdherenceProgress` para visualização de progresso visual
- `StreakBadge` para exibição de sequências de adesão
- Serviço `adherenceService.js` com algoritmos de cálculo:
  - Taxa de adesão por período (7d, 30d, 90d)
  - Cálculo de streaks (sequências de dias com doses tomadas)
  - Identificação de padrões de adesão
- Integração no Dashboard com período padrão de 30 dias
- Estilos CSS responsivos para o widget

#### Dashboard - Widgets de Engajamento (Task 2.4)
- Componente `DashboardWidgets` container para organização
- `QuickActionsWidget` com ações rápidas frequentes
- `StockAlertsWidget` para alertas de estoque visual
- Layout responsivo em grid para diferentes tamanhos de tela
- Props drill-down para comunicação entre componentes

#### Protocolo - Timeline de Titulação (Task 2.3)
- Componente `TitrationTimeline` com visualização completa de etapas
- `TitrationStep` para renderização individual de cada etapa
- Serviço `titrationService.js` com cálculos:
  - `calculateTitrationSteps()` - calcula todas as etapas com datas
  - `getDaysUntilNextStep()` - dias restantes até próxima etapa
  - `getStepProgress()` - progresso percentual da etapa atual
  - `calculateOverallProgress()` - progresso geral do protocolo
  - `formatDose()` - formatação de doses para exibição
  - `isTitrationActive()` / `hasReachedTarget()` - verificações de estado
- Modo compacto para preview em cards
- Modo expandido para visualização detalhada em modal
- Integração no `ProtocolCard` com botão "📈 Ver Timeline"
- Estilos CSS com indicadores visuais de status (completed, current, future)

### Modificado

- `Dashboard.jsx` - integração de múltiplos widgets de adesão
- `ProtocolCard.jsx` - adicionado suporte a StreakBadge e botão de timeline
- `ProtocolCard.css` - estilos para timeline e badges
- `server/bot/tasks.js` - refatorado para usar notificações ricas
- `server/bot/callbacks/doseActions.js` - adicionada confirmação de skip

### Documentação

- Adicionado `docs/TASK_2.6_BOT_RICH_NOTIFICATIONS.md` - documentação técnica das notificações


## [2.3.0] - 2026-02-03

### Onda 1 - Fundação: Testes, Validação, Cache e Onboarding

Esta release foca em fundamentos técnicos sólidos para suportar o crescimento do aplicativo, incluindo testes automatizados, validação de dados robusta, melhorias de performance e uma experiência de primeiro uso guiada.

### Adicionado

#### Validação Robusta com Zod (Tarefa 1.2)
- Schemas de validação completos para:
  - Medicamentos (`medicineSchema.js`) - 23 testes de validação
  - Protocolos (`protocolSchema.js`) - regras complexas de horários
  - Estoque (`stockSchema.js`) - validação de quantidades e datas
  - Logs (`logSchema.js`) - registro de doses tomadas
- Helper de validação (`validationHelper.js`) com mensagens de erro em português brasileiro
- Integração completa com todos os formulários existentes
- 23 testes unitários cobrindo edge cases e cenários de erro

#### Cache SWR - 95% Melhoria no Dashboard (Tarefa 1.5)
- Sistema de cache em memória com `QueryCache` (`src/lib/queryCache.js`)
- Hook React `useCachedQuery` com stale-while-revalidate
- Deduplicação automática de requests simultâneos
- Serviços cacheados (`cachedServices.js`) para medicines, protocols e logs
- **Resultado**: 95% de melhoria no carregamento do Dashboard (de ~2s para ~100ms)
- Revalidação background após 30 segundos (stale time)
- Prevenção de memory leak com limite de 50 entradas no cache

#### Onboarding Wizard - 4 Passos (Tarefa 1.4)
- Wizard mobile-first com interface intuitiva
- 4 passos guiados:
  1. **WelcomeStep** - Boas-vindas e apresentação do app
  2. **FirstMedicineStep** - Cadastro do primeiro medicamento
  3. **FirstProtocolStep** - Configuração da primeira rotina
  4. **TelegramIntegrationStep** - Integração com bot de lembretes
- Persistência de progresso no localStorage
- Validação em tempo real com Zod
- Componente `OnboardingProvider` para controle de estado
- Estilos dedicados para cada step (CSS modules)

#### Persistência de Sessões do Bot Telegram (Tarefa 1.3)
- `SessionManager` com persistência no Supabase (`server/services/sessionManager.js`)
- TTL configurável de 30 minutos para sessões conversacionais
- Cache local em memória para performance
- Auto-cleanup de sessões expiradas
- Suporte a múltiplos usuários simultâneos
- Testes de persistência simulando restart do servidor

#### View Otimizada de Estoque - 5x Mais Rápida (Tarefa 1.6)
- View SQL `medicine_stock_summary` no banco de dados
- Agregação em tempo real de quantidades por medicamento
- Índices otimizados para queries rápidas
- Políticas RLS integradas para segurança
- **Resultado**: 5x mais rápida que consultas anteriores (de ~500ms para ~100ms)
- Métodos no service: `getStockSummary()` e `getLowStockMedicines()`

#### Suíte de Testes Unitários - 110+ Testes (Tarefa 1.1)
- Setup completo com Vitest + jsdom + Testing Library
- Testes de componentes UI:
  - `Button.test.jsx` - interações e estados
  - `Card.test.jsx` - renderização e props
  - `Modal.test.jsx` - abertura/fechamento
- Testes de hooks:
  - `useCachedQuery` - cache e revalidação
- Testes de serviços:
  - `logService.test.js` - CRUD de logs
  - `stockService.test.js` - manipulação de estoque
- Testes de schemas:
  - `validation.test.js` - 23 casos de validação Zod
- Cobertura total: **~75%** (aumento de +65%)

### Melhorado

- **Performance do Dashboard**: Carregamento em < 100ms com cache ativo
- **Query de Estoque**: Tempo de resposta reduzido em 80%
- **Validação de Formulários**: Validação dupla (cliente + servidor) para segurança
- **Sessões Bot**: Persistência garantida após restart do servidor
- **Experiência de Primeiro Uso**: Onboarding guiado reduz abandono inicial

### Documentação

- `docs/BENCHMARK_CACHE_SWR.md` - Documentação detalhada da implementação SWR
- `docs/BENCHMARK_STOCK_VIEW.md` - Especificações da view otimizada
- `docs/SCHEMAS_VALIDACAO.md` - Guia de uso dos schemas Zod
- `docs/HOOKS.md` - Documentação dos hooks customizados
- `docs/QUICKSTART.md` - Guia rápido incluindo onboarding
- Atualização do README com métricas de performance

### Banco de Dados

#### Novas Tabelas/Views
```sql
-- View otimizada de estoque
medicine_stock_summary

-- Tabela de sessões do bot
bot_sessions (via SessionManager)
```

#### Migrações Necessárias
Execute as migrations na ordem:
1. `.migrations/create_medicine_stock_summary_view.sql`

### Segurança

- Validação de inputs em todos os endpoints
- Sanitização de dados com Zod antes de envio ao Supabase
- Proteção contra injeção via schemas tipados
- RLS policies atualizadas para novas views

### Breaking Changes

Nenhuma. Esta é uma release minor (`2.2.1` → `2.3.0`) com adição de funcionalidades mantendo compatibilidade total.

### Como Atualizar

1. **Aplicar migrações SQL**:
   ```bash
   # Execute no Supabase SQL Editor
   .migrations/create_medicine_stock_summary_view.sql
   ```

2. **Instalar dependências**:
   ```bash
   npm install
   ```

3. **Verificar instalação**:
   ```bash
   npm test
   npm run build
   ```

### Métricas da Release

| Métrica | Valor |
|---------|-------|
| Versão Anterior | 2.2.1 |
| Versão Atual | 2.3.0 |
| Tipo | Minor |
| Testes Adicionados | 110+ |
| Cobertura de Testes | ~75% |
| Melhoria Dashboard | 95% |
| Melhoria Query Estoque | 5x |
| Arquivos Criados | 25+ |
| Documentações | 4 novas |

---

## [2.2.1] - 2026-01-30

### Adicionado
- Autenticação segura via Supabase Auth
- Sistema multi-usuário com RLS
- Integração Telegram 2.0
- Dashboard Premium (Neo-Glass)
- Calendário interativo
- Histórico completo de doses

[2.6.0]: https://github.com/seu-usuario/meus-remedios/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/seu-usuario/meus-remedios/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/seu-usuario/meus-remedios/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/seu-usuario/meus-remedios/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/seu-usuario/meus-remedios/releases/tag/v2.2.1
