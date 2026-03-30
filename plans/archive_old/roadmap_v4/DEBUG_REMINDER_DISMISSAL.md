# Debug: Reminder Optimizer Dismissal Issue

**Status**: RESOLVED ✅
**Last Updated**: 2026-03-30
**Next Step**: —

---

## Problem Summary

**Issue**: When user accepts a reminder time suggestion (I03), the suggestion is processed BUT:
- The protocol is **removed from its treatment plan association** (`treatment_plan_id` becomes NULL)
- User cannot find expected localStorage keys for dismissed suggestions
- Reminder dismissal mechanism may not be working

**User Observation**:
- User has >21 days of medication logs
- Tested optimizer by accepting all suggestions
- Observed: time_schedule updated ✓ but treatment_plan_id removed ✗
- After accepting all suggestions: no more suggestions appear
- localStorage does NOT contain expected `optimizer_dismissed_*` keys

---

## Investigation Phases

### Phase 1: Timestamp Validation Error (RESOLVED ✓)
**Discovery**: AdherenceHeatmap + ReminderSuggestion failing silently
**Root Cause**: Supabase returns timestamps as `2026-03-08T13:15:00+00:00` but Zod expects `Z` suffix
**Fix Applied**: Added `normalizeTimestamps()` in [logService.js](../src/shared/services/api/logService.js)
- Replaces `+00:00` → `Z` suffix in all 7 log-returning functions
- `getAll()`, `getByProtocol()`, `create()`, `update()`, `getAllPaginated()`, `getByDateRange()`, `getByMonth()`

### Phase 2: Data Insufficiency in AdherenceHeatmap (RESOLVED ✓)
**Discovery**: Even with timestamp fix, heatmap showed "<21 days" despite user having 30-day streak
**Root Cause**: HealthHistory.jsx only loaded 30 paginated logs; analyzeAdherencePatterns() needs FULL history
**Fix Applied**: Modified [HealthHistory.jsx](../src/views/HealthHistory.jsx)
- Added `allLogsForAnalysis` state (separate from paginated timeline)
- Changed useMemo to use `allLogsForAnalysis` instead of limited `timelineLogs`
- Now fetches 3 datasets in parallel: month logs + paginated timeline + full history

### Phase 3: Reminder Dismissal Storage Issue (RESOLVED ✓)
**Discovery**: localStorage does NOT contain `optimizer_dismissed_*` keys
**Observation**: User accepted all suggestions but keys never created
**Hypothesis**:
1. `dismissSuggestion()` function NOT being called
2. OR `dismissSuggestion()` failing silently
3. OR component not rendering / buttons not functional

**Code Added for Debugging** (commits TBD):

#### 1. [reminderOptimizerService.js](../src/features/protocols/services/reminderOptimizerService.js) - Enhanced Logging

```javascript
export function dismissSuggestion(protocolId, permanent = false) {
  // Guard clause: ambiente não-browser
  if (typeof window === 'undefined') {
    console.warn('[reminderOptimizerService] dismissSuggestion called in non-browser environment')
    return
  }

  const key = `optimizer_dismissed_${protocolId}`
  const value = JSON.stringify({
    timestamp: Date.now(),
    permanent,
  })

  try {
    localStorage.setItem(key, value)
    console.log('[reminderOptimizerService] Suggestion dismissed:', {
      protocolId,
      key,
      permanent,
      timestamp: new Date().toISOString(),
      storageSize: Object.keys(localStorage).length,
    })
  } catch (error) {
    console.error('[reminderOptimizerService] Failed to dismiss suggestion:', {
      protocolId,
      key,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}
```

#### 2. [ReminderSuggestion.jsx](../src/features/protocols/components/ReminderSuggestion.jsx) - Button Click Logging

```javascript
const handleKeep = () => {
  console.log('[ReminderSuggestion] handleKeep clicked:', { protocolId, protocolName })
  dismissSuggestion(protocolId, false) // 30 dias
  onDismiss()
}

const handleNeverAsk = () => {
  console.log('[ReminderSuggestion] handleNeverAsk clicked:', { protocolId, protocolName })
  dismissSuggestion(protocolId, true) // Permanente
  onDismiss()
}
```

---

