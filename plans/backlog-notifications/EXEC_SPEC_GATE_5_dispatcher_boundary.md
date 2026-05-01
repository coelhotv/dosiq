# EXEC SPEC — GATE 5: Dispatcher & Boundary Cleanup

> **Part of**: `notifications_architecture_consolidation_plan.md`
> **Branch**: `fix/wave-12/notification-architecture-consolidation`
> **Prerequisite**: GATE 4 approved and committed
> **Difficulty**: Medium — touches the core dispatcher; careful reading required before changes
> **Estimated time**: 1.5–2 hours

---

## Objective

Enforce a single, unambiguous contract at the dispatcher boundary:

1. Remove the `payload || buildNotificationPayload(...)` fallback — dispatcher **always** calls the builder internally. Callers only pass `{ kind, data, context }`.
2. Remove fragile string-match `isGroupedKind` for `protocolId` inference.
3. Whitelist `provider_metadata` persisted to `notification_inbox`.
4. Fix `api/dlq/_handlers/retry.js` to use `context.isRetry` only (remove `data.isRetry`).
5. Remove the `isRetry` shim introduced in GATE 1 (now all callers use `context.isRetry`).
6. Verify `api/notify.js` is still a thin proxy (no behavioral changes needed there).

---

## Prerequisites

```bash
git log --oneline -5
# GATE 4 commit must be at the top

# Confirm actions[] work end-to-end
grep -n "actions" server/notifications/dispatcher/dispatchNotification.js
# If dispatcher currently strips actions[], note it for Step 3

# Confirm no more isRetry in data from tasks.js
grep -n "isRetry" server/bot/tasks.js
# Expected: zero results (tasks.js doesn't use isRetry)
```

---

## Context: Files to Modify

### File 1: `server/notifications/dispatcher/dispatchNotification.js`
Read the full file before making any changes:
```bash
cat -n server/notifications/dispatcher/dispatchNotification.js
```

Look for:
- The `payload || buildNotificationPayload(...)` fallback pattern
- The `isGroupedKind` string match (likely a conditional like `kind === 'dose_reminder_by_plan' || kind === 'dose_reminder_misc'`)
- Where `provider_metadata` is built for the inbox log call

### File 2: `api/dlq/_handlers/retry.js`
Read before modifying:
```bash
cat -n api/dlq/_handlers/retry.js
```

Look for:
- The call to `notificationDispatcher.dispatch(...)` or equivalent
- How `isRetry` is passed (likely both `data: { ...something, isRetry: true }` and `context: { isRetry: true }`)

### File 3: `server/notifications/payloads/buildNotificationPayload.js`
Only to remove the GATE 1 shim (one line change).

---

## Step-by-Step Instructions

### Step 1 — Read dispatchNotification.js and map the current flow

Read the file fully. Identify and note:
- Line numbers for the `payload` fallback
- Line numbers for `isGroupedKind`
- Line numbers for `provider_metadata` construction
- What parameters the function accepts (current signature)

### Step 2 — Remove the `payload` fallback in dispatcher

Find the pattern (approximate):
```js
const finalPayload = payload || buildNotificationPayload({ kind, data });
```
or:
```js
let finalPayload;
if (payload) {
  finalPayload = payload;
} else {
  finalPayload = buildNotificationPayload({ kind, data });
}
```

**Replace with a single, mandatory call:**
```js
const finalPayload = buildNotificationPayload({ kind, data, context });
```

This means the `payload` parameter is **removed** from the dispatcher's accepted parameters. Update the function signature accordingly.

Also ensure `context` is passed into `buildNotificationPayload` if it wasn't already.

### Step 3 — Ensure `actions[]` flows through to channels

After building `finalPayload`, verify that `finalPayload.actions` is passed to each channel call. The channels need it to build buttons. If the dispatcher was stripping it (e.g., only passing `{ title, body, pushBody, deeplink, metadata }`), add `actions: finalPayload.actions` to the channel call arguments.

### Step 4 — Fix `protocolId` inference

Find the `isGroupedKind` pattern (approximate):
```js
const isGroupedKind = kind === 'dose_reminder_by_plan' || kind === 'dose_reminder_misc';
const protocolId = isGroupedKind ? null : data?.protocolId;
```

Replace with schema-derived inference:
```js
const protocolId = data?.protocolId ?? null;
```

This is safe because:
- For `dose_reminder` (individual): `data.protocolId` is populated by L1.
- For `dose_reminder_by_plan` and `dose_reminder_misc`: `data.protocolId` is `undefined`, so `?? null` produces `null`.
- No string-matching needed.

### Step 5 — Whitelist `provider_metadata`

Find where `provider_metadata` is built for the inbox log. Currently it likely does a broad spread:
```js
provider_metadata: {
  ...finalPayload.metadata,
  ...someOtherStuff
}
```

Replace with an explicit whitelist:
```js
provider_metadata: {
  kind: finalPayload.metadata.kind,
  builtAt: finalPayload.metadata.builtAt,
  ...(context?.isRetry ? { isRetry: true } : {}),
  ...(channelResult?.telegram?.messageId ? { telegram_message_id: channelResult.telegram.messageId } : {}),
  ...(channelResult?.expo?.ticketId ? { expo_ticket_id: channelResult.expo.ticketId } : {})
}
```

