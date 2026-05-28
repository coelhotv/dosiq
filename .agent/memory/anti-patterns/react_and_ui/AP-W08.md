---
id: AP-W08
title: Use `onRegister(medicineId, dosage)` interface from SwipeRegisterItem as if it were `onRegisterDose(protocolId, dosage)`
summary: Wrong ID passed to logService.create(); log references wrong protocol
applies_to:
  - all
tags:
  - ui
  - interface
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-102
layer: cold
bootstrap_default: False
pack: design-ui
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
