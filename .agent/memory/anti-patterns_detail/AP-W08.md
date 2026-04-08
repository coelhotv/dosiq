# AP-W08 — Use `onRegister(medicineId, dosage)` interface from SwipeRegisterItem as if it were `onRegisterDose(protocolId, dosage)`

**Category:** Ui
**Status:** active
**Related Rule:** R-102
**Applies To:** all

## Problem

Wrong ID passed to logService.create(); log references wrong protocol

## Prevention

Always wrap: `onRegister={(_medicineId, dosage) => onRegisterDose(dose.protocolId, dosage)}`
