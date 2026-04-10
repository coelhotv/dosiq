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