## Secondary Issue: treatment_plan_id Removal

**Observation**: When time_schedule is updated, treatment_plan_id is NULLED

**Analysis Done**:
- ✓ `handleReminderSuggestionAccept()` passes only `{ time_schedule: newTimeSchedule }` to `protocolService.update()`
- ✓ `protocolUpdateSchema` uses `.partial()` — all fields optional, validation OK
- ✓ Supabase `.update({ time_schedule: ... })` should NOT affect other fields
- ✓ `protocolService.update()` does SELECT with `treatment_plan:treatment_plans(*)` join — should load it
- ✓ `useDashboardContext` uses `protocolService.getActive()` NOT `getAll()` — includes treatment_plan
- ? Possible: `refresh()` → `refetchAll()` reloads without treatment_plan? (needs verification)
- ? Possible: Database trigger/constraint removing treatment_plan_id on time_schedule change? (not found in migrations)

**Schema Observations**:
- [protocolSchema.js](../src/schemas/protocolSchema.js) line 75-80: treatment_plan_id has `.transform((val) => val || null)` but only applies if field present in payload

---

## Testing Procedure (When Next Suggestion Appears)

### Step 1: Capture Logs
1. Open browser DevTools → Console
2. Clear previous logs
3. Wait for or trigger reminder suggestion
4. Click **"Manter"** or **"Não perguntar mais"** button

### Step 2: Observe Console Output

**Expected Log Sequence**:

```
[ReminderSuggestion] handleKeep clicked: {
  protocolId: "uuid-xxx",
  protocolName: "Medicamento Y"
}

[reminderOptimizerService] Suggestion dismissed: {
  protocolId: "uuid-xxx",
  key: "optimizer_dismissed_uuid-xxx",
  permanent: false,
  timestamp: "2026-03-09T...",
  storageSize: 10
}
```

**Possible Outcomes**:

| Scenario | Logs Seen | Root Cause | Next Action |
|----------|-----------|-----------|-------------|
| ✓ WORKING | Both logs | dismissal working correctly | Investigate treatment_plan_id removal |
| ✗ Component not rendering | No logs | ReminderSuggestion not mounted/visible | Check Dashboard suggestion rendering logic |
| ✗ Button not working | First log only | onClick handler dead/not attached | Check React event binding |
| ✗ dismissSuggestion not called | No logs | onDismiss not triggering subsequent call | Check component prop chain |
| ✗ localStorage fails | "Failed to dismiss suggestion" log | localStorage quota exceeded / permission denied | Check browser storage settings |

### Step 3: Check localStorage After Dismissal

```javascript
// In console
Object.keys(localStorage).filter(k => k.startsWith('optimizer_dismissed_'))
// Should return: ["optimizer_dismissed_uuid-xxx", ...]
```

---

## Code Architecture Overview

### How Reminder Suggestions Flow

1. **Dashboard.jsx** (line ~500)
   - Calls `useMemo` → `computedReminder = analyzeReminders(rawProtocols, logs)`

2. **Dashboard.jsx** (line ~522)
   - Sets state: `setReminderSuggestion(computedReminder.suggestion)`

3. **Dashboard.jsx** (render section)
   - Renders `<ReminderSuggestion suggestion={reminder} protocolId={...} onAccept={handleReminderSuggestionAccept} onDismiss={handleReminderSuggestionDismiss} />`

4. **ReminderSuggestion.jsx**
   - User clicks "Manter" → `handleKeep()` → calls `dismissSuggestion(protocolId, false)` + `onDismiss()`
   - User clicks "Ajustar" → `handleAccept()` → calls `onAccept(newTime)`

5. **Dashboard.jsx** - `handleReminderSuggestionAccept`
   - Finds protocol by ID in `rawProtocols`
   - Calls `protocolService.update(id, { time_schedule: newTimeSchedule })`
   - Calls `refresh()` → refetches all data

6. **reminderOptimizerService.js** - `dismissSuggestion()`
   - Stores `{ timestamp, permanent }` in localStorage key `optimizer_dismissed_{protocolId}`
   - Used by `isSuggestionDismissed()` to check if dismissal expired (30 days for temporary, permanent for never-ask)

### Key Files for Investigation

