---
title: Import context (`useDashboardContext`, `DashboardProvider`) in a Wave 1 component
summary: Violates Wave 1 purity guardrail; couples component to context, breaking reuse
layer: cold
status: archived
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - DashboardProvider
    - useDashboardContext
  keywords:
    - import
    - context
    - usedashboardcontext
    - dashboardprovider
    - wave
    - component
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W04
incident_count: 0
last_triggered: None
legacy_pack: design-ui
related_rule: R-095
tags:
  - ui
  - react
trigger_count: 0
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
