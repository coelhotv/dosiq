---
id: AP-W04
title: Import context (`useDashboardContext`, `DashboardProvider`) in a Wave 1 component
summary: Violates Wave 1 purity guardrail; couples component to context, breaking reuse
applies_to:
  - all
tags:
  - ui
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-095
layer: cold
bootstrap_default: False
pack: design-ui
---

# AP-W04 — Import context (`useDashboardContext`, `DashboardProvider`) in a Wave 1 component

**Category:** Ui
**Status:** active
**Related Rule:** R-095
**Applies To:** all

## Problem

Violates Wave 1 purity guardrail; couples component to context, breaking reuse

## Prevention

Wave 1 = props only. Context integration belongs in Onda 2 (parent passes data as props)
