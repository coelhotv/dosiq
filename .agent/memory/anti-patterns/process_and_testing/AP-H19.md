---
id: AP-H19
title: Removing core React Native imports during style refactor
summary: Accidentally removing View, Text, StyleSheet from imports when replacing them with semantic tokens. Causes ReferenceError in runtime.
applies_to:
  - mobile
  - refactor
tags:
  - safety
  - ui
  - tokens
trigger_count: 1
last_triggered: 2026-04-15
expiry_date: 2027-04-15
status: active
related_rule: None
layer: hot
bootstrap_default: True
pack: mobile-ux
---

Accidentally removing View, Text, StyleSheet from imports when replacing them with semantic tokens. Causes ReferenceError in runtime.