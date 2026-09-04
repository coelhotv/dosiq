---
title: >-
  Reuse monthly totals in each daily PDF row or mix pill-quantity math into a table labeled as daily
  dose adherence
summary: >-
  Daily rows show inflated totals like `360/360` or mismatch the clinical meaning of `Tomadas` vs
  `Esp
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  keywords:
    - reuse
    - monthly
    - totals
    - each
    - daily
    - pdf
    - row
    - mix
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P19
incident_count: 0
last_triggered: None
legacy_pack: design-ui
related_rule: R-147
tags:
  - performance
trigger_count: 0
---

# AP-P19 — Reuse monthly totals in each daily PDF row or mix pill-quantity math into a table labeled as daily dose adherence

**Category:** Performance
**Status:** active
**Related Rule:** R-147
**Applies To:** all

## Problem

Daily rows show inflated totals like `360/360` or mismatch the clinical meaning of `Tomadas` vs `Esperadas`, confusing patients and clinicians

## Prevention

For the PDF daily table, compare expected vs completed dose events for that specific day only, excluding future slots; if quantity-based adherence is needed, expose it in a separate metric with explicit labeling
