---
id: AP-W09
title: Refactor Dashboard.jsx handlers when a new component has incompatible interface
summary: High risk of breaking SmartAlerts, LogForm integrations in 932-line file
applies_to:
  - all
tags:
  - ui
  - react
  - interface
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-098
layer: cold
bootstrap_default: False
pack: design-ui
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
