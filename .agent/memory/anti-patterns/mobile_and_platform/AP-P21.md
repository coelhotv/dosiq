---
title: Using `takenAnytime` as the numerator for clinical adherence summaries
summary: >-
  A protocol with multiple time slots per day counts the same day several times, inflating
  `taken/expe
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - takenAnytime
  keywords:
    - using
    - takenanytime
    - numerator
    - for
    - clinical
    - adherence
    - summaries
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P21
incident_count: 0
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-026
tags:
  - performance
  - datetime
trigger_count: 0
---

# AP-P21 — Using `takenAnytime` as the numerator for clinical adherence summaries

**Category:** Performance
**Status:** active
**Related Rule:** R-026
**Applies To:** all

## Problem

A protocol with multiple time slots per day counts the same day several times, inflating `taken/expected` (e.g., `360/360` or `466/466` from a real 30d period)

## Prevention

Use the actual dose-count metric (`taken`) for consultation/PDF summaries; reserve `takenAnytime` for auxiliary heuristics only
