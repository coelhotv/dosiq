# 🤖 Bot Telegram - Meus Remédios

**Versão:** 3.1.0  
**Última atualização:** 2026-02-17  
**Status:** Produção

Documentação consolidada do bot Telegram do Meus Remédios, incluindo arquitetura, comandos, sistema de notificações e desenvolvimentos recentes.

---

## 📋 Visão Geral

O bot Telegram do Meus Remédios é uma interface de comunicação que permite aos usuários gerenciar seus medicamentos, receber lembretes de doses e monitorar estoque diretamente pelo Telegram.

### Propósito

- **Lembretes de doses**: Notificações automáticas nos horários agendados
- **Gerenciamento de estoque**: Alertas de estoque baixo ou zerado
- **Registro de doses**: Interface conversacional para registrar doses tomadas
- **Relatórios de adesão**: Acompanhamento semanal e mensal do tratamento
- **Titulação**: Alertas para transição de etapas de titulação

### Componentes Principais

| Componente | Descrição |
|------------|-----------|
| **Commands** | Handlers para comandos de usuário (`/start`, `/status`, etc.) |
| **Callbacks** | Handlers para botões inline interativos |
| **Tasks** | Tarefas agendadas (lembretes, alertas, relatórios) |
| **Formatters** | Utilitários de formatação de mensagens |
| **DLQ** | Dead Letter Queue para notificações falhadas |

---

## 📁 Arquitetura de Arquivos

```
server/
├── index.js                    # Entry point (desenvolvimento local)
├── bot/
│   ├── commands/               # Handlers de comandos
│   │   ├── start.js           # /start - Vincular conta
│   │   ├── status.js          # /status - Protocolos ativos
│   │   ├── estoque.js         # /estoque - Níveis de estoque
│   │   ├── hoje.js            # /hoje - Cronograma do dia
│   │   ├── proxima.js         # /proxima - Próxima dose
│   │   ├── historico.js       # /historico - Histórico de doses
│   │   ├── ajuda.js           # /ajuda - Ajuda
│   │   ├── registrar.js       # /registrar - Registrar dose
│   │   ├── adicionar_estoque.js # /adicionar_estoque
│   │   └── protocols.js       # /pausar, /retomar
│   ├── callbacks/
│   │   ├── conversational.js  # Fluxos conversacionais
│   │   └── doseActions.js     # Botões de dose (Tomar/Pular)
│   ├── bot-factory.js         # Factory do bot
│   ├── correlationLogger.js   # UUID tracing
│   ├── health-check.js        # Health check
│   ├── inlineQuery.js         # Busca inline
│   ├── logger.js              # Logger estruturado
│   ├── scheduler.js           # Agendador de tarefas
│   ├── state.js               # Gerenciamento de sessão
│   └── tasks.js               # Tarefas do cron
├── services/
│   ├── supabase.js            # Cliente Supabase
│   ├── deadLetterQueue.js     # DLQ PostgreSQL
│   ├── notificationMetrics.js # Métricas em memória
│   ├── notificationDeduplicator.js # Controle de duplicados
│   ├── protocolCache.js       # Cache de protocolos
│   └── sessionManager.js      # Gerenciador de sessões
└── utils/
    ├── formatters.js          # Formatação de mensagens
    ├── retryManager.js        # Retry helpers
    └── timezone.js            # Utilitários de timezone

api/
├── telegram.js                # Webhook handler
├── notify.js                  # Cron job endpoint
├── dlq.js                     # DLQ list endpoint
├── dlq/
│   └── [id]/
│       ├── retry.js           # Retry endpoint
│       └── discard.js         # Discard endpoint
└── health/
    └── notifications.js       # Health check API

src/
└── views/
    └── admin/
        └── DLQAdmin.jsx       # Interface admin DLQ
```

---

## 📨 Sistema de Notificações

### Arquitetura de 3 Fases

O sistema de notificações implementa uma arquitetura resiliente em 3 fases:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE NOTIFICAÇÕES v3.1.0                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │   FASE P0     │  │   FASE P1     │  │   FASE P2     │               │
│  │ Fundamentos   │  │ Confiabilidade│  │Observabilidade│               │
│  ├───────────────┤  ├───────────────┤  ├───────────────┤               │
│  │ • Result obj  │  │ • Retry       │  │ • Metrics     │               │
│  │ • DB tracking │  │ • Correlation │  │ • Health API  │               │
│  │ • Log pattern │  │ • DLQ         │  │ • Dashboard   │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Notificação

