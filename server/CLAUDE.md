# server/ — Telegram Bot

> Referência para agentes trabalhando no bot Telegram.

## Estrutura (Pós-040 TypeScript)

```
server/bot/
  tasks.ts             # schedulers + message formatters (ARQUIVO PRINCIPAL)
  scheduler.ts         # Cron scheduling
  bot-factory.ts       # Instanciação do bot (Telegraf)
  health-check.ts      # Monitoramento de saúde e comandos /health
  logger.ts            # Logging estruturado
  correlationLogger.ts  # UUID tracing para requests
  alerts.ts            # Orquestrador de alertas inteligentes
  inlineQuery.ts       # Handlers de busca inline
  _adherenceHelpers.ts # Helpers internos de adesão
  _reminderHelpers.ts  # Helpers internos de lembretes
  callbacks/           # Handlers de callback (botões inline)
  commands/            # Handlers de comandos (/start, /status, etc.)
  middleware/          # Processamento de requests e sessões
  utils/               # Funções helper (formatação de datas, etc.)
```

## Regra de Resolução ESM (CRÍTICO)

> [!IMPORTANT]
> **Extensões de Import ESM**: O projeto usa a resolução ESM padrão do Node.js (`node16`/`nodenext`). Isso exige que todos os imports relativos dentro de `server/` **devem obrigatoriamente** incluir a extensão `.js` no caminho do import, mesmo que o arquivo físico no disco seja `.ts`.
>
> **Exemplo correto**: `import { escapeMarkdownV2 } from './utils/formatters.js'`  
> **Exemplo incorreto**: `import { escapeMarkdownV2 } from './utils/formatters'` (isso causará quebra de execução do servidor).

---

## Message Formatter Pattern (TypeScript)

```typescript
import { escapeMarkdownV2 } from './utils/formatters.js'

interface NovaAlertaData {
  name?: string;
  dosage?: number;
  notes?: string;
}

function formatNovaAlertaMessage(data: NovaAlertaData): string {
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

---

## REGRAS CRÍTICAS

### MarkdownV2 Escaping
```typescript
// SEMPRE usar escapeMarkdownV2() para TODA string que venha do banco ou input do usuário
// Ordem de escape interna: backslash PRIMEIRO, depois outros caracteres especiais
const safe = escapeMarkdownV2(unsafeString)
```

### Callback Data (Max 64 Bytes)
```typescript
// O payload de botões inline do Telegram tem limite de 64 bytes.
// Usar índices numéricos e strings de identificação curtas. NUNCA passar UUIDs diretamente.
const callbackData = `reg_med:${index}`          // Correto (~12 bytes)
const callbackData = `confirm:${protocolIndex}`   // Correto (~12 bytes)
```

### Session
```typescript
// SEMPRE obter session e userId de forma dinâmica a partir da biblioteca de contexto
const session = await getSession(chatId)
const userId = session.get('userId')
// NUNCA hardcodar ou assumir userId global
```

### Notificações e Deduplicação
```typescript
// shouldSendNotification() verifica limites e já realiza logs internos
// Evite chamadas duplicadas a logNotification() após a verificação de envio.
if (await shouldSendNotification(userId, type, protocolId)) {
  await sendMessage(chatId, message)
}
```

---

## Formatadores Existentes

| Função | Tipo de Mensagem | Descrição |
|--------|------------------|-----------|
| `formatDoseReminderMessage` | Lembrete de Dose | Medicamento, dosagem, horário e botões de ação |
| `formatSoftReminderMessage` | Lembrete Suave | Alerta sobre dose perdida recente (+15min) |
| `formatStockAlertMessage` | Alerta de Estoque | Notificação de estoque baixo ou zerado |
| `formatTitrationMessage` | Titulação | Instruções sobre mudança de fase de titulação |
| `formatDailyDigestMessage` | Daily Digest | Resumo diário de adesão do usuário |
| `formatWeeklyReportMessage` | Relatório Semanal | Estatísticas e gráficos de adesão semanais |
| `formatMonthlyReportMessage` | Relatório Mensal | Relatório completo de adesão do mês |

---

## Comandos do Bot

| Comando | Descrição |
|---------|-----------|
| `/start` | Iniciar interação com o bot + vincular conta Dosiq |
| `/status` | Status geral do tratamento e protocolos ativos |
| `/estoque` | Consulta de estoque atual de medicamentos |
| `/hoje` | Lista das doses programadas para o dia atual |
| `/proxima` | Consulta da próxima dose agendada |
| `/historico` | Histórico de doses tomadas recentemente |
| `/registrar` | Registro interativo de dose tomada retroativa |
| `/adicionar_estoque` | Adiciona estoque de forma interativa |

---

## Para Adicionar Novo Tipo de Notificação

1. Criar o formatador em `tasks.ts` seguindo o padrão tipado acima.
2. Adicionar o novo identificador de notificação ao `notificationDeduplicator` para prevenir envios redundantes.
3. Criar a lógica de envio:
   - Verificar permissão com `shouldSendNotification(userId, 'novo_tipo', entityId)`.
   - Gerar a mensagem formatada.
   - Enviar via `bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' })` com tratamento de erro.
4. Integrar o disparo na agenda cron (em `api/notify.ts`) ou nos schedulers correspondentes.
5. Adicionar testes unitários sob `server/bot/__tests__/`.

---

*Última atualização: 2026-07-09*
