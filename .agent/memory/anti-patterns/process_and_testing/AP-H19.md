---
title: Removing core React Native imports during style refactor
summary: >-
  Accidentally removing View, Text, StyleSheet from imports when replacing them with semantic
  tokens. Causes ReferenceError in runtime.
layer: warm
status: active
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - removing
    - core
    - react
    - native
    - imports
    - during
    - style
    - refactor
legacy_tags:
  - mobile
  - refactor
bootstrap_default: true
expiry_date: "2027-04-15"
id: AP-H19
last_triggered: "2026-04-15"
legacy_pack: mobile-ux
related_rule: None
tags:
  - safety
  - ui
  - tokens
trigger_count: 1
---

Accidentally removing View, Text, StyleSheet from imports when replacing them with semantic tokens. Causes ReferenceError in runtime.