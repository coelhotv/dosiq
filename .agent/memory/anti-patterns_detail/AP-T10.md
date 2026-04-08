# AP-T10 — Use `new Date()` in tests without timezone awareness

**Category:** Testing
**Status:** active
**Related Rule:** R-020
**Applies To:** all

## Problem

Tests pass in GMT but fail in GMT-3 (local); date off by 1 day

## Prevention

Always use `parseLocalDate()` or `new Date(str + 'T00:00:00')` for date comparisons
