# Telegram Notification System - Phase 1 (P0) Implementation Specification

> **Status:** READY FOR IMPLEMENTATION  
> **Branch:** `fix/telegram-p0-error-handling`  
> **Priority:** P0 - Critical  
> **Target:** Fix silent failures in notification system

---

## Executive Summary

This specification details the **Phase 1 (P0)** implementation of critical fixes for the Telegram notification system. The system currently has a fundamental error handling flaw that causes silent failures while falsely reporting success.

### Critical Issues Being Fixed

1. **Silent API Errors** - [`api/notify.js`](api/notify.js:24) logs errors but doesn't throw, returning `undefined`
2. **False Success Logging** - [`server/bot/tasks.js`](server/bot/tasks.js:269-281) logs "sent" and updates DB regardless of actual status
3. **Premature Deduplication** - [`notificationDeduplicator.js`](server/services/notificationDeduplicator.js:52) logs intent before actual send attempt
4. **Missing Status Tracking** - No `last_notification_status` column in database

### Success Criteria

- All Telegram API errors are properly propagated and handled
- Database `last_notified_at` is only updated on confirmed delivery
- Result object pattern used consistently across notification flow
- All 149 tests pass, lint clean, build succeeds

---

## Git Workflow (AGENTS.md Compliance)

### Branch Naming
```bash
fix/telegram-p0-error-handling
```

### Pre-Commit Validation Commands (MANDATORY)

```bash
# 1. Run linting
npm run lint
# Expected: 0 errors, 0 warnings

# 2. Run critical tests
npm run test:critical
# Expected: 149 tests passing

# 3. Build verification
npm run build
# Expected: Build successful

# Or use combined command:
npm run validate
```

### Commit Message Format (Portuguese Semantic)

```bash
# Pattern: type(scope): descrição em português
git commit -m "fix(api): adicionar throw em telegramFetch quando API retorna erro"
git commit -m "fix(bot): verificar resultado antes de atualizar last_notified_at"
git commit -m "fix(service): mover log de notificação para após envio confirmado"
git commit -m "feat(db): adicionar coluna status_notificacao em protocolos"
```

### PR Creation Steps

```bash
# 1. Push branch
git push origin fix/telegram-p0-error-handling

# 2. Create PR using template
gh pr create --title "fix(bot): corrige tratamento de erros em notificações Telegram" \
             --body-file docs/PULL_REQUEST_TEMPLATE.md
```

---

## Language Requirements (per AGENTS.md)

| Context | Language | Example |
|---------|----------|---------|
| **Variables, Functions** | English | `notificationResult`, `sendDoseNotification()` |
| **Comments** | Portuguese | `// Verifica se a notificação foi enviada com sucesso` |
| **Error Messages** | Portuguese | `'Falha ao enviar notificação'` |
| **Log Messages** | Portuguese | `logger.info('Notificação enviada', {...})` |
| **Database Columns** | Portuguese | `status_notificacao`, `mensagem_erro` |

---

## File-by-File Implementation Details

### 1. `api/notify.js` - Core Error Handling Fix

#### 1.1 Fix `telegramFetch` function (lines 16-31)

**Current (BROKEN):**
```javascript
const telegramFetch = async (method, body) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {...});
    const data = await res.json();
    if (!data.ok) {
      logger.error(`Telegram API Error (${method})`, null, { error: data });
      // MISSING: throw new Error()!
    }
    return data.result;  // Returns undefined when !data.ok
  } catch (err) {
    logger.error(`Fetch Error (${method})`, err);
    // Error swallowed!
  }
};
```

**Fixed:**
```javascript
const telegramFetch = async (method, body) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    
    if (!data.ok) {
      logger.error(`Erro na API do Telegram (${method})`, null, { error: data });
      throw new Error(`Erro Telegram API: ${data.error_code} - ${data.description}`);
    }
    
    return data.result;
  } catch (err) {
    logger.error(`Erro de fetch (${method})`, err);
    throw err;  // SEMPRE re-lançar o erro
  }
};
```

#### 1.2 Fix `sendMessage` with Result Object Pattern (lines 34-48)

**Current (BROKEN):**
```javascript
sendMessage: async (chatId, text, options = {}) => {
  try {
    const result = await telegramFetch('sendMessage', { chat_id: chatId, text, ...options });
    if (result) {
      logger.debug(`Telegram message sent successfully`, { chatId, messageId: result.message_id });
    } else {
      logger.error(`Telegram sendMessage failed`, { chatId });
    }
    return result;  // Returns undefined on failure!
  } catch (err) {
    logger.error(`Telegram sendMessage error`, err, { chatId });
    throw err;  // Throw is caught at line 28, not propagated!
  }
}
```