> Note: The exact field names for channel results depend on what each channel returns. Read the actual return shapes from `telegramChannel.js` and `expoPushChannel.js` to get the right field names.

### Step 6 — Fix `api/dlq/_handlers/retry.js`

Read the file. Find the dispatch call that passes both `data.isRetry` and `context.isRetry`:

```js
// CURRENT (wrong — isRetry in two places)
await notificationDispatcher.dispatch({
  ...
  data: { ...originalNotification.payload_data, isRetry: true },
  context: { isRetry: true }
})
```

Change to pass `isRetry` **only** in `context`:
```js
// CORRECTED
await notificationDispatcher.dispatch({
  ...
  data: originalNotification.payload_data,   // clean domain data, no isRetry
  context: {
    isRetry: true,
    originalNotificationId: originalNotification.id,
    correlationId: context?.correlationId
  }
})
```

> Important: The exact field names for `originalNotification` depend on the actual DB schema. Read `api/dlq/_handlers/retry.js` carefully before changing. Do not guess field names — read them from the actual code.

### Step 7 — Remove `isRetry` shim from `buildNotificationPayload.js`

In GATE 1, we added a shim:
```js
const isRetry = context.isRetry ?? data.isRetry ?? false;
```

Now that all callers use `context.isRetry`, simplify to:
```js
const isRetry = context.isRetry ?? false;
```

### Step 8 — Verify `api/notify.js` (read-only check)

```bash
cat -n api/notify.js
```

Confirm:
- `notificationDispatcher.dispatch` is called with `{ kind, data, context }` only (no `payload` field).
- There is no local `buildNotificationPayload` call.
- There is no presentation logic (no string building, no Markdown, no emoji).

If all three are true: **no changes needed to `api/notify.js`**. Note "api/notify.js verified — no changes needed" in your gate report.

If any of the three are false: fix them (but do not add features — just remove stray presentation or payload-building code).

---

## What NOT To Do

- **DO NOT** change the channels (`telegramChannel.js`, `expoPushChannel.js`).
- **DO NOT** change `tasks.js` or `buildNotificationPayload.js` beyond the shim removal (Step 7).
- **DO NOT** change `server/bot/callbacks/` or `server/bot/commands/`.
- **DO NOT** remove the `context` parameter from the dispatcher — it carries `isRetry`, `correlationId`, etc.
- **DO NOT** break the DLQ retry flow — test mentally: retry handler calls dispatch with `context.isRetry: true` → dispatcher calls builder with `context` → builder decorates payload with "(Reenvio)" → channels deliver decorated message.
- **DO NOT** commit without human approval.

---

## Verification Commands

```bash
# 1. Lint
cd /Users/coelhotv/git-icloud/dosiq && npm run lint

# 2. Critical tests
npm run test:critical

# 3. No payload fallback in dispatcher
grep -n "payload || buildNotificationPayload\|payload ? payload" server/notifications/dispatcher/dispatchNotification.js
# Expected: zero results

# 4. No isGroupedKind string match
grep -n "isGroupedKind\|dose_reminder_by_plan.*dose_reminder_misc" server/notifications/dispatcher/dispatchNotification.js
# Expected: zero results

# 5. data.isRetry gone from retry handler
grep -n "data.*isRetry\|isRetry.*true" api/dlq/_handlers/retry.js
# Expected: only context.isRetry (not data.isRetry)

# 6. Shim removed from builder
grep -n "data.isRetry" server/notifications/payloads/buildNotificationPayload.js
# Expected: zero results

# 7. Confirm isRetry still works via context
grep -n "context.isRetry\|context?.isRetry" server/notifications/payloads/buildNotificationPayload.js
# Expected: 1 result
```

---

## 🛑 HARD STOP — Gate Report

**STOP HERE. Do not commit. Do not proceed to GATE 5.5.**

Present the following to the human for review:

1. **Full diff** of `server/notifications/dispatcher/dispatchNotification.js`
2. **Full diff** of `api/dlq/_handlers/retry.js`
3. **One-line diff** of `server/notifications/payloads/buildNotificationPayload.js` (shim removal only)
4. **`api/notify.js` snapshot**: "No changes needed — confirmed thin proxy" OR diff of changes if any were needed
5. **Output** of all verification commands above
6. **Mental trace of DLQ retry path**: describe step-by-step what happens when a notification is retried — from retry handler to channel delivery — confirming "(Reenvio)" decoration still works
7. **Confirm**: "channels were not modified in this gate"
8. **Confirm**: "grep for `data.isRetry` returns zero"

**Wait for explicit human approval before proceeding.**

---

## Commit (only after human approval)

```bash
cd /Users/coelhotv/git-icloud/dosiq
npm run lint
git add server/notifications/dispatcher/dispatchNotification.js \
        api/dlq/_handlers/retry.js \
        server/notifications/payloads/buildNotificationPayload.js
git commit -m "$(cat <<'EOF'
refactor(dispatcher): contrato único; isRetry em context; protocolId derivado de schema

- dispatcher: remove fallback payload||buildNotificationPayload (contrato único)
- dispatcher: remove isGroupedKind string-match; protocolId via data?.protocolId
- dispatcher: provider_metadata com whitelist explícita
- dispatcher: actions[] fluem para os canais
- dlq retry: isRetry apenas em context (remove de data)
- buildNotificationPayload: remove shim data.isRetry

EOF
)"
git push origin fix/wave-12/notification-architecture-consolidation
```
