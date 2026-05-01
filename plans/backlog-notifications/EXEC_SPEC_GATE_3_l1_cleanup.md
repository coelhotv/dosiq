# EXEC SPEC — GATE 3: L1 Cleanup — tasks.js Purge Presentation

> **Part of**: `notifications_architecture_consolidation_plan.md`
> **Branch**: `fix/wave-12/notification-architecture-consolidation`
> **Prerequisite**: GATE 2 approved and committed
> **Difficulty**: Medium — requires understanding data flow between tasks.js and the dispatcher
> **Estimated time**: 2–3 hours

---

## Objective

Remove all presentation logic from Layer 1 (`server/bot/tasks.js`). L1 must only produce raw domain data structs — no string building, no emoji, no Markdown, no calls to formatters. All formatting belongs in L2 (`buildNotificationPayload.js`).

Specific changes:
1. `checkRemindersViaDispatcher` — pass raw dose data (no `formatMedicineWithStrength`).
2. `runDailyDigestViaDispatcher` — pass raw medicine data.
3. `runDailyAdherenceReportViaDispatcher` — replace `storytelling` string with a structured `comparison` object.
4. Update `adherenceReportDataSchema` in L2 to accept the new `comparison` shape.
5. Audit all other schedulers for stray presentation logic.
6. Move `formatMedicineWithStrength` / `formatIntakeQuantity` calls from L1 to inside L2.

---

## Prerequisites

```bash
git log --oneline -5
# GATE 2 commit must be at the top

# Confirm doseFormatters.js is gone
ls server/bot/utils/doseFormatters.js 2>&1
# Expected: "No such file or directory"

# Confirm dose_reminder* cases use .parse() in buildNotificationPayload
grep -n "doseReminderByPlanDataSchema.parse" server/notifications/payloads/buildNotificationPayload.js
# Must return 1 result
```

---

## Context: What Is Being Fixed

### In `server/bot/tasks.js`

**`checkRemindersViaDispatcher`** (around line 147–157):
Currently calls `formatMedicineWithStrength(d)` before passing to dispatcher. This is presentation logic in L1.

```js
// CURRENT (wrong — presentation in L1)
doses: block.doses.map(d => ({
  medicineName: formatMedicineWithStrength(d),  // ← remove this call
  ...
}))
```

**`runDailyDigestViaDispatcher`** (around line 357–363):
Similarly formats medicine names before passing to L2.

**`runDailyAdherenceReportViaDispatcher`** (around line 481–492):
Builds a `storytelling` string with emoji inline:
```js
storytelling: '📈 Melhora de X% vs ontem'  // ← presentation in L1
```
This must become a raw comparison object that L2 will format.

### In `server/notifications/payloads/buildNotificationPayload.js`

**`adherenceReportDataSchema`** currently has:
```js
storytelling: z.string().optional()
```
Must be updated to:
```js
comparison: z.object({
  previousPercentage: z.number().min(0).max(100),
  deltaPercent: z.number(),
  trend: z.enum(['up', 'down', 'flat'])
}).optional()
```

And the `case 'adherence_report'` must be updated to use `comparison` instead of `storytelling`.

---

## Step-by-Step Instructions

### Step 1 — Read tasks.js to understand current state

Before making any changes, read the relevant functions:
- Search for `checkRemindersViaDispatcher` and read ~30 lines around it.
- Search for `runDailyDigestViaDispatcher` and read ~30 lines.
- Search for `runDailyAdherenceReportViaDispatcher` and read ~30 lines.
- Search for `formatMedicineWithStrength` to find all call sites.

```bash
grep -n "formatMedicineWithStrength\|formatIntakeQuantity\|storytelling" server/bot/tasks.js
```

### Step 2 — Update `checkRemindersViaDispatcher`

Find where doses are mapped before calling `notificationDispatcher.dispatch` (or equivalent). Currently something like:

```js
doses: block.doses.map(d => ({
  medicineName: formatMedicineWithStrength(d),
  dosagePerIntake: d.dosage_per_intake,
  ...
}))
```

Change to pass raw fields:
```js
doses: block.doses.map(d => ({
  medicineName: d.medicine_name,           // raw name, no formatting
  dosagePerIntake: d.dosage_per_intake,
  dosageUnit: d.dosage_unit ?? 'cp',       // raw unit
  protocolId: d.protocol_id
}))
```

**Do not remove `formatMedicineWithStrength` from the file yet** — check if it's used elsewhere first (Step 6).