**Fixed:**
```javascript
sendMessage: async (chatId, text, options = {}) => {
  try {
    const result = await telegramFetch('sendMessage', { chat_id: chatId, text, ...options });
    
    logger.debug(`Mensagem Telegram enviada com sucesso`, { 
      chatId, 
      messageId: result.message_id 
    });
    
    return {
      success: true,
      messageId: result.message_id,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logger.error(`Falha ao enviar mensagem Telegram`, err, { chatId });
    
    return {
      success: false,
      error: {
        code: err.name || 'SEND_FAILED',
        message: err.message,
        retryable: isRetryableError(err)
      },
      timestamp: new Date().toISOString()
    };
  }
}
```

#### 1.3 Add Helper Function for Retryable Errors

Add at the end of `createNotifyBotAdapter` function (before return statement):

```javascript
/**
 * Verifica se um erro é passível de retry
 * @param {Error} error - Objeto de erro
 * @returns {boolean} true se o erro é transiente
 */
function isRetryableError(error) {
  const retryableCodes = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'Socket hang up',
    'ECONNABORTED',
    'Network Error'
  ];
  
  return retryableCodes.some(code => 
    error.message?.includes(code) || 
    error.code === code
  );
}
```

---

### 2. `server/bot/tasks.js` - Result Validation Before DB Update

#### 2.1 Update `sendDoseNotification` to Return Result (lines 163-180)

**Current:**
```javascript
async function sendDoseNotification(bot, chatId, p, scheduledTime) {
  const message = formatDoseReminderMessage(p, scheduledTime);

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Tomar', callback_data: `take_:${p.id}:${p.dosage_per_intake}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${p.id}` },
        { text: '⏭️ Pular', callback_data: `skip_:${p.id}` }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard
  });
}
```

**Fixed:**
```javascript
/**
 * Envia notificação de dose e retorna resultado
 * @param {object} bot - Bot adapter
 * @param {string} chatId - ID do chat Telegram
 * @param {object} p - Protocolo
 * @param {string} scheduledTime - Horário agendado (HH:MM)
 * @returns {Promise<NotificationResult>} Resultado da operação
 */
async function sendDoseNotification(bot, chatId, p, scheduledTime) {
  const message = formatDoseReminderMessage(p, scheduledTime);

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Tomar', callback_data: `take_:${p.id}:${p.dosage_per_intake}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${p.id}` },
        { text: '⏭️ Pular', callback_data: `skip_:${p.id}` }
      ]
    ]
  };

  try {
    const result = await bot.sendMessage(chatId, message, {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard
    });
    
    return result;
  } catch (err) {
    logger.error(`Erro ao enviar notificação de dose`, err, { 
      userId: p.user_id, 
      protocolId: p.id,
      chatId 
    });
    
    return {
      success: false,
      error: {
        code: err.name || 'NOTIFICATION_FAILED',
        message: err.message,
        retryable: false
      },
      timestamp: new Date().toISOString()
    };
  }
}
```

#### 2.2 Fix `checkUserReminders` to Check Result Before DB Update (lines 269-281)

**Current (BROKEN):**
```javascript
await sendDoseNotification(bot, chatId, p, currentHHMM);
logger.info(`Dose reminder sent`, {
  userId,
  medicine: p.medicine?.name,
  time: currentHHMM,
  protocolId: p.id,
  chatId
});

await supabase
  .from('protocols')
  .update({ last_notified_at: new Date().toISOString() })
  .eq('id', p.id);
```

**Fixed:**
```javascript
const notificationResult = await sendDoseNotification(bot, chatId, p, currentHHMM);

if (!notificationResult.success) {
  logger.error(`Falha ao enviar lembrete de dose`, {
    userId,
    medicine: p.medicine?.name,
    time: currentHHMM,
    protocolId: p.id,
    chatId,
    error: notificationResult.error
  });
  
  // Não atualiza last_notified_at em caso de falha
  continue;
}

logger.info(`Lembrete de dose enviado com sucesso`, {
  userId,
  medicine: p.medicine?.name,
  time: currentHHMM,
  protocolId: p.id,
  chatId,
  messageId: notificationResult.messageId
});

await supabase
  .from('protocols')
  .update({ 
    last_notified_at: new Date().toISOString(),
    status_ultima_notificacao: 'enviada'
  })
  .eq('id', p.id);
```

