---
id: AP-H16
title: Use pt-EU strings ('Registar', 'registados') in a pt-BR app
summary: Mobile code had pt-EU Portuguese (registar/registados) instead of pt-BR (tomar/tomados). Creates cognitive dissonance for Brazilian users who see 'Tomar' on web but 'Registar' on mobile. Always check web component language before writing mobile UI text. See R-166 (P-011).
applies_to:
  - apps/mobile/src/
tags:
  - mobile
  - ux
  - i18n
  - language
trigger_count: 1
last_triggered: 2026-04-14
expiry_date: 2027-04-14
status: active
related_rule: R-166
layer: warm
bootstrap_default: False
pack: mobile-ux
---

Mobile code had pt-EU Portuguese (registar/registados) instead of pt-BR (tomar/tomados). Creates cognitive dissonance for Brazilian users who see 'Tomar' on web but 'Registar' on mobile. Always check web component language before writing mobile UI text. See R-166 (P-011).