# AP-T01 — Use parallel threads (>1) without testing for race conditions

**Category:** Testing
**Status:** active
**Related Rule:** R-081
**Applies To:** all

## Problem

Tests pass locally, fail in CI; unpredictable hangs

## Prevention

Default: 1 thread (`npm run test:fast`). Use `--maxThreads=2` only if test isolation verified
