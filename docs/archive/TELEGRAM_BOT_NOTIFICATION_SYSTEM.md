# 📨 Sistema de Notificações do Bot Telegram

**Versão:** 3.0.0  
**Data:** 2026-02-15  
**Status:** Produção  
**Entregas:** PRs #19, #20, #21, #22

Documentação completa do sistema resiliente de notificações do bot Telegram do Meus Remédios.

---

## 📋 Resumo Executivo

O sistema de notificações foi completamente refatorado para garantir **confiabilidade, observabilidade e resiliência**. A nova arquitetura implementa um modelo de 3 fases que elimina falhas silenciosas, adiciona retry inteligente com exponential backoff, e fornece métricas em tempo real.

### Principais Melhorias

| Métrica | Antes | Depois |
|---------|-------|--------|
| Detecção de falhas | Silenciosa | 100% visível (DLQ) |
| Retry automático | Não existia | 3 tentativas com backoff |
| Rastreamento | Nenhum | UUID por notificação |
| Métricas | Nenhuma | p50/p95/p99 + health checks |
| Recuperação | Manual | Automática (DLQ retry) |

---

## 🏗️ Arquitetura de 3 Fases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FASE P0 - FUNDAMENTOS DE ERRO                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐    │
│   │  Result Object  │───→│  Status Tracking    │───→│  Log Pattern    │    │
│   │  Pattern        │    │  DB (Supabase)      │    │  Structured     │    │
│   └─────────────────┘    └─────────────────────┘    └─────────────────┘    │
│                                                                             │
│   • Nunca silencia falhas                                                   │
│   • Sempre retorna {success, data, error}                                   │
│   • Registra status_ultima_notificacao na tabela user_settings              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FASE P1 - CAMADA DE CONFIABILIDADE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐  │
│   │  Retry Manager   │    │  Correlation        │    │  Dead Letter     │  │
│   │  Exponential     │───→│  Logger (UUID)      │───→│  Queue (DLQ)     │  │
│   │  Backoff 1-2-4s  │    │  End-to-end tracing │    │  PostgreSQL      │  │
│   └──────────────────┘    └─────────────────────┘    └──────────────────┘  │
│                                                                             │
│   • Max 3 retries com jitter (+/- 25%)                                      │
│   • Correlation ID único por notificação                                    │
│   • DLQ com RLS (Row Level Security)                                        │
│   • Detecção automática de erros não-recuperáveis                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FASE P2 - OBSERVABILIDADE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐  │
│   │  Metrics         │    │  Health Check       │    │  Dashboard       │  │
│   │  In-Memory       │───→│  API Endpoint       │───→│  Widget          │  │
│   │  p50/p95/p99     │    │  /api/health/       │    │  Notification    │  │
│   │                  │    │  notifications      │    │  Stats           │  │
│   └──────────────────┘    └─────────────────────┘    └──────────────────┘  │
│                                                                             │
│   • Métricas em memória (60 min retention)                                  │
│   • Thresholds configuráveis                                                │
│   • Widget React no Dashboard                                               │
│   • Alertas automáticos                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Fluxo de Dados

```mermaid
flowchart TD
    A[Cron Job - /api/notify] --> B[notificationDeduplicator]
    B -->|Should send?| C[sendWithRetry]
    C --> D{Attempt 1}
    D -->|Success| E[recordSuccess]
    D -->|Failure| F[recordRetry]
    F --> G{Retryable?}
    G -->|Yes| H[Calculate Delay]
    H --> I[Attempt 2]
    I -->|Success| E
    I -->|Failure| J[Attempt 3]
    J -->|Success| E
    J -->|Failure| K[enqueue to DLQ]
    G -->|No| K
    K --> L[recordFailure]
    E --> M[logSuccessfulNotification]
    L --> M
    
    subgraph Observability
        E --> N[Metrics Store]
        L --> N
        F --> N
        N --> O[/api/health/notifications]
        O --> P[NotificationStatsWidget]
    end
    
    subgraph DLQ Management
        K --> Q[failed_notification_queue]
        Q --> R{Manual Retry}
        R -->|Yes| C
        R -->|No| S[Resolved/Discarded]
    end
```

---

## 🔧 Componentes

### Fase P0 - Fundamentos de Erro

#### 1. Result Object Pattern

```javascript
// ✅ Padrão obrigatório - nunca silenciar falhas
async function sendNotification(data) {
  try {
    const result = await bot.sendMessage(chatId, message);
    return { success: true, data: result };
  } catch (error) {
    // Sempre propaga o erro
    return { success: false, error, retryable: isRetryable(error) };
  }
}
```

#### 2. Status Tracking no Banco

```sql
-- Tabela user_settings com tracking de notificações
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS status_ultima_notificacao text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS hora_ultima_notificacao timestamptz;
```

