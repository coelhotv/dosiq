---
id: AP-W14
title: Use `new Date('YYYY-MM-DDTHH:MM:00.000Z')` as reference in tests involving `setHours`
summary: Test passes in BRT but fails in CI (UTC): same UTC timestamp = different local hours
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
related_rule: R-106
layer: warm
bootstrap_default: False
pack: date-time
---

# AP-W14 — Use `new Date('YYYY-MM-DDTHH:MM:00.000Z')` as reference in tests involving `setHours`

**Category:** Ui
**Status:** active
**Related Rule:** R-106
**Applies To:** all

## Problem

Test passes in BRT but fails in CI (UTC): same UTC timestamp = different local hours

## Prevention

Use `const now = new Date(); now.setHours(h, m, 0, 0)` for timezone-agnostic dates
