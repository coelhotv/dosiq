# EXEC SPEC — GATE 4: L3 Cleanup — Channels Become Pure Delivery

> **Part of**: `notifications_architecture_consolidation_plan.md`
> **Branch**: `fix/wave-12/notification-architecture-consolidation`
> **Prerequisite**: GATE 3 approved and committed
> **Difficulty**: Medium-High — must preserve callback_data wire format exactly; risk of breaking Telegram buttons
> **Estimated time**: 2–3 hours

---

## Objective

Make `telegramChannel.js` a pure delivery channel — it sends messages and maps actions to Telegram-native affordances, but does **zero formatting**.

Changes:
1. Delete `formatMessage()` from `telegramChannel.js`.
2. Delete kind-inference heuristic from deeplink parsing.
3. Delete `escapeMarkdownV2(payload.title)` (L2 already escapes titles).
4. Delete the `*${title}*\n${body}` wrapping (L2 delivers final `body`).
5. Replace hardcoded `inline_keyboard` construction with a generic `actions[]` mapper.
6. Add `encodeCallback()` helper that encodes `actions[]` → `callback_data` strings.
7. Audit `expoPushChannel.js` for any metadata reads outside the whitelist.

**CRITICAL CONSTRAINT**: The `callback_data` string format sent to Telegram must remain wire-compatible with existing callback handlers in `server/bot/callbacks/`. Do not change the encoded string format — only change how it is constructed.

---

## Prerequisites

```bash
git log --oneline -5
# GATE 3 commit must be at the top

# Confirm actions[] are populated by L2 for dose_reminder* kinds
grep -n "actions = \[" server/notifications/payloads/buildNotificationPayload.js
# Must return 3+ results
```

---

## Context: Wire Format You Must Preserve

Before touching anything, read the callback handlers to understand what `callback_data` strings they expect:

```bash
ls server/bot/callbacks/
grep -rn "callback_data\|split.*:" server/bot/callbacks/
```

The existing callback handlers parse `callback_data` by splitting on `:`. Current formats:
- `take_:<protocolId>:<dosage>` — take individual dose
- `snooze_:<protocolId>` — snooze
- `skip_:<protocolId>` — skip
- `takeplan:<planIdShort>:<hhmm>` — register plan
- `takelist:misc:<hhmm>` — register misc list
- `details:plan:<planIdShort>` — plan details
- `details:misc:<hhmm>` — misc details

**Your `encodeCallback` function must produce exactly these strings.** Map each `action.id` to its wire format:

| action.id | callback_data format |
|---|---|
| `take` | `take_:${params.protocolId}:${params.dosage ?? 1}` |
| `snooze` | `snooze_:${params.protocolId}` |
| `skip` | `skip_:${params.protocolId}` |
| `take_plan` | `takeplan:${params.planIdShort}:${params.hhmm}` |
| `take_misc` | `takelist:misc:${params.hhmm}` |
| `details` (plan) | `details:plan:${params.planIdShort}` |
| `details` (misc) | `details:misc:${params.hhmm}` |

---

## Context: What `telegramChannel.js` Looks Like Now

Current structure (~165 lines):
- `getTelegramChatId(userId)` — DB lookup ✓ keep as-is
- `formatMessage(payload)` — builds rich text ← **DELETE**
- `EMPTY_RESULT` constant ✓ keep
- `sendTelegramNotification(...)` — main export
  - Kind inference from deeplink (lines ~86-88) ← **DELETE**
  - `inline_keyboard` construction (lines ~95-123) — hardcoded by kind ← **REPLACE** with generic mapper
  - `escapeMarkdownV2(payload.title)` usage ← **DELETE**
  - `*${title}*\n${body}` wrapping ← **DELETE**

---

## Step-by-Step Instructions

### Step 1 — Read `telegramChannel.js` in full

Before making changes, read the entire file. Identify:
- The exact lines of `formatMessage()` (start and end)
- The exact lines of kind inference
- The exact lines of each `inline_keyboard` block

```bash
cat -n server/notifications/channels/telegramChannel.js
```

### Step 2 — Add `encodeCallback` helper