#### 2.3 Fix Soft Reminder Section (lines 310-337)

**Current:**
```javascript
if (!logs || logs.length === 0) {
  logger.info(`Soft reminder sent`, {...});
  
  const message = formatSoftReminderMessage(p);
  
  await bot.sendMessage(chatId, message, {...});

  await supabase
    .from('protocols')
    .update({ last_soft_reminder_at: new Date().toISOString() })
    .eq('id', p.id);
}
```

**Fixed:**
```javascript
if (!logs || logs.length === 0) {
  const message = formatSoftReminderMessage(p);
  
  const result = await bot.sendMessage(chatId, message, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Tomei', callback_data: `take_:${p.id}:${p.dosage_per_intake}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${p.id}` },
        { text: '⏭️ Pular', callback_data: `skip_:${p.id}` }
      ]]
    }
  });
  
  if (!result.success) {
    logger.error(`Falha ao enviar soft reminder`, {
      userId,
      medicine: p.medicine?.name,
      protocolId: p.id,
      chatId,
      error: result.error
    });
    continue;
  }
  
  logger.info(`Soft reminder enviado com sucesso`, {
    userId,
    medicine: p.medicine?.name,
    protocolId: p.id,
    chatId,
    messageId: result.messageId
  });

  await supabase
    .from('protocols')
    .update({ last_soft_reminder_at: new Date().toISOString() })
    .eq('id', p.id);
}
```

---

### 3. `server/services/notificationDeduplicator.js` - Fix Deduplication Order

#### 3.1 Refactor `shouldSendNotification` (lines 13-58)

**Current (BROKEN):**
```javascript
export async function shouldSendNotification(userId, protocolId, notificationType) {
  // ... checks notification_log for recent entries
  
  // Not a duplicate - log it and return true
  const loggedSuccessfully = await logNotification(userId, protocolId, notificationType);
  return loggedSuccessfully;  // Logs BEFORE actual send!
}
```

**Fixed:**
```javascript
/**
 * Verifica se a notificação deve ser enviada (sem duplicatas)
 * NÃO mais loga automaticamente - o log deve ser feito APÓS envio confirmado
 * @param {string} userId - UUID do usuário (obrigatório)
 * @param {string|null} protocolId - UUID do protocolo (opcional)
 * @param {string} notificationType - Tipo: 'dose_reminder', 'daily_digest', etc.
 * @returns {Promise<boolean>} true se deve enviar, false se duplicado
 */
export async function shouldSendNotification(userId, protocolId, notificationType) {
  if (!userId) {
    console.error('[Deduplicator] shouldSendNotification chamado sem userId');
    return true; // Fail open
  }

  const cutoffTime = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();

  try {
    // Build query based on notification type
    let query = supabase
      .from('notification_log')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_type', notificationType)
      .gte('sent_at', cutoffTime)
      .limit(1);
    
    // Add protocol filter only for protocol-level notifications
    if (protocolId) {
      query = query.eq('protocol_id', protocolId);
    } else {
      query = query.is('protocol_id', null);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Deduplicator] Erro ao verificar log de notificação:', error);
      return true; // Fail open on error
    }

    // If we found a recent notification, this is a duplicate
    if (data) {
      console.log(`[Deduplicator] Ignorando duplicata ${notificationType} para usuário ${userId}`);
      return false;
    }

    // Not a duplicate - return true (but DON'T log yet)
    return true;
  } catch (err) {
    console.error('[Deduplicator] Erro inesperado:', err);
    return true; // Fail open
  }
}
```

#### 3.2 Add New Function for Post-Send Logging (after line 92)

Add new function after `logNotification`:

```javascript
/**
 * Loga uma notificação como enviada com sucesso
 * Deve ser chamado APÓS confirmação de envio pelo Telegram
 * @param {string} userId - UUID do usuário (obrigatório)
 * @param {string|null} protocolId - UUID do protocolo (opcional)
 * @param {string} notificationType - Tipo de notificação
 * @param {object} metadata - Metadados adicionais (messageId, etc)
 * @returns {Promise<boolean>} true se logado com sucesso
 */
export async function logSuccessfulNotification(userId, protocolId, notificationType, metadata = {}) {
  if (!userId) {
    console.error('[Deduplicator] logSuccessfulNotification chamado sem userId');
    return false;
  }

  try {
    const { error } = await supabase
      .from('notification_log')
      .insert({
        user_id: userId,
        protocol_id: protocolId,
        notification_type: notificationType,
        status: 'enviada',
        telegram_message_id: metadata.messageId || null
      });

    if (error) {
      console.error('[Deduplicator] Erro ao logar notificação:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Deduplicator] Erro inesperado em logSuccessfulNotification:', err);
    return false;
  }
}
```

