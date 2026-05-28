---
id: AP-S08
title: INSERT into columns that don't exist
summary: Database error, failed writes
applies_to:
  - all
tags:
  - safety
  - database
  - schema
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-089
layer: hot
bootstrap_default: True
pack: schema-data
---

# AP-S08 — INSERT into columns that don't exist

**Category:** Schema
**Status:** active
**Related Rule:** R-089
**Applies To:** all

## Problem

Database error, failed writes

## Prevention

Verify schema before INSERT; keep migrations synchronized
