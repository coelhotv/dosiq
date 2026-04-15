---
id: AP-H13
title: Read this.href inside URL.prototype.toString override on Hermes
summary: No Hermes, o getter nativo href chama toString() internamente. Substituir toString() e ler this.href dentro cria recursão infinita → RangeError: Maximum call stack size exceeded.
applies_to:
  - apps/mobile/polyfills.js
tags:
  - mobile
  - expo
  - hermes
  - polyfill
  - recursion
trigger_count: 1
last_triggered: 2026-04-14
expiry_date: 2027-04-14
status: active
related_rule: R-165
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
---

No Hermes, o getter nativo href chama toString() internamente. Substituir toString() e ler this.href dentro cria recursão infinita → RangeError: Maximum call stack size exceeded.