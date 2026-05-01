# Prescriptive Plan: 3-Layer Notification Architecture

Resolves organic notifications structure grow by formalizing the architecture into strict, contracted layers.

## Architectural Vision

```
┌────────────────────────────────────────────────────────────┐
│  LAYER 1: BUSINESS LOGIC (tasks.js)                        │
│  • Calculates data: percentages, schedules, streaks        │
│  • Decides eligibility (is user X ready for notification?) │
│  • Deduplicates via shouldSendNotification()               │
│  • Output: { kind, data } (validated by per-kind schema)   │
└─────────────────────────┬──────────────────────────────────┘
                          │ Contract: per-kind Zod data schema
                          ▼
┌────────────────────────────────────────────────────────────┐
│  LAYER 2: PRESENTATION LOGIC (buildNotificationPayload.js) │
│  • Transforms raw data into rich formatted payloads        │
│  • Owns: Markdown, greetings, titles, push body            │
│  • Output: { title, body, pushBody, metadata }             │
└─────────────────────────┬──────────────────────────────────┘
                          │ Contract: CON-019 payload shape
                          ▼
┌────────────────────────────────────────────────────────────┐
│  LAYER 3: DELIVERY LOGIC (dispatchNotification.js)         │
│  • Resolves channels (Telegram, Expo Push, Inbox)          │
│  • Enforces suppression: Quiet Hours, Mode (R-200)         │
│  • Logs delivery to notification_inbox                     │
│  • Output: { success, totalDelivered, ... }                │
└────────────────────────────────────────────────────────────┘
```

---

## Function Inventory & Impact

| # | File | Function | Action | Reason |
|---|:-----|:---------|:-------|:-------|
| 1 | `buildNotificationPayload.js` | `kindSchema` | **EXTEND** | Add `weekly_adherence`, `monthly_report`, `titration_alert`, `prescription_alert` (existing in api/notify.js but missing here) |
| 2 | `buildNotificationPayload.js` | `dailyDigestDataSchema` | **[NEW]** | Zod schema for `daily_digest` data input (formalizes L1→L2 contract) |
| 3 | `buildNotificationPayload.js` | `adherenceReportDataSchema` | **[NEW]** | Zod schema for `adherence_report` data input (formalizes L1→L2 contract) |
| 4 | `buildNotificationPayload.js` | `buildNotificationPayload` | **EXPAND** | Implement rich formatting for `daily_digest` + `adherence_report` using validated data schemas |
| 5 | `tasks.js` | `getGreeting` | **MOVE TO** `server/bot/utils/notificationHelpers.js` | Shared utility; imported by the canonical builder |
| 6 | `tasks.js` | `getMotivationalNudge` | **MOVE TO** `server/bot/utils/notificationHelpers.js` | Shared utility; imported by the canonical builder |
| 7 | `tasks.js` | `runDailyDigestViaDispatcher` | **REFACTOR** | Remove all Markdown/string building. Pass `data` struct only |
| 8 | `tasks.js` | `runDailyAdherenceReportViaDispatcher` | **REFACTOR** | Remove all Markdown/string building. Pass `data` struct only |
| 9 | `api/notify.js` | `buildNotificationPayload` (local) | **DELETE** | 133 lines of stale shadow code; root cause of "Unsupported kind" errors |
| 10 | `api/notify.js` | `getTimeOfDayGreeting` | **DELETE** | Presentation logic belongs in Layer 2 |
| 11 | `api/notify.js` | `notificationDispatcher.dispatch` | **REFACTOR** | Thin proxy: accepts `{ kind, data, payload?, context }` and forwards to Layer 3 |
| 12 | `buildNotificationPayload.js` | `buildNotificationPayload` | **EXPAND** | Add support for `dlq_digest` and `isRetry` decoration |
| 13 | `api/dlq/_handlers/retry.js` | `handleRetry` | **REFACTOR** | Remove formatting/delivery; call `notificationDispatcher.dispatch()` |
| 14 | `server/bot/tasks.js` | `sendDLQDigest` | **REFACTOR** | Remove local formatting; call `notificationDispatcher.dispatch()` |
| 15 | `apps/web/src/services/api/dlqService.js` | `formatNotificationType` | **EXTEND** | Add labels for `prescription_alert` and `dlq_digest` |

---

## Execution: Gates with Mandatory Approval + Atomic Commits

> [!IMPORTANT]
> **After each Gate approval, the sequence is: Lint → Atomic Commit to feature branch.**
> Feature branch: `fix/wave-11/notification-layer-unification`

---

### 🟡 GATE 1 — Layer 2: Canonical Builder Expansion
**Files touched**: `buildNotificationPayload.js`, `server/bot/utils/notificationHelpers.js` [NEW]

