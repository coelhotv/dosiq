---
title: >-
  Use `onRegister(medicineId, dosage)` interface from SwipeRegisterItem as if it were
  `onRegisterDose(protocolId, dosage)`
summary: Wrong ID passed to logService.create(); log references wrong protocol
layer: cold
status: archived
applies_to:
  paths:
    - apps/web/**
  keywords:
    - use
    - onregister
    - medicineid
    - dosage
    - interface
    - from
    - swiperegisteritem
    - were
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W08
last_triggered: None
legacy_pack: design-ui
related_rule: R-102
tags:
  - ui
  - interface
trigger_count: 0
---

# AP-W08 — Use `onRegister(medicineId, dosage)` interface from SwipeRegisterItem as if it were `onRegisterDose(protocolId, dosage)`

**Category:** Ui
**Status:** active
**Related Rule:** R-102
**Applies To:** all

## Problem

Wrong ID passed to logService.create(); log references wrong protocol

## Prevention

Always wrap: `onRegister={(_medicineId, dosage) => onRegisterDose(dose.protocolId, dosage)}`
