# AP-W07 — Write test expecting UTC timestamp as "tomorrow" when timezone is BRT (UTC-3)

**Category:** Ui
**Status:** active
**Related Rule:** R-020
**Applies To:** all

## Problem

Test fails: `2026-03-06T02:00:00Z` = 23:00 BRT = still "today"

## Prevention

Use `T04:00:00Z` (01:00 BRT) for reliable "next day" test data
