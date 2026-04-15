---
id: AP-W13
title: Leave dead code (old states, memos, handlers) after replacing a JSX section
summary: CI lint failure; confuses future agents about what is active
applies_to:
  - all
tags:
  - safety
  - ui
  - state
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-105
layer: warm
bootstrap_default: False
pack: design-ui
---

# AP-W13 — Leave dead code (old states, memos, handlers) after replacing a JSX section

**Category:** Ui
**Status:** active
**Related Rule:** R-105
**Applies To:** all

## Problem

CI lint failure; confuses future agents about what is active

## Prevention

Run `grep -n "NomeVarAntiga"` post-replacement; `npm run lint` before commit
