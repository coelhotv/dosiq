---
id: AP-S01
title: Zod enum values don't match database CHECK constraint
summary: 500 error on INSERT, data rejected by database
applies_to:
  - all
tags:
  - safety
  - database
  - schema
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-082
layer: hot
bootstrap_default: True
pack: schema-data
---

# AP-S01 — Zod enum values don't match database CHECK constraint

**Category:** Schema
**Status:** active
**Related Rule:** R-082
**Applies To:** all

## Problem

500 error on INSERT, data rejected by database

## Prevention

Keep Zod and SQL schemas synchronized; test with real INSERT


**Problem:** Stock prediction calculates `daysRemaining = currentStock / dailyConsumption`, but `dailyConsumption` from `calculateExpectedDoses()` returns number of DOSES, not number of PILLS. Forgetting to multiply by `dosage_per_intake` produces wildly incorrect stock forecasts.

**Impact:**
- User has 90 comprimidos of Omega-3
- Takes 1 dose/day × 3 comprimidos per dose = 3 comprimidos/day
- Bug: calculates 90 / 1 = 90 days (WRONG)
- Correct: 90 / 3 = 30 days
- **30-day difference in refill planning = massive UX failure**

**Real case (Wave 7 Stock Prediction — 2026-03-25):**
```javascript
// ❌ WRONG — calculateExpectedDoses returns DOSES, not pills
const expectedDaily = calculateExpectedDoses(activeProtocols, 1)  // returns 1 dose
const dailyConsumption = expectedDaily                            // 1 (not 3 pills!)
const daysRemaining = currentStock / dailyConsumption             // 90 / 1 = 90 days ❌

// ✅ CORRECT — multiply by dosage_per_intake
const expectedDoses = calculateExpectedDoses(activeProtocols, 1)
const dosagePerIntake = activeProtocols[0]?.dosage_per_intake || 1
const dailyConsumption = expectedDoses * dosagePerIntake          // 1 × 3 = 3 pills
const daysRemaining = currentStock / dailyConsumption             // 90 / 3 = 30 days ✅
```

**Prevention:**
- Understand the output of `calculateExpectedDoses()` — it returns DOSES, not pills
- Every time you convert doses to pills, multiply by `dosage_per_intake`
- Test with a known example: 90 pills, 3 pills/day = 30 days. If your code produces 90, you forgot the multiplier
- Add a comment explaining the conversion: `// Multiply by dosage_per_intake to convert doses→pills`

**Related:** R-148 (Domain-Aware Calculations)

---
