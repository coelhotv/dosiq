---
title: Edit a file referenced in spec without verifying the actual path first
summary: Edit goes to wrong file; bug remains; spec can have stale paths
layer: warm
status: active
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - edit
    - file
    - referenced
    - spec
    - without
    - verifying
    - actual
    - path
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W01
last_triggered: None
legacy_pack: file-integrity
related_rule: R-092
tags:
  - safety
  - ui
trigger_count: 0
---

# AP-W01 — Edit a file referenced in spec without verifying the actual path first

**Category:** Ui
**Status:** active
**Related Rule:** R-092
**Applies To:** all

## Problem

Edit goes to wrong file; bug remains; spec can have stale paths

## Prevention

Always `find src -name "*File*" -type f` before editing any spec-referenced file
