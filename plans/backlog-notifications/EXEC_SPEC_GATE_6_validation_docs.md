# EXEC SPEC — GATE 6: Validation, Frontend Sync & Documentation

> **Part of**: `notifications_architecture_consolidation_plan.md`
> **Branch**: `fix/wave-12/notification-architecture-consolidation`
> **Prerequisite**: GATE 5.5 approved and committed
> **Difficulty**: Low — verification, small fixes, and documentation
> **Estimated time**: 2–3 hours

---

## Objective

Final validation gate. No architectural changes. Confirms all previous gates work together end-to-end and documents the new architecture for future maintainers.

1. Sync `dlqService.js` (frontend) labels with backend `kindSchema`.
2. Run the full validation suite.
3. Smoke-test all three channels for key notification kinds.
4. Update `docs/architecture/NOTIFICATIONS.md`.
5. Create the PR.

---

## Prerequisites

```bash
git log --oneline -10
# All previous gate commits must be visible

# Run the full success criteria checklist from the consolidation plan
grep -r "doseFormatters" server/ apps/ 2>/dev/null
# Expected: zero results

grep -r "data\.isRetry" server/ api/ 2>/dev/null
# Expected: zero results

grep -n "passthrough" server/notifications/payloads/buildNotificationPayload.js
# Expected: zero results

wc -l server/notifications/channels/telegramChannel.js
# Expected: less than 100 lines
```

If any of the above return unexpected results, **stop and fix the issue before continuing**.

---

## Step-by-Step Instructions

### Step 1 — Sync `dlqService.js` labels with `kindSchema`

Open `apps/web/src/services/api/dlqService.js`.

Find the `formatNotificationType` function (or equivalent). It maps `kind` strings to human-readable labels.

Open `server/notifications/payloads/buildNotificationPayload.js` and read the `kindSchema` enum values.

Compare the two lists. The frontend labels must cover all backend kinds:

```
dose_reminder           → "Lembrete de Dose"
dose_reminder_by_plan   → "Lembrete de Plano"
dose_reminder_misc      → "Lembrete de Doses Diversas"
stock_alert             → "Alerta de Estoque"
daily_digest            → "Resumo Diário"
adherence_report        → "Relatório de Adesão"
monthly_report          → "Relatório Mensal"
titration_alert         → "Alerta de Titulação"
prescription_alert      → "Alerta de Prescrição"
dlq_digest              → "DLQ Digest"
```

If any kind is missing from the frontend function, add it. If the function uses a `switch`, add the missing `case`. If it uses an object map, add the key-value pair.

### Step 2 — Run the full validation suite

```bash
cd /Users/coelhotv/git-icloud/dosiq
npm run validate:agent
```

This command has a 10-minute kill switch. If it fails:
- Read the error output carefully.
- Fix the specific failing test or lint error.
- Do **not** skip tests or modify test assertions to make them pass artificially.
- Re-run until green.

### Step 3 — Smoke test: end-to-end channel verification

This step verifies that the pipeline produces correct output for key notification kinds. You will do this by **tracing the code manually** if no local simulation environment is available, or by running a local test script if one exists.

For each of the following, describe the output that would be delivered to each channel:

#### Test Case A: `dose_reminder_by_plan`
Input to dispatcher:
```js
{
  kind: 'dose_reminder_by_plan',
  data: {
    planName: 'Quarteto Fantástico',
    planId: 'abc12345',
    scheduledTime: '12:15',
    hour: 12,
    doses: [
      { medicineName: 'SeloZok 50mg', dosagePerIntake: 1, dosageUnit: 'cp' },
      { medicineName: 'Forxiga 10mg', dosagePerIntake: 1, dosageUnit: 'cp' }
    ]
  },
  context: {}
}
```

Expected Telegram `body` (rich):
```
🍽️ *Quarteto Fantástico*

2 medicamentos agora — 12:15

  💊 SeloZok 50mg — 1 cp
  💊 Forxiga 10mg — 1 cp
```

Expected Push `pushBody` (plain):
```
Quarteto Fantástico: 2 medicamentos agora (12:15)
• SeloZok 50mg — 1 cp
• Forxiga 10mg — 1 cp
```