Add this function **at the top of the file**, just after the imports:

```js
/**
 * Encodes a canonical action into a Telegram callback_data string.
 * Wire format must remain compatible with server/bot/callbacks/ handlers.
 * Max 64 bytes enforced (R-030).
 */
function encodeCallback(action) {
  const { id, params = {} } = action;
  let raw;

  switch (id) {
    case 'take':
      raw = `take_:${params.protocolId}:${params.dosage ?? 1}`;
      break;
    case 'snooze':
      raw = `snooze_:${params.protocolId}`;
      break;
    case 'skip':
      raw = `skip_:${params.protocolId}`;
      break;
    case 'take_plan':
      raw = `takeplan:${params.planIdShort}:${params.hhmm}`;
      break;
    case 'take_misc':
      raw = `takelist:misc:${params.hhmm}`;
      break;
    case 'details':
      raw = params.kind === 'plan'
        ? `details:plan:${params.planIdShort}`
        : `details:misc:${params.hhmm}`;
      break;
    default:
      return null; // unknown action — skip
  }

  // Enforce 64-byte limit (Telegram hard limit)
  return Buffer.byteLength(raw, 'utf8') <= 64 ? raw : raw.slice(0, 64);
}
```

### Step 3 — Delete `formatMessage()`

Find and delete the entire `formatMessage` function (roughly lines 36–60). This includes:
- The JSDoc comment above it
- The function body
- Everything from `function formatMessage(payload) {` to the closing `}`

After deletion, the imports at the top of the file should also be cleaned up:
- Remove import of `formatDoseGroupedByPlanMessage` (already removed in GATE 2)
- Remove import of `formatDoseGroupedMiscMessage` (already removed in GATE 2)
- Remove import of `escapeMarkdownV2` from formatters — **only if it is no longer used anywhere else in the file**. Check before removing.

### Step 4 — Update `sendTelegramNotification` — remove kind inference

Find this block (approximately lines 86–88):
```js
const kind = payload.metadata?.kind ?? (payload.deeplink?.includes('plan=') ? 'dose_reminder_by_plan' :
                                        payload.deeplink?.includes('misc=1') ? 'dose_reminder_misc' :
                                        'dose_reminder')
```

Replace with:
```js
const kind = payload.metadata.kind;
```

`payload.metadata.kind` is now always present and validated by L2 (GATE 1 made metadata strict).

### Step 5 — Delete `const message = formatMessage(...)` call and replace

Find the line:
```js
const message = formatMessage({ ...payload, kind })
```

Replace with:
```js
const message = payload.body
```

That's it. L2 already delivers the complete formatted `body` string.

### Step 6 — Replace `inline_keyboard` hardcode with generic mapper

Find the entire block that builds `options.reply_markup` conditionally (approximately lines 95–123). It looks like:

```js
if (kind === 'dose_reminder_by_plan' && payload.metadata?.planId) {
  ...
  options.reply_markup = { inline_keyboard: [[...]] }
} else if (kind === 'dose_reminder_misc' && ...) {
  ...
} else if (payload.metadata?.protocolId) {
  ...
}
```

Delete this entire block and replace with:

```js
if (payload.actions && payload.actions.length > 0) {
  const buttons = payload.actions
    .map(a => {
      const callbackData = encodeCallback(a);
      return callbackData ? { text: a.label, callback_data: callbackData } : null;
    })
    .filter(Boolean);

  if (buttons.length > 0) {
    options.reply_markup = {
      inline_keyboard: [buttons]
    };
  }
}
```

### Step 7 — Remove the `*${title}*\n${body}` wrapping

Find where `message` was being constructed (now just `payload.body`). If there is any remaining code that wraps the message in `*${title}*\n${...}` format — delete it. L2 delivers `body` as the final string to send.

### Step 8 — Clean up remaining dead code

After the changes above, `telegramChannel.js` should no longer reference:
- `escapeMarkdownV2` (unless used elsewhere — verify)
- `formatDoseGroupedByPlanMessage` / `formatDoseGroupedMiscMessage` (already gone from GATE 2)
- Any `metadata.planId`, `metadata.protocolIds`, `metadata.planName`, `metadata.scheduledTime` reads outside of logging

