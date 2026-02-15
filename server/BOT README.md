# Telegram Bot - Meus Remédios

## Architecture

The bot is now organized in a modular structure for better maintainability:

```
server/
├── index.js                    # Entry point
├── bot/
│   ├── commands/               # Command handlers
│   │   ├── start.js           # /start
│   │   ├── status.js          # /status
│   │   ├── estoque.js         # /estoque (NEW)
│   │   ├── hoje.js            # /hoje (NEW)
│   │   ├── proxima.js         # /proxima (NEW)
│   │   ├── historico.js       # /historico (NEW)
│   │   └── ajuda.js           # /ajuda (NEW)
│   ├── callbacks/
│   │   └── doseActions.js     # Button callbacks
│   └── scheduler.js           # Cron notifications
├── services/
│   └── supabase.js            # Database client
└── utils/
    └── formatters.js          # Message formatting utilities
```

## Features Implemented

### Phase 3: Conversational Actions ✅
- ✅ `/registrar` - Interactive dose logging
- ✅ `/adicionar_estoque` - Add stock via Telegram
- ✅ `/pausar` / `/retomar` - Protocol management

### Phase 4: Intelligent Alerts & Insights ✅
- ✅ **Stock Forecasting Alerts** - Daily at 9 AM, warns when stock ≤7 days
- ✅ **Weekly Adherence Reports** - Sundays at 8 PM, tracks dose adherence
- ✅ **Titration Stage Alerts** - Daily at 8 AM, notifies when to advance titration

### Multi-User & Security ✅
- ✅ **Secure Authentication** - Integration with Supabase Auth
- ✅ **Token-Based Linking** - Secure chat registration using `/start <TOKEN>`
- ✅ **Data Isolation** - Per-user data access through dynamic session resolution

## Database Migration Required

Ensure your Supabase schema is up to date. Siga o guia em `MIGRATION_GUIDE.md` para adicionar os campos necessários, incluindo:

```sql
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS verification_token text;
```

## Setup & Deployment

1. **Local**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is in your `.env`.
2. **Vercel**: You **MUST** add `SUPABASE_SERVICE_ROLE_KEY` to your Vercel Environment Variables. Without it, the bot cannot link users due to RLS policies.

## Commands

### User Commands
- `/start <TOKEN>` - Link Telegram account using the code from App Settings
- `/status` - View active protocols
- `/estoque` - Check medicine stock levels
- `/hoje` - Today's medication schedule
- `/proxima` - Next scheduled dose
- `/historico` - Recent dose history
- `/ajuda` - Show help message
- `/registrar` - Register a dose interactively
- `/pausar [medicamento]` - Pause a protocol
- `/retomar [medicamento]` - Resume a protocol
- `/health` - Verificar status do bot

### Notifications
- Automatic reminders at scheduled times
- Interactive buttons: "Tomei ✅" / "Pular ❌"
- Stock warnings when levels are low
- **Resilient Delivery (v3.0.0)**: Retry automático com exponential backoff
- **Dead Letter Queue**: Falhas armazenadas para retry manual

## Notification System (v3.0.0)

O sistema de notificações implementa uma arquitetura resiliente de 3 fases:

### Fase P0 - Fundamentos de Erro
- **Result Object Pattern**: Nunca silencia falhas
- **Database Status Tracking**: `status_ultima_notificacao` na tabela user_settings
- **Structured Logging**: Logger com níveis (ERROR, WARN, INFO, DEBUG, TRACE)

### Fase P1 - Camada de Confiabilidade
- **Retry Manager**: Exponential backoff (1s → 2s → 4s) com jitter (±25%)
- **Correlation Logger**: UUID tracing para rastreamento end-to-end
- **Dead Letter Queue**: PostgreSQL-based DLQ com RLS
- **Error Categorization**: Detecção automática de erros não-recuperáveis

### Fase P2 - Observabilidade
- **Notification Metrics**: Métricas em memória (p50/p95/p99 latência)
- **Health Check API**: `GET /api/health/notifications`
- **Dashboard Widget**: `NotificationStatsWidget` no Dashboard
- **Alert Thresholds**: Configuráveis para diferentes severidades

### Fluxo de Notificação
```
1. CRON Trigger → 2. Deduplication Check → 3. Retry Manager
                                     ↓
              ┌─────────────────────────────────────┐
              │  Tentativa 1 → Falha → Retry 1s     │
              │  Tentativa 2 → Falha → Retry 2s     │
              │  Tentativa 3 → Falha → DLQ          │
              └─────────────────────────────────────┘
                                     ↓
                        Sucesso → Métricas + Log
```

### Arquivos Principais
```
server/bot/retryManager.js              # Retry com exponential backoff
server/bot/correlationLogger.js         # UUID tracing
server/services/deadLetterQueue.js      # DLQ PostgreSQL
server/services/notificationMetrics.js  # Métricas em memória
api/health/notifications.js             # Health check endpoint
```

### Monitoramento
```bash
# Health check
curl https://seu-app.vercel.app/api/health/notifications

# Logs detalhados
LOG_LEVEL=DEBUG npm run bot
```

Veja a documentação completa em [`docs/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md`](../docs/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md).

## Development

```bash
# Run the bot locally
npm run bot

# With debug logging
LOG_LEVEL=DEBUG npm run bot
```

### Estrutura do Projeto

```
server/
├── bot/
│   ├── commands/           # Handlers de comandos (/start, /status, etc)
│   ├── callbacks/          # Handlers de botões inline
│   ├── middleware/         # Middlewares (auth, logging)
│   ├── retryManager.js     # Retry com exponential backoff
│   ├── correlationLogger.js # UUID tracing
│   ├── scheduler.js        # Agendador de tarefas
│   ├── tasks.js            # Tarefas executadas pelo cron
│   └── logger.js           # Logger estruturado
├── services/
│   ├── supabase.js         # Cliente Supabase
│   ├── deadLetterQueue.js  # DLQ PostgreSQL
│   ├── notificationMetrics.js # Métricas em memória
│   ├── notificationDeduplicator.js # Controle de duplicados
│   └── protocolCache.js    # Cache de protocolos
└── utils/
    ├── formatters.js       # Formatação de mensagens
    └── timezone.js         # Timezone utilities (GMT-3)

api/
├── telegram.js             # Webhook handler
├── notify.js               # Cron job endpoint
└── health/
    └── notifications.js    # Health check API
```
