---
title: INSERT into columns that don't exist
summary: Database error, failed writes
layer: warm
status: active
applies_to:
  paths:
    - packages/**
    - "**/schemas/**"
  keywords:
    - insert
    - into
    - columns
    - that
    - don
    - exist
legacy_tags:
  - all
bootstrap_default: true
expiry_date: "2027-04-08"
id: AP-S08
last_triggered: None
legacy_pack: schema-data
related_rule: R-089
tags:
  - safety
  - database
  - schema
trigger_count: 0
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
