---
title: Make ANY code change without creating a feature branch FIRST
summary: >-
  Code ends up on `main` without review, history/audit trail lost, violates deliver-sprint workflow
  St
layer: warm
status: active
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - make
    - any
    - code
    - change
    - without
    - creating
    - feature
    - branch
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-A01
last_triggered: None
legacy_pack: review-validation
related_rule: R-065
tags:
  - adherence
trigger_count: 0
---

# AP-A01 — Make ANY code change without creating a feature branch FIRST

**Category:** Adherence
**Status:** active
**Related Rule:** R-065
**Applies To:** all

## Problem

Code ends up on `main` without review, history/audit trail lost, violates deliver-sprint workflow Step 1

## Prevention

MANDATORY: `git checkout -b branch-name` BEFORE touching any files. This is non-negotiable Step 1.
