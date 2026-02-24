# Telegram Bot Notification System - Technical Fix Specification

> **Document Version:** 1.0  
> **Date:** 2026-02-13  
> **Project:** Meus Remédios v2.7.0  
> **Status:** Draft - Pending Review

---

## 1. Executive Summary

### Current State
The Telegram bot notification system has critical failures preventing alerts and scheduled reports from being delivered. While the infrastructure (cron-job.org, Vercel API, database tables) is operational, **notifications fail silently** due to a schema mismatch and architectural design flaws.

### Root Cause
The `notification_log` table requires `user_id` (NOT NULL), but [`logNotification()`](server/services/notificationDeduplicator.js:51) doesn't provide it, causing every INSERT to fail. Additionally, the deduplication logic incorrectly uses `protocol_id` for user-level alerts, breaking the deduplication mechanism entirely.

### Impact Assessment
| Component | Status | Impact |
|-----------|--------|--------|
| Dose Reminders | 🔴 Broken | INSERT failures every minute |
| Daily Digest | 🔴 Broken | No deduplication, sends duplicates |
| Stock Alerts | 🔴 Broken | No deduplication, sends duplicates |
| Titration Alerts | 🔴 Broken | INSERT failures when triggered |
| Weekly Reports | 🔴 Broken | No deduplication, sends duplicates |
| Monthly Reports | 🔴 Broken | No deduplication, sends duplicates |

### Business Impact
Users relying on medication reminders are **not receiving critical dose alerts**, potentially compromising treatment adherence. The application's core value proposition—reliable medication management—is compromised.

---

## 2. Detailed Issues Identified

### 2.1 Critical Bug: Schema Mismatch in `logNotification()`

**Location:** [`server/services/notificationDeduplicator.js`](server/services/notificationDeduplicator.js:51)

**Problem:**
```javascript
// Current (BROKEN):
export async function logNotification(protocolId, notificationType) {
  const { error } = await supabase
    .from('notification_log')
    .insert({
      protocol_id: protocolId,
      notification_type: notificationType
      // ❌ MISSING: user_id is NOT NULL in schema
    });
}
```

**Database Schema:**
```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- Required!
  protocol_id UUID REFERENCES protocols(id) ON DELETE CASCADE,         -- Nullable
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Impact:** Every call to `logNotification()` fails with:
```
ERROR: 23502: null value in column "user_id" of relation "notification_log" violates not-null constraint
```

---

### 2.2 Critical Bug: Incorrect Function Signature Design

**Location:** [`server/services/notificationDeduplicator.js`](server/services/notificationDeduplicator.js:12)

**Problem:** The function was designed assuming all notifications have a protocol:

```javascript
// Current signature (SEMANTICALLY WRONG for user-level alerts):
export async function shouldSendNotification(protocolId, notificationType)
```

**Usage in `tasks.js` (Lines 354, 458, 526, 655):**
```javascript
// Daily Digest - no protocol, but passing userId as protocolId:
const shouldSend = await shouldSendNotification(userId, 'daily_digest');

