# Telegram Bot Fix Plan - February 2026

**Date:** 2026-02-16  
**Status:** READY FOR IMPLEMENTATION  
**Priority:** P0 - Production Blocking  
**Branch:** `fix/telegram-retrymanager-missing`

---

## Executive Summary

### The Problem
Vercel deployment is failing with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/bot/retryManager.js' 
imported from /var/task/server/bot/tasks.js
```

### Root Cause
The P1 implementation was partially rolled back, but [`server/bot/tasks.js`](server/bot/tasks.js:3) still imports `sendWithRetry` from `./retryManager.js` which **does not exist**.

### Solution Strategy
**SIMPLIFY** - Remove the retry mechanism complexity and use direct `bot.sendMessage` calls. The bot adapter in [`api/notify.js`](api/notify.js:60-89) already has proper error handling that returns result objects.

---

## Part 1: Immediate Fix (P0 - Production Blocking)

### Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `server/bot/tasks.js` | Remove retryManager import, use direct sendMessage | 3, 189-211, 448-473 |

### Step-by-Step Fix

#### Step 1: Remove the missing import

**File:** [`server/bot/tasks.js`](server/bot/tasks.js:3)

```javascript
// REMOVE THIS LINE:
import { sendWithRetry } from './retryManager.js';
```

#### Step 2: Simplify sendDoseNotification function

**File:** [`server/bot/tasks.js`](server/bot/tasks.js:174-211)

**BEFORE:**
```javascript
async function sendDoseNotification(bot, chatId, p, scheduledTime) {
  const message = formatDoseReminderMessage(p, scheduledTime);
  const correlationId = getOrGenerateCorrelationId();

  const keyboard = { /* ... */ };

  // P1: Enviar com retry automático
  const result = await sendWithRetry(
    async () => {
      return await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
      });
    },
    {
      correlationId,
      userId: p.user_id,
      protocolId: p.id,
      notificationType: 'dose_reminder',
      chatId
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000
    }
  );
  
  return result;
}
```

**AFTER:**
```javascript
async function sendDoseNotification(bot, chatId, p, scheduledTime) {
  const message = formatDoseReminderMessage(p, scheduledTime);
  const correlationId = getOrGenerateCorrelationId();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Tomar', callback_data: `take_:${p.id}:${p.dosage_per_intake}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${p.id}` },
        { text: '⏭️ Pular', callback_data: `skip_:${p.id}` }
      ]
    ]
  };

  // Direct send - bot adapter already handles errors and returns result object
  const result = await bot.sendMessage(chatId, message, {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard
  });

  // Add correlationId to result for logging
  return {
    ...result,
    correlationId,
    attempts: 1,
    retried: false
  };
}
```

#### Step 3: Simplify soft reminder send (around line 448)

**File:** [`server/bot/tasks.js`](server/bot/tasks.js:448-473)

**BEFORE:**
```javascript
const result = await sendWithRetry(
  async () => {
    return await bot.sendMessage(chatId, message, {
      parse_mode: 'MarkdownV2',
      reply_markup: { /* ... */ }
    });
  },
  { correlationId, userId, protocolId: p.id, notificationType: 'soft_reminder', chatId },
  { maxRetries: 3, baseDelay: 1000, maxDelay: 30000 }
);
```

**AFTER:**
```javascript
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

// Add correlationId to result
const notificationResult = {
  ...result,
  correlationId,
  attempts: 1,
  retried: false
};
```

#### Step 4: Update error handling to use new result structure

The existing error handling code expects `result.success`, `result.error`, `result.attempts` which our simplified version provides.

---

## Part 2: Validation Steps

### Local Validation (MANDATORY before commit)

```bash
# 1. Lint check
npm run lint

# 2. Build check
npm run build

# 3. Critical tests
npm run test:critical

# 4. Combined validation
npm run validate
```

### Deployment Validation

```bash
# Deploy to Vercel
vercel --prod

# Check logs
vercel logs --follow

# Test the notify endpoint
curl -X GET "https://meus-remedios.vercel.app/api/notify" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Part 3: Simplified Architecture (Post-Fix)

