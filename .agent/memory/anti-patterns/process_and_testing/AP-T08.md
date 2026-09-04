---
title: Run full test suite on every commit locally
summary: Blocks development, 6.5 min wait time discourages testing
layer: cold
status: archived
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - run
    - full
    - test
    - suite
    - every
    - commit
    - locally
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-T08
incident_count: 0
last_triggered: None
legacy_pack: review-validation
related_rule: R-051
tags:
  - testing
  - datetime
trigger_count: 0
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