// This creates the query:
// SELECT * FROM notification_log 
// WHERE protocol_id = '<user-uuid>'  -- ❌ Wrong! This is a user ID
//   AND notification_type = 'daily_digest'
```

**Impact:** 
- Deduplication queries return incorrect results
- User-level alerts (daily_digest, stock_alert, etc.) may send duplicates
- Protocol-level alerts fail to find duplicates properly

---

### 2.3 Missing `logNotification()` Calls

**Location:** [`server/bot/tasks.js`](server/bot/tasks.js)

**Problem:** Several notification paths don't call `logNotification()` at all:

| Function | Line | Calls `logNotification()`? |
|----------|------|---------------------------|
| `checkUserReminders` | 188-317 | ❌ NO - only calls `shouldSendNotification()` which internally calls it |
| `runUserDailyDigest` | 345-396 | ❌ NO |
| `checkUserStockAlerts` | 416-469 | ❌ NO |
| `runUserWeeklyAdherenceReport` | 517-565 | ❌ NO |
| `checkUserTitrationAlerts` | 570-601 | ❌ NO |
| `runUserMonthlyReport` | 649-694 | ❌ NO |

**Note:** Only `checkUserReminders` goes through `shouldSendNotification()` which calls `logNotification()` internally. The other user-level functions call `shouldSendNotification()` but the logging is broken due to issue #2.2.

---

### 2.4 Silent Failures Throughout Pipeline

**Locations:** Multiple

**Current State:**
| Stage | Has Logging | Problem |
|-------|-------------|---------|
| User Discovery | ✅ Partial | Logs count, but not individual user processing |
| Protocol Check | ❌ None | No visibility into time matching logic |
| Deduplication | ✅ Error only | Logs errors but not skip reasons |
| Telegram Send | ✅ Error only | [`api/notify.js:25`](api/notify.js:25) logs errors but lacks context |
| Success Tracking | ❌ None | No confirmation of successful sends |

---

### 2.5 Architectural Debt: Dual-Mode Notification System

**Problem:** The system conflates two notification types:

1. **Protocol-Level Notifications:** Dose reminders, soft reminders, titration alerts (tied to specific protocols)
2. **User-Level Notifications:** Daily digest, stock alerts, weekly/monthly reports (aggregate user data)

**Current Design Flaw:**
- Single `notification_log` table expects `protocol_id` to be significant
- Deduplication logic treats all notifications the same
- No distinction between "per-protocol" and "per-user" deduplication windows

---

## 3. Fix Specifications

### 3.1 Fix: Update `notificationDeduplicator.js` Function Signatures

**File:** [`server/services/notificationDeduplicator.js`](server/services/notificationDeduplicator.js)

**Changes Required:**

#### A. Update `logNotification()` signature and implementation:

```javascript
/**
 * Log a notification as sent
 * @param {string} userId - User UUID (required)
 * @param {string|null} protocolId - Protocol UUID (optional, null for user-level alerts)
 * @param {string} notificationType - Notification type
 * @returns {Promise<boolean>} true if logged successfully
 */
export async function logNotification(userId, protocolId, notificationType) {
  if (!userId) {
    console.error('[Deduplicator] logNotification called without userId');
    return false;
  }

  try {
    const { error } = await supabase
      .from('notification_log')
      .insert({
        user_id: userId,
        protocol_id: protocolId,  // Can be null for user-level alerts
        notification_type: notificationType
      });

    if (error) {
      console.error('[Deduplicator] Error logging notification:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Deduplicator] Unexpected error in logNotification:', err);
    return false;
  }
}
```

#### B. Update `shouldSendNotification()` to accept `userId`:

```javascript
/**
 * Check if notification was recently sent and log if not
 * @param {string} userId - User UUID (required)
 * @param {string|null} protocolId - Protocol UUID (optional, null for user-level alerts)
 * @param {string} notificationType - Type: 'dose_reminder', 'daily_digest', etc.
 * @returns {Promise<boolean>} true if should send, false if duplicate
 */
export async function shouldSendNotification(userId, protocolId, notificationType) {
  if (!userId) {
    console.error('[Deduplicator] shouldSendNotification called without userId');
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
      console.error('[Deduplicator] Error checking notification log:', error);
      return true; // Fail open on error
    }

    // If we found a recent notification, this is a duplicate
    if (data) {
      console.log(`[Deduplicator] Skipping duplicate ${notificationType} for user ${userId}`);
      return false;
    }

    // Not a duplicate - log it and return true
    await logNotification(userId, protocolId, notificationType);
    return true;
  } catch (err) {
    console.error('[Deduplicator] Unexpected error:', err);
    return true; // Fail open
  }
}
```

---

### 3.2 Fix: Update All Call Sites in `tasks.js`

**File:** [`server/bot/tasks.js`](server/bot/tasks.js)

#### A. Update `checkUserReminders()` (Lines 188-317):

```javascript
// Line 258 - Change from:
const shouldSend = await shouldSendNotification(p.id, 'dose_reminder');

// To:
const shouldSend = await shouldSendNotification(userId, p.id, 'dose_reminder');
```

```javascript
// Line 280 - Change from:
const shouldSend = await shouldSendNotification(p.id, 'soft_reminder');

// To:
const shouldSend = await shouldSendNotification(userId, p.id, 'soft_reminder');
```

#### B. Update `runUserDailyDigest()` (Lines 345-396):

```javascript
// Line 354 - Change from:
const shouldSend = await shouldSendNotification(userId, 'daily_digest');

