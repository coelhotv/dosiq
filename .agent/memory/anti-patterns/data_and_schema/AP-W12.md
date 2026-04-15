---
id: AP-W12
title: Use `||` fallback for numeric props that can legitimately be `0`
summary: `dosage_per_intake = 0` becomes `1`; incorrect dose recorded
applies_to:
  - all
tags:
  - ui
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-104
layer: warm
bootstrap_default: False
pack: schema-data
---

# AP-W12 — Use `||` fallback for numeric props that can legitimately be `0`

**Category:** Ui
**Status:** active
**Related Rule:** R-104
**Applies To:** all

## Problem

Using `||` as fallback for numeric props can coerce a valid `0` into the fallback value and silently change business meaning.

## Prevention

Use `??` instead of `||` for numeric props that can legitimately be `0`.

Example:

```javascript
// ❌ WRONG
const dosage = dosagePerIntake || 1

// ✅ CORRECT
const dosage = dosagePerIntake ?? 1
```