#### 3. Log Pattern

```javascript
import { logSuccessfulNotification } from '../services/notificationDeduplicator.js';

// Após envio bem-sucedido
await logSuccessfulNotification(userId, 'dose_reminder', protocolId);
```

---

### Fase P1 - Camada de Confiabilidade

#### 1. Retry Manager (`server/bot/retryManager.js`)

**Responsabilidade:** Gerenciar tentativas de envio com exponential backoff.

```javascript
import { sendWithRetry, DEFAULT_RETRY_CONFIG } from '../bot/retryManager.js';

// Uso típico
const result = await sendWithRetry(
  async () => bot.sendMessage(chatId, message),
  { maxRetries: 3, baseDelay: 1000 }
);

// Resultado
if (result.success) {
  console.log('Enviado após', result.attempts, 'tentativas');
} else {
  console.error('Falhou após', result.attempts, 'tentativas');
}
```

**Configuração Padrão:**

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `maxRetries` | 3 | Tentativas máximas |
| `baseDelay` | 1000ms | Delay inicial |
| `maxDelay` | 30000ms | Delay máximo |
| `jitter` | true | Variação aleatória |
| `jitterFactor` | 0.25 | +/- 25% de variação |

**Sequência de Backoff:**
```
Tentativa 1: 1s (+/- 250ms jitter)
Tentativa 2: 2s (+/- 500ms jitter)
Tentativa 3: 4s (+/- 1s jitter)
```

**Erros Recuperáveis:**
- `network_error`, `rate_limit`, `timeout_error`
- `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`
- Códigos Telegram: 429, 500, 502, 503, 504

**Erros NÃO Recuperáveis:**
- 400 Bad Request, 401 Unauthorized, 403 Forbidden
- 404 Not Found, mensagens muito longas
- Usuário bloqueou o bot

---

#### 2. Correlation Logger (`server/bot/correlationLogger.js`)

**Responsabilidade:** Rastreamento end-to-end com UUIDs.

```javascript
import { withCorrelation, generateCorrelationId } from '../bot/correlationLogger.js';

// Gerar correlation ID para notificação
const correlationId = generateCorrelationId();

// Usar em operações async
await withCorrelation(async (ctx) => {
  // ctx.correlationId disponível em todo o fluxo
  await sendNotification(data);
}, { userId, notificationType: 'dose' });
```

**Benefícios:**
- Rastreabilidade de notificações individuais
- Debugging distribuído
- Correlação entre logs e métricas

---

#### 3. Dead Letter Queue (`server/services/deadLetterQueue.js`)

**Responsabilidade:** Armazenar notificações que falharam após todas as tentativas.

**Tabela no PostgreSQL:**
```sql
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

-- Índice para evitar duplicados
CREATE UNIQUE INDEX idx_failed_queue_pending 
ON failed_notification_queue (user_id, notification_type, status) 
WHERE status IN ('failed', 'pending', 'retrying');
```

**Categorias de Erro:**

| Categoria | Descrição | Ação |
|-----------|-----------|------|
| `network_error` | Erro de rede | Retry manual |
| `rate_limit` | 429 Too Many Requests | Aguardar |
| `invalid_chat` | Usuário bloqueou bot | Descartar |
| `message_too_long` | Mensagem > 4096 chars | Corrigir |
| `telegram_400/401/403/404` | Erros de API | Analisar |

**API:**
```javascript
import { enqueue, getDLQStats, retryFailed } from '../services/deadLetterQueue.js';

// Adicionar à DLQ
await enqueue(notificationData, error, retryCount, correlationId);

// Estatísticas
const stats = await getDLQStats();
console.log(stats.pending, 'notificações pendentes');

// Retry manual
await retryFailed({ maxAge: '24h', batchSize: 10 });
```

---

### Fase P2 - Observabilidade

#### 1. Notification Metrics (`server/services/notificationMetrics.js`)

**Responsabilidade:** Coletar métricas em memória com 60 minutos de retenção.

**Métricas Coletadas:**
- `successCount` - Notificações bem-sucedidas (por minuto)
- `failureCount` - Notificações falhas (por minuto)
- `retryCount` - Tentativas de retry (por minuto)
- `deliveryTimes` - Array de tempos de entrega (por minuto)
- `errorBreakdown` - Contagem por categoria de erro
- `rateLimitHits` - Rate limits encontrados (por minuto)

**API:**
```javascript
import { 
  recordSuccess, 
  recordFailure, 
  recordRetry, 
  getMetrics 
} from '../services/notificationMetrics.js';

// Registrar sucesso
recordSuccess(deliveryTimeMs, { userId, notificationType });

// Obter métricas
const metrics = getMetrics(5); // Últimos 5 minutos
console.log(metrics.summary.errorRate, '% erro');
console.log(metrics.deliveryTime.p50, 'ms p50');
```

