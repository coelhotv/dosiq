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
