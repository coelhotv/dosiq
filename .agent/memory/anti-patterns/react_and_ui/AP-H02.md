---
title: Passar IDs ao invés de objetos para treatmentPlanService no LogForm
summary: Passar IDs ao invés de objetos para treatmentPlanService no LogForm
layer: cold
status: archived
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - treatmentPlans
  keywords:
    - passar
    - ids
    - invés
    - objetos
    - treatmentplanservice
    - logform
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-H02
incident_count: 0
last_triggered: None
legacy_pack: react-hooks
related_rule: R-133
tags:
  - history
trigger_count: 0
---

# AP-H02 — Passar IDs ao invés de objetos para treatmentPlanService no LogForm

**Category:** History
**Status:** active
**Related Rule:** R-133
**Applies To:** all

## Problem



## Prevention




**O que é:** Derivar array de IDs de planos de tratamento a partir de `protocols` e passar para LogForm como `treatmentPlans`.

**Problema:** LogForm espera objetos completos `{id, name, protocols:[{active, medicine_id, dosage_per_intake}]}` para montar o dropdown. Passar só IDs resulta em "0 remédios" e nomes vazios.

**Correção:** Chamar `cachedTreatmentPlanService.getAll()` para obter os objetos completos.

---
