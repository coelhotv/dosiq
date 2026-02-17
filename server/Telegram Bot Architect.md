GitHub Copilot: # Telegram Bot Architecture & Services Documentation

## Overview
This is a medication adherence tracking bot with multi-stage development (Phases 1-4). It uses Node.js with Telegram Bot API and Supabase as the backend.

---

## Services Architecture

### 1. **Core Services**

#### `server/services/supabase.js`
- **Purpose**: Centralized Supabase client initialization
- **Exports**: 
  - `supabase`: Authenticated client instance
  - `MOCK_USER_ID`: Single user ID for MVP
- **Issues**: 
  - Hardcoded single user (MVP limitation)
  - No authentication layer for multi-user

#### `server/utils/formatters.js`
- **Purpose**: Shared formatting utilities
- **Functions**:
  - `getCurrentTime()`: Brazil timezone aware HH:MM formatter
  - `calculateDaysRemaining()`: Stock forecasting math
  - `formatStockStatus()`: Medicine stock message builder
  - `formatProtocol()`: Protocol details formatter
  - `calculateStreak()`: Adherence streak calculator

---

### 2. **Bot Commands** (Implemented)

| Command | File | Purpose |
|---------|------|---------|
| `/start` | `bot/commands/start.js` | Bot initialization & user linking |
| `/status` | `bot/commands/status.js` | Current protocol overview |
| `/estoque` | `bot/commands/estoque.js` | Stock level review |
| `/hoje` | `bot/commands/hoje.js` | Today's scheduled doses |
| `/proxima` | `bot/commands/proxima.js` | Next dose notification |
| `/historico` | `bot/commands/historico.js` | Dose history & trends |
| `/ajuda` | `bot/commands/ajuda.js` | Help & command reference |
| `/registrar` | `bot/commands/registrar.js` | Register new medicine |
| `/adicionar_estoque` | `bot/commands/adicionar_estoque.js` | Add stock + shortcut `/repor` |
| `/pausar` | `bot/commands/protocols.js` | Pause protocol |
| `/retomar` | `bot/commands/protocols.js` | Resume protocol |

---

### 3. **Callback Handlers** (Interactive Buttons)

#### `bot/callbacks/doseActions.js`
- **Purpose**: Handle dose-related inline buttons
- **Actions**:
  - `take_:${protocolId}:${dosage}`: Mark dose as taken
  - `skip_:${protocolId}`: Skip dose
- **Linked to**: Dose notifications & reminders

#### `bot/callbacks/conversational.js`
- **Purpose**: Multi-step conversational flows
- **Flows**: Registration, stock addition, protocol management
- **State Management**: Uses `bot/state.js` for session tracking

#### `bot/state.js`
- **Purpose**: In-memory session management
- **Features**: 
  - Maps chatId → conversation context
  - 10-minute TTL for sessions
  - Basic garbage collection

---

### 4. **Scheduling & Alerts**

#### `bot/scheduler.js`
- **Cron Jobs**:
  - `* * * * *`: Dose reminders (every minute)
  - `0 23 * * *`: Daily digest (11 PM)

#### `bot/alerts.js`
- **Cron Jobs**:
  - `0 9 * * *`: Stock alerts (9 AM daily)
  - `0 8 * * *`: Titration alerts (8 AM daily)
  - `0 22 * * 0`: Adherence reports (10 PM Sundays)
  - `0 10 1 * *`: Monthly report (1st of month, 10 AM)

#### `bot/tasks.js`
- **Core Functions**:
  - `checkReminders()`: Main dose notification + soft reminders
  - `runDailyDigest()`: Daily recap (taken doses + tomorrow preview)
  - `checkStockAlerts()`: Low stock & out-of-stock warnings
  - `checkAdherenceReports()`: Weekly adherence metrics
  - `checkTitrationAlerts()`: Titration stage transition notifications
  - `checkMonthlyReport()`: Monthly trend analysis

---

### 5. **Advanced Features**

#### `bot/inlineQuery.js`
- **Purpose**: Inline medicine search (`@botname medicine_name`)
- **Results**: Medicine cards with stock & protocol info
- **Cache**: 10 seconds

---

### 6. **API Routes** (Vercel Serverless)

