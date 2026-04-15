---
id: AP-T08
title: Run full test suite on every commit locally
summary: Blocks development, 6.5 min wait time discourages testing
applies_to:
  - all
tags:
  - testing
  - datetime
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-051
layer: cold
bootstrap_default: False
pack: review-validation
---

# AP-T08 — Run full test suite on every commit locally

**Category:** Testing
**Status:** active
**Related Rule:** R-051
**Applies To:** all

## Problem

Blocks development, 6.5 min wait time discourages testing

## Prevention

Use `npm run test:changed` (30s) before commit, full suite only on push or before merge
