---
title: Filter logs with `medicine_id` in addition to `protocol_id`
summary: >-
  When 2+ protocols exist for same medicine, logs bleed between them. Protocol A's adherence =
  Protoco
layer: cold
status: archived
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - medicine_id
    - protocol_id
  keywords:
    - filter
    - logs
    - with
    - medicine_id
    - addition
    - protocol_id
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-A03
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-113
tags:
  - adherence
trigger_count: 0
---

# AP-A03 — Filter logs with `medicine_id` in addition to `protocol_id`

**Category:** Adherence
**Status:** active
**Related Rule:** \
**Applies To:** all

## Problem

When 2+ protocols exist for same medicine, logs bleed between them. Protocol A's adherence = Protocol A's logs + Protocol B's logs.

## Prevention

Use ONLY `log.protocol_id === protocolId`, remove any `\
