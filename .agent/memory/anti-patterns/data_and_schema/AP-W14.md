---
title: Use `new Date('YYYY-MM-DDTHH:MM:00.000Z')` as reference in tests involving `setHours`
summary: "Test passes in BRT but fails in CI (UTC): same UTC timestamp = different local hours"
layer: warm
status: active
applies_to:
  paths:
    - packages/**
    - "**/schemas/**"
  diff_triggers:
    - setHours
  keywords:
    - use
    - new
    - date
    - yyyy
    - ddthh
    - reference
    - tests
    - involving
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W14
last_triggered: None
legacy_pack: date-time
related_rule: R-106
tags:
  - safety
  - ui
  - datetime
trigger_count: 0
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