### Step 3 — Update `runDailyDigestViaDispatcher`

Find where medicines are mapped. Change from formatted to raw:
```js
// BEFORE
medicines: protocols.map(p => ({
  name: formatMedicineWithStrength(p),
  time: p.scheduled_time,
  dosage: formatIntakeQuantity(p)
}))

// AFTER
medicines: protocols.map(p => ({
  name: p.medicine_name,          // raw
  time: p.scheduled_time,
  dosage: `${p.dosage_per_intake} ${p.dosage_unit ?? 'cp'}`  // minimal formatting is OK here since it's a unit label, not a display string
}))
```

> Note: `name` and `time` are structural fields. Combining dosage_per_intake + unit is acceptable in L1 as it is data normalization, not presentation. L2 will format it into the final message string.

### Step 4 — Update `runDailyAdherenceReportViaDispatcher`

Find the storytelling logic. It likely looks like:

```js
const storytelling = percentageYesterday !== null
  ? `📈 Melhora de ${delta}% vs ontem`
  : undefined;

await notificationDispatcher.dispatch({
  ...
  data: {
    ...
    storytelling,
    ...
  }
})
```

Replace with a structured comparison object:
```js
const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
const comparison = percentageYesterday !== null
  ? { previousPercentage: percentageYesterday, deltaPercent: Math.abs(delta), trend }
  : undefined;

await notificationDispatcher.dispatch({
  ...
  data: {
    ...
    comparison,   // replaces storytelling
    ...
  }
})
```

### Step 5 — Update `adherenceReportDataSchema` in `buildNotificationPayload.js`

Find `adherenceReportDataSchema` and change:

```js
// BEFORE
export const adherenceReportDataSchema = z.object({
  firstName: z.string(),
  period: z.string(),
  percentage: z.number().min(0).max(100),
  taken: z.number(),
  total: z.number(),
  storytelling: z.string().optional()  // ← remove
});

// AFTER
export const adherenceReportDataSchema = z.object({
  firstName: z.string(),
  period: z.string(),
  percentage: z.number().min(0).max(100),
  taken: z.number(),
  total: z.number(),
  comparison: z.object({
    previousPercentage: z.number().min(0).max(100),
    deltaPercent: z.number(),
    trend: z.enum(['up', 'down', 'flat'])
  }).optional()  // ← replaces storytelling
});
```

### Step 6 — Update `case 'adherence_report'` in `buildNotificationPayload.js`

Find the `case 'adherence_report':` block. It currently uses `storytelling`. Update it to use `comparison`:

```js
case 'adherence_report': {
  const { firstName, period, percentage, taken, total, comparison } = adherenceReportDataSchema.parse(data);
  const nudge = getMotivationalNudge(percentage);
  title = '📈 Relatório diário';

  const safeName = escapeMarkdownV2(firstName);
  const safePeriod = escapeMarkdownV2(period);

  let richMsg = `Olá, *${safeName}*\\!\n\n`;
  richMsg += `Sua adesão ${safePeriod} foi de *${percentage}%*\n`;
  richMsg += `✅ *${taken}* de *${total}* doses registradas\\.\n\n`;

  let plainMsg = `Olá, ${firstName}!\n`;
  plainMsg += `Sua adesão ${period} foi de ${percentage}% `;
  plainMsg += `✅ ${taken} de ${total} doses registradas.\n`;

  if (comparison) {
    const { deltaPercent, trend } = comparison;
    const trendEmoji = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
    const trendText = trend === 'up'
      ? `Melhora de ${deltaPercent}% vs ontem`
      : trend === 'down'
      ? `Queda de ${deltaPercent}% vs ontem`
      : `Estável vs ontem`;

    richMsg += `*Comparação:* ${trendEmoji} ${escapeMarkdownV2(trendText)}\n\n`;
    plainMsg += `Comparação: ${trendEmoji} ${trendText}\n`;
  }

  richMsg += `_${escapeMarkdownV2(nudge)}_`;
  plainMsg += nudge;

  body = richMsg;
  pushBody = plainMsg;
  break;
}
```

### Step 7 — Audit other schedulers

Run the following to find any remaining presentation logic in L1:

```bash
grep -n "escapeMarkdownV2\|MarkdownV2\|getMotivationalNudge\|getGreeting\|getTimeOfDay\|formatMedicineWithStrength\|formatIntakeQuantity\|storytelling" server/bot/tasks.js
```