**Estatísticas Calculadas:**

| Métrica | Descrição |
|---------|-----------|
| `p50` | Mediana do tempo de entrega |
| `p95` | 95th percentile |
| `p99` | 99th percentile |
| `avg` | Média aritmética |
| `errorRate` | Percentual de falhas |

---

#### 2. Health Check API (`api/health/notifications.js`)

**Endpoint:** `GET /api/health/notifications`

**Thresholds:**
```javascript
const HEALTH_THRESHOLDS = {
  maxErrorRate: 5,           // 5% erro máximo
  maxDlqSize: 100,           // 100 notificações na DLQ
  maxMinutesSinceSuccess: 10, // 10 minutos sem sucesso
  maxRateLimitHitsPerHour: 10 // 10 rate limits por hora
};
```

**Resposta:**
```json
{
  "status": "healthy|warning|critical",
  "timestamp": "2026-02-15T11:10:52.032Z",
  "checks": {
    "errorRate": { "status": "healthy", "value": 2.5, "threshold": 5 },
    "dlqSize": { "status": "healthy", "value": 3, "threshold": 100 },
    "lastSuccessfulSend": { "status": "healthy", "value": "2026-02-15T11:05:00Z" },
    "rateLimitHits": { "status": "healthy", "value": 0, "threshold": 10 }
  },
  "metrics": {
    "totalAttempts": 100,
    "successful": 97,
    "failed": 3,
    "errorRate": 3.0,
    "avgDeliveryTime": 150
  }
}
```

---

#### 3. Dashboard Widget (`src/components/dashboard/NotificationStatsWidget.jsx`)

**Funcionalidades:**
- Atualização automática a cada 30 segundos
- Status visual (verde/amarlo/vermelho)
- Métricas: enviadas, falhas, taxa de erro, DLQ, tempo médio
- Tempo desde último envio

**Estados:**
- ✅ **Healthy** - Sistema operando normalmente
- ⚡ **Warning** - Algum threshold atingido
- ⚠️ **Critical** - Ação imediata necessária

---

## 📁 Estrutura de Arquivos

```
server/
├── bot/
│   ├── retryManager.js           # Retry com exponential backoff
│   ├── correlationLogger.js      # UUID tracing
│   └── logger.js                 # Logger estruturado
│
├── services/
│   ├── deadLetterQueue.js        # DLQ PostgreSQL
│   ├── notificationMetrics.js    # Métricas em memória
│   ├── notificationDeduplicator.js # Controle de duplicados
│   └── protocolCache.js          # Cache de protocolos
│
└── utils/
    └── formatters.js             # Formatação de mensagens

api/
├── health/
│   └── notifications.js          # Health check endpoint
├── notify.js                     # Cron job entry point
└── telegram.js                   # Webhook handler

src/
└── components/
    └── dashboard/
        ├── NotificationStatsWidget.jsx  # Widget do dashboard
        └── NotificationStatsWidget.css  # Estilos

.migrations/
└── 20260215_notification_system.sql   # Schema DLQ
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

```bash
# Telegram
TELEGRAM_BOT_TOKEN=seu_token_aqui

# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role

# Cron
CRON_SECRET=chave_secreta_forte

