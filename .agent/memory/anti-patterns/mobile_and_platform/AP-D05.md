---
title: Slice no prop de doses do PriorityDoseCard
summary: Slice no prop de doses do PriorityDoseCard
layer: cold
status: archived
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - PriorityDoseCard
    - handleRegisterDosesAll
    - onRegisterAll
    - urgentDoses
    - urgentDoses.slice
  keywords:
    - slice
    - prop
    - doses
    - prioritydosecard
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-D05
incident_count: 0
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-155
tags:
  - interface
  - design
trigger_count: 0
---

# AP-D05 — Slice no prop de doses do PriorityDoseCard

**Category:** Design
**Status:** active
**Related Rule:** R-155
**Applies To:** all

## Problem



## Prevention




**O que é:** Passar `doses={urgentDoses.slice(0, 3)}` para `PriorityDoseCard`.

**Consequência:** O CTA "Confirmar Agora" registra apenas 3 doses — as demais da faixa horária ficam sem registro, mesmo que o usuário pense que confirmou tudo.

**Prevenção:**
```jsx
// ❌ ERRADO — slice no prop
<PriorityDoseCard doses={urgentDoses.slice(0, 3)} />

// ✅ CORRETO — passa todos; componente faz slice interno só para display
<PriorityDoseCard doses={urgentDoses} onRegisterAll={handleRegisterDosesAll} />
```

**Relacionado:** R-155

---
