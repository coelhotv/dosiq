# AP-T08 — Run full test suite on every commit locally

**Category:** Testing
**Status:** active
**Related Rule:** R-051
**Applies To:** all

## Problem

Blocks development, 6.5 min wait time discourages testing

## Prevention

Use `npm run test:changed` (30s) before commit, full suite only on push or before merge