// To:
const shouldSend = await shouldSendNotification(userId, null, 'daily_digest');
```

#### C. Update `checkUserStockAlerts()` (Lines 416-469):

```javascript
// Line 458 - Change from:
const shouldSend = await shouldSendNotification(userId, 'stock_alert');

// To:
const shouldSend = await shouldSendNotification(userId, null, 'stock_alert');
```

#### D. Update `runUserWeeklyAdherenceReport()` (Lines 517-565):

```javascript
// Line 526 - Change from:
const shouldSend = await shouldSendNotification(userId, 'weekly_adherence');

// To:
const shouldSend = await shouldSendNotification(userId, null, 'weekly_adherence');
```

#### E. Update `checkUserTitrationAlerts()` (Lines 570-601):

```javascript
// Line 589 - Change from:
const shouldSend = await shouldSendNotification(protocol.id, 'titration_alert');

// To:
const shouldSend = await shouldSendNotification(userId, protocol.id, 'titration_alert');
```

#### F. Update `runUserMonthlyReport()` (Lines 649-694):

```javascript
// Line 655 - Change from:
const shouldSend = await shouldSendNotification(userId, 'monthly_report');

// To:
const shouldSend = await shouldSendNotification(userId, null, 'monthly_report');
```

---

### 3.3 Enhancement: Add Comprehensive Logging

**File:** [`server/bot/tasks.js`](server/bot/tasks.js)

Add structured logging throughout the notification pipeline:

#### A. In `checkUserReminders()`:

```javascript
// After line 256 (already taken check):
logger.debug(`Dose already taken`, { 
  userId, 
  medicine: p.medicine?.name, 
  time: currentHHMM,
  protocolId: p.id 
});

// After line 259 (deduplication check):
if (!shouldSend) {
  logger.debug(`Dose reminder suppressed by deduplication`, {
    userId,
    medicine: p.medicine?.name,
    time: currentHHMM,
    protocolId: p.id
  });
  continue;
}

// After line 262 (successful send):
logger.info(`Dose reminder sent`, { 
  userId, 
  medicine: p.medicine?.name, 
  time: currentHHMM,
  protocolId: p.id,
  chatId 
});

// After line 290 (soft reminder sent):
logger.info(`Soft reminder sent`, { 
  userId, 
  medicine: p.medicine?.name,
  protocolId: p.id,
  chatId 
});
```

#### B. Add summary logging at function exit:

```javascript
// At end of checkUserReminders():
logger.debug(`Completed reminder check for user`, { userId, protocolsChecked: protocols.length });
```

---

### 3.4 Enhancement: Add Delivery Confirmation Logging

**File:** [`api/notify.js`](api/notify.js)

```javascript
// Update sendMessage in createNotifyBotAdapter (Lines 34-36):
sendMessage: async (chatId, text, options = {}) => {
  try {
    const result = await telegramFetch('sendMessage', { chat_id: chatId, text, ...options });
    if (result) {
      logger.debug(`Telegram message sent successfully`, { chatId, messageId: result.message_id });
    } else {
      logger.error(`Telegram sendMessage failed`, { chatId });
    }
    return result;
  } catch (err) {
    logger.error(`Telegram sendMessage error`, err, { chatId });
    throw err;
  }
}
```

---

### 3.5 Enhancement: Add Health Check Endpoint

**File:** `api/notify.js` (Add new endpoint)

Add a health check endpoint to verify the notification system status:

```javascript
// Add to handler function, after auth check (around line 53):
if (req.url === '/api/notify/health') {
  const health = await getNotificationSystemHealth();
  return res.status(200).json(health);
}
```

**New file:** `server/services/notificationHealth.js`

```javascript
import { supabase } from './supabase.js';

