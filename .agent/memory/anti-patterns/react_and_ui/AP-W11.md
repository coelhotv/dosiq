---
title: Pass a prop to an internal sub-component JSX but omit it from the function signature
summary: Prop silently ignored; feature broken with no error or warning in runtime or tests
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  keywords:
    - pass
    - prop
    - internal
    - sub
    - component
    - jsx
    - but
    - omit
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W11
incident_count: 1
last_referenced: "2026-03-05"
last_triggered: None
legacy_pack: react-hooks
related_rule: R-103
tags:
  - ui
  - react
  - safety
  - interface
trigger_count: 0
---

# AP-W11 — Pass a prop to an internal sub-component JSX but omit it from the function signature

**Category:** Ui
**Status:** active
**Related Rule:** R-103
**Applies To:** all

## Problem

Prop silently ignored; feature broken with no error or warning in runtime or tests

## Prevention

List ALL interaction props in destructuring; add click/interaction test for each callback
