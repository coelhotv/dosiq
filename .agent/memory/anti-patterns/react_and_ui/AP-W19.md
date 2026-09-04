---
title: >-
  Assume stats object properties match component expectations without reading the context/hook that
  provides the data
summary: >-
  Component displays wrong values (e.g., ring gauge shows 0% adherence). useDashboard returns
  `score`,
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - adherenceScore
    - currentStreak
  keywords:
    - assume
    - stats
    - object
    - properties
    - match
    - component
    - expectations
    - without
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W19
incident_count: 1
last_referenced: "2026-03-25"
last_triggered: None
legacy_pack: react-hooks
related_rule: R-134
tags:
  - ui
  - react
  - interface
trigger_count: 0
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
