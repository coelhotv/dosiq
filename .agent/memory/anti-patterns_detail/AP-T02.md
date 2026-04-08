# AP-T02 — Skip test cleanup (cache, mocks, timers)

**Category:** Testing
**Status:** active
**Related Rule:** R-078
**Applies To:** all

## Problem

Memory accumulation, OOM on 8GB machines, state leaks between tests

## Prevention

Call `afterEach()`: `clearCache()`, `vi.clearAllMocks()`, `vi.clearAllTimers()`, `if (global.gc) global.gc()`