For each result found:
- If it's in `checkStockAlertsViaDispatcher`, `checkTitrationAlertsViaDispatcher`, `checkPrescriptionAlertsViaDispatcher`, or `sendDLQDigest` — read the context. If it's constructing a display string (not just computing a domain value), remove it and pass raw data instead.
- If those functions already pass raw data structs, note them as "OK" in your gate report.

### Step 8 — Check if `formatMedicineWithStrength`/`formatIntakeQuantity` can be removed from tasks.js

```bash
grep -n "formatMedicineWithStrength\|formatIntakeQuantity" server/bot/tasks.js
```

If there are zero usages remaining after Steps 2 and 3, also remove their import from `tasks.js`. If they were defined inside `tasks.js`, remove the definition. If they were imported from `notificationHelpers.js`, remove the import.

> Note: `formatMedicineWithStrength` and `formatIntakeQuantity` may still be needed by L2 in the future — do NOT delete them from `notificationHelpers.js`. Only remove them from `tasks.js` if no longer called there.

---

## What NOT To Do

- **DO NOT** modify `telegramChannel.js` — that is GATE 4.
- **DO NOT** modify `dispatchNotification.js` — that is GATE 5.
- **DO NOT** remove `formatMedicineWithStrength` from `notificationHelpers.js` — L2 may need it.
- **DO NOT** change `monthly_report` case (uses `adherenceReportDataSchema` too) unless it also uses `storytelling` — if it does, apply same treatment; if it doesn't, leave it alone.
- **DO NOT** change any channel files.
- **DO NOT** add presentation logic to `tasks.js` as a workaround.
- **DO NOT** commit without human approval.

---

## Verification Commands

```bash
# 1. Lint
cd /Users/coelhotv/git-icloud/dosiq && npm run lint

# 2. Critical tests
npm run test:critical

# 3. No presentation helpers in tasks.js
grep -n "escapeMarkdownV2\|MarkdownV2\|getMotivationalNudge\|getGreeting\|getTimeOfDay" server/bot/tasks.js
# Expected: zero results

# 4. No formatMedicineWithStrength in tasks.js
grep -n "formatMedicineWithStrength\|formatIntakeQuantity" server/bot/tasks.js
# Expected: zero results (or explain any remaining ones in the report)

# 5. storytelling gone from tasks.js
grep -n "storytelling" server/bot/tasks.js
# Expected: zero results

# 6. comparison object appears in tasks.js
grep -n "comparison" server/bot/tasks.js
# Expected: results showing the new comparison object

# 7. adherenceReportDataSchema uses comparison not storytelling
grep -n "storytelling" server/notifications/payloads/buildNotificationPayload.js
# Expected: zero results
```

---

## 🛑 HARD STOP — Gate Report

**STOP HERE. Do not commit. Do not proceed to GATE 4.**

Present the following to the human for review:

1. **Full diff** of `server/bot/tasks.js` (changed functions only, not the entire 900-line file)
2. **Full diff** of `server/notifications/payloads/buildNotificationPayload.js` (adherenceReportDataSchema + case)
3. **Output** of all verification commands above
4. **Audit results** for other schedulers — list each one and whether it was OK or modified:
   - `checkStockAlertsViaDispatcher`: OK / Modified (describe change)
   - `checkTitrationAlertsViaDispatcher`: OK / Modified
   - `checkPrescriptionAlertsViaDispatcher`: OK / Modified
   - `sendDLQDigest`: OK / Modified
5. **Confirm**: "telegramChannel.js was not modified"
6. **Confirm**: "dispatchNotification.js was not modified"

**Wait for explicit human approval before proceeding.**

---

## Commit (only after human approval)

```bash
cd /Users/coelhotv/git-icloud/dosiq
npm run lint
git add server/bot/tasks.js server/notifications/payloads/buildNotificationPayload.js
git commit -m "$(cat <<'EOF'
refactor(tasks): L1 passa dados crus de domínio; L2 owna toda formatação

- checkRemindersViaDispatcher: doses passadas sem formatMedicineWithStrength
- runDailyDigestViaDispatcher: medicines passadas sem formatMedicineWithStrength
- runDailyAdherenceReportViaDispatcher: storytelling string → comparison object
- adherenceReportDataSchema: storytelling removido, comparison adicionado
- case adherence_report: constrói storytelling a partir de comparison em L2

EOF
)"
git push origin fix/wave-12/notification-architecture-consolidation
```