Check:
```bash
grep -n "metadata\." server/notifications/channels/telegramChannel.js
```

Any `metadata.X` read that is not `metadata.kind` is suspicious. Evaluate: is it used for logging (acceptable) or for building strings/conditions (should be removed)?

### Step 9 — Audit `expoPushChannel.js`

```bash
cat -n server/notifications/channels/expoPushChannel.js
```

Verify:
- It uses `payload.pushBody` (not `payload.body`) for the push notification body.
- It does not read raw domain data from `metadata.*` to construct any strings.
- It reads `payload.title` directly (fine — title is clean from L2).

If it does read raw metadata fields to build strings, remove that logic. If it's clean, note "expoPushChannel OK" in the gate report.

---

## What NOT To Do

- **DO NOT** change the `callback_data` string values that callbacks receive — only the construction mechanism changes.
- **DO NOT** modify `server/bot/callbacks/` handlers — they must continue working unchanged.
- **DO NOT** modify `buildNotificationPayload.js` — L2 is done.
- **DO NOT** modify `tasks.js` — L1 is done.
- **DO NOT** modify `dispatchNotification.js` — that is GATE 5.
- **DO NOT** add any formatting logic (emoji, Markdown, string concatenation of domain data) to the channel.
- **DO NOT** commit without human approval.

---

## Verification Commands

```bash
# 1. Lint
cd /Users/coelhotv/git-icloud/dosiq && npm run lint

# 2. Critical tests
npm run test:critical

# 3. formatMessage must be gone
grep -n "formatMessage" server/notifications/channels/telegramChannel.js
# Expected: zero results

# 4. Kind inference heuristic must be gone
grep -n "deeplink.*includes\|includes.*plan=\|includes.*misc=" server/notifications/channels/telegramChannel.js
# Expected: zero results

# 5. telegramChannel.js line count (should drop from ~165 to <100)
wc -l server/notifications/channels/telegramChannel.js
# Expected: less than 100 lines

# 6. encodeCallback function exists
grep -n "encodeCallback" server/notifications/channels/telegramChannel.js
# Expected: 2+ results (definition + call)

# 7. Verify callback handlers still parse the same formats
grep -rn "split.*:\|callback_data" server/bot/callbacks/
# Manually verify formats are unchanged vs what encodeCallback emits

# 8. No doseFormatters import anywhere
grep -rn "doseFormatters" server/ apps/
# Expected: zero results
```

---

## 🛑 HARD STOP — Gate Report

**STOP HERE. Do not commit. Do not proceed to GATE 5.**

Present the following to the human for review:

1. **Full diff** of `server/notifications/channels/telegramChannel.js`
2. **Line count before vs after**: "Was ~165 lines, now X lines"
3. **`encodeCallback` mapping table** — list each `action.id` → `callback_data` format and confirm it matches the existing handlers
4. **`expoPushChannel.js` audit result**: OK or list of changes made
5. **Output** of all verification commands above
6. **Confirm**: "server/bot/callbacks/ handlers were not modified"
7. **Confirm**: "buildNotificationPayload.js was not modified in this gate"
8. **Confirm**: "tasks.js was not modified in this gate"

**Wait for explicit human approval before proceeding.**

---

## Commit (only after human approval)

```bash
cd /Users/coelhotv/git-icloud/dosiq
npm run lint
git add server/notifications/channels/telegramChannel.js \
        server/notifications/channels/expoPushChannel.js
git commit -m "$(cat <<'EOF'
refactor(channels): canais viram delivery puro; actions[] mapeadas para affordances nativas

- telegramChannel: deleta formatMessage(), kind inference e wrapping *title*\nbody
- telegramChannel: inline_keyboard hardcode → mapeador generico actions[]
- encodeCallback(): serializa actions[] → callback_data wire-compatible (R-030)
- expoPushChannel: auditado (usa pushBody; sem leitura de metadata cru)

EOF
)"
git push origin fix/wave-12/notification-architecture-consolidation
```
