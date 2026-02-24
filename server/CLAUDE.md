# server/ — Telegram Bot

> Referencia para agentes trabalhando no bot Telegram.

## Estrutura

```
server/bot/
  tasks.js            # ~939 linhas — schedulers + message formatters (ARQUIVO PRINCIPAL)
  scheduler.js        # Cron scheduling
  bot-factory.js      # Instanciacao do bot
  health-check.js     # Monitoramento de saude
  logger.js           # Logging estruturado
  correlationLogger.js # UUID tracing para requests
  callbacks/          # Handlers de callback (botoes inline)
  commands/           # Handlers de comandos (/start, /status, etc.)
  middleware/         # Processamento de requests
  utils/              # Funcoes helper
```

## Message Formatter Pattern

```javascript
// server/bot/tasks.js — padrao para novas mensagens
function formatNovaAlertaMessage(data) {
  const name = escapeMarkdownV2(data.name || 'Medicamento')
  const dosage = escapeMarkdownV2(String(data.dosage ?? 1))

  let message = `💊 *Titulo da Mensagem*\n\n`
  message += `🩹 **${name}**\n`
  message += `📋 ${dosage} unidades\n`

  // Condicional
  if (data.notes) {
    const notes = escapeMarkdownV2(data.notes)
    message += `📝 ${notes}\n`
  }

  return message
}
```

## REGRAS CRITICAS

### MarkdownV2 Escaping
```javascript
// SEMPRE usar escapeMarkdownV2() para TODA string de usuario
// Ordem de escape: backslash PRIMEIRO, depois outros caracteres
const safe = escapeMarkdownV2(unsafeString)
```

### Callback Data
```javascript
// MAXIMO 64 bytes — usar indices numericos, NUNCA UUIDs
// CORRETO
const callbackData = `reg_med:${index}`          // ~12 bytes
const callbackData = `confirm:${protocolIndex}`   // ~12 bytes

// ERRADO — excede 64 bytes
const callbackData = `register:${uuid}`           // ~45+ bytes
```

### Session
```javascript
// SEMPRE obter session e userId dinamicamente
const session = await getSession(chatId)
const userId = session.get('userId')
// NUNCA hardcodar userId
```

### Notificacoes
```javascript
// shouldSendNotification() ja faz log internamente
// NUNCA chamar logNotification() DEPOIS de shouldSendNotification()
if (await shouldSendNotification(userId, type, protocolId)) {
  await sendMessage(chatId, message)
  // NAO chamar logNotification() aqui — ja foi feito
}
```

### Deduplicacao
```javascript
// Usar notificationDeduplicator para evitar notificacoes duplicadas
// Tipos existentes: 'dose_reminder', 'stock_alert', 'soft_reminder', etc.
// Para novos tipos: adicionar ao deduplicator com novo tipo string
```

## Formatadores Existentes

| Funcao | Tipo | Descricao |
|--------|------|-----------|
| `formatDoseReminderMessage` | Dose reminder | Lembrete de dose com medicamento, dosagem, horario |
| `formatSoftReminderMessage` | Soft reminder | Lembrete suave para dose perdida |
| `formatStockAlertMessage` | Stock alert | Alerta de estoque baixo/zerado |
| `formatTitrationMessage` | Titulation | Notificacao de mudanca de titulacao |
| `formatDailyDigestMessage` | Digest | Resumo diario |
| `formatWeeklyReportMessage` | Report | Relatorio semanal de adesao |
| `formatMonthlyReportMessage` | Report | Relatorio mensal |

## Comandos do Bot

| Comando | Descricao |
|---------|-----------|
| `/start` | Iniciar bot + configurar conta |
| `/status` | Status geral (adesao, estoque) |
| `/estoque` | Ver estoque de medicamentos |
| `/hoje` | Doses de hoje |
| `/proxima` | Proxima dose programada |
| `/historico` | Historico recente de doses |
| `/registrar` | Registrar dose tomada |
| `/adicionar_estoque` | Adicionar estoque |

## Para Adicionar Novo Tipo de Notificacao

1. Criar formatter em `tasks.js` seguindo o padrao acima
2. Adicionar novo tipo ao `notificationDeduplicator`
3. Criar funcao `sendNovaNotificacao()` que:
   - Chama `shouldSendNotification(userId, 'novo_tipo', entityId)`
   - Formata mensagem com `formatNovaMessage()`
   - Envia com `bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' })`
   - Wrapa resultado com `wrapSendMessageResult(result, correlationId)`
4. Integrar na schedule do cron (`api/notify.js`) ou no scheduler
5. Adicionar testes em `server/bot/__tests__/`
