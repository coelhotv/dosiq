# AP-A01 — Make ANY code change without creating a feature branch FIRST

**Category:** Adherence
**Status:** active
**Related Rule:** R-065
**Applies To:** all

## Problem

Code ends up on `main` without review, history/audit trail lost, violates deliver-sprint workflow Step 1

## Prevention

MANDATORY: `git checkout -b branch-name` BEFORE touching any files. This is non-negotiable Step 1.
