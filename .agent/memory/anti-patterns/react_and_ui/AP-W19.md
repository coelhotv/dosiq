---
id: AP-W19
title: Assume stats object properties match component expectations without reading the context/hook that provides the data
summary: Component displays wrong values (e.g., ring gauge shows 0% adherence). useDashboard returns `score`,
applies_to:
  - all
tags:
  - ui
  - react
  - interface
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-134
layer: warm
bootstrap_default: False
pack: react-hooks
---

# AP-W19 — Assume stats object properties match component expectations without reading the context/hook that provides the data

**Category:** Ui
**Status:** active
**Related Rule:** R-134
**Applies To:** all

## Problem

Component displays wrong values (e.g., ring gauge shows 0% adherence). useDashboard returns `score`, `currentStreak` but code references `adherenceScore`, `streak`.

## Prevention

Always read the hook's return type comment and destructure property names exactly as documented. Map property names explicitly if hook returns different names than component expects.
