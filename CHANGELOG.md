# Changelog - Meus Remédios

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
