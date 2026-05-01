# EXEC SPEC — GATE 2: L2 Absorption — dose_reminder Family

> **Part of**: `notifications_architecture_consolidation_plan.md`
> **Branch**: `fix/wave-12/notification-architecture-consolidation`
> **Prerequisite**: GATE 1 approved and committed
> **Difficulty**: Medium — rich formatting logic, must match existing Telegram output visually
> **Estimated time**: 2–3 hours

---

## Objective

Move all `dose_reminder*` formatting logic from the Telegram channel (L3) into the canonical builder (L2), so **all channels** receive a rich payload instead of only Telegram:

1. Move `getTimeOfDayEmoji` from `doseFormatters.js` → `notificationHelpers.js`.
2. Implement rich `body` + `pushBody` for `dose_reminder`, `dose_reminder_by_plan`, `dose_reminder_misc` inside `buildNotificationPayload.js`.
3. Emit `actions[]` for each of these kinds.
4. Delete `server/bot/utils/doseFormatters.js`.

**L1 (tasks.js) and L3 (telegramChannel.js) are NOT touched in this gate.**

---

## Prerequisites

Before starting, verify GATE 1 was completed:

```bash
git log --oneline -5
# Should show GATE 1 commit at the top

grep -n "actionSchema\|metadataSchema\|doseReminderByPlanDataSchema" server/notifications/payloads/buildNotificationPayload.js
# Must return results — if empty, GATE 1 is not done. STOP.

grep -n "passthrough" server/notifications/payloads/buildNotificationPayload.js
# Must return zero results — if not, GATE 1 is not done. STOP.
```

---

## Context: Files to Modify

### File 1: `server/bot/utils/doseFormatters.js`
Currently contains:
- `getTimeOfDayEmoji(hour)` — returns emoji based on hour (🌅🍽️☕🌆🌙)
- `formatDoseGroupedByPlanMessage(planName, doses, scheduledTime, hour)` — rich MarkdownV2 body for plan groups
- `formatDoseGroupedMiscMessage(doses, scheduledTime, hour)` — rich MarkdownV2 body for misc groups

This entire file will be **deleted** at the end of this gate.

### File 2: `server/bot/utils/notificationHelpers.js`
Currently contains `getGreeting`, `getMotivationalNudge`, `getTimeOfDayGreeting`.
Will receive `getTimeOfDayEmoji` from `doseFormatters.js`.

### File 3: `server/notifications/payloads/buildNotificationPayload.js`
Currently has thin implementations for `dose_reminder*` cases (no medicine listing, no emoji).
Will receive rich formatting logic absorbing `formatDoseGroupedByPlanMessage` and `formatDoseGroupedMiscMessage`.

---

## Step-by-Step Instructions

### Step 1 — Move `getTimeOfDayEmoji` to `notificationHelpers.js`

Open `server/bot/utils/notificationHelpers.js`.

Add the following function export at the end of the file (copy the exact logic from `doseFormatters.js`):

```js
export function getTimeOfDayEmoji(hour) {
  if (hour >= 5 && hour < 11) return '🌅';
  if (hour >= 11 && hour < 14) return '🍽️';
  if (hour >= 14 && hour < 18) return '☕';
  if (hour >= 18 && hour < 23) return '🌆';
  return '🌙';
}
```

### Step 2 — Add import in `buildNotificationPayload.js`

Open `server/notifications/payloads/buildNotificationPayload.js`.

The current import line is:
```js
import { getGreeting, getMotivationalNudge, getTimeOfDayGreeting } from '../../bot/utils/notificationHelpers.js';
```

Update it to also import `getTimeOfDayEmoji`:
```js
import { getGreeting, getMotivationalNudge, getTimeOfDayGreeting, getTimeOfDayEmoji } from '../../bot/utils/notificationHelpers.js';
```

### Step 3 — Rewrite `case 'dose_reminder'`

Find the current `case 'dose_reminder':` block in the switch statement. It currently does minimal formatting. Replace the **entire case block** with:

```js
case 'dose_reminder': {
  const { medicineName, time, dosage, protocolId } = doseReminderDataSchema.parse(data);
  title = '💊 Hora do Medicamento';

  const safeName = escapeMarkdownV2(medicineName);
  const safeTime = escapeMarkdownV2(time);

  if (dosage) {
    const safeDosage = escapeMarkdownV2(dosage);
    body = `Está na hora de tomar *${safeName}* \\(${safeTime}\\) — ${safeDosage}\\.`;
    pushBody = `Está na hora de tomar ${medicineName} (${time}) — ${dosage}.`;
  } else {
    body = `Está na hora de tomar *${safeName}* \\(${safeTime}\\)\\.`;
    pushBody = `Está na hora de tomar ${medicineName} (${time}).`;
  }

  actions = [
    { id: 'take',   label: '✅ Tomar',  params: { protocolId: protocolId ?? '' } },
    { id: 'snooze', label: '⏰ Adiar',  params: { protocolId: protocolId ?? '' } },
    { id: 'skip',   label: '⏭️ Pular', params: { protocolId: protocolId ?? '' } }
  ];
  break;
}
```