```
Cron Trigger (/api/notify)
        ↓
notificationDeduplicator (evita duplicados)
        ↓
sendWithRetry (2 tentativas)
        ↓
├─ Tentativa 1 → Sucesso → recordSuccess
├─ Tentativa 1 → Falha → Delay 1s → Tentativa 2
└─ Tentativa 2 → Falha → enqueue(DLQ)
        ↓
logSuccessfulNotification
```

### Tipos de Notificação

| Tipo | Horário | Descrição |
|------|---------|-----------|
| **Dose Reminder** | A cada minuto | Lembretes de doses agendadas |
| **Soft Reminder** | 30 min após dose | Lembrete secundário se não registrou |
| **Stock Alert** | 09:00 diário | Alerta de estoque baixo/zerado |
| **DLQ Digest** | 09:00 diário | Resumo de falhas para admin |
| **Titration Alert** | 08:00 diário | Alerta de transição de titulação |
| **Daily Digest** | 23:00 diário | Resumo do dia |
| **Adherence Report** | Domingo 23:00 | Relatório semanal de adesão |
| **Monthly Report** | Dia 1, 10:00 | Relatório mensal |

---

## ✨ Formatação MarkdownV2 (v2.9.0)

### Função `escapeMarkdownV2()`

A API do Telegram exige que caracteres especiais sejam escapados no formato MarkdownV2. A função [`escapeMarkdownV2()`](../../server/utils/formatters.js:130) implementa essa formatação.

#### Caracteres Reservados (18 caracteres)

```
_ * [ ] ( ) ~ ` > # + - = | { } . !
```

#### Implementação

```javascript
/**
 * Escapa caracteres especiais para Telegram MarkdownV2 format
 * @param {string} text - Texto a ser escapado
 * @returns {string} Texto escapado seguro para MarkdownV2
 */
export function escapeMarkdownV2(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Ordem importa: escapar backslash PRIMEIRO para evitar double-escaping
  return text
    .replace(/\\/g, '\\\\')  // Deve ser primeiro!
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}
```

#### Exemplos de Uso

```javascript
// Entrada: "Omega 3!"
// Saída:   "Omega 3\!"

// Entrada: "Vitamina D (1000UI)"
// Saída:   "Vitamina D \(1000UI\)"

