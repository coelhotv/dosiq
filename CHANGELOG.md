# Changelog - Meus Remédios

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adhere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [4.0.0] — 2026-04-09 — Santuário Terapêutico Complete ✨

### 🎨 **Major: Design System Overhaul**
- Santuário Terapêutico design (Waves 0-16) agora padrão em 100% das telas
- Nova paleta: Health Green (#006a5e) + Clinical Blue (#005db6)
- Tipografia moderna: Public Sans (display) + Lexend (body)
- Border radius: mínimo 0.75rem (healthcare-appropriate aesthetics)
- Shadow system: ambient (Material Design 3) em lugar de glows

### ♿ **Major: WCAG 2.1 AA Accessibility**
- Font weights ≥400 only (elderly users, geriatric compliance)
- Todos os ícones pareados com text labels
- Motion preferences respeitadas via `useReducedMotion()`
- Color contrast ratios verificados (4.5:1 minimum)
- Touch targets ≥44px, keyboard navigation completa

### 📱 **Major: Mobile Performance**
- Bundle: 989kB → 102.47kB gzip (89% reduction)
- Lazy loading em 13+ views com ViewSkeleton pattern
- Dashboard queries: 13+ → 1 (promise coalescence cache)
- Mobile FCP: ~500ms mais rápido
- Vite manualChunks: 8 vendor/feature chunks

### 🤖 **New: AI Chatbot Multi-Canal**
- Groq API com prompt caching
- Web + Telegram unified assistant
- Context-aware recomendações
- Safety guard + hallucination mitigations
- Active ingredient grounding (temperature 0.2)

### 🎛️ **New: Navigation Redesign**
- BottomNav (mobile) + Sidebar (desktop)
- Framer Motion page transitions (6 motion archetypes)
- Responsive layout with CSS Grid
- Keyboard-friendly navigation

### 📊 **Improvements: Dashboard & Insights**
- Adherence widgets redesigned
- Smart alerts (adherence, stock, protocols)
- Cost analysis view
- Health history com calendar navigation
- Ring gauge + sparkline visualizations

### 🏥 **Improvements: Clinical Features**
- Consultation mode (read-only medicines)
- Clinical PDF reports via jsPDF
- ANVISA drug database (819KB feature chunk)
- Therapeutic class field

### ✅ **Improvements: Protocol Management**
- Enhanced treatment wizard
- Titration schedule support
- Protocol reminders via Telegram bot
- Duration validation (start/end dates)

### 📦 **Improvements: Stock & Inventory**
- Four-tier system (CRITICAL/LOW/NORMAL/HIGH)
- FIFO inventory management
- Expiration tracking
- Cost analytics

### 🔧 **Technical: Architecture**
- Feature-based organization (src/features/)
- Zod validation everywhere
- Supabase RLS enforcement
- Telegram bot com message deduplication
- QueryCache + SWR adherence

### 🚀 **Infrastructure**
- 6/12 serverless functions: DLQ, Gemini, health, notify, share, telegram
- GitHub Actions + Gemini Code Assist review
- Vercel Hobby deployment (grátis)

### 🗑️ **Breaking Changes**
- Feature flag infrastructure removed (`RedesignContext`, `useRedesign`)
- Neon colors removed (`--neon-*` tokens)
- Legacy views deleted (Dashboard, Stock, HealthHistory, etc.)
- BottomNav replaced with BottomNavRedesign
- Old theme tokens (tokens.redesign.css) consolidated to sanctuary.css

### 📚 **Documentation**
- Complete redesign system docs
- Mobile performance standards
- Bot architecture guide
- Chatbot AI integration guide
- Release migration guide (v3.x → v4.0.0)

### 📊 **Metrics**
- Lighthouse Performance: ≥90
- Lighthouse Accessibility: ≥95
- Test coverage: 32 test files, 543+ tests
- Bundle size: 102.47kB gzip (main)

---

## [3.0.0] - 2026-02-18

### Protocol Start/End Dates for Accurate Adherence

#### ✨ Novas Funcionalidades
- **Campos `start_date` e `end_date` em protocolos**: Nova coluna para definir período de vigência
  - Cálculo de adesão agora considera apenas dias a partir da data de início
  - Corrige problema onde protocolos novos exibiam score artificialmente baixo
  - Usuários podem definir duração do protocolo ou deixar em aberto
- **Módulo `dateUtils.js`**: Funções compartilhadas para manipulação de datas
  - `parseLocalDate()` - Converte string para data em timezone local
  - `formatLocalDate()` - Formata data para string YYYY-MM-DD
  - `isProtocolActiveOnDate()` - Verifica se protocolo está ativo em uma data

#### 🔄 Mudanças
- **Cálculo de Adesão**: Refatorado para respeitar limites de data do protocolo
  - `effectiveDays` agora considera apenas dias entre `start_date` e data atual
  - Protocolos com `end_date` definido não são considerados após término
- **Manipulação de Datas**: Padronizada para timezone local (GMT-3 para Brasil)
  - Todas as comparações de data usam `new Date(dateStr + 'T00:00:00')`
  - Eliminada inconsistência entre UTC e timezone local

#### 🐛 Correções
- **Inconsistência de timezone em validação de datas**: `protocolSchema.js` agora usa timezone local
- **Bug de cálculo de effectiveDays**: Removido dia extra que era adicionado incorretamente
- **Duplicação de código**: Função `isProtocolActiveOnDate` centralizada em `dateUtils.js`

#### 📦 Commits Incluídos
- Criação de módulo `dateUtils.js` com funções compartilhadas
- Atualização de `adherenceService.js` para usar novas funções
- Atualização de `adherenceLogic.js` para re-exportar funções
- Correção de timezone em `protocolSchema.js` (3 arquivos)
- Migração SQL para adicionar colunas `start_date` e `end_date`

#### 📊 Estatísticas
- **3 arquivos novos**: `dateUtils.js`, migração SQL
- **5 arquivos modificados**: adherenceService, adherenceLogic, protocolSchema (x3)
- **166 testes passando**: Sem regressões

---

## [2.9.0] - 2026-02-17

### Telegram MarkdownV2 Escape System

#### ✨ Novas Funcionalidades
- **Função `escapeMarkdownV2()`**: Escape de 18 caracteres reservados do Telegram MarkdownV2
  - Caracteres: `_ * [ ] ( ) ~ \` > # + - = | { } . !`
  - Aplicado em todos os comandos, callbacks e tasks do bot
- **63 testes unitários**: Cobertura completa de edge cases
- **Documentação consolidada**: `docs/architecture/TELEGRAM_BOT.md`

#### 🐛 Correções
- **Erro DLQ resolvido**: "Character '!' is reserved and must be escaped"
- **Unidade de dosagem dinâmica**: Mensagens de estoque insuficiente agora mostram mg/ml/U/mcg corretamente
- **Escape consistente**: Todos os textos de usuário agora escapados corretamente

#### 📦 Commits Incluídos
- PR #32: Criar função escapeMarkdownV2
- PR #36: Adicionar testes unitários (63 testes)
- PR #42: Atualizar tasks.js com escape
- PR #44: Atualizar comandos do bot com escape
- PR #47: Atualizar callbacks do bot com escape

---

## [2.8.1] - 2026-02-16

### Telegram Bot Reliability

#### 🐛 Correções Críticas
- **P0**: Removido import de `retryManager.js` inexistente que causava falha no deploy
- Simplificado `sendDoseNotification` para usar `bot.sendMessage()` diretamente
- Helper function `wrapSendMessageResult` para reduzir duplicação

#### ✨ Novas Funcionalidades
- **P1A - DLQ Admin Interface**: Interface administrativa para gerenciar notificações falhadas
  - API endpoints: GET `/api/dlq`, POST `/api/dlq/:id/retry`, POST `/api/dlq/:id/discard`
  - View em `/admin/dlq` com tabela, filtros e paginação
  - Modal de confirmação para ações destrutivas
- **P1B - Daily DLQ Digest**: Digest diário enviado às 09:00 (horário de Brasília)
  - Lista até 10 notificações falhadas (status: pending, retrying)
  - Mensagem formatada em MarkdownV2
  - Requer configuração de `ADMIN_CHAT_ID` na Vercel
- **P1C - Simple Retry**: Retry automático de 2 tentativas
  - Identificação de erros retryable (network, rate limit, HTTP 5xx)
  - Delay simples de 1 segundo entre tentativas
  - Helper `isRetryableError` para categorização

#### 📊 Estatísticas
- **4 PRs mergeados**: #26, #27, #28, #29
- **8 arquivos novos**: DLQ API endpoints, view admin, retryManager
- **162 testes passando**: 13 novos testes para retryManager

#### ⚙️ Configuração Necessária
Para ativar o digest diário, configure a variável de ambiente na Vercel:
```bash
ADMIN_CHAT_ID=123456789  # Obter via @userinfobot no Telegram
```

---

## [2.8.0] - 2026-02-12

### Phase 4: Distribuição e Navegação

#### 🚀 Added

**F4.1: Hash Router & Deep Linking**
- Hook `useHashRouter` para navegação baseada em hash
- Componente `HashRouter` com lazy loading de rotas
- 9 rotas implementadas:
  - `#/dashboard` - Dashboard principal
  - `#/medicamentos` - Lista de medicamentos
  - `#/medicamento/:id` - Detalhes do medicamento
  - `#/estoque` - Gestão de estoque
  - `#/historico` - Histórico completo
  - `#/historico/:periodo` - Histórico filtrado (7d/30d/90d)
  - `#/protocolos` - Lista de protocolos
  - `#/perfil` - Perfil e configurações
  - `#/onboarding` - Wizard de primeiros passos
- Suporte a deep links do Telegram
- Integração com histórico do navegador

**F4.2: PWA Infrastructure**
- Integração com `vite-plugin-pwa`
- `manifest.json` com metadados completos
- Ícones PWA em 8 tamanhos: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- Service Worker com estratégias Workbox:
  - `CacheFirst` para JS/CSS/imagens (30 dias)
  - `StaleWhileRevalidate` para API Supabase (5 min)
  - `NetworkOnly` para operações de escrita
- Componente `InstallPrompt` para iOS e Android
- Utilitários `pwaUtils.js` para detecção de plataforma
- Meta tags para suporte Safari iOS

**F4.3: Push Notifications**
- Servidor de notificações push com VAPID
- API endpoints:
  - `POST /api/push-subscribe` - Gerenciamento de inscrições
  - `POST /api/push-send` - Envio de notificações
- Hook `usePushSubscription` para controle de inscrições
- Componente `PushPermission` para UI de permissões
- 3 tipos de notificações:
  - Lembretes de dose agendada
  - Alertas de dose atrasada (t+15min)
  - Alertas de estoque baixo (<= 3 dias)
- Rate limiting: máximo 10 pushes/dia/usuário
- Migração SQL: `008_push_subscriptions.sql`

**F4.4: Analytics PWA Integration**
- Extensão do `analyticsService` com eventos PWA
- 7 novos eventos trackados:
  - `pwa_installed` - App instalado
  - `pwa_install_prompt_shown/response/dismissed` - Interações com prompt
  - `push_opted_in/out` - Opt-in/opt-out de push
  - `push_permission_prompt_shown/dismissed` - UI de permissão
  - `offline_session` - Uso offline
  - `deep_link_accessed` - Navegação via deep links
  - `view_changed` - Navegação interna
- Privacy-first: sem PII, dados em localStorage apenas
- LGPD compliant

**F4.5: Bot Standardization**
- `server/bot/utils/messageFormatter.js` - Formatação MarkdownV2
- `server/bot/utils/errorHandler.js` - Tratamento de erros
- 49 testes unitários para utilitários do bot
- Refatoração de 10 handlers:
  - `start.js`, `hoje.js`, `estoque.js`, `historico.js`
  - `status.js`, `proxima.js`, `registrar.js`, `ajuda.js`
  - `adicionar_estoque.js`, `protocols.js`
- >30% redução de código duplicado
- Mensagens de erro padronizadas em português

**F4.6: Feature Organization**
- Nova estrutura de pastas:
  ```
  src/features/
  ├── adherence/       # Adesão: components, hooks, services, utils
  ├── dashboard/       # Dashboard: widgets e utilitários
  ├── medications/     # Medicamentos
  ├── protocols/       # Protocolos
  └── stock/           # Estoque

  src/shared/
  ├── components/      # UI, log, gamification, onboarding
  ├── hooks/           # useCachedQuery, useTheme, etc
  ├── services/        # cachedServices, migrationService
  ├── constants/       # Schemas Zod
  ├── utils/           # queryCache, supabase
  └── styles/          # CSS tokens e temas
  ```
- Path aliases no Vite:
  - `@` → `src/`
  - `@features` → `src/features/`
  - `@shared` → `src/shared/`
  - `@dashboard`, `@medications`, `@protocols`, `@stock`, `@adherence`
- 150+ arquivos migrados
- 100% backward compatible

#### 📊 Stats
- **Total de testes**: 140+ (93 críticos + 11 smoke + 36+ componentes)
- **Test coverage Phase 4**: 100%
- **Bundle size**: 762KB (gzipped: 219KB)
- **Build time**: ~9.5s
- **Lighthouse PWA score**: >= 90
- **Lighthouse Performance**: >= 90

---

## [2.7.0] - 2026-02-11

### Phase 3.6: Component Consolidation Wave

#### 🚀 Added
- Consolidation de 6 grupos de componentes (~783 linhas removidas)
- `MedicineForm` unificado com `FirstMedicineStep` via props de onboarding
- `ProtocolForm` com modos `full` e `simple`
- `Calendar` com features opcionais (lazyLoad, swipe, monthPicker)
- `AlertList` componente base para alertas
- `LogForm` UX padronizada
- 100% backward compatibility

---

## [2.6.0] - 2026-02-10

### Fase 3.5: Design Uplift

#### 🚀 Added
- Glassmorphism hierárquico (4 níveis)
- Gradientes temáticos
- Micro-interações e animações
- Tokens CSS completos
- `InsightCard` com 11 variantes
- Hooks `useAdherenceTrend` e `useInsights`
- Serviços `adherenceTrendService` e `insightService`

---

## [2.2.1] - 2026-01-31

### Correções do Bot Telegram

#### 🔧 Fixed
- Bot funciona com múltiplos usuários (removido MOCK_USER_ID)
- Cron jobs notificam todos os usuários com Telegram vinculado
- Sistema de logs estruturados (ERROR → TRACE)
- Health checks via comando `/health`
- Reconexão automática em erros de rede

#### 🚀 Added
- Validação de token do Telegram na inicialização
- Tratamento de erros nos comandos do bot
- Cache de protocolos por usuário
- Compatibilidade com cron-job.org

---

## [2.0.0] - 2026-01-15

### Multi-User Auth

#### 🚀 Added
- Autenticação segura via Supabase Auth
- Isolamento de dados com RLS
- Integração Telegram 2.0 com tokens temporários

---

## Notas de Versão

### Convenções de Versionamento

- **MAJOR**: Mudanças incompatíveis com versões anteriores
- **MINOR**: Novas funcionalidades, mantendo compatibilidade
- **PATCH**: Correções de bugs, sem novas funcionalidades

### Referências

- [Documentação Completa](./docs/)
- [Setup e Instalação](./docs/SETUP.md)
- [Guia de Contribuição](./docs/PADROES_CODIGO.md)