#### `api/telegram.js`
- **Purpose**: Webhook receiver for Telegram updates
- **Handlers**: Routes messages & callbacks to commands
- **Bot Adapter**: Fetch-based bot mock (no node-telegram-bot-api polling)

#### `api/notify.js`
- **Purpose**: Cron job endpoint for scheduled tasks
- **Auth**: Bearer token via `CRON_SECRET`
- **Logic**: Time-based dispatcher for all alerts & reminders

---

## Data Flow

```
User Message
    ↓
[Telegram Webhook] → api/telegram.js
    ↓
[Command Router] → bot/commands/*.js
    ↓
[Supabase Queries] ← server/services/supabase.js
    ↓
[Formatters & Responses] ← server/utils/formatters.js
    ↓
[Telegram API] → Bot sends message/inline buttons
    ↓
[Callback Event] → bot/callbacks/*.js (if button clicked)
    ↓
[State Management] → bot/state.js (for multi-step flows)
```

---

## Key Improvements Needed

### **High Priority**

1. **Multi-User Support**
   - Remove `MOCK_USER_ID` hardcoding
   - Implement user authentication flow
   - Store `user_id` in Telegram user context
   - Add user registration with encryption

2. **Timezone Handling**
   - `getCurrentTime()` uses `new Date()` in Vercel (UTC)
   - Issue: Dose reminders may trigger at wrong times
   - **Fix**: Either:
     - Pass timezone from user settings
     - Store user timezone in DB
     - Use date-fns with IANA timezones

3. **Error Handling & Logging**
   - No structured logging (just `console.error`)
   - No error recovery for partial failures
   - Missing error messages to users (silent failures)
   - **Fix**: Implement Winston or Pino logger + user error notifications

### **Medium Priority**

4. **State Management Issues**
   - In-memory sessions lost on Vercel restarts
   - 10-min TTL may be too short for complex flows
   - No persistence layer
   - **Fix**: Use Redis or Supabase for session storage

5. **Duplicate Notifications**
   - `last_notified_at` + 5-min check can still miss edge cases
   - Soft reminders may overlap with main notifications
   - **Fix**: Implement message deduplication queue (Redis)

6. **Performance Optimization**
   - `checkReminders()` queries all protocols every minute
   - No query result caching
   - Stock calculations repeated per request
   - **Fix**: Implement caching layer + query optimization

7. **Input Validation**
   - Commands don't validate user input thoroughly
   - Stock additions accept any quantity
   - No input sanitization for SQL injection
   - **Fix**: Add Zod/Joi validation schemas

### **Low Priority (Polish)**

8. **Testing**
   - No unit/integration tests
   - No mock Supabase setup
   - Difficult to test without live bot token
   - **Fix**: Add Jest + Supabase local testing

9. **Rate Limiting**
   - No rate limiting on endpoints
   - Users could spam `/registrar` to create infinite medicines
   - **Fix**: Add Telegram rate limit middleware

10. **Code Organization**
    - `tasks.js` is 400+ lines (single responsibility violated)
    - Commands mixed with callbacks in same handlers
    - Formatters intermingled with business logic
    - **Fix**: Split into smaller modules (e.g., `services/`, `features/`)

11. **Documentation**
    - No JSDoc comments on exported functions
    - Callback data format undocumented (`take_:${id}:${dosage}`)
    - Database schema not in code docs
    - **Fix**: Add comprehensive JSDoc + API docs

---

## Notification System Architecture (v3.0.0)

