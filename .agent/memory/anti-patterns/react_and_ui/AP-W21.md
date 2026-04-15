---
id: AP-W21
title: Batch UI Promises Single-Item Implementation
summary: Batch UI Promises Single-Item Implementation
applies_to:
  - all
tags:
  - ui
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-136
layer: cold
bootstrap_default: False
pack: react-hooks
---

# AP-W21 — Batch UI Promises Single-Item Implementation

**Category:** Ui
**Status:** active
**Related Rule:** R-136
**Applies To:** all

## Problem



## Prevention




**Anti-Pattern:** Callback handlers that claim to handle batch operations (UI: "Confirmar 3 doses") but only implement single-item logic (implementation: `doses[0]`).

**Why it fails:** 
- Contradicts UI contract
- User selects multiple items, expects all to be processed
- Only first item processed = data loss (remaining items not registered)
- Causes bug reports: "I clicked Confirmar, but only 1 of 3 doses was registered"

**Corrected in Wave 6.5:** Issue #426 HIGH priority fix. Implemented `handleRegisterDosesAll()` that loops through all doses sequentially:
```javascript
const handleRegisterDosesAll = async (doses) => {
  for (const dose of doses) {
    await logService.create(dose)
  }
  refresh()
}
```

**Prevention:** 
- Write test case for batch operation: `test('should register all doses in array')`
- Code review: check if loop processes all array items, not just [0]
