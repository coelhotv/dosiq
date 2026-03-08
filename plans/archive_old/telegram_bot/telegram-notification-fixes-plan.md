# Telegram Notification System - Final Fix Plan

**Date:** 2026-02-15  
**Based on:** Vercel logs from 20:30 failure and codebase analysis  
**Status:** READY FOR IMPLEMENTATION

---

## Executive Summary

### Immediate Issue
The Vercel deployment is **stale** - running code without the `!` escape fix that already exists in the codebase at [`tasks.js:48`](server/bot/tasks.js:48).

### Root Causes Identified
1. **Markdown Escaping:** Code fix exists, deployment is stale
2. **DLQ Schema:** Missing UNIQUE constraint for upsert

---

## Issue 1: Markdown Escaping

### Current State (Verified from Codebase)

The [`escapeMarkdown()`](server/bot/tasks.js:28-49) function **already includes** `!` escaping:

```javascript
// server/bot/tasks.js:48
.replace(/!/g, '\\!')
```

### Problem
Vercel is running an **old deployment** that doesn't include this fix.

### Fix
**Simply redeploy to Vercel** to push the current codebase that includes the fix.

```bash
# Option 1: Push a minor change to trigger deploy
git add -A && git commit --amend --no-edit && git push -f

# Option 2: Use Vercel CLI
cd api && vercel --prod
```

---

## Issue 2: DLQ Schema Constraint

### Current State

**File:** [`server/services/deadLetterQueue.js:111`](server/services/deadLetterQueue.js:111)

```javascript
.onConflict: 'user_id,protocol_id,notification_type'
```

**Migration:** [`.migrations/add_dead_letter_queue.sql:57-59`](.migrations/add_dead_letter_queue.sql:57)

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_failed_notif_unique_pending
    ON failed_notification_queue(user_id, protocol_id, notification_type)
    WHERE status = 'pending';
```

### Root Cause
PostgreSQL requires a **UNIQUE constraint** (not just a partial unique index) for `ON CONFLICT` to work. The migration has a **partial index** with `WHERE status = 'pending'`, which doesn't satisfy the upsert requirement.

### Fix

#### Step 1: Create Migration
**File:** `.migrations/add_dlq_unique_constraint.sql`

```sql
-- Migration: Add UNIQUE constraint for DLQ upsert
-- Created: 2026-02-15
-- Prerequisites: Run after .migrations/add_dead_letter_queue.sql

-- Add UNIQUE constraint on correlation_id for upsert conflict resolution
-- This is required for the upsert() call in deadLetterQueue.js to work
ALTER TABLE failed_notification_queue 
ADD CONSTRAINT uq_failed_notification_queue_correlation_id UNIQUE (correlation_id);

-- Verify constraint was added
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_failed_notification_queue_correlation_id'
    ) THEN 
        RAISE NOTICE 'Constraint uq_failed_notification_queue_correlation_id added successfully';
    ELSE 
        RAISE EXCEPTION 'Constraint addition failed - check database connection';
    END IF;
END $$;
```

#### Step 2: Update Dead Letter Service
**File:** [`server/services/deadLetterQueue.js:111`](server/services/deadLetterQueue.js:111)

```javascript
// BEFORE:
onConflict: 'user_id,protocol_id,notification_type',

// AFTER:
onConflict: 'correlation_id',
```

**Rationale:** `correlation_id` is:
- Already `NOT NULL` in the schema
- Already has an index for lookups
- Unique identifier per notification attempt

---

## Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `.migrations/add_dlq_unique_constraint.sql` | **NEW FILE** | N/A |
| `server/services/deadLetterQueue.js` | Change `onConflict` | 111 |

---

## Validation Steps

### 1. Markdown Escape Verification
```bash
# Verify escapeMarkdown includes ! escape
grep -n "!.*\\\\\\\\!" server/bot/tasks.js
# Expected output: .replace(/!/g, '\\!')

# Or run:
node -e "
const fs = require('fs');
const code = fs.readFileSync('server/bot/tasks.js', 'utf8');
console.log('Has ! escape:', code.includes(\".replace(/!/g\"));
"
```

### 2. DLQ Schema Validation
```bash
# Check if constraint exists
psql "postgresql://your-connection-string" -c "
SELECT conname, contype FROM pg_constraint 
WHERE conname LIKE '%failed_notification%';
"

# Expected: uq_failed_notification_queue_correlation_id | u
```

### 3. Integration Test
```bash
# Trigger cron job
curl "https://your-app.vercel.app/api/notify"

# Check logs for success
vercel logs --mode=production
```

---

## Architecture Issues (Deferred to Phase 2)

While the immediate fixes resolve the 20:30 failure, the architecture review identified deeper issues:

1. **Silent failures** - System reports success when messages fail
2. **State inconsistency** - `last_notified_at` updated on attempt, not delivery
3. **No retry logic** - Transient failures aren't retried

These should be addressed in a **Phase 2** effort after the immediate fixes are deployed.

---

## Implementation Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         IMPLEMENTATION ORDER                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1️⃣  DEPLOY CURRENT CODE                                               │
│      └─→ Trigger Vercel redeploy                                       │
│      └─→ Verify escapeMarkdown fix is live                             │
│                                                                         │
│  2️⃣  RUN DATABASE MIGRATION                                           │
│      └─→ psql -f .migrations/add_dlq_unique_constraint.sql             │
│      └─→ Verify constraint was created                                 │
│                                                                         │
│  3️⃣  UPDATE DEAD LETTER SERVICE                                        │
│      └─→ Change onConflict to 'correlation_id'                        │
│      └─→ Deploy to Vercel                                              │
│                                                                         │
│  4️⃣  TEST                                                             │
│      └─→ Trigger /api/notify                                           │
│      └─→ Verify notifications sent successfully                         │
│      └──→ If fails, check Vercel logs                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Rollback Plan

```sql
-- Rollback DLQ constraint (if needed)
ALTER TABLE failed_notification_queue 
DROP CONSTRAINT IF EXISTS uq_failed_notification_queue_correlation_id;
```

---

## Summary

| Issue | Status | Fix |
|-------|--------|-----|
| Markdown `!` not escaped | Code fixed, **deploy needed** | Redeploy to Vercel |
| DLQ upsert fails | Schema issue | Add UNIQUE constraint + update onConflict |

**Next Action:** Switch to Code mode to implement these fixes.
