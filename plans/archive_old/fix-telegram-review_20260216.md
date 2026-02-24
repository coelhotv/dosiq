## Análise Completa e Planos Criados

### 1. Problema Identificado (P0 - Bloqueante)

**Erro Vercel:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/bot/retryManager.js'
```

**Causa Raiz:** O arquivo [`server/bot/tasks.js`](server/bot/tasks.js:3) importa `sendWithRetry` de `./retryManager.js` que **não existe**. O P1 foi parcialmente implementado e depois revertido, mas o import ficou órfão.

### 2. Planos Criados

#### Plano P0 - Correção Imediata
**Arquivo:** [`plans/TELEGRAM_BOT_FIX_PLAN.md`](plans/TELEGRAM_BOT_FIX_PLAN.md)

**Solução:** Remover o import de `retryManager.js` e usar `bot.sendMessage()` diretamente. O bot adapter em [`api/notify.js`](api/notify.js:60-89) já retorna result objects com error handling adequado.

**Mudanças necessárias:**
- Remover linha 3 de `tasks.js`: `import { sendWithRetry } from './retryManager.js'`
- Simplificar `sendDoseNotification()` para usar `bot.sendMessage()` diretamente
- Simplificar soft reminder send (linha ~448)

#### Plano P1 Simplificado
**Arquivo:** [`plans/TELEGRAM_P1_SIMPLIFIED_PLAN.md`](plans/TELEGRAM_P1_SIMPLIFIED_PLAN.md)

**Abordagem:** Ao invés do retry complexo do plano original, propor:
- **P1A:** Interface admin para DLQ (4h)
- **P1B:** Digest diário de falhas (2h)
- **P1C:** Retry simples de 2 tentativas no bot adapter (2h, opcional)

**Esforço total:** 7-9h (vs 20+ horas do plano original)

### 3. Lições Aprendidas do P1 Original

| Problema | Impacto | Prevenção |
|----------|---------|-----------|
| `retryManager.js` nunca foi criado | Production outage | Validar imports antes de commit |
| Over-engineering | Agent context loss | Começar simples, adicionar complexidade incrementalmente |
| Rollback incompleto | Build failure | Sempre validar com `npm run build` |

### 4. O que Manter vs Remover

| Componente | Status | Ação |
|------------|--------|------|
| `correlationLogger.js` | ✅ Funcionando | Manter |
| `deadLetterQueue.js` | ✅ Funcionando | Manter |
| `notificationDeduplicator.js` | ✅ Funcionando | Manter |
| `protocolCache.js` | ✅ Funcionando | Manter |
| `retryManager.js` | ❌ Não existe | Remover import |

### 5. Próximos Passos

1. **IMEDIATO:** Switch para Code mode e implementar P0 fix
2. **Validar:** `npm run validate` antes de commit
3. **Deploy:** `vercel --prod` e monitorar logs
4. **P1:** Implementar DLQ admin interface após P0 estável

### 6. Workflow Git Obrigatório

```bash
git checkout main && git pull origin main
git checkout -b fix/telegram-retrymanager-missing
# Fazer mudanças
npm run validate  # lint + test:critical + build
git commit -m "fix(bot): remover dependência de retryManager inexistente"
git push origin fix/telegram-retrymanager-missing
# Criar PR, aguardar review, merge com --no-ff
```

A memória do projeto foi atualizada em [`.roo/rules/memory.md`](.roo/rules/memory.md) com esta entrada.