Expected `actions[]`:
```js
[
  { id: 'take_plan', label: '✅ Registrar este plano', params: { planIdShort: 'abc12345', hhmm: '12:15' } },
  { id: 'details', label: '📋 Detalhes', params: { kind: 'plan', planIdShort: 'abc12345' } }
]
```

Expected Telegram `callback_data` values:
- Button 1: `takeplan:abc12345:12:15`
- Button 2: `details:plan:abc12345`

#### Test Case B: `daily_digest`
Input:
```js
{
  kind: 'daily_digest',
  data: {
    firstName: 'João',
    hour: 8,
    pendingCount: 1,
    medicines: [{ name: 'Atorvastatina', time: '08:00', dosage: '1 cp' }]
  },
  context: {}
}
```

Verify `body` starts with a greeting, includes "João" in bold, lists the medicine.

#### Test Case C: DLQ retry
Input:
```js
{
  kind: 'daily_digest',
  data: { firstName: 'João', hour: 8, pendingCount: 1, medicines: [...] },
  context: { isRetry: true }
}
```

Verify:
- `title` contains "🔄" and "(Reenvio)"
- `body` ends with "_Esta é uma nova tentativa de envio\\._"
- `pushBody` ends with "(Reenvio)"

Trace through `buildNotificationPayload.js` to confirm `context.isRetry` triggers the decoration block.

### Step 4 — Update `docs/architecture/NOTIFICATIONS.md`

Read the current file first:
```bash
cat docs/architecture/NOTIFICATIONS.md
```

Update the file to reflect the post-consolidation architecture. The document should include:

**Section 1: Architecture Overview**
```
L1 (Business) → L2 (Presentation) → L3 (Delivery)
```
Include the ASCII diagram from `notifications_architecture_consolidation_plan.md`.

**Section 2: Layer Responsibilities**
- L1: domain data only, no formatting
- L2: all formatting, owns actions[], deeplinks
- L3: channel-native delivery, maps actions[] to affordances

**Section 3: Payload Contract**
Document the `notificationPayloadSchema` fields:
- `title` (string, escaped for MarkdownV2)
- `body` (string, MarkdownV2 rich)
- `pushBody` (string, plain text)
- `deeplink` (string | null)
- `actions[]` (`{ id, label, params? }`)
- `metadata` (`{ kind, builtAt, correlationId?, details? }`)

**Section 4: How to Add a New Kind**
Step-by-step:
1. Add string to `kindSchema` in `buildNotificationPayload.js`
2. Add `<kind>DataSchema` Zod export
3. Add `case` in switch with `body`, `pushBody`, `actions[]`
4. Update L1 caller to pass raw data matching the schema
5. Add label to `dlqService.js` `formatNotificationType`
6. Add test

**Section 5: How to Add a New Channel**
Step-by-step:
1. Create `server/notifications/channels/<canal>Channel.js`
2. Implement `send<Canal>Notification({ userId, payload, context, ... })`
3. Map `payload.actions[]` to channel-native affordances (if supported)
4. Return standard result shape: `{ channel, success, attempted, delivered, failed, errors }`
5. Register in `dispatcher/dispatchNotification.js` and `policies/resolveChannelsForUser.js`

**Section 6: Related Documents**
- `plans/backlog-notifications/notifications_architecture_vision.md` — strategic roadmap
- `plans/backlog-notifications/notifications_architecture_consolidation_plan.md` — this refactor's plan
- ADR-037, ADR-038, ADR-039 — architectural decisions

---

## What NOT To Do

- **DO NOT** make any code changes in this gate except to `dlqService.js` labels.
- **DO NOT** skip the `validate:agent` run.
- **DO NOT** modify test files to make tests pass.
- **DO NOT** commit without human approval.
- **DO NOT** merge the PR yourself — merging requires explicit human approval.

---

## Verification Commands (Full Success Criteria Checklist)

Run all of these and include output in the Gate Report:

```bash
cd /Users/coelhotv/git-icloud/dosiq

# 1. No doseFormatters anywhere
grep -r "doseFormatters" server/ apps/
# Expected: zero results

# 2. No data.isRetry anywhere
grep -r "data\.isRetry" server/ api/
# Expected: zero results

# 3. No passthrough in L2
grep -n "passthrough" server/notifications/payloads/buildNotificationPayload.js
# Expected: zero results

# 4. telegramChannel.js is lean
wc -l server/notifications/channels/telegramChannel.js
# Expected: < 100 lines

# 5. buildNotificationPayload.js is not too large
wc -l server/notifications/payloads/buildNotificationPayload.js
# Expected: < 700 lines (if over, flag for cosmetic split in a future wave)

# 6. Full suite
npm run validate:agent
# Expected: all green, no timeout

# 7. kindSchema and dlqService in sync
grep -n "dose_reminder_by_plan\|dose_reminder_misc\|dlq_digest\|titration_alert\|prescription_alert" apps/web/src/services/api/dlqService.js
# Expected: all 5 kinds present with labels

# 8. No presentation logic in L1
grep -n "escapeMarkdownV2\|MarkdownV2" server/bot/tasks.js
# Expected: zero results

# 9. No presentation logic in L3 (beyond encodeCallback)
grep -n "escapeMarkdownV2" server/notifications/channels/telegramChannel.js
# Expected: zero results
```

---

## 🛑 HARD STOP — Gate Report

**STOP HERE. Do not create the PR yet.**

Present the following to the human for review:

1. **Full diff** of `apps/web/src/services/api/dlqService.js` (labels added)
2. **Full diff** of `docs/architecture/NOTIFICATIONS.md`
3. **Output of `validate:agent`**: pass/fail, test count, duration
4. **Output of all verification commands above** (copy-paste each result)
5. **Smoke test trace** for all three test cases (A, B, C) — describe what each channel would receive
6. **Complete success criteria checklist** from `notifications_architecture_consolidation_plan.md`:
   - [ ] `grep -r "doseFormatters"` → zero
   - [ ] `grep -r "data.isRetry"` → zero
   - [ ] `grep -n "passthrough"` → zero
   - [ ] `telegramChannel.js` < 100 lines
   - [ ] `buildNotificationPayload.js` < 700 lines
   - [ ] `validate:agent` passes
   - [ ] dose_reminder* in Inbox have visual parity with Telegram
   - [ ] `NOTIFICATIONS.md` updated with extension guides

**Wait for explicit human approval before creating the PR.**

---

## PR Creation (only after human approval)

```bash
cd /Users/coelhotv/git-icloud/dosiq
git push origin fix/wave-12/notification-architecture-consolidation

gh pr create \
  --title "refactor(notifications): consolidação arquitetura 3 camadas Wave 12" \
  --body "$(cat <<'EOF'
## Summary

- Absorve formatação `dose_reminder*` em L2 (era em L3 via `doseFormatters.js`)
- `actions[]` semânticas no payload canônico; Telegram mapeia para `inline_keyboard`
- `metadata` strict whitelist (remove `passthrough()`)
- `context.isRetry` como canal único de reenvio (remove `data.isRetry`)
- L1 passa dados crus de domínio; L2 owna toda formatação e escape
- Inbox renderer parseia MarkdownV2 para paridade visual com Telegram
- `docs/architecture/NOTIFICATIONS.md` atualizado com guias de extensão

## Gates Completed
- GATE 1: Schema & Contract Hardening ✅
- GATE 2: L2 Absorption (dose_reminder family) ✅
- GATE 3: L1 Cleanup (tasks.js) ✅
- GATE 4: L3 Cleanup (channels) ✅
- GATE 5: Dispatcher & Boundary ✅
- GATE 5.5: Inbox Markdown Renderer ✅
- GATE 6: Validation & Docs ✅

## Test plan
- [ ] `npm run validate:agent` passing
- [ ] `dose_reminder_by_plan` delivers identical message to Telegram and Inbox
- [ ] DLQ retry delivers message with "(Reenvio)" decoration
- [ ] No regressions in existing notification kinds
- [ ] Telegram callback buttons functional (no change to wire format)

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

**After PR creation**: wait for Gemini Code Assist review, address comments, then wait for explicit human merge approval. **Do not merge yourself.**