# Logging
LOG_LEVEL=INFO  # ERROR | WARN | INFO | DEBUG | TRACE
```

### Configuração Vercel (`vercel.json`)

```json
{
  "functions": {
    "api/notify.js": {
      "maxDuration": 60
    }
  },
  "crons": [
    {
      "path": "/api/notify",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

## 🚨 Troubleshooting

### Problema: Notificações não chegam

**Diagnóstico:**
```bash
# Verificar health check
curl https://seu-app.vercel.app/api/health/notifications

# Verificar DLQ
# No Supabase: SELECT * FROM failed_notification_queue WHERE status = 'failed';
```

**Causas comuns:**
1. Usuário não vinculou Telegram (verificar `user_settings.telegram_chat_id`)
2. Bot bloqueado pelo usuário (erro 403)
3. Rate limit do Telegram (erro 429)

### Problema: Taxa de erro alta

**Ação:**
1. Verificar logs: `LOG_LEVEL=DEBUG npm run bot`
2. Analisar DLQ: categorias de erro predominantes
3. Verificar status da API do Telegram

### Problema: DLQ crescendo

**Ação manual:**
```javascript
// Retry manual de notificações na DLQ
await retryFailed({ maxAge: '24h', batchSize: 50 });
```

### Problema: Widget não carrega

**Verificar:**
1. Endpoint `/api/health/notifications` respondendo
2. CORS habilitado
3. Autenticação não bloqueando (endpoint é público)

---

## 📊 Monitoramento

### Dashboard
Acesse o dashboard do app e localize o widget "📊 Notificações".

### Logs
```bash
# Local
LOG_LEVEL=DEBUG npm run bot

# Vercel (via dashboard ou CLI)
vercel logs --follow
```

### Métricas Programáticas
```javascript
const response = await fetch('/api/health/notifications');
const health = await response.json();

if (health.status === 'critical') {
  // Enviar alerta para equipe
}
```

---

## 🔒 Segurança

### RLS (Row Level Security)

Todas as operações na DLQ respeitam RLS:

```sql
-- Política: usuários só veem seus próprios registros
CREATE POLICY "Users can only see their own DLQ entries"
  ON failed_notification_queue
  FOR ALL
  USING (user_id = auth.uid());
```

### Deduplicação

Notificações duplicadas são automaticamente descartadas:

```javascript
const shouldSend = await shouldSendNotification(
  userId, 
  'dose_reminder', 
  protocolId,
  5 // minutos de cooldown
);
```

---

## 🔄 Ciclo de Vida de uma Notificação

```
1. CRON Trigger (/api/notify)
   ↓
2. Buscar protocolos ativos por usuário
   ↓
3. Verificar deduplicação (já enviou nos últimos 5 min?)
   ↓
4. Tentativa 1 (imediata)
   ├─ Sucesso → Registrar sucesso + métricas
   └─ Falha → Registrar retry
       ↓
5. Espera 1s (+ jitter)
6. Tentativa 2
   ├─ Sucesso → Registrar sucesso + métricas
   └─ Falha → Registrar retry
       ↓
7. Espera 2s (+ jitter)
8. Tentativa 3
   ├─ Sucesso → Registrar sucesso + métricas
   └─ Falha → Enviar para DLQ + registrar falha
       ↓
9. Log final (sucesso ou falha)
   ↓
10. Próxima notificação
```

---

## 📝 Referência de Código

### Enviar Notificação com Retry
```javascript
import { sendWithRetry } from '../bot/retryManager.js';
import { logSuccessfulNotification } from '../services/notificationDeduplicator.js';

async function notifyUser(userId, chatId, message) {
  const result = await sendWithRetry(
    () => bot.sendMessage(chatId, message, { parse_mode: 'Markdown' }),
    { maxRetries: 3 }
  );
  
  if (result.success) {
    await logSuccessfulNotification(userId, 'dose_reminder', protocolId);
  }
  
  return result;
}
```

### Verificar Métricas
```javascript
import { getMetrics } from '../services/notificationMetrics.js';

const metrics = getMetrics(5); // Últimos 5 minutos
console.table({
  'Enviadas': metrics.summary.successful,
  'Falhas': metrics.summary.failed,
  'Taxa de Erro': `${metrics.summary.errorRate.toFixed(2)}%`,
  'P50 Latência': `${metrics.deliveryTime.p50}ms`,
  'P95 Latência': `${metrics.deliveryTime.p95}ms`
});
```

---

## 🎯 Métricas de Sucesso

| KPI | Target | Measurement |
|-----|--------|-------------|
| Taxa de entrega | > 99% | `successful / totalAttempts` |
| Latência p95 | < 500ms | `metrics.deliveryTime.p95` |
| Retry rate | < 5% | `retries / totalAttempts` |
| DLQ size | < 10 | `stats.pending` |
| Tempo sem envios | < 5 min | `lastSuccessfulSend` |

---

## 📎 Anexo: Incidente 2026-02-16 - Correção de Parsing Markdown

### Resumo do Incidente
Em 16/02/2026 às 20:30, notificações falharam com erro:
```
Bad Request: can't parse entities: Character '!' is reserved and must be escaped with the preceding '\\'
```

### Root Cause
1. **Literais de template** continham `!` não escapados:
   - `server/bot/tasks.js:66` - "Hora do seu remédio!"
   - `server/bot/tasks.js:151` - "Parabéns! ... alvo!"
   - 7 localizações ao total

2. **DLQ schema** não tinha UNIQUE constraint para upsert

### Correções Aplicadas
```javascript
// ANTES (com erro)
let message = `💊 *Hora do seu remédio!*\n\n`;

// DEPOIS (corrigido)
let message = `💊 *Hora do seu remédio\!*\n\n`;
```

### Validação de Mensagens
Para prevenir recorrência:
```bash
# Verificar caracteres não escapados
grep -rn "![^}]" server/bot/*.js
```

### LIÇÕES APRENDIDAS
1. TODAS as mensagens MarkdownV2 DEVEM escapar caracteres especiais
2. Usar `escapeMarkdown()` ou criar `telegramFormatter` centralizado
3. Migrations DEVEM ser idempotentes (IF NOT EXISTS)
4. Verificar Vercel deployments após push

---

*Documentação mantida pela equipe de arquitetura.  
Última atualização: 2026-02-16*
