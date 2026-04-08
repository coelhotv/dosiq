# AP-P09 — N+1 Query Pattern: `Promise.all(items.map(async item => supabase.from('table').select()))`

**Category:** Performance
**Status:** active
**Related Rule:** R-118
**Applies To:** all

## Problem

N queries Supabase simultaneous. With 10 items → 10 round-trips HTTP, each blocking Main Thread. 100ms+ blocking (safari trace M7). With `select('*')` each = ~500 bytes × 10 = 5KB waste per call

## Prevention

Batch query: 1 `SELECT key` for all items, then `Map.set(key, count)` client-side O(M) grouping. Eliminates round-trip amplification
