---
id: AP-W15
title: Initialize state with `useState(() => derivedHook())` assuming it will stay reactive
summary: State is stale if derived value changes after mount (e.g., `defaultViewMode` after complexity change
applies_to:
  - all
tags:
  - ui
  - state
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-107
layer: warm
bootstrap_default: False
pack: react-hooks
---

# AP-W15 — Initialize state with `useState(() => derivedHook())` assuming it will stay reactive

**Category:** Ui
**Status:** active
**Related Rule:** R-107
**Applies To:** all

## Problem

State is stale if derived value changes after mount (e.g., `defaultViewMode` after complexity change)

## Prevention

Add `useEffect(() => { if (!savedPref) setState(derived) }, [derived])`
