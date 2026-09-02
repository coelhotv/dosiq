---
title: Read this.href inside URL.prototype.toString override on Hermes
summary: >-
  No Hermes, o getter nativo href chama toString() internamente. Substituir toString() e ler
  this.href dentro cria recursão infinita → RangeError: Maximum call stack size exceeded.
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  keywords:
    - read
    - this
    - href
    - inside
    - url
    - prototype
    - tostring
    - override
legacy_tags:
  - apps/mobile/polyfills.js
bootstrap_default: false
expiry_date: "2027-04-14"
id: AP-H13
last_triggered: "2026-04-14"
legacy_pack: adherence-reporting-mobile
related_rule: R-165
tags:
  - mobile
  - expo
  - hermes
  - polyfill
  - recursion
trigger_count: 1
---

No Hermes, o getter nativo href chama toString() internamente. Substituir toString() e ler this.href dentro cria recursão infinita → RangeError: Maximum call stack size exceeded.