### Step 4 — Rewrite `case 'dose_reminder_by_plan'`

Find the current `case 'dose_reminder_by_plan':` block. Replace the **entire case block** with:

```js
case 'dose_reminder_by_plan': {
  const { planName, planId, scheduledTime, hour, doses } = doseReminderByPlanDataSchema.parse(data);
  const emoji = getTimeOfDayEmoji(hour);
  const safePlanName = escapeMarkdownV2(planName || 'Plano de tratamento');
  const safeTime = escapeMarkdownV2(scheduledTime);
  const count = doses.length;
  const MAX_SHOWN = 10;
  const shown = doses.slice(0, MAX_SHOWN);
  const extra = count - shown.length;

  title = `${emoji} ${planName}`;

  // Rich body (Telegram + Inbox)
  const doseLines = shown.map(d => {
    const name = escapeMarkdownV2(d.medicineName || 'Medicamento');
    const qty = escapeMarkdownV2(String(d.dosagePerIntake ?? 1));
    return `  💊 ${name} — ${qty} cp`;
  }).join('\n');

  body = `${emoji} *${safePlanName}*\n\n${escapeMarkdownV2(String(count))} medicamentos agora — ${safeTime}\n\n${doseLines}`;
  if (extra > 0) {
    body += `\n  _… e mais ${escapeMarkdownV2(String(extra))}_`;
  }

  // Plain body (Push)
  const plainLines = shown.map(d =>
    `• ${d.medicineName} — ${d.dosagePerIntake ?? 1} cp`
  ).join('\n');
  pushBody = `${planName}: ${count} medicamento${count !== 1 ? 's' : ''} agora (${scheduledTime})\n${plainLines}`;
  if (extra > 0) {
    pushBody += `\n… e mais ${extra}`;
  }

  const planIdShort = String(planId ?? '').slice(0, 8);
  actions = [
    { id: 'take_plan', label: '✅ Registrar este plano', params: { planIdShort, hhmm: scheduledTime } },
    { id: 'details',   label: '📋 Detalhes',             params: { kind: 'plan', planIdShort } }
  ];
  break;
}
```

### Step 5 — Rewrite `case 'dose_reminder_misc'`

Find the current `case 'dose_reminder_misc':` block. Replace the **entire case block** with:

```js
case 'dose_reminder_misc': {
  const { scheduledTime, hour, doses, protocolIds } = doseReminderMiscDataSchema.parse(data);
  const emoji = getTimeOfDayEmoji(hour);
  const safeTime = escapeMarkdownV2(scheduledTime);
  const count = doses.length;
  const MAX_SHOWN = 10;
  const shown = doses.slice(0, MAX_SHOWN);
  const extra = count - shown.length;

  title = getTimeOfDayGreeting(hour);

  // Rich body (Telegram + Inbox)
  const doseLines = shown.map(d => {
    const name = escapeMarkdownV2(d.medicineName || 'Medicamento');
    const qty = escapeMarkdownV2(String(d.dosagePerIntake ?? 1));
    return `  • ${name} — ${qty} cp`;
  }).join('\n');

  body = `${emoji} *Suas doses agora* — ${safeTime}\n\n${escapeMarkdownV2(String(count))} medicamento${count !== 1 ? 's' : ''} pendente${count !== 1 ? 's' : ''}:\n\n${doseLines}`;
  if (extra > 0) {
    body += `\n  _… e mais ${escapeMarkdownV2(String(extra))}_`;
  }

  // Plain body (Push)
  const plainLines = shown.map(d =>
    `• ${d.medicineName} — ${d.dosagePerIntake ?? 1} cp`
  ).join('\n');
  pushBody = `${count} medicamento${count !== 1 ? 's' : ''} pendente${count !== 1 ? 's' : ''} (${scheduledTime}):\n${plainLines}`;
  if (extra > 0) {
    pushBody += `\n… e mais ${extra}`;
  }

  const hhmm = scheduledTime;
  actions = [
    { id: 'take_misc', label: '✅ Registrar todos', params: { hhmm } },
    { id: 'details',   label: '📋 Detalhes',        params: { kind: 'misc', hhmm } }
  ];
  break;
}
```

### Step 6 — Initialize `actions` at top of switch

In `buildNotificationPayload`, near where `title`, `body`, `pushBody` are initialized, ensure `actions` is also initialized (GATE 1 should have added this, verify it exists):

