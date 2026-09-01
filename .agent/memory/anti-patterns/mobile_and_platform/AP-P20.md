---
title: Show `"Paciente"` even when the user email already provides a safe local-part fallback
summary: >-
  The consultation PDF loses clinical usefulness and makes it harder to distinguish which patient
  was
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  keywords:
    - show
    - paciente
    - even
    - when
    - user
    - email
    - already
    - provides
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P20
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-148
tags:
  - performance
trigger_count: 0
---

# AP-P20 — Show `"Paciente"` even when the user email already provides a safe local-part fallback

**Category:** Performance
**Status:** active
**Related Rule:** R-148
**Applies To:** all

## Problem

The consultation PDF loses clinical usefulness and makes it harder to distinguish which patient was exported

## Prevention

Derive the display label from the email handle, then fall back to `"Paciente"` only if no handle exists
