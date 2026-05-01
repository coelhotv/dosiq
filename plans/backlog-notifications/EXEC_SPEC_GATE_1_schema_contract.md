# EXEC SPEC — GATE 1: Schema & Contract Hardening

> **Part of**: `notifications_architecture_consolidation_plan.md`
> **Branch**: `fix/wave-12/notification-architecture-consolidation`
> **Difficulty**: Low — schema additions only, no behavioral changes
> **Estimated time**: 1–2 hours

---

## Objective

Harden the L2 payload contract by:
1. Adding a strict `metadataSchema` (replace `passthrough()`).
2. Adding `actionSchema` and `actions[]` field to the canonical payload.
3. Relaxing `deeplink` to allow `null`.
4. Changing the builder signature to accept `context` separately from `data`.
5. Adding per-kind Zod data schemas for the `dose_reminder` family.

**This gate is schema-only. No switch-case logic changes. No other files touched.**

---

## Prerequisites

Before starting, verify:

```bash
# Confirm you are on the correct branch
git branch --show-current
# Expected: fix/wave-12/notification-architecture-consolidation
# If not, create it:
git checkout -b fix/wave-12/notification-architecture-consolidation

# Confirm the previous refactor plan is already merged (these files must exist)
ls server/notifications/payloads/buildNotificationPayload.js
ls server/notifications/channels/telegramChannel.js
ls server/notifications/dispatcher/dispatchNotification.js
```

---

## Context: File to Modify

**Single file**: `server/notifications/payloads/buildNotificationPayload.js`

Current state of the schemas section (top of file, lines ~1–90):
- `kindSchema` — z.enum with all supported kinds ✓
- `notificationPayloadSchema` — has `metadata: z.object({kind}).passthrough()` ← **this is the problem**
- `dailyDigestDataSchema`, `adherenceReportDataSchema`, etc. — per-kind schemas exist for some kinds
- **Missing**: `doseReminderDataSchema`, `doseReminderByPlanDataSchema`, `doseReminderMiscDataSchema`
- **Missing**: `actionSchema`, `metadataSchema`
- Builder signature is currently `buildNotificationPayload({ kind, data })` — **needs `context` param**

---

## Step-by-Step Instructions

### Step 1 — Add `actionSchema`

Add this export **after the existing `kindSchema`** export and **before `notificationPayloadSchema`**:

```js
export const actionSchema = z.object({
  id: z.enum(['take', 'snooze', 'skip', 'take_plan', 'take_misc', 'details']),
  label: z.string(),
  params: z.record(z.string()).optional()
});
```

### Step 2 — Add `metadataSchema`

Add this export **after `actionSchema`**:

```js
export const metadataSchema = z.object({
  kind: kindSchema,
  builtAt: z.string().optional(),
  correlationId: z.string().optional(),
  details: z.record(z.unknown()).optional()
}).strict();
```

### Step 3 — Update `notificationPayloadSchema`

Find the current `notificationPayloadSchema` definition. It contains:
```js
metadata: z.object({
  kind: kindSchema,
}).passthrough()
```

Replace **only that `metadata` field** with:
```js
metadata: metadataSchema,
```

Also update the `deeplink` field from:
```js
deeplink: z.string().startsWith('dosiq://'),
```
To:
```js
deeplink: z.string().startsWith('dosiq://').nullable(),
```

Also add `actions` field:
```js
actions: z.array(actionSchema).default([]),
```

Final `notificationPayloadSchema` should look like:
```js
export const notificationPayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  pushBody: z.string(),
  deeplink: z.string().startsWith('dosiq://').nullable(),
  actions: z.array(actionSchema).default([]),
  metadata: metadataSchema,
});
```

### Step 4 — Add missing `dose_reminder*` data schemas

Add these three exports **alongside the other per-kind schemas** (near `dailyDigestDataSchema`):

```js
export const doseReminderDataSchema = z.object({
  medicineName: z.string(),
  time: z.string(),
  dosage: z.string().optional(),
  protocolId: z.string().optional()
});

export const doseReminderByPlanDataSchema = z.object({
  planName: z.string(),
  planId: z.string().optional(),
  scheduledTime: z.string(),
  hour: z.number().min(0).max(23),
  doses: z.array(z.object({
    medicineName: z.string(),
    dosagePerIntake: z.number(),
    dosageUnit: z.string().optional(),
    protocolId: z.string().optional()
  }))
});

export const doseReminderMiscDataSchema = z.object({
  scheduledTime: z.string(),
  hour: z.number().min(0).max(23),
  doses: z.array(z.object({
    medicineName: z.string(),
    dosagePerIntake: z.number(),
    dosageUnit: z.string().optional(),
    protocolId: z.string().optional()
  })),
  protocolIds: z.array(z.string()).optional()
});
```