Sistema resiliente de notificações implementado em 3 fases (PRs #19-#22).

### 3-Phase Resilient Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE NOTIFICAÇÕES v3.0.0                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │   FASE P0     │  │   FASE P1     │  │   FASE P2     │               │
│  │ Fundamentos   │  │ Confiabilidade│  │Observabilidade│               │
│  ├───────────────┤  ├───────────────┤  ├───────────────┤               │
│  │ • Result obj  │  │ • Retry Mgr   │  │ • Metrics     │               │
│  │ • DB tracking │  │ • Correlation │  │ • Health API  │               │
│  │ • Log pattern │  │ • DLQ         │  │ • Dashboard   │               │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘               │
│          │                  │                  │                       │
│          └──────────────────┼──────────────────┘                       │
│                             ↓                                          │
│                    ┌─────────────────┐                                 │
│                    │  sendWithRetry  │                                 │
│                    └────────┬────────┘                                 │
│                             ↓                                          │
│                    ┌─────────────────┐                                 │
│                    │   /api/notify   │ ← Cron Job                     │
│                    └─────────────────┘                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Componentes do Sistema

#### Retry Manager (`server/bot/retryManager.js`)
- Exponential backoff: 1s → 2s → 4s
- Jitter: ±25% para evitar thundering herd
- Max 3 tentativas por padrão
- Detecção automática de erros recuperáveis

#### Correlation Logger (`server/bot/correlationLogger.js`)
- UUID único por notificação
- AsyncLocalStorage para contexto implícito
- Rastreamento end-to-end

#### Dead Letter Queue (`server/services/deadLetterQueue.js`)
- PostgreSQL-based com RLS
- Categorização automática de erros
- Retry manual via API
- Status: failed → retrying → resolved/discarded

#### Notification Metrics (`server/services/notificationMetrics.js`)
- In-memory com 60min retention
- p50/p95/p99 latência
- Error rate tracking
- Rate limit detection

#### Health Check API (`api/health/notifications.js`)
- Endpoint: GET /api/health/notifications
- Thresholds configuráveis
- Status: healthy | warning | critical
- Headers: X-Health-Status

#### Dashboard Widget (`src/components/dashboard/NotificationStatsWidget.jsx`)
- Atualização a cada 30s
- Status visual (cores)
- Métricas em tempo real

### Fluxo de Dados

```
Cron Trigger
     ↓
notificationDeduplicator (evita duplicados)
     ↓
sendWithRetry
     ↓
├─ Tentativa 1 → Sucesso → recordSuccess
├─ Tentativa 1 → Falha → recordRetry
│     ↓
│  Delay 1s + jitter
│     ↓
├─ Tentativa 2 → Sucesso → recordSuccess
├─ Tentativa 2 → Falha → recordRetry
│     ↓
│  Delay 2s + jitter
│     ↓
├─ Tentativa 3 → Sucesso → recordSuccess
└─ Tentativa 3 → Falha → enqueue(DLQ) → recordFailure
     ↓
logSuccessfulNotification
     ↓
Próxima notificação
```

### Database Schema

```sql
-- DLQ Table
CREATE TABLE failed_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  notification_type text NOT NULL,
  payload jsonb NOT NULL,
  error_category text NOT NULL,
  error_message text,
  retry_count integer DEFAULT 0,
  status text DEFAULT 'failed',
  correlation_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Índice único para evitar duplicados
CREATE UNIQUE INDEX idx_failed_queue_pending
ON failed_notification_queue (user_id, notification_type, status)
WHERE status IN ('failed', 'pending', 'retrying');

-- Tracking em user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS status_ultima_notificacao text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS hora_ultima_notificacao timestamptz;
```

### Thresholds de Saúde

```javascript
const HEALTH_THRESHOLDS = {
  maxErrorRate: 5,           // 5% erro máximo
  maxDlqSize: 100,           // 100 notificações na DLQ
  maxMinutesSinceSuccess: 10, // 10 minutos sem sucesso
  maxRateLimitHitsPerHour: 10 // 10 rate limits por hora
};
```

### Documentação Relacionada

- [`docs/architecture/TELEGRAM_BOT.md`](../docs/architecture/TELEGRAM_BOT.md) - Documentação consolidada
- [`docs/past_deliveries/BOT_REFACTORING_GUIDE.md`](../docs/past_deliveries/BOT_REFACTORING_GUIDE.md) - Guia de migração

---

## Recommended Tech Debt Items

| Item | Impact | Effort | Status |
|------|--------|--------|--------|
| Multi-user auth | Blocker | High | ✅ Done |
| Structured logging | Medium | Low | ✅ Done |
| Redis session store | High | Medium | ❌ Not needed |
| Input validation | Medium | Medium | ⚠️ Partial |
| Timezone fixes | High | Low | ✅ Done |
| Query caching | Medium | Medium | ✅ Done |
| Module splitting | Low | High | ✅ Done |
| Test suite | Medium | High | ⚠️ In progress |
| **Notification resilience** | Critical | High | ✅ **Done** |