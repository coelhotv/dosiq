---
id: AP-W20
title: Copy modal-based registration flow from original Dashboard without considering lighter 1-click gesture patterns in other components
summary: Worse UX: 4 clicks (button → modal open → form fill → confirm) instead of 1-click direct registratio
applies_to:
  - all
tags:
  - ui
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-135
layer: cold
bootstrap_default: False
pack: design-ui
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
