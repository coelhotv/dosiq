---
title: >-
  Copy component usage from existing code without inspecting the actual prop interface (e.g.,
  LogForm usage from Dashboard.jsx)
summary: >-
  TypeError at runtime: "Cannot read properties of undefined" when component tries to access props
  wit
layer: cold
status: archived
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - initialValues
    - onCancel
    - onSave
    - onSuccess
    - prefillData
    - treatmentPlans
  keywords:
    - copy
    - component
    - usage
    - from
    - existing
    - code
    - without
    - inspecting
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W18
incident_count: 1
last_referenced: "2026-03-25"
last_triggered: None
legacy_pack: react-hooks
related_rule: R-133
tags:
  - ui
  - react
  - safety
  - interface
trigger_count: 0
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