```js
let actions = [];
```

If it's missing, add it alongside the other `let` declarations.

### Step 7 — Delete `server/bot/utils/doseFormatters.js`

```bash
git rm server/bot/utils/doseFormatters.js
```

### Step 8 — Fix any remaining imports of doseFormatters

```bash
grep -rn "doseFormatters" server/ apps/
```

For each file that imports from `doseFormatters`, update:
- If it only imported `getTimeOfDayEmoji` → change to import from `notificationHelpers.js`
- If it imported `formatDoseGroupedByPlanMessage` or `formatDoseGroupedMiscMessage` → **these are no longer needed externally**; the import should be removed entirely (callers now rely on the canonical payload's `body` field)

Expected result: `telegramChannel.js` imports `formatDoseGroupedByPlanMessage` and `formatDoseGroupedMiscMessage` from `doseFormatters.js`. **Remove those imports from `telegramChannel.js` but do NOT change any other logic in that file yet** — that is GATE 4 work.

---

## What NOT To Do

- **DO NOT** modify `telegramChannel.js` beyond removing the dead `doseFormatters` import.
- **DO NOT** modify `server/bot/tasks.js` — L1 cleanup is GATE 3.
- **DO NOT** change `dispatchNotification.js`.
- **DO NOT** change any other switch cases (daily_digest, adherence_report, etc.).
- **DO NOT** add `actions[]` to switch cases other than the three `dose_reminder*` cases above.
- **DO NOT** change callback_data format — GATE 4 introduces the generic mapper; for now telegramChannel still builds inline_keyboard with its own hardcoded logic (just without the import).
- **DO NOT** commit without human approval.

---

## Verification Commands

```bash
# 1. Lint
cd /Users/coelhotv/git-icloud/dosiq && npm run lint

# 2. Critical tests
npm run test:critical

# 3. doseFormatters.js must be gone
ls server/bot/utils/doseFormatters.js 2>&1
# Expected: "No such file or directory"

# 4. getTimeOfDayEmoji must be in notificationHelpers
grep -n "getTimeOfDayEmoji" server/bot/utils/notificationHelpers.js
# Expected: 1+ results

# 5. No remaining imports of doseFormatters
grep -rn "doseFormatters" server/ apps/
# Expected: zero results

# 6. doseReminderByPlanDataSchema is now used in the switch
grep -n "doseReminderByPlanDataSchema.parse\|doseReminderMiscDataSchema.parse\|doseReminderDataSchema.parse" server/notifications/payloads/buildNotificationPayload.js
# Expected: 3 results (one per case)

# 7. actions[] populated in all 3 dose_reminder cases
grep -n "actions = \[" server/notifications/payloads/buildNotificationPayload.js
# Expected: at least 3 results
```

---

## 🛑 HARD STOP — Gate Report

**STOP HERE. Do not commit. Do not proceed to GATE 3.**

Present the following to the human for review:

1. **Full diff** of `server/notifications/payloads/buildNotificationPayload.js` (dose_reminder* cases only)
2. **Full diff** of `server/bot/utils/notificationHelpers.js` (getTimeOfDayEmoji addition)
3. **Confirmation** that `doseFormatters.js` is deleted (`git status` showing it removed)
4. **Output** of all verification commands above
5. **Side-by-side message comparison** — write out what the old Telegram message looked like vs what the new canonical `body` contains for:
   - One `dose_reminder_by_plan` example (e.g., plan "Quarteto Fantástico", 2 doses, 12:15)
   - One `dose_reminder_misc` example (2 doses, 08:00)
6. **Confirm**: "telegramChannel.js was not modified beyond removing dead imports"
7. **Confirm**: "tasks.js was not modified"

**Wait for explicit human approval before proceeding.**

---

## Commit (only after human approval)

```bash
cd /Users/coelhotv/git-icloud/dosiq
npm run lint
git add server/notifications/payloads/buildNotificationPayload.js \
        server/bot/utils/notificationHelpers.js \
        server/notifications/channels/telegramChannel.js
git commit -m "$(cat <<'EOF'
refactor(notifications): absorve formatters dose_reminder em L2 e emite actions[]

- dose_reminder: listagem rica com dosagem + actions [take, snooze, skip]
- dose_reminder_by_plan: absorve formatDoseGroupedByPlanMessage + actions [take_plan, details]
- dose_reminder_misc: absorve formatDoseGroupedMiscMessage + actions [take_misc, details]
- getTimeOfDayEmoji movido para notificationHelpers.js
- doseFormatters.js deletado (lógica absorvida por L2)
- telegramChannel.js: import de doseFormatters removido

EOF
)"
git push origin fix/wave-12/notification-architecture-consolidation
```
