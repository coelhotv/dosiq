---
id: AP-W07
title: Write test expecting UTC timestamp as "tomorrow" when timezone is BRT (UTC-3)
summary: Test fails: `2026-03-06T02:00:00Z` = 23:00 BRT = still "today"
applies_to:
  - all
tags:
  - safety
  - ui
  - datetime
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-020
layer: warm
bootstrap_default: False
pack: date-time
---

# AP-W07 — Write test expecting UTC timestamp as "tomorrow" when timezone is BRT (UTC-3)

**Category:** Ui
**Status:** active
**Related Rule:** R-020
**Applies To:** all

## Problem

Test fails: `2026-03-06T02:00:00Z` = 23:00 BRT = still "today"

## Prevention

Use `T04:00:00Z` (01:00 BRT) for reliable "next day" test data
