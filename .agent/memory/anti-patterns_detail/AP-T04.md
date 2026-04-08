# AP-T04 — Leave `setInterval()` running during test suite

**Category:** Testing
**Status:** active
**Related Rule:** R-077
**Applies To:** all

## Problem

Garbage collection never runs, memory grows indefinitely

## Prevention

Export `cancelGarbageCollection()` / `restartGarbageCollection()` and call in test hooks