// Entrada: "Medicamento #1 - 10mg"
// Saída:   "Medicamento \#1 \- 10mg"
```

#### Arquivos que Utilizam

- [`server/utils/formatters.js`](../../server/utils/formatters.js) - Funções de formatação
- [`server/bot/tasks.js`](../../server/bot/tasks.js) - Mensagens de notificação
- [`server/bot/commands/*.js`](../../server/bot/commands/) - Respostas de comandos
- [`server/bot/callbacks/*.js`](../../server/bot/callbacks/) - Mensagens de callback

---

## 🔄 Sistema de Retry e DLQ

### Retry Simples (v3.1.0)

O sistema implementa retry simples com 2 tentativas:

```javascript
// api/notify.js
const maxAttempts = 2;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    const result = await telegramFetch('sendMessage', { ... });
    return { success: true, messageId: result.message_id };
  } catch (err) {
    if (!isRetryableError(err) || attempt === maxAttempts) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay 1s
  }
}
```

### Erros Recuperáveis

| Tipo | Códigos | Retry? |
|------|---------|--------|
| **Network** | ETIMEDOUT, ECONNRESET, ENOTFOUND | ✅ Sim |
| **Rate Limit** | 429 Too Many Requests | ✅ Sim |
| **Server Error** | 500, 502, 503, 504 | ✅ Sim |
| **Client Error** | 400, 401, 403, 404 | ❌ Não |

### Dead Letter Queue (DLQ)

Notificações que falharam após todas as tentativas são armazenadas na DLQ.

#### Schema da Tabela

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
```

#### Status da DLQ

| Status | Descrição |
|--------|-----------|
| `failed` | Falhou, aguardando ação |
| `retrying` | Em processo de retry |
| `resolved` | Resolvido com sucesso |
| `discarded` | Descartado manualmente |

### DLQ Admin Interface

Interface web para gerenciar notificações falhadas.

#### Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/dlq` | Lista notificações falhadas |
| `POST` | `/api/dlq/[id]/retry` | Re-tenta notificação |
| `POST` | `/api/dlq/[id]/discard` | Descarta notificação |

#### Parâmetros de Query (GET /api/dlq)

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `limit` | number | 20 | Itens por página (max: 100) |
| `offset` | number | 0 | Offset para paginação |
| `status` | string | null | Filtrar por status |

#### Exemplo de Resposta

```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "notification_type": "dose_reminder",
      "payload": { "medicineName": "Omega 3" },
      "error_category": "network_error",
      "error_message": "ETIMEDOUT",
      "retry_count": 2,
      "status": "failed",
      "created_at": "2026-02-17T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

### Daily Digest

Resumo diário de falhas enviado ao admin às 09:00.

```javascript
// Configurar ADMIN_CHAT_ID na Vercel
ADMIN_CHAT_ID=123456789  // Obter via @userinfobot
```

---

## 📱 Comandos Disponíveis

### Comandos de Usuário

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `/start <TOKEN>` | Vincula conta Telegram | `/start abc123` |
| `/status` | Protocolos ativos | `/status` |
| `/estoque` | Níveis de estoque | `/estoque` |
| `/hoje` | Cronograma do dia | `/hoje` |
| `/proxima` | Próxima dose agendada | `/proxima` |
| `/historico` | Histórico de doses | `/historico` |
| `/ajuda` | Mensagem de ajuda | `/ajuda` |
| `/registrar` | Registrar dose interativo | `/registrar` |
| `/adicionar_estoque` | Adicionar estoque | `/adicionar_estoque` |
| `/pausar [medicamento]` | Pausar protocolo | `/pausar Omega 3` |
| `/retomar [medicamento]` | Retomar protocolo | `/retomar Omega 3` |
| `/health` | Status do bot | `/health` |

### Botões Inline

| Botão | Ação |
|-------|------|
| ✅ Tomar | Registra dose como tomada |
| ⏰ Adiar | Adia lembrete em 30 min |
| ⏭️ Pular | Pula a dose |

### Fluxo Conversacional

O comando `/registrar` utiliza fluxo conversacional:

```
1. /registrar
   ↓
2. Selecione o medicamento (inline keyboard)
   ↓
3. Selecione a dosagem (inline keyboard)
   ↓
4. Confirmação → Dose registrada
```

---

## ⚙️ Configuração e Deploy

### Variáveis de Ambiente

```bash
# Telegram
TELEGRAM_BOT_TOKEN=seu_token_aqui

# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role

# Cron
CRON_SECRET=chave_secreta_forte

# Admin (para DLQ digest)
ADMIN_CHAT_ID=123456789

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
      "schedule": "* * * * *"
    }
  ]
}
```

### Desenvolvimento Local

```bash
# Executar bot localmente
npm run bot

# Com debug logging
LOG_LEVEL=DEBUG npm run bot
```

### Monitoramento

```bash
# Health check
curl https://seu-app.vercel.app/api/health/notifications

# Logs da Vercel
vercel logs --follow

# Logs filtrados por função
vercel logs --filter="api/notify"
```

---

## 🔗 Documentação Relacionada

- [`docs/architecture/DATABASE.md`](DATABASE.md) - Schema do banco de dados
- [`docs/reference/SERVICES.md`](../reference/SERVICES.md) - API de serviços
- [`docs/archive/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md`](../archive/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md) - Documentação detalhada do sistema de notificações
- [`server/BOT README.md`](../../server/BOT%20README.md) - README do bot

---

## 📜 Histórico de Versões

| Versão | Data | Mudanças |
|--------|------|----------|
| **3.1.0** | 2026-02-17 | DLQ Admin Interface, Daily Digest, Retry simplificado |
| **3.0.0** | 2026-02-15 | Sistema de notificações resiliente (3 fases) |
| **2.9.0** | 2026-02-17 | MarkdownV2 escape em todas as mensagens |
| **2.8.0** | 2026-02-10 | Multi-user auth, timezone handling |

---

## 🚨 Troubleshooting

### Notificações não chegam

1. Verificar se usuário vinculou Telegram (`user_settings.telegram_chat_id`)
2. Verificar se bot não foi bloqueado pelo usuário (erro 403)
3. Verificar health check: `curl /api/health/notifications`
4. Verificar DLQ: `SELECT * FROM failed_notification_queue WHERE status = 'failed'`

### Erro de MarkdownV2

**Sintoma**: Mensagens não são enviadas, erro 400 Bad Request

**Causa**: Caracteres especiais não escapados

**Solução**: Usar `escapeMarkdownV2()` em todas as strings dinâmicas

### DLQ crescendo

1. Verificar categorias de erro predominantes
2. Verificar status da API do Telegram
3. Retry manual via interface admin

---

*Última atualização: 2026-02-17*