#### 3.3 Update Log Function to Support Status (line 67-92)

Update `logNotification` to include status parameter:

```javascript
/**
 * Loga uma notificação (função legada - usar logSuccessfulNotification)
 * @deprecated Use logSuccessfulNotification após envio confirmado
 */
export async function logNotification(userId, protocolId, notificationType, status = 'enviada') {
  if (!userId) {
    console.error('[Deduplicator] logNotification chamado sem userId');
    return false;
  }

  try {
    const { error } = await supabase
      .from('notification_log')
      .insert({
        user_id: userId,
        protocol_id: protocolId,
        notification_type: notificationType,
        status: status
      });

    if (error) {
      console.error('[Deduplicator] Erro ao logar notificação:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Deduplicator] Erro inesperado em logNotification:', err);
    return false;
  }
}
```

---

## Database Migration Specification

### Migration File: `.migrations/add_notification_status.sql`

```sql
-- Migration: Add notification status tracking to protocols
-- Phase 1 (P0): Critical status tracking
-- Created: 2026-02-15

-- Add status column to protocols table
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS status_ultima_notificacao VARCHAR(20) 
  CHECK (status_ultima_notificacao IN ('pendente', 'enviada', 'falhou', 'tentando_novamente'));

-- Add comment explaining the column
COMMENT ON COLUMN protocols.status_ultima_notificacao IS 'Status da última notificação enviada: pendente, enviada, falhou, tentando_novamente';

-- Add status column to notification_log table
ALTER TABLE notification_log 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'enviada'
  CHECK (status IN ('pendente', 'enviada', 'falhou', 'entregue'));

-- Add Telegram message ID for tracking
ALTER TABLE notification_log 
ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

-- Add error message for failed notifications
ALTER TABLE notification_log 
ADD COLUMN IF NOT EXISTS mensagem_erro TEXT;

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_protocols_notification_status 
  ON protocols(status_ultima_notificacao) 
  WHERE status_ultima_notificacao IS NOT NULL;

-- Create index for notification log status
CREATE INDEX IF NOT EXISTS idx_notification_log_status 
  ON notification_log(status, sent_at);
```

---

## Testing Validation Checklist

### Pre-Implementation Baseline

```bash
# Record current state
npm run test:critical 2>&1 | tail -20
npm run lint 2>&1 | tail -10
npm run build 2>&1 | tail -10
```

### Post-Implementation Validation

```bash
# 1. Critical Tests - MUST PASS
npm run test:critical
# Expected: 149 tests passing

# 2. Lint - MUST PASS (0 errors)
npm run lint

# 3. Build - MUST SUCCEED
npm run build

# 4. Smoke Tests (if available)
npm run test:smoke
```

### Manual Verification Steps

1. **Test Error Handling:**
   ```javascript
   // Simulate Telegram API error in dev
   // Verify error is thrown and caught properly
   ```

2. **Test Result Pattern:**
   ```javascript
   // Verify sendMessage returns {success, messageId, timestamp} on success
   // Verify sendMessage returns {success: false, error, timestamp} on failure
   ```

3. **Test DB Update Logic:**
   ```javascript
   // Verify last_notified_at only updates on success
   // Verify status_ultima_notificacao is set correctly
   ```

---

## PR Template Filled Example

### PR Title
```
fix(bot): corrige tratamento de erros em notificações Telegram
```

### PR Body

