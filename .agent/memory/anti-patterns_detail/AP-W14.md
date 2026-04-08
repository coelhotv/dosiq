# AP-W14 — Use `new Date('YYYY-MM-DDTHH:MM:00.000Z')` as reference in tests involving `setHours`

**Category:** Ui
**Status:** active
**Related Rule:** R-106
**Applies To:** all

## Problem

Test passes in BRT but fails in CI (UTC): same UTC timestamp = different local hours

## Prevention

Use `const now = new Date(); now.setHours(h, m, 0, 0)` for timezone-agnostic dates
