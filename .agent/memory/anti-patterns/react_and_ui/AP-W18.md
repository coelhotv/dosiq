---
id: AP-W18
title: Copy component usage from existing code without inspecting the actual prop interface (e.g., LogForm usage from Dashboard.jsx)
summary: TypeError at runtime: "Cannot read properties of undefined" when component tries to access props wit
applies_to:
  - all
tags:
  - ui
  - react
  - safety
  - interface
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-133
layer: cold
bootstrap_default: False
pack: react-hooks
---

# AP-W18 — Copy component usage from existing code without inspecting the actual prop interface (e.g., LogForm usage from Dashboard.jsx)

**Category:** Ui
**Status:** active
**Related Rule:** R-133
**Applies To:** all

## Problem

TypeError at runtime: "Cannot read properties of undefined" when component tries to access props with wrong names. E.g., LogForm expects `protocols`, `treatmentPlans`, `initialValues`, `onSave`, `onCancel` but receives `prefillData`, `onSuccess`.

## Prevention

Always read the component's destructuring signature in the source code BEFORE copy-pasting usage. Verify all expected props are provided and named correctly. Match prop names exactly.
