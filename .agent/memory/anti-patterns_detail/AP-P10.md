# AP-P10 — `select('*')` when only need count

**Category:** Performance
**Status:** active
**Related Rule:** R-119
**Applies To:** all

## Problem

All columns transferred unnecessarily. 90 days logs × 10 protocols = ~2700 rows × ~500 bytes/row = 1.35MB waste per query

## Prevention

Use `select('*', { count: 'exact', head: true })` — HEAD request, zero data bytes, server returns only count
