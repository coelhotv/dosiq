# AP-T06 — Hardcode `setTimeout()` for timing in `act()` blocks

**Category:** Testing
**Status:** active
**Related Rule:** R-073
**Applies To:** all

## Problem

Timing-dependent, flaky in CI; can timeout unexpectedly

## Prevention

Use `vi.useFakeTimers()` + `vi.runAllTimersAsync()` OR `waitFor()` polling (no hardcoded delays)
