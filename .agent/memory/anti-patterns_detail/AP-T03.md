# AP-T03 — Store data in localStorage during tests

**Category:** Testing
**Status:** active
**Related Rule:** R-076
**Applies To:** all

## Problem

~200MB memory waste per test suite run

## Prevention

Check `process.env.NODE_ENV === 'test'` and skip persistence in tests
