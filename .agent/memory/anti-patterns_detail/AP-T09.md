# AP-T09 — Ignore timeout warnings on slow tests

**Category:** Testing
**Status:** active
**Related Rule:** —
**Applies To:** all

## Problem

Tests >15s can trigger 10-min kill switch in agents, fail CI

## Prevention

Optimize slow tests: mock expensive operations, use fake timers, reduce setup overhead
