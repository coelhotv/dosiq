---
id: AP-A03
title: Filter logs with `medicine_id` in addition to `protocol_id`
summary: When 2+ protocols exist for same medicine, logs bleed between them. Protocol A's adherence = Protoco
applies_to:
  - all
tags:
  - adherence
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-113
layer: cold
bootstrap_default: False
pack: adherence-reporting-mobile
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
