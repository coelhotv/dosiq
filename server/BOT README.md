# 🤖 Dosiq Telegram Bot - Developer Guide

Este guia é focado no desenvolvimento local e na estrutura técnica do bot Telegram do Dosiq.

Para detalhes sobre a arquitetura do sistema de notificações, consulte:
👉 [`docs/architecture/NOTIFICATIONS.md`](../docs/architecture/NOTIFICATIONS.md)

---

## 📁 Estrutura de Pastas

```
server/bot/
├── commands/               # Handlers para comandos (/start, /status, etc.)
│   ├── start.js           # Vinculação de conta
│   ├── status.js          # Resumo de protocolos
│   ├── hoje.js            # Cronograma diário
│   └── registrar.js       # Registro interativo de dose
├── callbacks/
│   └── doseActions.js     # Handlers para botões de notificação (Tomar/Pular)
├── tasks.js               # Lógica de tarefas agendadas (reminders, reports)
├── bot-factory.js         # Instanciação do bot (Telegraf)
└── logger.js              # Logger estruturado para o bot
```

## 🚀 Desenvolvimento Local

Para rodar o bot localmente, você precisa de um token de bot do Telegram (`@BotFather`).

1. Certifique-se de que o `.env` na raiz tem `TELEGRAM_BOT_TOKEN`.
2. Execute o comando:
   ```bash
   npm run bot
   ```

O bot iniciará em modo de **polling** localmente, ignorando os webhooks da Vercel.

## 🧪 Testando Tarefas Agendadas

Como o bot local não roda o cron da Vercel automaticamente, você pode testar as funções de `tasks.js` chamando-as diretamente em um script de teste ou modificando temporariamente o `index.js`.

Funções principais para teste:
- `checkRemindersViaDispatcher()`: Simula o cron de lembretes de dose.
- `runDailyAdherenceReportViaDispatcher()`: Simula o relatório de adesão.
- `checkStockAlertsViaDispatcher()`: Simula os alertas de estoque.

## 📝 Convenções Técnicas

1. **MarkdownV2**: O Telegram exige escape de caracteres especiais. Use `escapeMarkdownV2()` de `server/utils/formatters.js` em todas as strings dinâmicas.
2. **Atomic Logs**: Sempre use os serviços em `src/shared/services/` para garantir que as mutações de banco (logs de dose, estoque) sejam transacionais.
3. **Correlation ID**: Todos os logs do bot incluem um `correlationId` para facilitar o rastreamento de fluxos complexos.
