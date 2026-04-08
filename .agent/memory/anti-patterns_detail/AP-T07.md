# AP-T07 — Resolve Promise only after assertion without `finally`

**Category:** Testing
**Status:** active
**Related Rule:** R-072
**Applies To:** all

## Problem

If assertion fails, Promise stays pending → Vitest hangs indefinitely

## Prevention

Wrap in `try/finally`: resolve always happens, even on error
