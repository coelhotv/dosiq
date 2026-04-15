---
id: AP-A01
title: Make ANY code change without creating a feature branch FIRST
summary: Code ends up on `main` without review, history/audit trail lost, violates deliver-sprint workflow St
applies_to:
  - all
tags:
  - adherence
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-065
layer: warm
bootstrap_default: False
pack: review-validation
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
