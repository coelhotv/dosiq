---
title: Use `screen.getByText('X%')` when the same text appears in multiple elements
summary: "`\"Found multiple elements with text…\"` test failure"
layer: warm
status: active
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - use
    - screen
    - getbytext
    - when
    - same
    - text
    - appears
    - multiple
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W03
incident_count: 0
last_triggered: None
legacy_pack: test-hygiene
related_rule: R-094
tags:
  - safety
  - ui
trigger_count: 0
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
