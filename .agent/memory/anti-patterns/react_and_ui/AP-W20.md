---
title: >-
  Copy modal-based registration flow from original Dashboard without considering lighter 1-click
  gesture patterns in other components
summary: >-
  Worse UX: 4 clicks (button → modal open → form fill → confirm) instead of 1-click direct
  registratio
layer: cold
status: archived
applies_to:
  paths:
    - apps/web/**
  keywords:
    - copy
    - modal
    - based
    - registration
    - flow
    - from
    - original
    - dashboard
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W20
incident_count: 1
last_referenced: "2026-03-25"
last_triggered: None
legacy_pack: design-ui
related_rule: R-135
tags:
  - ui
  - react
trigger_count: 0
---

# AP-W20 — Copy modal-based registration flow from original Dashboard without considering lighter 1-click gesture patterns in other components

**Category:** Ui
**Status:** active
**Related Rule:** R-135
**Applies To:** all

## Problem

Worse UX: 4 clicks (button → modal open → form fill → confirm) instead of 1-click direct registration. Unnecessary UI complexity for common action.

## Prevention

Study existing gesture/quick-action patterns (SwipeRegisterItem, PriorityCard) before implementing new registration flows. Prefer direct `logService.create()` calls for primary actions. Modal flows reserved for complex, multi-step operations only.
