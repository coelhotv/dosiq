---
title: Refactor Dashboard.jsx handlers when a new component has incompatible interface
summary: High risk of breaking SmartAlerts, LogForm integrations in 932-line file
layer: cold
status: archived
applies_to:
  paths:
    - apps/web/**
  keywords:
    - refactor
    - dashboard
    - jsx
    - handlers
    - when
    - new
    - component
    - has
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W09
incident_count: 1
last_referenced: "2026-03-05"
last_triggered: None
legacy_pack: design-ui
related_rule: R-098
tags:
  - ui
  - react
  - interface
trigger_count: 0
---

# AP-W09 — Refactor Dashboard.jsx handlers when a new component has incompatible interface

**Category:** Ui
**Status:** active
**Related Rule:** R-098
**Applies To:** all

## Problem

High risk of breaking SmartAlerts, LogForm integrations in 932-line file

## Prevention

Create thin adapter functions (D-01 pattern); never refactor existing handlers for new components