| File | Lines | Purpose |
|------|-------|---------|
| [Dashboard.jsx](../src/views/Dashboard.jsx) | 534-567 | handleReminderSuggestionAccept — processes time_schedule update |
| [Dashboard.jsx](../src/views/Dashboard.jsx) | 545-562 | Includes debug logging (added in previous session) |
| [ReminderSuggestion.jsx](../src/features/protocols/components/ReminderSuggestion.jsx) | 30-40 | Button handlers with NEW dismissal logging |
| [reminderOptimizerService.js](../src/features/protocols/services/reminderOptimizerService.js) | 19-123 | analyzeReminderTiming — generates suggestions |
| [reminderOptimizerService.js](../src/features/protocols/services/reminderOptimizerService.js) | 130-194 | dismissSuggestion + isSuggestionDismissed with NEW logging |
| [protocolService.js](../src/features/protocols/services/protocolService.js) | 121-145 | update() function with treatment_plan join |
| [protocolSchema.js](../src/schemas/protocolSchema.js) | 1-100 | Schema definitions — check treatment_plan_id validation |

---

## Questions for Next Investigator

When logs are available, answer these:

1. **Does `[ReminderSuggestion] handleKeep clicked` appear?**
   - If NO → component not rendering or onClick broken
   - If YES → proceed to Q2

2. **Does `[reminderOptimizerService] Suggestion dismissed` appear?**
   - If NO → dismissSuggestion() not being called
   - If YES → proceed to Q3

3. **Does `Failed to dismiss suggestion` error appear instead?**
   - If YES → localStorage.setItem() threw error, check error.message

4. **Does localStorage have `optimizer_dismissed_*` keys after dismissal?**
   - If NO → dismissal log claims success but setItem didn't actually persist
   - If YES → dismissal is working; investigate treatment_plan_id separately

5. **For treatment_plan_id removal: After accepting time suggestion, check:**
   - Before update: `protocol.treatment_plan_id = "uuid-xxx"`? (see Dashboard debug log line 549)
   - After update: Does protocol reload with treatment_plan still attached?
   - In DB: Did treatment_plan_id actually change to NULL or is it a data loading issue?

---

## Timeline

| Date | Task | Status |
|------|------|--------|
| 2026-03-08 | Fix timestamp validation (ISO 8601 +00:00 → Z) | ✓ COMPLETE |
| 2026-03-08 | Fix AdherenceHeatmap data insufficiency (<21 days bug) | ✓ COMPLETE |
| 2026-03-08 | Protocol edit modal: fixed prop names + onSave persistence | ✓ COMPLETE |
| 2026-03-09 | Add dismissal logging to reminderOptimizerService + ReminderSuggestion | ✓ COMPLETE |
| 2026-03-09 | Attempt to reproduce — NO suggestions generated yet | ⏳ WAITING |
| 2026-03-30 | Capture logs when next suggestion appears | ✓ COMPLETE |
| 2026-03-30 | Fix treatment_plan_id nullification (Zod transform bug) | ✓ COMPLETE |

---

## Notes for Future Agent

- **Context**: User accepted all previous suggestions → no more suggestions until they take meds again in different time window
- **How to trigger test**: User needs to either:
  1. Wait for natural suggestion (will happen if they take meds at different time)
  2. Or manually reset cache: `localStorage.removeItem('protocols:active')` + reload
  3. Or create test data scenario
- **Importance**: Reminder optimizer is I03 feature; treatment plan association is core data integrity
- **Complexity**: Two separate issues intertwined — dismissal storage AND data persistence
- **Related PRs/Issues**: Check GitHub for issues tagged "reminder-optimizer" or "I03"

---

## References

- **Reminder Optimizer Spec**: `plans/EXEC_SPEC_FASE_6.md` (Phase 6.1 or 6.2)
- **Related Service**: [reminderOptimizerService.js](../src/features/protocols/services/reminderOptimizerService.js)
- **Related Component**: [ReminderSuggestion.jsx](../src/features/protocols/components/ReminderSuggestion.jsx)
- **Memory Notes**: Check `.memory/rules.md` for R-111 to R-114 (reminder optimizer rules)
- **Previous Fixes**: Commits fixing timestamp issues + HealthHistory data loading