```markdown
## 🎯 Resumo

Esta PR corrige falhas críticas no sistema de notificações do Telegram onde erros eram silenciados e o banco de dados era atualizado mesmo quando mensagens falhavam ao ser enviadas.

---

## 📋 Tarefas Implementadas

### ✅ Tarefa 1.1 - Correção em `api/notify.js`
- [x] `telegramFetch` agora lança exceção quando API retorna `ok: false`
- [x] `sendMessage` retorna objeto de resultado com `{success, messageId, error}`
- [x] Adicionada função `isRetryableError()` para identificar erros transientes

### ✅ Tarefa 1.2 - Correção em `server/bot/tasks.js`
- [x] `sendDoseNotification` retorna resultado da operação
- [x] `checkUserReminders` verifica resultado antes de atualizar DB
- [x] Soft reminders também verificam resultado antes de atualizar

### ✅ Tarefa 1.3 - Correção em `notificationDeduplicator.js`
- [x] `shouldSendNotification` não mais loga automaticamente
- [x] Nova função `logSuccessfulNotification` para logar após envio confirmado
- [x] `logNotification` atualizada para suportar campo `status`

### ✅ Tarefa 1.4 - Migration de Banco de Dados
- [x] Adicionada coluna `status_ultima_notificacao` em `protocols`
- [x] Adicionadas colunas `status`, `telegram_message_id`, `mensagem_erro` em `notification_log`
- [x] Criados índices para queries de status

---

## 📊 Métricas de Melhoria

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Erros silenciados | Sim | Não | Detecção 100% |
| DB atualizado em falha | Sim | Não | Consistência |
| Status de entrega | Não | Sim | Rastreabilidade |
| Retry automático | Não | Identificação | Preparado P1 |

---

## 🔧 Arquivos Principais

```
api/
└── notify.js                          # Error handling fixes

server/
├── bot/
│   └── tasks.js                       # Result validation
└── services/
    └── notificationDeduplicator.js    # Deduplication order fix

.migrations/
└── add_notification_status.sql        # DB schema changes
```

---

## ✅ Checklist de Verificação

### Código
- [x] Todos os testes passam (`npm run test:critical` - 149 tests)
- [x] Lint sem erros (`npm run lint`)
- [x] Build bem-sucedido (`npm run build`)
- [x] Nenhum `process.exit()` em funções serverless

### Funcionalidade
- [x] Erros da API Telegram são propagados corretamente
- [x] DB só atualiza `last_notified_at` em envio confirmado
- [x] Pattern de objeto de resultado aplicado consistentemente
- [x] Mensagens de log em português

### Padrões
- [x] Código em inglês (variáveis, funções)
- [x] Comentários em português
- [x] Mensagens de erro em português
- [x] Commits seguem padrão semântico

---

## 🚀 Como Testar

```bash
# 1. Executar testes
npm run test:critical

# 2. Verificar lint
npm run lint

# 3. Build de produção
npm run build

# 4. Testar localmente (simular erro na API)
# Modificar temporariamente o token para um inválido
# Verificar se erro é lançado e logado corretamente
```

---

## 🔗 Issues Relacionadas

- Fixes silent failures identified in architecture review
- Related to notification reliability improvements

---

## 📝 Notas para Reviewers

1. **Error Handling:** Foco no padrão de objeto de resultado em todos os pontos de envio
2. **DB Consistency:** Verificar que `last_notified_at` só atualiza em sucesso
3. **Logs:** Todas as mensagens devem estar em português
4. **Migrations:** Executar migration antes de testar funcionalidade

---

## 🏷️ Versão

**Tipo:** Patch (`2.7.0` → `2.7.1`)
**Tag sugerida:** `v2.7.1`

---

/cc @reviewers
```

---

## Implementation Order Recommendations

### Phase 1A - Database (First)
1. Create and run migration `.migrations/add_notification_status.sql`
2. Verify columns exist in Supabase dashboard

### Phase 1B - API Layer (Second)
1. Fix `api/notify.js` - `telegramFetch` error handling
2. Fix `api/notify.js` - `sendMessage` result object
3. Test with simulated API errors

### Phase 1C - Bot Logic (Third)
1. Update `server/bot/tasks.js` - `sendDoseNotification` return value
2. Update `server/bot/tasks.js` - result checking before DB update
3. Test end-to-end notification flow

### Phase 1D - Deduplication (Fourth)
1. Update `notificationDeduplicator.js` - remove premature logging
2. Add `logSuccessfulNotification` function
3. Test deduplication still works correctly

### Phase 1E - Validation (Final)
1. Run full test suite
2. Run lint
3. Run build
4. Create PR

---

## Rollback Plan

If issues arise in production:

```sql
-- Rollback migration (if needed)
ALTER TABLE protocols 
DROP COLUMN IF EXISTS status_ultima_notificacao;

ALTER TABLE notification_log 
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS telegram_message_id,
DROP COLUMN IF EXISTS mensagem_erro;
```

---

*Specification generated by Architect Mode - Ready for implementation*