export async function getNotificationSystemHealth() {
  const checks = {
    database: false,
    telegram: false,
    usersWithTelegram: 0,
    recentNotifications: 0,
    errors: []
  };

  // Check database connectivity
  try {
    const { data, error } = await supabase
      .from('notification_log')
      .select('id')
      .limit(1);
    
    if (!error) {
      checks.database = true;
    } else {
      checks.errors.push(`Database error: ${error.message}`);
    }
  } catch (err) {
    checks.errors.push(`Database exception: ${err.message}`);
  }

  // Check users with Telegram
  try {
    const { count, error } = await supabase
      .from('user_settings')
      .select('*', { count: 'exact', head: true })
      .not('telegram_chat_id', 'is', null);
    
    if (!error) {
      checks.usersWithTelegram = count || 0;
    }
  } catch (err) {
    checks.errors.push(`User count error: ${err.message}`);
  }

  // Check recent notifications (last hour)
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('notification_log')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', oneHourAgo);
    
    if (!error) {
      checks.recentNotifications = count || 0;
    }
  } catch (err) {
    checks.errors.push(`Notification count error: ${err.message}`);
  }

  // Check Telegram connectivity (lightweight)
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      checks.telegram = data.ok === true;
      if (!data.ok) {
        checks.errors.push(`Telegram API error: ${data.description}`);
      }
    } else {
      checks.errors.push('TELEGRAM_BOT_TOKEN not configured');
    }
  } catch (err) {
    checks.errors.push(`Telegram connection error: ${err.message}`);
  }

  const overallHealthy = checks.database && checks.telegram;
  
  return {
    status: overallHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  };
}
```

---

## 4. Refactoring Recommendations

### 4.1 Create `NotificationService` Abstraction

**New File:** `server/services/notificationService.js`

Encapsulate all notification logic to improve testability and maintainability:

```javascript
import { shouldSendNotification } from './notificationDeduplicator.js';
import { createLogger } from '../bot/logger.js';

const logger = createLogger('NotificationService');

export class NotificationService {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Send a notification with deduplication
   * @param {string} userId - User UUID
   * @param {string} chatId - Telegram chat ID
   * @param {string} message - Message text
   * @param {Object} options - Send options
   * @param {string} notificationType - Type for deduplication
   * @param {string|null} protocolId - Protocol ID (optional)
   * @returns {Promise<boolean>} Success status
   */
  async sendNotification(userId, chatId, message, options, notificationType, protocolId = null) {
    try {
      // Check deduplication
      const shouldSend = await shouldSendNotification(userId, protocolId, notificationType);
      if (!shouldSend) {
        logger.debug(`Notification suppressed by deduplication`, {
          userId,
          notificationType,
          protocolId
        });
        return false;
      }

      // Send message
      const result = await this.bot.sendMessage(chatId, message, options);
      
      if (result) {
        logger.info(`Notification sent successfully`, {
          userId,
          notificationType,
          protocolId,
          chatId,
          messageId: result.message_id
        });
        return true;
      } else {
        logger.error(`Failed to send notification`, {
          userId,
          notificationType,
          chatId
        });
        return false;
      }
    } catch (err) {
      logger.error(`Error sending notification`, err, {
        userId,
        notificationType,
        protocolId
      });
      return false;
    }
  }