### Step 5 — Update builder signature and `isRetry` handling

Find the `buildNotificationPayload` function signature:
```js
export function buildNotificationPayload({ kind, data }) {
```

Change it to:
```js
export function buildNotificationPayload({ kind, data, context = {} }) {
```

Find the `isRetry` decoration block near the bottom of the function (currently reads `data.isRetry`):
```js
if (data.isRetry) {
```

Replace with a shim that supports both old (`data.isRetry`) and new (`context.isRetry`) callers during transition:
```js
const isRetry = context.isRetry ?? data.isRetry ?? false;
if (isRetry) {
```

### Step 6 — Update the return statement metadata

Find the final return near the bottom of the function:
```js
return notificationPayloadSchema.parse({
  title,
  body,
  pushBody,
  deeplink,
  metadata: {
    ...metadata,
    builtAt: new Date().toISOString()
  }
});
```

Replace with (note: metadata must now fit `metadataSchema.strict()` — no more spreading raw domain data):
```js
return notificationPayloadSchema.parse({
  title,
  body,
  pushBody,
  deeplink,
  actions,
  metadata: {
    kind: validatedKind,
    builtAt: new Date().toISOString(),
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    ...(context.details ? { details: context.details } : {})
  }
});
```

Also initialize `actions` at the top of the function body (after `let metadata = ...`):
```js
let actions = [];
```

---

## What NOT To Do

- **DO NOT** modify any `case` in the switch statement — that is GATE 2 work.
- **DO NOT** modify `telegramChannel.js`, `tasks.js`, `dispatchNotification.js`, or any other file.
- **DO NOT** remove `data.isRetry` support yet — other callers still use it. The shim is intentional.
- **DO NOT** change how `metadata` is built inside each `case` — leave `let metadata = { ...data, kind: validatedKind }` alone for now. The final return will override it correctly.
- **DO NOT** add validation calls (`.parse()`) for the new dose_reminder schemas yet — that happens in GATE 2.
- **DO NOT** commit without human approval.

---

## Verification Commands

Run these before presenting the Gate Report:

```bash
# 1. Lint must pass
cd /Users/coelhotv/git-icloud/dosiq && npm run lint

# 2. Critical tests must pass
npm run test:critical

# 3. Confirm new schemas are exported
grep -n "doseReminderDataSchema\|doseReminderByPlanDataSchema\|doseReminderMiscDataSchema\|actionSchema\|metadataSchema" server/notifications/payloads/buildNotificationPayload.js

# 4. Confirm passthrough is gone
grep -n "passthrough" server/notifications/payloads/buildNotificationPayload.js
# Expected: zero results

# 5. Confirm context param exists
grep -n "context = {}" server/notifications/payloads/buildNotificationPayload.js
# Expected: 1 result (function signature)

# 6. Confirm isRetry shim
grep -n "context.isRetry" server/notifications/payloads/buildNotificationPayload.js
# Expected: 1 result
```

---

## 🛑 HARD STOP — Gate Report

**STOP HERE. Do not commit. Do not proceed to GATE 2.**

Present the following to the human for review:

1. **Full diff** of `server/notifications/payloads/buildNotificationPayload.js`
2. **Output** of all verification commands above
3. **Confirm**: "passthrough() is gone from this file"
4. **Confirm**: "No switch cases were modified"
5. **Confirm**: "No other files were modified"

**Wait for explicit human approval before proceeding.**

---

## Commit (only after human approval)

```bash
cd /Users/coelhotv/git-icloud/dosiq
npm run lint
git add server/notifications/payloads/buildNotificationPayload.js
git commit -m "$(cat <<'EOF'
feat(notifications): adiciona actions[], metadata strict e schemas dose_reminder (L1→L2)

- actionSchema com id enum + label + params opcionais
- metadataSchema strict (substitui passthrough())
- actions[] no notificationPayloadSchema
- deeplink relaxado para nullable
- context param na assinatura do builder (isRetry shim durante transição)
- doseReminderDataSchema, doseReminderByPlanDataSchema, doseReminderMiscDataSchema

EOF
)"
git push origin fix/wave-12/notification-architecture-consolidation
```
