---
title: Use pt-EU strings ('Registar', 'registados') in a pt-BR app
summary: Mobile code had pt-EU Portuguese (registar/registados) instead of pt-BR (tomar/t...
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  keywords:
    - use
    - strings
    - registar
    - registados
    - app
legacy_tags:
  - apps/mobile/src/
bootstrap_default: false
expiry_date: "2027-04-14"
id: AP-H16
incident_count: 2
last_referenced: "2026-04-17"
last_triggered: "2026-04-14"
legacy_pack: mobile-ux
related_rule: R-166
tags:
  - mobile
  - ux
  - i18n
  - language
trigger_count: 1
---

Mobile code had pt-EU Portuguese (registar/registados) instead of pt-BR (tomar/tomados). Creates cognitive dissonance for Brazilian users who see 'Tomar' on web but 'Registar' on mobile. Always check web component language before writing mobile UI text. See R-166 (P-011).