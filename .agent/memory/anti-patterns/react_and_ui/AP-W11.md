---
id: AP-W11
title: Pass a prop to an internal sub-component JSX but omit it from the function signature
summary: Prop silently ignored; feature broken with no error or warning in runtime or tests
applies_to:
  - all
tags:
  - ui
  - react
  - safety
  - interface
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-103
layer: warm
bootstrap_default: False
pack: react-hooks
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
