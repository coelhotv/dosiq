# AP-A04 — Compare local `new Date()` with ISO timestamps without zeroing hours

**Category:** Adherence
**Status:** active
**Related Rule:** R-114
**Applies To:** all

## Problem

±1 day boundary errors when local time ≠ UTC (GMT-3 offset). Log taken at 2026-03-08T09:00-03:00 may be filtered out of "14 days ago" window.

## Prevention

Always call `.setHours(0, 0, 0, 0)` on date boundaries for consistent timezone-agnostic comparison