  /**
   * Send dose reminder
   */
  async sendDoseReminder(userId, chatId, protocol, scheduledTime) {
    const message = formatDoseReminderMessage(protocol, scheduledTime);
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Tomar', callback_data: `take_:${protocol.id}:${protocol.dosage_per_intake}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${protocol.id}` },
        { text: '⏭️ Pular', callback_data: `skip_:${protocol.id}` }
      ]]
    };

    return this.sendNotification(
      userId,
      chatId,
      message,
      { parse_mode: 'MarkdownV2', reply_markup: keyboard },
      'dose_reminder',
      protocol.id
    );
  }

  /**
   * Send soft reminder
   */
  async sendSoftReminder(userId, chatId, protocol) {
    const message = formatSoftReminderMessage(protocol);
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Tomei', callback_data: `take_:${protocol.id}:${protocol.dosage_per_intake}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${protocol.id}` },
        { text: '⏭️ Pular', callback_data: `skip_:${protocol.id}` }
      ]]
    };

    return this.sendNotification(
      userId,
      chatId,
      message,
      { parse_mode: 'MarkdownV2', reply_markup: keyboard },
      'soft_reminder',
      protocol.id
    );
  }

  // ... additional methods for other notification types
}
```

### 4.2 Extract Message Formatters

**New File:** `server/bot/messageFormatters.js`

Move all message formatting logic to a dedicated module for better separation of concerns and testability:

```javascript
// Move from tasks.js:
// - escapeMarkdown()
// - formatDoseReminderMessage()
// - formatSoftReminderMessage()
// - formatStockAlertMessage()
// - formatTitrationAlertMessage()
// - formatDailyDigestMessage() [new]
// - formatWeeklyReportMessage() [new]
// - formatMonthlyReportMessage() [new]
```

---

## 5. Implementation Sequence

### Phase 1: Critical Fixes (Deploy Immediately)

1. **Update `notificationDeduplicator.js`**
   - Modify `logNotification()` to accept `userId`
   - Modify `shouldSendNotification()` to accept `userId`
   - Update query logic for protocol vs user-level notifications

2. **Update `tasks.js` Call Sites**
   - Update all 6 call sites with correct parameters
   - Add enhanced logging

3. **Deploy and Verify**
   - Run `npm run validate`
   - Deploy to Vercel
   - Check logs for "Dose reminder sent" messages

**Estimated Time:** 2 hours  
**Risk Level:** Low (straightforward signature changes)  
**Rollback:** Revert commit

---

### Phase 2: Observability Improvements

4. **Enhance Logging in `tasks.js`**
   - Add structured logging at all notification stages
   - Add summary statistics

5. **Enhance `api/notify.js`**
   - Add delivery confirmation logging
   - Improve error context

6. **Add Health Check Endpoint**
   - Create `notificationHealth.js`
   - Add `/api/notify/health` endpoint
   - Update cron-job.org to call health check

**Estimated Time:** 3 hours  
**Risk Level:** Low (additive changes only)  
**Rollback:** Revert commit

---

### Phase 3: Refactoring (Future Sprint)

7. **Create `NotificationService` Class**
   - Encapsulate notification logic
   - Improve testability

8. **Extract Message Formatters**
   - Move formatting logic to dedicated module
   - Add unit tests

9. **Add Unit Tests**
   - Test `notificationDeduplicator.js` with mocked Supabase
   - Test `NotificationService` with mocked bot
   - Test message formatters

**Estimated Time:** 8 hours  
**Risk Level:** Medium (structural changes)  
**Rollback:** Revert commit

---

## 6. Testing Strategy

### 6.1 Unit Tests

**New File:** `server/services/__tests__/notificationDeduplicator.test.js`

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldSendNotification, logNotification } from '../notificationDeduplicator.js';

// Mock Supabase
vi.mock('../supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis()
    }))
  }
}));

describe('notificationDeduplicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logNotification', () => {
    it('should log notification with userId and protocolId', async () => {
      // Test implementation
    });

    it('should log notification with userId and null protocolId', async () => {
      // Test implementation
    });

    it('should return false when userId is missing', async () => {
      const result = await logNotification(null, 'protocol-123', 'dose_reminder');
      expect(result).toBe(false);
    });
  });

  describe('shouldSendNotification', () => {
    it('should return true when no duplicate found (protocol-level)', async () => {
      // Test implementation
    });

    it('should return true when no duplicate found (user-level)', async () => {
      // Test implementation
    });

    it('should return false when duplicate exists', async () => {
      // Test implementation
    });

    it('should fail open on database error', async () => {
      // Test implementation
    });
  });
});
```

### 6.2 Integration Tests

**New File:** `server/bot/__tests__/tasks.integration.test.js`

Test the full notification flow with mocked external dependencies.

### 6.3 Manual Testing Checklist

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Dose Reminder | 1. Set protocol time to current minute<br>2. Wait for cron trigger | Message received, logged in `notification_log` |
| Deduplication | 1. Trigger same reminder twice<br>2. Check second is suppressed | Second message NOT sent |
| Daily Digest | 1. Set time to 23:00<br>2. Trigger cron | Digest received once per day |
| Stock Alert | 1. Set stock to 0<br>2. Trigger at 09:00 | Alert received |
| Error Handling | 1. Break database connection<br>2. Trigger notification | Error logged, continues processing other users |

---

## 7. Rollback Plan

### 7.1 Immediate Rollback (Critical Issues Post-Deploy)

If critical issues are detected after deployment:

```bash
# 1. Revert to last known good commit
git revert HEAD

# 2. Push to trigger redeploy
git push origin main

# 3. Verify rollback in Vercel logs
vercel logs --follow
```

### 7.2 Database Schema Rollback (If Needed)

If the fix requires schema changes that cause issues:

```sql
-- Make user_id nullable (emergency fallback)
ALTER TABLE notification_log ALTER COLUMN user_id DROP NOT NULL;
```

**Note:** This is a temporary measure. The proper fix is to provide `user_id` in the code.

### 7.3 Feature Flag Approach (Recommended for Future)

Consider adding a feature flag for notification deduplication:

```javascript
// In notificationDeduplicator.js
const DEDUPLICATION_ENABLED = process.env.ENABLE_NOTIFICATION_DEDUP !== 'false';

export async function shouldSendNotification(userId, protocolId, notificationType) {
  if (!DEDUPLICATION_ENABLED) {
    return true; // Always send if deduplication disabled
  }
  // ... normal logic
}
```

This allows immediate disable via environment variable without code changes.

---

## 8. Success Criteria

The fix is considered successful when:

| Criterion | Metric | Verification |
|-----------|--------|--------------|
| No INSERT errors | 0 errors in 24h | Check Vercel logs |
| Dose reminders sent | >0 per day per active user | Check `notification_log` |
| Deduplication working | 0 duplicates per user per 5min window | Check `notification_log` for same notification_type within 5min |
| Delivery confirmation | Log shows "sent successfully" | Check Vercel logs |
| No silent failures | All errors logged with context | Check Vercel logs |
| Health check passing | 200 OK from `/api/notify/health` | HTTP request |

---

## 9. Files to Modify

| File | Change Type | Lines | Description |
|------|-------------|-------|-------------|
| `server/services/notificationDeduplicator.js` | Modify | 12-62 | Fix function signatures and logic |
| `server/bot/tasks.js` | Modify | 258, 280, 354, 458, 526, 589, 655 | Update call sites |
| `server/bot/tasks.js` | Add | Multiple | Enhanced logging |
| `api/notify.js` | Modify | 34-36 | Add delivery confirmation logging |
| `api/notify.js` | Add | 53+ | Health check endpoint |
| `server/services/notificationHealth.js` | Create | New | Health check logic |
| `server/services/notificationService.js` | Create | New | Service abstraction (Phase 3) |
| `server/bot/messageFormatters.js` | Create | New | Message formatting (Phase 3) |

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missed call site update | Medium | High | Comprehensive code review, unit tests |
| Database connection issues | Low | High | Fail-open design, error logging |
| Telegram API rate limiting | Low | Medium | Deduplication, 5-min window |
| User confusion from duplicate sends | Low (after fix) | Medium | Deduplication, proper logging |
| Deployment failure | Low | Critical | Rollback plan, feature flags |

---

## 11. Appendix: Database Queries for Verification

Run these after deployment to verify the fix:

```sql
-- 1. Check recent notification log entries (should show user_id populated)
SELECT 
  user_id,
  protocol_id,
  notification_type,
  sent_at
FROM notification_log
ORDER BY sent_at DESC
LIMIT 20;

-- 2. Count notifications by type in last hour
SELECT 
  notification_type,
  COUNT(*) as count
FROM notification_log
WHERE sent_at >= NOW() - INTERVAL '1 hour'
GROUP BY notification_type;

-- 3. Check for duplicate notifications (should be 0 or very low)
SELECT 
  user_id,
  notification_type,
  protocol_id,
  COUNT(*) as duplicate_count
FROM notification_log
WHERE sent_at >= NOW() - INTERVAL '1 hour'
GROUP BY user_id, notification_type, protocol_id
HAVING COUNT(*) > 1;

-- 4. Verify users with Telegram integration
SELECT 
  us.user_id,
  us.telegram_chat_id,
  us.timezone,
  COUNT(nl.id) as notifications_sent_today
FROM user_settings us
LEFT JOIN notification_log nl ON us.user_id = nl.user_id 
  AND nl.sent_at >= CURRENT_DATE
WHERE us.telegram_chat_id IS NOT NULL
GROUP BY us.user_id, us.telegram_chat_id, us.timezone;
```

---

*End of Specification*
