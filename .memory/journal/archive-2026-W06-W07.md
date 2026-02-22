# Archive — 2026 Weeks 6-7 (Feb 7-16)

> Compressed summary of 20 journal entries. All actionable rules have been graduated to .memory/rules.md.

## Week 6 (Feb 7-9)

### Schema Translation (Feb 7)
- Translated Zod enums from English to Portuguese: FREQUENCIES, MEDICINE_TYPES, WEEKDAYS
- Updated ProtocolForm, MedicineForm, and onboarding components to use exported constants
- Created SQL migration for existing English data in database
- **Graduated:** R-021 (Zod enums Portuguese)

### Dashboard ADIAR Button Fix (Feb 7)
- Fixed ADIAR button in smart alerts not responding — handler didn't treat that action label
- Used Set for snoozedAlertIds tracking (more performant than Array.includes)
- **TDZ Bug:** snoozedAlertIds declared after useMemo that used it — ReferenceError crash
- **Graduated:** R-010 (Hook declaration order)

### Telegram Bot Audit (Feb 7)
- Bot inoperative 3+ days — sessionManager imported non-existent MOCK_USER_ID
- Fixed: removed MOCK_USER_ID, implemented dynamic userId via getUserIdByChatId
- **Graduated:** R-003 (Import existence check)

### Micro-interactions Integration (Feb 8)
- Integrated ConfettiAnimation, PulseEffect, ShakeEffect with React states
- Added analyticsService.track() for user events (swipe, theme change, sparkline tap)
- ShakeEffect applied to Zod validation error fields

### Bot Supabase Integration (Feb 9)
- Created bot entry point, command handlers (/hoje, /registrar, /estoque, /historico)
- Implemented node-cron scheduler for dose reminders every 5 minutes

## Week 7 (Feb 10-16)

### Zod Validation in Services (Feb 10)
- Added Zod validation to all Supabase services (medicine, log)
- Used safeParse() for non-blocking validation
- **Graduated:** R-021, R-022

### SWR Cache Implementation (Feb 10)
- Created queryCache, useCachedQuery hook, cachedServices
- staleTime: 5min for medicines, 1min for stock
- cachedServices auto-invalidate after mutations

### RLS Setup (Feb 11)
- Enabled Row Level Security on all user data tables
- Frontend: anon key with RLS. Backend: service_role only in server/

### Onboarding Wizard (Feb 12)
- 4-step wizard: Welcome, First Medicine, First Protocol, Telegram Integration
- Telegram step is optional (doesn't block progress)
- Data saved to user_settings via OnboardingProvider

### Stock Management (Feb 12)
- StockCard, StockForm, StockIndicator, stockService
- Dashboard widget for stock alerts
- **Graduated:** R-022, R-023

### Bot Notification Logging Fix (Feb 13)
- Removed 7 redundant logNotification() calls from tasks.js
- shouldSendNotification() already calls logNotification() internally
- **Graduated:** R-032, AP-015

### Bot Production Fix — Dotenv/Exit (Feb 14)
- Bot not sending notifications in production
- dotenv.config() fails in Vercel (no .env file), process.exit() kills function
- **Graduated:** R-041, AP-010

### MarkdownV2 Parsing Failures (Feb 16)
- Messages failing with unescaped `!` character
- DLQ schema missing UNIQUE constraint for upsert
- **Graduated:** R-031, AP-009

### P1 Retry Mechanism Revert (Feb 16)
- Entire retry mechanism branch reverted — caused more problems than it solved
- Orphaned import of retryManager.js caused ERR_MODULE_NOT_FOUND in production
- **Graduated:** R-003, AP-003

### P1 Reimplementation (Feb 16)
- Simplified: 2-attempt retry, DLQ admin UI, daily digest
- DLQ endpoints: GET /api/dlq, POST /api/dlq/:id/retry, POST /api/dlq/:id/discard
- **Graduated:** R-040

---

*All entries graduated. This file is retained for historical context only.*
*Original entries: 20 | Rules graduated: 15 | Anti-patterns created: 10*