**Scope**:
1. Create `server/bot/utils/notificationHelpers.js` with `getGreeting` and `getMotivationalNudge`.
2. In `buildNotificationPayload.js`:
   - Import `escapeMarkdownV2` and helpers.
   - Add `dailyDigestDataSchema` and `adherenceReportDataSchema` Zod shapes.
   - Expand `buildNotificationPayload` with rich formatting for `daily_digest` and `adherence_report`.
   - **Validate `data` against its per-kind schema** before building the payload (throws on contract violation).

**Gate Report**: Diff of changed files, test output, rationale for each formatting decision.
**On Approval**: `npm run lint` → commit: `feat(notifications): adiciona formatação rica e schemas de contrato L1→L2`

---

### 🟡 GATE 2 — Layer 1: Task Runner Decoupling
**Files touched**: `server/bot/tasks.js`

**Scope**:
1. Import `getGreeting` and `getMotivationalNudge` from `notificationHelpers.js`.
2. `runDailyDigestViaDispatcher`: Remove `richTitle`, `richBody`, `pushBody` construction. Replace `payload: { ... }` with `data: { displayName, percentageYesterday, expectedDosesYesterday, todaySchedule, greeting, dateStr }`.
3. `runDailyAdherenceReportViaDispatcher`: Remove `title`, `body`, `pushBody` construction. Remove `storytelling` string. Pass raw values.
4. Remove `getGreeting` and `getMotivationalNudge` local definitions.

**Gate Report**: Full diff, verification that tasks are now "Data-Only", list of removed lines.
**On Approval**: `npm run lint` → commit: `refactor(tasks): separa business logic da presentation logic (L1→L2)`

---

### 🟡 GATE 3 — Layer 0: API Entry Point Purge
**Files touched**: `api/notify.js`

**Scope**:
1. **Delete** lines 71–213 (local `buildNotificationPayload` and `getTimeOfDayGreeting`).
2. **Refactor** `notificationDispatcher.dispatch` (lines 379–425):
   - Remove `buildNotificationPayload` call.
   - Forward `{ userId, kind, data, payload, channels, context, repositories, bot, expoClient }` directly to `dispatchNotification`.

**Gate Report**: Verify file is now a thin infrastructure proxy with zero business/presentation logic.
**On Approval**: `npm run lint` → commit: `fix(api): remove shadow code e torna notify.js proxy transparente (R-200)`

---

### 🟡 GATE 3.5 — DLQ Integration & Manual Retry
**Files touched**: `buildNotificationPayload.js`, `api/dlq/_handlers/retry.js`, `server/bot/tasks.js`, `apps/web/src/services/api/dlqService.js`

**Scope**:
1. **L2 Expansion**: 
   - Add `dlq_digest` to `kindSchema`.
   - Implement `dlqDigestDataSchema` and its formatting in `buildNotificationPayload`.
   - Add logic to detect `isRetry: true` in metadata and append `(Reenvio)` to the payload.
2. **L1 Decoupling (Admin)**: 
   - Refactor `sendDLQDigest` in `tasks.js` to fetch raw data and call `notificationDispatcher.dispatch`.
3. **L1 Decoupling (Retry)**: 
   - Refactor `handleRetry` in `api/dlq/_handlers/retry.js` to call `notificationDispatcher.dispatch`.
   - Delete `formatRetryMessage` and `sendTelegramMessage` from the handler.
4. **Frontend Sync**:
   - Update `formatNotificationType` in `dlqService.js` (frontend) to support the new `kinds`.

**Gate Report**: Verification that retry now uses the canonical builder and the dispatcher, and Admin UI displays correct labels.
**On Approval**: `npm run lint` → commit: `refactor(dlq): integra DLQ e manual retry à arquitetura de 3 camadas`

---

### 🟢 GATE 4 — Validation & Delivery
**Files touched**: None (verification only)

**Scope**:
1. Run `npm run validate:agent` (critical suite + lint + 10min timeout).
2. Simulate dispatch locally for `daily_digest` and `adherence_report`, inspect log output.
3. Update `docs/features/NOTIFICATIONS_EXPERIENCE.md` with 3-layer architecture diagram.
4. Create PR, await AI review, await explicit user approval.

---

## Risk Management

| Risk | Mitigation |
| :--- | :--- |
| `kindSchema` gaps | GATE 1 extends the enum to include all `api/notify.js` kinds. |
| Double-escape Markdown | `escapeMarkdownV2` called once in the builder only. |
| Missing kinds crash at runtime | Per-kind Zod schemas throw early with descriptive errors, not undefined reads. |
| Vercel import resolution | All imports follow the established relative path pattern already used in `api/notify.js`. |
