---
id: AP-W03
title: Use `screen.getByText('X%')` when the same text appears in multiple elements
summary: `"Found multiple elements with text…"` test failure
applies_to:
  - all
tags:
  - safety
  - ui
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-094
layer: warm
bootstrap_default: False
pack: test-hygiene
---

# AP-W03 — Use `screen.getByText('X%')` when the same text appears in multiple elements

**Category:** Ui
**Status:** active
**Related Rule:** R-094
**Applies To:** all

## Problem

`"Found multiple elements with text…"` test failure

## Prevention

Use `container.querySelector('.specific-class').textContent` for non-unique text
