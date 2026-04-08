# AP-T05 — Test file >300 lines with multiple unrelated test suites

**Category:** Testing
**Status:** active
**Related Rule:** R-079
**Applies To:** all

## Problem

Memory accumulation in single worker, OOM on 8GB machines

## Prevention

Split by scope: one hook/component per file (e.g., `useCachedQuery.test.jsx` + separate `useCachedQueries.test.jsx`)