### What We're Keeping

| Component | Status | Purpose |
|-----------|--------|---------|
| `correlationLogger.js` | ✅ Keep | Request tracing |
| `deadLetterQueue.js` | ✅ Keep | Failed notification storage |
| `notificationDeduplicator.js` | ✅ Keep | Prevent duplicate notifications |
| `protocolCache.js` | ✅ Keep | Cache protocols for performance |
| `retryManager.js` | ❌ Remove | Too complex, caused failures |

### Error Handling Flow (Simplified)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SIMPLIFIED ERROR HANDLING FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   tasks.js ──► bot.sendMessage() ──► Telegram API                          │
│                     │                                                        │
│                     ├──► Success: Log + Update last_notified_at            │
│                     │                                                        │
│                     └──► Failure: Enqueue to DLQ                            │
│                              │                                               │
│                              └──► Manual review via DLQ table               │
│                                                                             │
│   Key Insight: bot.sendMessage() in api/notify.js ALREADY returns          │
│   a result object with { success, error, messageId, timestamp }             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why This Is Better

1. **Fewer moving parts** - Less code = fewer bugs
2. **Same error visibility** - DLQ still captures failures
3. **Same deduplication** - Prevents duplicate notifications
4. **Same tracing** - Correlation IDs still work
5. **No retry complexity** - Retries can be added later if needed

---

## Part 4: Lessons Learned from P1 Failure

### What Went Wrong

1. **Over-engineering**: The retry mechanism was too complex for the actual requirements
2. **Missing file**: `retryManager.js` was never created or was deleted during rollback
3. **Incomplete rollback**: Import was left in `tasks.js` but file was removed
4. **Agent context loss**: Multiple failures caused loss of implementation context

### What We're Doing Differently

1. **Incremental changes**: Fix the immediate issue first, add features later
2. **Validate each step**: Run lint/build/test after each change
3. **Keep it simple**: Use existing error handling instead of adding new layers
4. **Document clearly**: This plan provides exact code changes

---

## Part 5: Git Workflow (MANDATORY)

### Branch Creation

```bash
# Start from updated main
git checkout main
git pull origin main

# Create fix branch
git checkout -b fix/telegram-retrymanager-missing
```

### Commit Format (Portuguese)

```bash
git commit -m "fix(bot): remover dependência de retryManager inexistente

- Remove import de retryManager.js que não existe
- Simplifica sendDoseNotification para usar bot.sendMessage diretamente
- Mantém error handling via DLQ e correlation IDs
- Bot adapter em api/notify.js já retorna result objects"
```

### Validation Before Push

```bash
# Run all validations
npm run validate

# If all pass, push
git push origin fix/telegram-retrymanager-missing
```

### Merge Process

```bash
# After PR approval
git checkout main
git pull origin main
git merge --no-ff fix/telegram-retrymanager-missing
git push origin main
git branch -d fix/telegram-retrymanager-missing
```

---

## Summary

| Issue | Status | Fix |
|-------|--------|-----|
| Missing `retryManager.js` | **P0 - Blocking** | Remove import, use direct sendMessage |
| Complex retry mechanism | Deferred | Simplify architecture, add later if needed |
| Incomplete rollback | Fixed | This plan completes the rollback |

**Next Action:** Switch to Code mode to implement the fix.

---

## Files Reference

| File | Purpose |
|------|---------|
| [`server/bot/tasks.js`](server/bot/tasks.js) | Main file to fix - remove retryManager import |
| [`api/notify.js`](api/notify.js) | Bot adapter with error handling |
| [`server/bot/correlationLogger.js`](server/bot/correlationLogger.js) | Keep - correlation ID tracking |
| [`server/services/deadLetterQueue.js`](server/services/deadLetterQueue.js) | Keep - failed notification storage |
| [`server/services/notificationDeduplicator.js`](server/services/notificationDeduplicator.js) | Keep - deduplication |
| [`server/services/protocolCache.js`](server/services/protocolCache.js) | Keep - caching |
