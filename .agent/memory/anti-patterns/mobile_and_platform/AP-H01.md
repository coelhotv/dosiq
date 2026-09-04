---
title: Usar quantity_taken como valor do dosage pill
summary: Usar quantity_taken como valor do dosage pill
layer: cold
status: archived
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - quantity_taken
    - getByMonthSlim
    - log.quantity_taken
  keywords:
    - usar
    - quantity_taken
    - valor
    - dosage
    - pill
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-H01
incident_count: 1
last_referenced: "2026-08-30"
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-149
tags:
  - history
trigger_count: 0
---

# AP-H01 — Usar quantity_taken como valor do dosage pill

**Category:** History
**Status:** active
**Related Rule:** R-149
**Applies To:** all

## Problem



## Prevention




**O que é:** Exibir `log.quantity_taken` como o valor de dosagem do remédio no HistoryLogCard.

**Problema:** `quantity_taken` é quantos comprimidos foram tomados naquela dose, não a dosagem unitária do remédio. Mostra "1mg" quando deveria mostrar "10mg".

**Correção:** Usar `log.medicine?.dosage_per_pill + log.medicine?.dosage_unit` para o pill de dosagem. `quantity_taken` vai para a linha de "N comprimidos".

**Requer:** `getByMonthSlim` deve incluir `medicine(dosage_per_pill, dosage_unit)` no select.

---
