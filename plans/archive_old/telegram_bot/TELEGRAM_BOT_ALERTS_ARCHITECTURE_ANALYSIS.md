# Telegram Bot Alerts & Reports System Architecture Analysis

> **Date:** 2026-02-13  
> **Analyst:** AI Code Assistant  
> **Project:** Meus Remédios v2.7.0

---

## Executive Summary

The alerts infrastructure is **confirmed working** - cron-job.org is calling `/api/notify` every minute successfully (200 OK), and all environment variables are configured.

**The root cause is identified:** The `notificationDeduplicator.js` references a table `notification_log` that has a **schema mismatch** - the table requires `user_id` (NOT NULL), but the code doesn't provide it during INSERT operations.

Additionally, **silent failures** in the notification chain and lack of visibility into execution flow are preventing alerts from being delivered.

---

## 1. Confirmed Working Infrastructure

✅ **cron-job.org**: Executing every minute successfully (200 OK, ~2s response time)  
✅ **Vercel Environment**: All required variables configured (`TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, etc.)  
✅ **API Endpoint**: `/api/notify` returning 200 with `{"status":"ok","executed":["reminders"],"time":"HH:MM"}`  
✅ **Database Tables**: `notification_log`, `bot_sessions`, `user_settings` exist  

---

## 2. Critical Issue #1: Schema Mismatch in `notification_log`

### The Problem

**Table Schema** (from migration):
```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- ❌ REQUIRED
  protocol_id UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Code in** `server/services/notificationDeduplicator.js` (lines 51-57):
```javascript
export async function logNotification(protocolId, notificationType) {
  const { error } = await supabase
    .from('notification_log')
    .insert({
      protocol_id: protocolId,
      notification_type: notificationType
      // ❌ MISSING: user_id is required but not provided!
    });
  // ...
}
```

**Impact:**
- INSERT fails every time due to `NOT NULL` constraint violation
- `logNotification()` fails silently (only logs to console)
- Notifications may still send ("fail open" in `shouldSendNotification()`), but deduplication is broken
- Each cron call retries failed INSERTs, causing unnecessary database errors

---

## 3. Critical Issue #2: Silent Failures & Missing Visibility

### Problem: No Execution Flow Logging

The notification pipeline has **no visibility points**:

| Stage | Current Behavior | Problem |
|-------|-----------------|---------|
| **User Discovery** | Silent if 0 users | Don't know if users are found |
| **Protocol Check** | Silent if no matches | Don't know if time schedules match |
| **Deduplication** | Silent on skip | Don't know why notifications skipped |
| **Telegram Send** | Silent on failure | Don't know if Telegram API failed |
| **Success** | No confirmation | Don't know if anything was sent |

### Evidence from Code

**`server/bot/tasks.js`** - No user count logging:
```javascript
export async function checkReminders(bot) {
  const users = await getAllUsersWithTelegram();
  // ❌ No log of how many users found
  for (const user of users) {
    await checkUserReminders(bot, user.user_id, user.telegram_chat_id);
  }
}
```

**`api/notify.js`** - Bot adapter has no error handling:
```javascript
sendMessage: async (chatId, text, options = {}) => {
  return telegramFetch('sendMessage', { chat_id: chatId, text, ...options });
  // ❌ No error handling, no logging of failures
}
```

---

## 4. Critical Issue #3: Potential No Users with Telegram Linked

### The Data Chain

```
cron-job.org → /api/notify → checkReminders() 
  → getAllUsersWithTelegram() 
    → SELECT * FROM user_settings WHERE telegram_chat_id IS NOT NULL
```

**If this query returns 0 rows:**
- Function exits silently
- No notifications sent
- No errors logged
- Appears as "working" in logs (200 OK)

**Users must complete these steps to receive alerts:**
1. Open web app → Settings → Telegram Integration
2. Copy verification token
3. Send `/start <token>` to bot
4. Bot saves `telegram_chat_id` to `user_settings`

---

## 5. Alert Generation Architecture

### Data Flow Diagram

```
cron-job.org (Every Minute)
    ↓
GET /api/notify
    ↓
api/notify.js - Auth check (CRON_SECRET)
    ↓
Execute Tasks:
    ├─ checkReminders() [Always]
    ├─ runDailyDigest() [23:00 daily]
    ├─ checkStockAlerts() [09:00 daily]
    ├─ checkTitrationAlerts() [08:00 daily]
    ├─ checkAdherenceReports() [Sundays 23:00]
    └─ checkMonthlyReport() [1st @ 10:00]
    ↓
getAllUsersWithTelegram()
    ↓
Query: SELECT * FROM user_settings WHERE telegram_chat_id IS NOT NULL
    ↓
{Users Found?} ──No──→ [Silent Exit - No logs]
    │
    Yes
    ↓
For each user:
    ↓
checkUserReminders(bot, userId, chatId)
    ↓
getActiveProtocols(userId)
    ↓
Check time_schedule matches current time
    ↓
{Time Matches?} ──No──→ [Skip - no log]
    │
    Yes
    ↓
shouldSendNotification(protocolId, type)
    ↓
Query notification_log (deduplication)
    ↓
{Duplicate?} ──Yes──→ [Skip - logged]
    │
    No
    ↓
Send Telegram Message
    ↓
logNotification(protocolId, type)
    ↓
INSERT notification_log
    ↓
❌ FAILS - user_id is NULL but required!
```

### Alert Types & Schedule

| Alert | Schedule | Function | Location |
|-------|----------|----------|----------|
| **Dose Reminders** | Every minute | `checkReminders()` | `server/bot/tasks.js:323` |
| **Daily Digest** | 23:00 daily | `runDailyDigest()` | `server/bot/tasks.js:401` |
| **Stock Alerts** | 09:00 daily | `checkStockAlerts()` | `server/bot/tasks.js:474` |
| **Titration Alerts** | 08:00 daily | `checkTitrationAlerts()` | `server/bot/tasks.js:606` |
| **Adherence Reports** | Sundays 23:00 | `checkAdherenceReports()` | `server/bot/tasks.js:490` |
| **Monthly Reports** | 1st @ 10:00 | `checkMonthlyReport()` | `server/bot/tasks.js:622` |

### Key Files

| File | Purpose |
|------|---------|
| `api/notify.js` | Serverless endpoint triggered by cron-job.org |
| `server/bot/tasks.js` | Core notification logic (checkReminders, etc.) |
| `server/bot/scheduler.js` | Local cron scheduler (unused on Vercel) |
| `server/bot/alerts.js` | Alert scheduling wrapper (unused on Vercel) |
| `server/services/protocolCache.js` | Caches protocols and user settings |
| `server/services/notificationDeduplicator.js` | Deduplication logic (BROKEN) |
| `api/telegram.js` | Webhook handler for bot commands |

---

## 6. Root Cause Summary

The alerts aren't being delivered due to a combination of:

1. **Schema Mismatch** - `logNotification()` fails every time because `user_id` is required but not provided
2. **Silent Failures** - No logging at critical stages to diagnose issues
3. **No User Visibility** - Unknown if users have Telegram linked
4. **Silent Telegram Errors** - Bot adapter doesn't log API failures

---

## 7. Immediate Fixes Required

### Fix #1: Update `logNotification()` to Include `user_id`

**File:** `server/services/notificationDeduplicator.js`

The function signature and calls need to change:

```javascript
// CURRENT (broken):
export async function logNotification(protocolId, notificationType) {
  const { error } = await supabase
    .from('notification_log')
    .insert({
      protocol_id: protocolId,
      notification_type: notificationType
    });
}

// REQUIRED (fix):
export async function logNotification(userId, protocolId, notificationType) {
  const { error } = await supabase
    .from('notification_log')
    .insert({
      user_id: userId,              // ✅ Add required field
      protocol_id: protocolId,
      notification_type: notificationType
    });
}
```

**All call sites must be updated:**
- `tasks.js:38` - `await logNotification(userId, p.id, 'dose_reminder')`
- `tasks.js:355` - `await logNotification(userId, null, 'daily_digest')`
- `tasks.js:458` - `await logNotification(userId, null, 'stock_alert')`
- `tasks.js:526` - `await logNotification(userId, null, 'weekly_adherence')`
- `tasks.js:589` - `await logNotification(userId, protocol.id, 'titration_alert')`
- `tasks.js:655` - `await logNotification(userId, null, 'monthly_report')`

**Note:** For alerts without a specific protocol (daily digest, stock, etc.), `protocol_id` should be `null` but `user_id` is still required.

### Fix #2: Add Execution Flow Logging

**In `server/bot/tasks.js`:**
```javascript
export async function checkReminders(bot) {
  logger.info('Starting reminder check');
  const users = await getAllUsersWithTelegram();
  
  if (users.length === 0) {
    logger.warn('No users with Telegram found');  // ✅ Add this
    return;
  }
  
  logger.info(`Found ${users.length} users with Telegram`);  // ✅ Add this
  
  for (const user of users) {
    logger.debug(`Checking user`, { userId: user.user_id });  // ✅ Add this
    await checkUserReminders(bot, user.user_id, user.telegram_chat_id);
  }
  
  logger.info('Reminder check completed');
}
```

**In `api/notify.js`:**
```javascript
sendMessage: async (chatId, text, options = {}) => {
  try {
    const result = await telegramFetch('sendMessage', { chat_id: chatId, text, ...options });
    if (!result) {
      logger.error('Telegram sendMessage failed', { chatId });  // ✅ Add this
    }
    return result;
  } catch (err) {
    logger.error('Telegram sendMessage error', err, { chatId });  // ✅ Add this
    throw err;
  }
}
```

### Fix #3: Update Deduplicator Function Signature

**In `server/bot/tasks.js` - Update all logNotification calls:**

```javascript
// Line 38 - After sending dose reminder
await logNotification(userId, p.id, 'dose_reminder');

// Line 355 - After daily digest
await logNotification(userId, null, 'daily_digest');

// Line 458 - After stock alert
await logNotification(userId, null, 'stock_alert');

// Line 526 - After weekly adherence
await logNotification(userId, null, 'weekly_adherence');

// Line 589 - After titration alert
await logNotification(userId, protocol.id, 'titration_alert');

// Line 655 - After monthly report
await logNotification(userId, null, 'monthly_report');
```

Also update `shouldSendNotification` calls to pass userId:
```javascript
// Change from:
const shouldSend = await shouldSendNotification(p.id, 'dose_reminder');

// To:
const shouldSend = await shouldSendNotification(userId, p.id, 'dose_reminder');
```

---

## 8. Diagnostic Queries

Run these in Supabase SQL Editor to verify current state:

```sql
-- 1. Check notification_log table structure
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'notification_log';

-- 2. Check if users have Telegram linked
SELECT COUNT(*) as linked_users 
FROM user_settings 
WHERE telegram_chat_id IS NOT NULL;

-- 3. List users with Telegram (for verification)
SELECT user_id, telegram_chat_id, timezone
FROM user_settings 
WHERE telegram_chat_id IS NOT NULL;

-- 4. Check active protocols with time schedules for linked users
SELECT 
  p.id as protocol_id, 
  p.time_schedule, 
  p.active, 
  p.dosage_per_intake,
  u.telegram_chat_id,
  u.user_id,
  u.timezone,
  m.name as medicine_name
FROM protocols p
JOIN user_settings u ON p.user_id = u.user_id
JOIN medicines m ON p.medicine_id = m.id
WHERE p.active = true 
  AND p.time_schedule IS NOT NULL
  AND u.telegram_chat_id IS NOT NULL;

-- 5. Check recent notification_log entries
SELECT * FROM notification_log 
ORDER BY sent_at DESC 
LIMIT 10;

-- 6. Check user_settings has timezone column
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_settings' AND column_name = 'timezone';

-- 7. Check for any errors in notification_log inserts (if logging added)
-- This will help verify the fix is working
```

---

## 9. Testing Steps After Fix

1. **Apply the code fixes** to `notificationDeduplicator.js` and `tasks.js`
2. **Deploy to Vercel**
3. **Run diagnostic queries** to verify users have Telegram linked
4. **Check Vercel logs** for new log messages:
   ```
   [INFO] Found N users with Telegram
   [INFO] Dose reminder sent {...}
   ```
5. **Manually trigger test** by setting a protocol's `time_schedule` to current time
6. **Verify Telegram message** is received

---

## 10. Summary Table

| Component | Status | Issue | Priority |
|-----------|--------|-------|----------|
| cron-job.org | ✅ Working | Calling every minute | - |
| Vercel Env | ✅ Working | All variables set | - |
| `/api/notify` | ✅ Working | Returns 200 OK | - |
| `notification_log` table | ✅ Exists | Schema correct | - |
| **`logNotification()`** | ❌ **BROKEN** | **Missing required `user_id`** | **URGENT** |
| `user_settings.timezone` | ✅ Exists | Added via migration | - |
| Execution logging | ❌ Missing | Can't diagnose flow | **HIGH** |
| Users with Telegram | 🔍 Unknown | May be 0 | **HIGH** |
| Telegram API errors | ❌ Silent | Failures not visible | **MEDIUM** |

---

## 11. Files to Modify

1. `server/services/notificationDeduplicator.js` - Fix function signatures
2. `server/bot/tasks.js` - Update all call sites, add logging
3. `api/notify.js` - Add error handling to bot adapter

---

## 12. Migration Verification

The following tables should exist (verify with `\dt` in Supabase):

- `notification_log` - For deduplication
- `bot_sessions` - For Telegram bot state
- `user_settings` - Should have `telegram_chat_id` and `timezone` columns
- `protocols` - Should have `time_schedule`, `active` columns
- `medicines` - Linked to protocols
- `medicine_logs` - For checking if doses already taken

---

*End of Analysis*
