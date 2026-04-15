---
id: AP-W01
title: Edit a file referenced in spec without verifying the actual path first
summary: Edit goes to wrong file; bug remains; spec can have stale paths
applies_to:
  - all
tags:
  - safety
  - ui
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-092
layer: warm
bootstrap_default: False
pack: file-integrity
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
